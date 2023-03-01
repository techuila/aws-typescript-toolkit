import { BackendError } from './../exceptions/index';
import {
  AttributeValue,
  BatchWriteItemCommand,
  CreateTableCommand,
  CreateTableCommandInput,
  DeleteItemCommand,
  DeleteItemCommandInput,
  DeleteTableCommand,
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandInput,
  PutItemCommand,
  PutItemCommandInput,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
  UpdateItemCommand,
  UpdateItemCommandInput
} from '@aws-sdk/client-dynamodb';
import { DynamoReturnValues } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { CatchDatabaseException } from '../utils';
import { v4 as uuidv4 } from 'uuid';
import { ValueOf } from '../types';
import { join } from 'path';

// Definitions - Start
const Functions = {
  ATTRIBUTE_EXISTS: 'attribute_exists',
  ATTRIBUTE_NOT_EXISTS: 'attribute_not_exists',
  ATTRIBUTE_TYPE: 'attribute_type',
  BEGINS_WITH: 'begins_with',
  CONTAINS: 'contains',
  SIZE: 'size'
} as const;

type Function = { function?: ValueOf<typeof Functions> };
export type Keys = {
  PrimaryKey: Record<string, any> & Function;
  SortKey?: Record<string, any> & Function;
};

export type VerifyItemInput = {
  TableName: string;
  IndexName?: string;
} & Keys;

type ExpressionData<T> = T extends Record<string, any>
  ? { [K in keyof T]: { key: `#${string & K}`; value: `:${string & K}` } }
  : null;

export type CustomQueryItemInput<T> = {
  FilterExpression?: {
    data: T;
    callback: (data: ExpressionData<T>) => string;
  };
} & VerifyItemInput;

interface ExpressionAttributeInput {
  data?: Record<string, any>;
  isKey?: boolean;
}

interface ConditionKeysInput {
  keys: Array<string>;
  data: Record<string, string>;
}
interface GenerateExpressionInput {
  KeyCondition: ConditionKeysInput & { functions: Record<string, ValueOf<typeof Functions>> };
  FilterCondition?: ConditionKeysInput & { callback: (data: Record<string, string>) => string };
}

type RequestType = 'PutRequest' | 'DeleteRequest';

// Definitions - End

const ddbOptions = process.env.JEST_WORKER_ID
  ? {
      region: 'local-env',
      endpoint: 'http://localhost:8000',
      sslEnabled: false,
      credentials: {
        accessKeyId: 'fakeMyKeyId',
        secretAccessKey: 'fakeSecretAccessKey'
      }
    }
  : {};

export const ddbClient = new DynamoDBClient(ddbOptions);

export class DynamoDbActions {
  public TABLE_PREFIX = 'ORGANIZATION';
  public client = ddbClient;
  public marshall = marshall;
  public unmarshall = unmarshall;
  public uuidv4 = uuidv4;
  public DynamoReturnValues = DynamoReturnValues;
  public updateExpression = updateExpression;
  public setKeyExpression = setKeyExpression;
  public setExpressionAttribute = setExpressionAttribute;

  constructor() {}

  @CatchDatabaseException
  async query(params: QueryCommandInput) {
    const command = new QueryCommand(params);
    const data = await this.client.send(command);

    return data;
  }

