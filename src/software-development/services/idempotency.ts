import { Sha256 } from '@aws-crypto/sha256-js';
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandInput,
  PutItemCommand,
  PutItemCommandInput,
  UpdateItemCommand,
  UpdateItemCommandInput
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { serializeError } from 'serialize-error';
import { DatabaseError } from '../exceptions';

/**
 * Decorator to make a function idempotent by caching its result in a DynamoDB table.
 * @params
 * - scope: A string to namespace the cache key, typically the function name.
 * - payloadHash: Function to generate a hash from the function's arguments to use as the cache key.
 * - ttl: Time to live for the cache entry in seconds. Default is 600 seconds (10 minutes).
 */
export function makeIdempotent<T extends string[]>(scope: string, propertiesToHash: T, ttl = 600) {
  return function <N>(_target: N, _propertyKey: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (this: N, ...args: any) {
      const tableName = process.env.TABLE_NAME ?? '';

      const idempotencyCache = new IdempotencyCache(tableName);
      const payloadHash = await idempotencyCache.hashPayload(propertiesToHash, args[0]);
      const primaryKey: IdempotencyRecord['PK'] = `${scope}#${payloadHash}`;
      const data = await idempotencyCache.get(primaryKey);

      if (data) {
        return data;
      }

      const createIdempotencyRecordPromise = idempotencyCache.create(`${scope}#${payloadHash}`, null, ttl);

      // Call the original method and cache the result
      const originalMethodPromise = method.apply(this, args);

      // Run both promises in concurrency
      const [idempotencyRecord, result] = await Promise.allSettled([
        createIdempotencyRecordPromise,
        originalMethodPromise
      ]);
      const payload = {
        fulfilled: {
          status: 'COMPLETED' as IdempotencyStatus,
          response: (result as PromiseFulfilledResult<Record<string, any>>).value
        },
        rejected: {
          status: 'FAILED' as IdempotencyStatus,
          response: serializeError((result as PromiseRejectedResult).reason)
        }
      };

      if (idempotencyRecord.status === 'fulfilled') {
        await idempotencyCache.update(primaryKey, payload[result.status]);
      } else {
        // If we fail to create the idempotency record, we log the error but we don't block the original method result
        console.error('Failed to create idempotency record:', idempotencyRecord.reason);
      }

      return payload[result.status].response;
    };
  };
}

type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
type IdempotencyRecord = {
  PK: `${string}#${string}`;
  SK: 'IDEMPOTENCY_RECORD';
  status: IdempotencyStatus;
  response?: Record<string, any>;
  scope: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  ttl: number;
};

class IdempotencyCache {
  private tableName: string;
  private dynamoDbClient: DynamoDBClient;

  constructor(tableName: string) {
    this.tableName = tableName;
    this.dynamoDbClient = new DynamoDBClient({});
  }

  async hashPayload(propertiesToHash: string[], payload: Record<string, any>): Promise<string> {
    const payloadToHash = propertiesToHash.reduce((acc: Record<string, any>, prop: string) => {
      acc[prop] = payload[prop];
      return acc;
    }, {});

    const sha256 = new Sha256();
    sha256.update(JSON.stringify(payloadToHash));
    const hashBuffer = await sha256.digest();
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async get(primayKey: IdempotencyRecord['PK']): Promise<any | null> {
    const command: GetItemCommandInput = {
      TableName: this.tableName,
      Key: marshall({
        PK: primayKey,
        SK: 'IDEMPOTENCY_RECORD'
      })
    };

    const result = await this.dynamoDbClient.send(new GetItemCommand(command));
    const item = result.Item ? (unmarshall(result.Item) as IdempotencyRecord) : null;

    if (item) {
      if (item.status === 'IN_PROGRESS') {
        return {
          __typename: 'BackendError',
          message: 'Operation already in progress',
          details: {
            status: 409,
            details: 'Operation already in progress'
          }
        };
      } else {
        return item.response!;
      }
    }

    return null;
  }

  async create(primaryKey: IdempotencyRecord['PK'], value: any, ttl: number): Promise<void> {
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);
    const [scope, idempotencyKey] = primaryKey.split('#');
    const item: IdempotencyRecord = {
      PK: primaryKey,
      SK: 'IDEMPOTENCY_RECORD',
      status: 'IN_PROGRESS',
      response: value,
      scope: scope,
      idempotencyKey: idempotencyKey,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      ttl: nowSec + ttl
    };

    const command: PutItemCommandInput = {
      TableName: this.tableName,
      Item: marshall(item),
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
    };

    try {
      await this.dynamoDbClient.send(new PutItemCommand(command));
    } catch (error) {
      throw new DatabaseError(error);
    }
  }

  async update(
    primaryKey: IdempotencyRecord['PK'],
    payload: Required<Pick<IdempotencyRecord, 'status' | 'response'>>
  ): Promise<void> {
    const command: UpdateItemCommandInput = {
      TableName: this.tableName,
      Key: marshall({
        PK: primaryKey,
        SK: 'IDEMPOTENCY_RECORD'
      }),
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: marshall({
        ':status': payload.status,
        ':response': payload.response,
        ':updatedAt': new Date().toISOString(),
        ':inProgress': 'IN_PROGRESS'
      }),
      ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK) AND #status = :inProgress'
    };

    try {
      await this.dynamoDbClient.send(new UpdateItemCommand(command));
    } catch (error) {
      throw new DatabaseError(error);
    }
  }
}
