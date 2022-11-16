import { serializeError } from 'serialize-error';
import { IAWSLambdaHandler, gql } from '../types';
import { Log, Logger } from '../services/logger';
import { BackendError } from '../exceptions';
import { Context } from 'aws-lambda';

// Base handler used by other lambda handlers.
export default abstract class BaseHandler extends Logger {
  public __typename: any;

  // Function to be overridden by the handlers
  abstract perform<T extends IAWSLambdaHandler>(...args: Parameters<T>): any;
  abstract perform(event: any, context: Context): any;
  abstract perform(event: any): any;

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

      if (this.strict) {
        throw err;
      }

      return serializeError(error);
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
