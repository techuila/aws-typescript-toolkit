import { ValueOf, gql } from '../types';

export class BaseError extends Error {
  __typename: string;
  message: string;
  body: {
    status: number;
    details: string | undefined;
  };

  constructor(status: number, message: string, __typename: string, stack?: string) {
    super(message);
    this.message = message;
    this.__typename = __typename;
    this.stack = stack || this.stack;
    this.body = {
      status,
      details: message
    };
  }
}

export class BackendError extends BaseError {
  constructor(error: unknown) {
    const message = `Internal server error.`;
    const stack = error instanceof Error ? error.stack : undefined;
    super(500, message, gql.CommonErrors.BACKEND_ERROR, stack);
  }
}

export class DatabaseError extends BaseError {
  constructor(error: unknown) {
    const message = `Database error occurred.`;
    const stack = error instanceof Error ? error.stack : undefined;
    super(500, message, gql.CommonErrors.DATABASE_ERROR, stack);
  }
}
