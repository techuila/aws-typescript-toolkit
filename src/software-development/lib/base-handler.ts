import { AppConfigDataClient, StartConfigurationSessionCommand, GetLatestConfigurationCommand } from '@aws-sdk/client-appconfigdata';
import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
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
  protected ssmParameters: Record<string, string> | null = null;

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
      // await this.loadSSMParameters();
      // await this.loadFeatureFlags();
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

  protected async loadFeatureFlags() {
    if (!this.ssmParameters) {
      throw new BackendError('SSM parameters not loaded');
    }

    const client = new AppConfigDataClient({ region: process.env.REGION });
    console.error(process.env)

    try {
      const startSessionCommand = new StartConfigurationSessionCommand({
        ApplicationIdentifier: this.ssmParameters['APPCONFIG_APPLICATION_ID'],
        EnvironmentIdentifier: this.ssmParameters['APPCONFIG_ENVIRONMENT_ID'],
        ConfigurationProfileIdentifier: this.ssmParameters['APPCONFIG_PROFILE_ID'],
      });

      const sessionResponse = await client.send(startSessionCommand);
      const getConfigCommand = new GetLatestConfigurationCommand({
        ConfigurationToken: sessionResponse.InitialConfigurationToken,
      });

      const configResponse = await client.send(getConfigCommand);
      this.featureFlags = JSON.parse(new TextDecoder().decode(configResponse.Configuration)) as Record<string, any>;

      //this.log(`AppConfig feature flags loaded: ${JSON.stringify(this.featureFlags)}`);
    } catch (error) {
      //this.log(`Error loading AppConfig feature flags: ${error}`);
      throw new BackendError('Failed to load AppConfig feature flags');
    }
  }

  // Load environment variables from SSM Parameter Store
  protected async loadSSMParameters() {
    const stageName = process.env.STAGE_NAME
    const ssmClient = new SSMClient({ region: process.env.REGION || 'us-east-1' });

    try {
      const command = new GetParametersCommand({
        Names: [
          `/appconfig/${stageName}/configtrials/application-id`,
          `/appconfig/${stageName}/configtrials/config1/profile-id`,
          `/appconfig/${stageName}/configtrials/environment-id`,
        ],
        WithDecryption: true,
      });

      const response = await ssmClient.send(command);

      if (!response.Parameters) {
        throw new BackendError('Failed to fetch SSM parameters');
      }

      // Map parameters into a key-value object
      this.ssmParameters = response.Parameters.reduce((acc, param) => {
        const name = param.Name?.split('/').pop(); // Extract the key from the parameter path
        if (name && param.Value) {
          acc[name.toUpperCase()] = param.Value;
        }
        return acc;
      }, {} as Record<string, string>);

      // Debugging (optional)
      // this.log(`SSM parameters loaded: ${JSON.stringify(this.ssmParameters)}`);
    } catch (error) {
      throw new BackendError(`Failed to load SSM parameters: ${error instanceof Error ? error.message : error}`);
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