  // @TODO Make `PrimaryKey` and `SortKey` type-safe that depends on the `IndexName`
  @CatchDatabaseException
  async customQuery<T extends {}>(
    { TableName, IndexName, PrimaryKey, SortKey, FilterExpression }: CustomQueryItemInput<T>,
    Options?: Partial<QueryCommandInput>
  ): Promise<Omit<QueryCommandOutput, 'Items'> & { Items: Record<string, any>[] | undefined }> {
    let filterCondition = {};
    const { keys, data, functions } = getKeysAndData({ PrimaryKey, SortKey });
    let ExpressionAttributeNames = {};
    let ExpressionAttributeValues = {};

    if (Options) {
      ExpressionAttributeNames = Options.ExpressionAttributeNames ?? {};
      ExpressionAttributeValues = Options.ExpressionAttributeValues ?? {};

      delete Options.ExpressionAttributeNames;
      delete Options.ExpressionAttributeValues;
    }

    if (FilterExpression) {
      const { data, callback } = FilterExpression;
      const keys = Object.keys(data);
      filterCondition = { FilterCondition: { keys, data, callback } };
    }

    const expressions = generateExpressions({ KeyCondition: { keys, data, functions }, ...filterCondition });

    expressions.ExpressionAttributeNames = {
      ...expressions.ExpressionAttributeNames,
      ...ExpressionAttributeNames
    };

    expressions.ExpressionAttributeValues = {
      ...expressions.ExpressionAttributeValues,
      ...ExpressionAttributeValues
    };

    if (!Object.keys(expressions.ExpressionAttributeNames).length) {
      delete expressions.ExpressionAttributeNames;
    }

    const params = {
      TableName,
      IndexName,
      ...Options,
      ...expressions
    };
    console.log('[AWS-TYPESCRIPT-TOOLKIT]');
    console.log(params);

    const result = await this.query(params);
    const Items = result.Items ? this.unmarshallArray(result.Items) : undefined;

    delete result.Items;

    return { Items, ...result };
  }

  @CatchDatabaseException
  async get(params: GetItemCommandInput) {
    const command = new GetItemCommand(params);
    const data = await this.client.send(command);

    return this.unmarshall(data.Item ?? {});
  }

  @CatchDatabaseException
  async create(params: PutItemCommandInput) {
    const command = new PutItemCommand(params);
    const data = await this.client.send(command);

    return this.unmarshall(params.Item ?? {});
  }

  @CatchDatabaseException
  async bulkRequest<T extends Record<string, any>[]>(tableName: string, requestType: RequestType, items: T) {
    const params = {
      RequestItems: {
        [tableName]: items.map((item) => ({
          [requestType]: {
            Item: marshall(item)
          }
        }))
      }
    };

    const command = new BatchWriteItemCommand(params);
    const data = await this.client.send(command);
    return data;
  }

  @CatchDatabaseException
  async update(params: UpdateItemCommandInput) {
    const command = new UpdateItemCommand(params);
    const data = await this.client.send(command);

    return this.unmarshall(data.Attributes ?? {});
  }

  @CatchDatabaseException
  async delete(params: DeleteItemCommandInput) {
    const command = new DeleteItemCommand(params);
    const data = await this.client.send(command);

    return this.unmarshall(data.Attributes ?? {});
  }

  @CatchDatabaseException
  async verify({ TableName, IndexName, PrimaryKey, SortKey }: VerifyItemInput): Promise<boolean> {
    const { keys, data, functions } = getKeysAndData({ PrimaryKey, SortKey });

    const params = {
      TableName,
      IndexName,
      ...generateExpressions({ KeyCondition: { keys, data, functions } })
    };

    const { Items } = await this.query(params);

    return Items ? Items.length > 0 : false;
  }

  unmarshallArray(Items: Record<string, AttributeValue>[]) {
    return Items.map((item) => unmarshall(item));
  }
}

export const dbHelper = {
  createTable: async () => {
    try {
      const config: { tables: CreateTableCommandInput[] } = require(join(process.cwd(), 'jest-dynamodb-config'));
      for (const params of config.tables) {
        const command = new CreateTableCommand(params);
        await ddbClient.send(command);
      }
    } catch (err) {
      throw err;
    }
  },
  deleteTable: async (TableName: string) => {
    const command = new DeleteTableCommand({ TableName });
    await ddbClient.send(command);
  },
  resetTable: async (TableName: string) => {
    await dbHelper.deleteTable(TableName);
    await dbHelper.createTable();
  },
  populateItems: async (TableName: string, items: (object & { PK: string; SK: string })[]) => {
    const params = {
      RequestItems: {
        [TableName]: items.map((item) => ({
          PutRequest: {
            Item: marshall(item)
          }
        }))
      }
    };
    const command = new BatchWriteItemCommand(params);
    await ddbClient.send(command);
  },
  deleteItems: async (TableName: string, Keys: { PK: string; SK: string }[]) => {
    const params = {
      RequestItems: {
        [TableName]: Keys.map((key) => ({
          DeleteRequest: {
            Key: marshall(key)
          }
        }))
      }
    };
    const command = new BatchWriteItemCommand(params);
    await ddbClient.send(command);
  }
};

