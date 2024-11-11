import * as Sentry from '@sentry/aws-serverless';
//import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { ValueOf, levels } from './../types/index';
import { Callback, Context } from 'aws-lambda';

const DEPLOYMENT_NAME =
  JSON.parse(process.env.CDK_CONTEXT_JSON ?? '{}').deployment_name ?? process.env.DEPLOYMENT_NAME ?? '';
console.log('DEPLOYMENT_NAME', DEPLOYMENT_NAME);
console.log(
  `JSON.parse(process.env.CDK_CONTEXT_JSON ?? '{}').deployment_name`,
  JSON.parse(process.env.CDK_CONTEXT_JSON ?? '{}').deployment_name
);
console.log('process.env.DEPLOYMENT_NAME', process.env.DEPLOYMENT_NAME);

const shouldInitializeSentry = DEPLOYMENT_NAME === 'production' || DEPLOYMENT_NAME === 'nightly';
console.log('shouldInitializeSentry', shouldInitializeSentry);

Sentry.init({
  dsn: 'https://eb1e53f2bc0babfb8d9255f59b665a1e@o4507405535739904.ingest.us.sentry.io/4507961792462848',
  //integrations: [
  //nodeProfilingIntegration(),
  //],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions

  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
  environment: DEPLOYMENT_NAME
});

type LogData = {
  body: Record<string, string>;
  level: ValueOf<typeof levels>;
  service: string;
  response: string | Record<string, any> | unknown;
  stack?: string;
} & Context;

export class Logger {
  public filename: string;

  constructor() {}

  log(data: Record<string, any>, event?: string) {
    console[data.level === 'ERROR' ? 'error' : 'info'](JSON.stringify({ ...data, event }, null, 2));
  }
}

const logger = new Logger();

export const Log = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const method = descriptor.value;
  const log = logger.log;

  descriptor.value = function (...args: any[]) {
    const _context = this; // Capture the context of the method being decorated
    const [event, context] = args;
    const logData: LogData = {
      ...context,
      body: event,
      level: 'INFO',
      response: ''
    };

    // Set the user context for Sentry if available
    if (event.username) {
      Sentry.setUser({ username: event.username, email: event.email });
    }

    return Sentry.wrapHandler(async (...innerArgs: any[]) => {
      try {
        const result = await method.apply(_context, innerArgs); // Use the captured context

        logData.response = result;
        log(logData, 'TriggerHandler');

        return result;
      } catch (error) {
        logData.level = 'ERROR';
        logData.response = error;

        if (error instanceof Error) {
          logData.stack = error.stack;
          Sentry.captureException(error);
        }

        log(logData);
        throw error;
      }
    })(...(args as [any, Context, Callback<any>]));
  };

  return descriptor;
};
