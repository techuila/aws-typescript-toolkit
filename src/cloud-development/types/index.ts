import { CfnGraphQLApi } from 'aws-cdk-lib/aws-appsync';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';


export type ValueOf<T> = T[keyof T];

export type StackProps = [Construct, string, any?];

export type ConstructTypes = NodejsFunction | Bucket | Table | CfnGraphQLApi;

export interface IConstruct<T extends ConstructTypes> {
  new (...args: StackProps): T;
}

export type INewConstruct<T extends ConstructTypes> = T;
export type IConstructs<T extends Record<string, ConstructTypes>> = {
  [K in keyof T]: GenericExtend<T[K]>;
};

export type Callback<T extends ConstructTypes> = (scope: Construct, construct: T, resources: Resources) => void;

export interface Resources {
  lambda?: IConstructs<Record<string, NodejsFunction>>;
  bucket?: IConstructs<Record<string, Bucket>>;
  dynamodb?: IConstructs<Record<string, Table>>;
  appsync?: IConstructs<Record<string, CfnGraphQLApi>>;
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