export function getKeysAndData({ PrimaryKey, SortKey }: Keys) {
  const primaryFn = PrimaryKey?.function;
  const sortFn = SortKey?.function;

  delete PrimaryKey.function;
  delete SortKey?.function;

  const [primaryKey] = Object.keys(PrimaryKey);
  const [sortKey] = Object.keys(SortKey ?? {});

  const data = {
    ...PrimaryKey,
    ...(SortKey && SortKey)
  };

  const functions = {
    ...(primaryFn && { [primaryKey]: primaryFn }),
    ...(sortFn && { [sortKey]: sortFn })
  };

  const keys = Object.keys(data);
  return {
    data,
    keys,
    functions
  };
}

/**
 * Generates KeyConditionExpression, ExpressionAttributeValues, ExpressionAttributeNames (Optional).
 * 
 * @typedef {{ 
 *  keys: Array<string>; 
 *  data: Record<string, string>; 
 * }}   ConditionKeysInput
 * @typedef {{
 *  KeyCondition:     ConditionKeysInput & { functions: ValueOf<typeof Functions>};
 *  FilterCondition:  ConditionKeysInput & { callback: (data: Record<string, string>) => string };
 * }}   GenerateExpressionInput

 * @link    https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.html#Query.FilterExpression
 * @link    https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/interfaces/querycommandinput.html
 * @fires   setExpressionAttribute
 * @fires   setKeyExpression
 * @param   {GenerateExpressionInput} Obj
 * @param   {ConditionKeysInput}      [Obj.KeyCondition]      -   Data for generating `KeyConditionExpression`
 * @param   {ConditionKeysInput}      [Obj.FilterCondition]   -   Data for generating `FilterConditionExpression`
 * @returns {
 *  KeyConditionExpression:     string 
 *  ExpressionAttributeValues:  Record<string, AttributeValue> 
 *  ExpressionAttributeNames:   Record<string, string> | undefined
 * } 
 */
export function generateExpressions({ KeyCondition, FilterCondition }: GenerateExpressionInput) {
  const keyConditionAttributeValues = setExpressionAttribute({ ...KeyCondition, isKey: true });
  const filterConditionAttributeValues = FilterCondition ? setExpressionAttribute(FilterCondition) : {};
  const ExpressionAttributeNames = FilterCondition
    ? { ExpressionAttributeNames: setExpressionAttribute({ keys: FilterCondition.keys }) }
    : {};
  const FilterExpression = FilterCondition
    ? {
        FilterExpression: FilterCondition.callback(
          FilterCondition.keys.reduce(
            (prev: {}, key: string) => ({ ...prev, [key]: { key: `#${key}`, value: `:${key}` } }),
            {}
          )
        )
      }
    : {};

  return {
    KeyConditionExpression: setKeyExpression(
      setExpressionAttribute({ keys: KeyCondition.keys, isKey: true }),
      KeyCondition.functions
    ),
    ExpressionAttributeValues: marshall({ ...keyConditionAttributeValues, ...filterConditionAttributeValues }),
    ...ExpressionAttributeNames,
    ...FilterExpression
  };
}

/**
 * Generates expressions for Update Command on DynamodbClient.
 *
 * @link      https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-dynamodb/interfaces/updateitemcommandinput.html
 * @fires     setExpressionAttribute
 * @param     {Record<string, any>} data  -   Data to be transformed to KeyConditionExpression / expressionAttribute[Names\Values]
 * @returns   {
 *  UpdateExpression:           string,
 *  ExpressionAttributeNames:   Record<string, string>,
 *  ExpressionAttributeValues:  Record<string, AttributeValue>
 * }
 */
export function updateExpression(data: any) {
  const keys = Object.keys(data);
  const namePrefix = '#',
    valuePrefix = ':';

  return {
    UpdateExpression: `SET ${keys.map((key) => `${namePrefix}${key} = ${valuePrefix}${key}`).join(', ')}`,
    ExpressionAttributeNames: setExpressionAttribute({ keys }),
    ExpressionAttributeValues: marshall(setExpressionAttribute({ keys, data }))
  };
}

