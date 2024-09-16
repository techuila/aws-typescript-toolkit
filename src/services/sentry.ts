import * as Sentry from "@sentry/aws-serverless";
import { nodeProfilingIntegration } from "@sentry/profiling-node";


Sentry.init({
  dsn: "https://eb1e53f2bc0babfb8d9255f59b665a1e@o4507405535739904.ingest.us.sentry.io/4507961792462848",
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions

  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

export const SentryWrapper = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const method = descriptor.value;

  descriptor.value = async function (...args: any) {
    const [event, context] = args;
    try {
      const result = await method.apply(this, args);

      return result;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };
};

