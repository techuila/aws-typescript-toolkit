import { CfnGraphQLApi } from 'aws-cdk-lib/aws-appsync';
import getCallerFile from 'get-caller-file';
import { ConstructTypes, IConstruct, IConstructs, Resources, _Construct, Callback, GenericExtend } from '../types';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { createFileNameHandler } from '../utils';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { resolve } from 'path';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Table } from 'aws-cdk-lib/aws-dynamodb';

type Constructs<T extends ConstructTypes> = Record<
  string,
  {
    props?: { [rest: string]: unknown };
    output?: boolean;
    entry?: string;
    callback?: Callback<T>;
  }
>;

export type ConstructMiddleware<T extends ConstructTypes> = (scope: Construct, id: string) => GenericExtend<T>;

interface CreateConstructsProps<T extends ConstructTypes, K> {
  type: IConstruct<T>;
  constructs: K;
}

export const createConstructs = <T extends ConstructTypes, K extends Constructs<T>>({
  type,
  constructs
}: CreateConstructsProps<T, K>): Record<keyof K, ConstructMiddleware<T>> => {
  const resourceNames = Object.keys(constructs) as (keyof typeof constructs)[];
  const _constructs = {} as Record<keyof K, ConstructMiddleware<T>>;

  const getParentDirectory = (path: string) => {
    return path.split('/').slice(0, -1).join('/');
  };

  for (const name of resourceNames) {
    _constructs[name] = (scope, id): GenericExtend<T> => {
      const filename = constructs[name]?.entry ?? `handlers/${String(name)}.ts`;
      const callback = constructs[name]?.callback;
      const _props = constructs[name]?.props ?? {};
      const output = constructs[name]?.output ?? null;
      let props = { ..._props };

      if (type.name === NodejsFunction.name) {
        const _entry = createFileNameHandler(
          resolve(`${getParentDirectory(getCallerFile())}`, '..', 'constructs', 'lambda'),
          filename
        );
        props = Object.assign(
          {
            functionName: id,
            entry: _entry,
            runtime: Runtime.NODEJS_14_X
          },
          _props
        );
      } else if (type.name === Bucket.name) {
        props = Object.assign(
          {
            versioned: false,
            bucketName: id,
            publicReadAccess: false,
            removalPolicy: RemovalPolicy.DESTROY
          },
          _props
        );
      } else if (type.name === CfnGraphQLApi.name) {
        props = Object.assign(
          {
            name: id
          },
          _props
        );
      } else if (type.name === Table.name) {
        props = Object.assign(
          {
            tableName: id
          },
          _props
        );
      }

      const Construct: new <T extends ConstructTypes>(
        scope: Construct,
        Model: T,
        callback?: Callback<T>
      ) => GenericExtend<T> = _Construct as any;

      const construct = new Construct(scope, new type(scope, id, props), callback);
      if (output && construct instanceof NodejsFunction) {
        const cfnID = id + '-arn';
        new CfnOutput(scope, cfnID, {
          value: construct.functionArn,
          exportName: cfnID
        });
      }

      return construct;
    };
  }

  return _constructs;
};

export const setResources = (resources: Resources) => {
  const resources_arr: IConstructs<Record<string, ConstructTypes>>[] = Object.values(resources);

  for (const resource of resources_arr) {
    const constructs = Object.values(resource);

    for (const construct of constructs) {
      if (construct?.callback) {
        construct.callback(resources);
      }
    }
  }
};
