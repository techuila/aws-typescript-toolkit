import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { ConstructMiddleware } from '../construct';
import { DatabaseError } from '../exceptions';
import { ConstructTypes } from '../types';
import getConfig from '../config';
import { resolve } from 'path';
import * as fs from 'fs';

export const createFileNameHandler = (dir: string, filePath: string): string => {
  const partialPath = filePath.split('/') || [];
  const filenameArray = partialPath.pop()?.split('.') || [];
  const ext = filenameArray.pop();
  const filename = filenameArray.join('.');

  partialPath.push(filename);

  return `${dir}/${partialPath.join('/')}.${ext}`;
};

interface GenerateName {
  prefix?: string;
  name: string;
}

export const streamToString = (stream: any) =>
  new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

export const flattenInput = (obj: Record<string, any>) => {
  const { input, ...rest } = obj;
  return { ...input, ...rest };
};

export const constructName = ({ prefix, name }: GenerateName) => {
  const _prefix = prefix ? prefix + '-' : '';
  return _prefix + name.toLowerCase();
};

export const generateName = ({ prefix, name, withoutVersion }: GenerateName & { withoutVersion?: boolean }) => {
  const { VERSION, DEPLOYMENT_NAME } = getConfig();
  let version = '';
  const newName = name[0].toLowerCase() + name.substring(1);

  if (!withoutVersion) {
    version = '-' + VERSION;
  }

  return `${prefix}${version}-${DEPLOYMENT_NAME}-${newName}`;
};

export const getConstructs = async <T extends ConstructTypes>(dir: string) => {
  const files = fs.readdirSync(dir).filter((file) => !fs.lstatSync(resolve(dir, file)).isDirectory());
  const constructs = [] as {
    construct: ConstructMiddleware<T>;
    name: string;
  }[];
  for (const file of files) {
    const Constructs = await import(resolve(dir, file)).then(
      <K extends Record<string, ConstructMiddleware<T>>>(e: K) => e
    );
    for (const construct of Object.entries(Constructs) as [string, ConstructMiddleware<T>][]) {
      constructs.push({ construct: construct[1], name: construct[0] });
    }
  }
  return constructs;
};

export function CatchDatabaseException(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      if (!isConditionalException(error)) throw new DatabaseError(error);
      throw error;
    }
  };
}

export const isConditionalException = (error: unknown) => error instanceof ConditionalCheckFailedException;