/**
 * Function assumes that `data` received from the argument is a transformed expression object from the `setEpxressionAttribute` function.
 *
 * @link      https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.OperatorsAndFunctions.html#Expressions.OperatorsAndFunctions.Functions
 * @fires     setFunction
 * @param     {Record<string, any>}       data      -   Data to be transformed to KeyConditionExpression / expressionAttribute[Names\Values]
 * @param     {ValueOf<typeof Functions>} functions -   Functions associated with keys
 * @returns   {string}                              -   Flattens object to a string with the format `<key[0]> = <value[0]>, <key[1]> = <value[2]>, ...`
 */
export function setKeyExpression(
  data: Record<string, string>,
  functions: Record<string, ValueOf<typeof Functions>>
): string {
  return Object.entries(data)
    .reduce((previousValue: string[], [key, value]: [string, string]) => {
      const _func = functions[key];
      return previousValue.concat(_func ? setFunction(_func, key, value) : `${key} = ${value}`);
    }, [])
    .join(' AND ');
}

/**
 * Places `key` and `value` variables on the appropriate arguments of the function.
 *
 * @link    https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.OperatorsAndFunctions.html#Expressions.OperatorsAndFunctions.Functions
 * @param   {ValueOf<typeof Functions>  name    -   Name of the function that will concatenate with the `key`` and `value`.
 * @param   {string}                    key     -   Key of PrimaryKey/SortKey
 * @param   {string}                    value   -   Value of PrimaryKey/SortKey
 * @returns {string}
 */
export function setFunction(name: ValueOf<typeof Functions>, key: string, value: string) {
  switch (name) {
    case 'attribute_exists':
      return `${name}(${key})`;
    case 'attribute_not_exists':
      return `${name}(${key})`;
    case 'attribute_type':
      return `${name}(${key}, ${value})`;
    case 'begins_with':
      return `${name}(${key}, ${value})`;
    case 'contains':
      return `${name}(${key}, ${value})`;
    case 'size':
      return `${name}(${key})`;
    default:
      throw new BackendError(`DynamoDB function "${name}" doesn't exist.`);
  }
}

/**
 *
 * @fires   expressionAttributeCallback
 * @param   {string[]}                  keys        -   Keys of `data`
 * @param   {Record<string, any>}       data        -   Data to be transformed to KeyConditionExpression / expressionAttribute[Names\Values]
 * @param   {boolean}                   [obj.isKey] -   Indicate if the data to be transformed is for Key Expressions
 * @returns {Record<string, any>[]}
 */
export function setExpressionAttribute({ keys, data, isKey }: ExpressionAttributeInput & { keys: Array<string> }) {
  return keys.reduce(expressionAttributeCallback({ data, isKey }), {});
}

/**
 * This is intended for the [keys].`reduce` callback function, that receives 1 argument ({ data: Record<string, any>, isKey: boolean }).
 * The function maps the key and the `data` passed from the argument, and transforms into a new object.
 *
 * @link    https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.html
 * @param   {ExpressionAttributeInput}  obj
 * @param   {Record<string, any>}       [obj.data]  -   Data to be transformed to KeyConditionExpression / expressionAttribute[Names\Values]
 * @param   {boolean}                   [obj.isKey] -   Indicate if the data to be transformed is for Key Expressions
 * @return  {Record<string, any>}                   -   Check Result Table for more info
 *
 *
 * Result Table
 *
 * | data  | isKey | property | value         | Expression inteded for    |
 * | ----- | ----- | -------- | ------------- | ------------------------- |
 * | true  | true  | `:<key>` | `data[<key>]` | ExpressionAttributeValues |
 * | false | true  | `<key>`  | `:<key>`      | KeyConditionExpression    |
 * | true  | false | `:<key>` | `data[<key>]` | ExpressionAttributeValues |
 * | false | false | `#<key>` | `<key>`       | ExpressionAttributeNames  |
 */
export function expressionAttributeCallback({ data, isKey }: ExpressionAttributeInput) {
  const prefix = data ? ':' : '#';

  return (acc: {}, key: string) => {
    const property = isKey ? `${data ? ':' : ''}${key}` : `${prefix}${key}`;
    const value = data ? data[key] : `${isKey ? ':' : ''}${key}`;

    return {
      ...acc,
      [property]: value
    };
  };
}
