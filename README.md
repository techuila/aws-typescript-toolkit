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
import { Services, BaseHandler, Constants, Construct, Exceptions, Types, Utils } from 'aws-typescript-toolkit';

const { Bucket, DeepLink, Dynamodb, Event, Logger, SSM } = Service;
const { VERSION, DEPLOYMENT_NAME, PLATFORM_PREFIX, TABLE_NAME } = Constants;
const { createConstructs, setResources, ConstructMiddleware } = Construct;
const { BaseError, BackendError, DatabaseError } = Exceptions;
const { createFileNameHandler, streamToString, flattenInput, constructName, generateName, getConstructs } = Utils;
const { ValueOf, IAWSLambdaHandler, GqlInput, StackProps, ConstructTypes, IConstruct, INewConstruct, Callback, GenericExtend, gql } = Types;
```

## Construct
Utilities to simplify setting up of constructs.

- createConstructs

_Usage is similar to `createSlice` from [Redux Toolkit](https://redux-toolkit.js.org/api/createSlice)._
```typescript
// cdk/constructs/lambda/EntityName.ts

import { Construct, Services, Constants } from 'aws-typescript-toolkit'

const { createConstructs } = Construct;
const { SSMActions } = Services.SSM
const { DEPLOYMENT_NAME } = Constants;

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

        // Fetch param stores:
        // 1. Branch.io key
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