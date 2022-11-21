import { APIGatewayProxyResultV2, Context, Callback as ICallback } from 'aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CfnGraphQLApi } from 'aws-cdk-lib/aws-appsync';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export type OperationType = 'Query' | 'Mutation';
export type CognitoAuth = { cognito_auth_token: Record<string, any> };
export type AppsyncResolverEvent<T extends OperationType, I> = (T extends 'Query'
  ? { [K in keyof I]: I[K] }
  : { input: I }) &
  CognitoAuth;

export type ValueOf<T> = T[keyof T];

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

export type StackProps = [Construct, string, any?];

export type ConstructTypes = NodejsFunction | Bucket | Table | CfnGraphQLApi;

export interface IConstruct<T extends ConstructTypes> {
  new (...args: StackProps): T;
}

export type INewConstruct<T extends ConstructTypes> = T;
export interface IConstructs<T extends ConstructTypes> {
  [key: string]: GenericExtend<T>;
}

export type Callback<T extends ConstructTypes> = (scope: Construct, construct: T, resources: Resources) => void;

export interface Resources {
  lambda?: IConstructs<NodejsFunction>;
  bucket?: IConstructs<Bucket>;
  dynamodb?: IConstructs<Table>;
  appsync?: IConstructs<CfnGraphQLApi>;
}

export type GenericExtend<T extends ConstructTypes> = T & { callback?: (resources: Resources) => void };

// Workaround for extending generic class
export class _Construct<T extends ConstructTypes> {
  constructor(scope: Construct, Model: T, callback?: Callback<T>) {
    const additional = callback
      ? {
          callback: (resources: Resources) => {
            callback(scope, Model, resources);
          }
        }
      : {};
    Object.assign(Model, additional);
    return Object.create(Model);
  }
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
