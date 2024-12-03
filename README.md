# AWS Typescript Toolkit

Common utils, types, exceptions, constants and services 

Features:

- Base handler for lamba resource
- Common:
  - Utils
  - Types 
  - Services
  - Exceptions:
    - Backend Error
    - Database Error
  - Config
    - getConfig() 
      - VERSION 
      - DEPLOYMENT_NAME 
      - TABLE_NAME 
      - PLATFORM_PREFIX

## Installation

```bash
yarn install aws-typescript-toolkit
```

## Exports 
```typescript
// cloud-development
import { Config, Construct, Types, Utils } from 'aws-typescript-toolkit/cloud-development';

const { createConstructs, setResources, ConstructMiddleware } = Construct;
const { createFileNameHandler, constructName, generateName, getConstructs } = Utils;
const { StackProps, ConstructTypes, IConstruct, INewConstruct } = Types;
const { getConfig } = Config;
const { VERSION, DEPLOYMENT_NAME, PLATFORM_PREFIX, TABLE_NAME } = getConfig();


// software-development
import { BaseHandler, Repository, Service, Services, Exceptions } from 'aws-typescript-toolkit/software-development';

const { Bucket, DeepLink, Dynamodb, Event, Logger, SSM } = Services;
const { BaseError, BackendError, DatabaseError } = Exceptions;
```

## Construct
Utilities to simplify setting up of constructs.

- createConstructs

_Usage is similar to `createSlice` from [Redux Toolkit](https://redux-toolkit.js.org/api/createSlice)._
```typescript
// cdk/constructs/lambda/EntityName.ts

import { Construct, Config } from 'aws-typescript-toolkit/cloud-development';
import { Services } from 'aws-typescript-toolkit/software-development';

const { createConstructs } = Construct;
const { SSMActions } = Services.SSM
const { getConfig } = Config;

const { TABLE_NAME } = getConfig();

const EntityName = createConstructs({
  type: NodejsFunction,
  constructs: {
    handleHelloWorld: {
      props: { 
        environment: { TABLE_NAME } 
      }, 
      output: true,
      callback: async (scope, construct) => {
        // Add event source trigger
        const eventBusArn = Fn.importValue('EventsPlatform-EventBus');
        const eventBus = EventBus.fromEventBusArn(scope, 'ImportedEventBus', eventBusArn);
        eventBus.grantPutEventsTo(construct);

        // Fetch param store
        const ssmClient = new SSMActions();
        const parameterInput = {
          Name: `/${DEPLOYMENT_NAME}/key`,
        };
        const parameter = await ssmClient.getParameter(parameterInput);

        // Add Environments
        construct.addEnvironment('BRANCH_KEY', parameter?.Value ?? '');
        construct.addEnvironment('EVENT_BUS_NAME', eventBus.eventBusName);
      },
    },
  },
});

export const { handleHelloWorld } = EntityName;
```

## Config
Gets the config file of the cdk project `platform.json`.

**Expected Content**
```json
{
  "name": "cdk-project-name",
  "version": "1.0.0",
  "table_name": "cdk-project-table"
}
```

To get the these values: `VERSION`, `DEPLOYMENT_NAME`, `PLATFORM_PREFIX`, `TABLE_PREFIX`, `TABLE_NAME`, from the config file, call the `getConfig()`. 