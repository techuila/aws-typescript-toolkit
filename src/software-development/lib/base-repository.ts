import { QueryCommandInput } from '@aws-sdk/client-dynamodb';
import { BackendError } from '../exceptions';
import { CustomQueryItemInput, DynamoDbActions } from '../services/dynamodb';


export type PrimaryKeys = { PK: string; SK?: string };

export type Entity<T> = Partial<T> & { id: string };

export interface IBaseRepository<T> {
  create(primaryKeys: PrimaryKeys, entity: Partial<T>): Promise<T>;
  createBulk(entities: Entity<T>[]): Promise<T[]>;
  updateByPrimaryKeys(primaryKeys: PrimaryKeys, entity: Partial<T>): Promise<T>;
  deleteByPrimaryKeys(primaryKeys: PrimaryKeys): Promise<T>;
  findManyByPrimaryKeys<K extends {}>(
    queryOptions: Omit<CustomQueryItemInput<K>, 'TableName'>,
    options?: Partial<QueryCommandInput>
  ): Promise<T[]>;
  findOneByPrimaryKeys(primaryKeys: PrimaryKeys): Promise<T>;
  findManyFromIndex<IK>(IndexName: string, indexKeys: IK): Promise<Partial<T>[] | undefined>;
}

export abstract class BaseRepository<T> implements IBaseRepository<T> {
  constructor(protected TableName: string, protected db = new DynamoDbActions()) {
    this.create = this.create.bind(this);
    this.findOneByPrimaryKeys = this.findOneByPrimaryKeys.bind(this);
    this.findManyFromIndex = this.findManyFromIndex.bind(this);
    this.updateByPrimaryKeys = this.updateByPrimaryKeys.bind(this);
    this.deleteByPrimaryKeys = this.deleteByPrimaryKeys.bind(this);
  }

  async create(primaryKeys: PrimaryKeys, entity: Entity<T>): Promise<T> {
    const input = {
      TableName: this.TableName,
      Item: this.db.marshall({
        ...primaryKeys,
        ...entity
      })
    };

    const result = (await this.db.create(input)) as T;
    return result;
  }

  async createBulk(entities: Entity<T>[]): Promise<T[]> {
    const result = await this.db.bulkRequest(this.TableName, 'PutRequest', entities);
    return result?.ItemCollectionMetrics?.ItemCollectionKey as T[];
  }

  async findOneByPrimaryKeys(primaryKeys: PrimaryKeys): Promise<T> {
    const input = {
      TableName: this.TableName,
      Key: this.db.marshall(primaryKeys)
    };

    const result = (await this.db.get(input)) as T;
    return result;
  }

  async findManyByPrimaryKeys<K extends {}>(
    queryOptions: Omit<CustomQueryItemInput<K>, 'TableName'>,
    options?: Partial<QueryCommandInput>
  ): Promise<T[]> {
    const result = await this.db.customQuery(
      {
        TableName: this.TableName,
        ...queryOptions
      },
      options
    );
    return (result.Items ?? []) as T[];
  }

  async findManyFromIndex<IK>(IndexName: string, IndexKeys: IK): Promise<Entity<T>[] | undefined> {
    const indexKeys = IndexKeys as unknown as {
      PrimaryKey: Record<string, any>;
      SortKey?: Record<string, any>;
    };
    if (typeof IndexName !== 'undefined') {
      const { Items } = await this.db.customQuery({
        TableName: this.TableName,
        IndexName: IndexName as string,
        ...indexKeys
      });
      return Items as Entity<T>[];
    } else {
      throw new BackendError("Missing 'IndexName' property from 'findManyFromIndex' method.");
    }
  }

  async updateByPrimaryKeys(primaryKeys: PrimaryKeys, entity: Entity<T>): Promise<T> {
    delete (entity as any).id;
    delete (entity as any).PK;
    delete (entity as any).SK;

    const input = {
      TableName: this.TableName,
      Key: this.db.marshall(primaryKeys),
      ReturnValues: this.db.DynamoReturnValues.ALL_NEW,
      ...this.db.updateExpression(entity)
    };

    const result = (await this.db.update(input)) as T;
    return result;
  }

  async deleteByPrimaryKeys(primaryKeys: PrimaryKeys): Promise<T> {
    const input = {
      TableName: this.TableName,
      Key: this.db.marshall(primaryKeys),
      ReturnValues: this.db.DynamoReturnValues.ALL_OLD
    };

    const result = (await this.db.delete(input)) as T;
    return result;
  }
}
