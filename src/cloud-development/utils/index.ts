
import * as fs from 'fs';
import { resolve } from 'path';

import getConfig from '../config';
import { ConstructMiddleware } from '../construct';
import { ConstructTypes } from '../types';



interface GenerateName {
  prefix?: string;
  name: string;
}

export const createFileNameHandler = (dir: string, filePath: string): string => {
  const partialPath = filePath.split('/') || [];
  const filenameArray = partialPath.pop()?.split('.') || [];
  const ext = filenameArray.pop();
  const filename = filenameArray.join('.');

  partialPath.push(filename);

  return `${dir}/${partialPath.join('/')}.${ext}`;
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
