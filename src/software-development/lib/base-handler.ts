import { AppConfigDataClient, StartConfigurationSessionCommand, GetLatestConfigurationCommand } from '@aws-sdk/client-appconfigdata';
import * as Sentry from '@sentry/aws-serverless';
import { Callback, Context } from 'aws-lambda';
import { serializeError } from 'serialize-error';

import { BackendError } from '../exceptions';
import { Log, Logger } from '../services/logger';
import { IAWSLambdaHandler, gql } from '../types';


// Base handler used by other lambda handlers.
export default abstract class BaseHandler extends Logger {
  public __typename: any;
  protected featureFlags: Record<string, any> | null = null;

  // Function to be overridden by the handlers
  abstract perform(event: any, context: Context, callback: Callback): any;

  constructor(protected strict = false) {
    super();
    // Bind this context to handler method
    this.handler = this.handler.bind(this);
  }

  // Wrap perform(), invoked by AWS Lambda.
  @Log
  async handler(...args: Parameters<IAWSLambdaHandler>) {
    try {
      const result = await this.perform(...args);
      const hasData = result && isObjectNotEmpty(result);
      const typename = this.__typename ? { __typename: this.__typename } : {};

      return hasData ? Object.assign(result, typename) : null;
    } catch (error) {
      let err;
      if (error instanceof Error) {
        if (error.constructor.name !== 'Error') {
          err = error;
        }
      } else {
        err = new BackendError(error);
      }

      Sentry.captureException(error);

      if (this.strict) {
        throw err;
      }

      return serializeError(error);
    }
  }

  protected async loadFeatureFlags(app_id: string, env_id: string, profile_id: string) {
    const client = new AppConfigDataClient({ region: process.env.REGION });

    try {
      const startSessionCommand = new StartConfigurationSessionCommand({
        ApplicationIdentifier: app_id,
        EnvironmentIdentifier: env_id,
        ConfigurationProfileIdentifier: profile_id,
      });

      const sessionResponse = await client.send(startSessionCommand);
      const getConfigCommand = new GetLatestConfigurationCommand({
        ConfigurationToken: sessionResponse.InitialConfigurationToken,
      });

      const configResponse = await client.send(getConfigCommand);
      this.featureFlags = JSON.parse(new TextDecoder().decode(configResponse.Configuration)) as Record<string, any>;

    } catch (error) {
      throw new BackendError('Failed to load AppConfig feature flags');
    }
  }
}

function isObjectNotEmpty(data: Record<string, any>) {
  const isNotEmpty = (_data: Record<string, any>) => Object.entries(_data).length > 0;
  return (
    isNotEmpty(data) &&
    Object.values(data).some((val) =>
      Array.isArray(val)
        ? val.length > 0
        : typeof val === 'object' && val !== null
        ? isNotEmpty(val)
        : typeof val === 'boolean'
        ? true
        : typeof val === 'number'
        ? true
        : val
    )
  );
}
