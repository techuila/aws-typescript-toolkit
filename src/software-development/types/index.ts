import { APIGatewayProxyResultV2, Context, Callback as ICallback } from 'aws-lambda';


export type ValueOf<T> = T[keyof T];

export type OperationType = 'Query' | 'Mutation';
export type CognitoAuth = { cognito_auth_token: Record<string, any> };
export type AppsyncResolverEvent<T extends OperationType, I> = (T extends 'Query'
  ? { [K in keyof I]: I[K] }
  : { input: I }) &
  CognitoAuth;

export type IAWSLambdaHandler = (
  event: any,
  context: Context,
  callback: ICallback<APIGatewayProxyResultV2>
) => Promise<APIGatewayProxyResultV2<any>>;

export interface GqlInput {
  input: {
    [key: string]: any;
  };
}

export const gql = {
  CommonErrors: {
    BACKEND_ERROR: 'BackendError',
    DATABASE_ERROR: 'DatabaseError',
    UNAUTHORIZED_ERROR: 'UnauthorizedError'
  }
} as const;

export const levels = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
} as const;
