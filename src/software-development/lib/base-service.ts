import { v4 as uuidv4 } from 'uuid';

import { Entity, IBaseRepository } from './base-repository';
import { Keys } from '../services/dynamodb';


export type PrimaryKeys = { PK: string; SK?: string };
export type GetPrimaryKeys = PrimaryKeys & { id: string };

export abstract class BaseService<RT extends { id: string }> {
  protected repo: IBaseRepository<RT>;
  protected uuidv4 = uuidv4;

  constructor() {
    this.create = this.create.bind(this);
    this.findOneByPrimaryKeys = this.findOneByPrimaryKeys.bind(this);
    this.updateByPrimaryKeys = this.updateByPrimaryKeys.bind(this);
    this.deleteByPrimaryKeys = this.deleteByPrimaryKeys.bind(this);
  }

  abstract getPrimaryKeys(PK?: string, SK?: string): GetPrimaryKeys;

  async create(primaryKeys: PrimaryKeys, entity: Entity<RT>): Promise<RT> {
    const _entity = await this.repo.create(primaryKeys, entity);
    return _entity;
  }

  async createBulk(primaryKey: string, entities: Partial<RT>[]): Promise<Partial<RT>[]> {
    let items = [];
    for (const entity of entities) {
      const { id, ...primaryKeys } = this.getPrimaryKeys(primaryKey);
      items.push({ ...primaryKeys, ...entity, id });
    }

    await this.repo.createBulk(items);
    return items;
  }

  async updateByPrimaryKeys(primaryKeys: PrimaryKeys, entity: Entity<RT>): Promise<RT> {
    const _entity = await this.repo.updateByPrimaryKeys(primaryKeys, entity);
    return _entity;
  }

  async deleteByPrimaryKeys(primaryKeys: PrimaryKeys): Promise<RT> {
    const _entity = await this.repo.deleteByPrimaryKeys(primaryKeys);
    return _entity;
  }

  async findManyByPrimaryKeys(primaryKeys: Keys): Promise<RT[]> {
    const _entity = await this.repo.findManyByPrimaryKeys(primaryKeys);
    return _entity;
  }

  async findOneByPrimaryKeys(primaryKeys: PrimaryKeys): Promise<RT> {
    const _entity = await this.repo.findOneByPrimaryKeys(primaryKeys);
    return _entity;
  }

  /* Common Methods */
  genIndexKeys<PK extends {}, SK extends {}>(PrimaryKey: PK, SortKey: SK): { PrimaryKey: PK; SortKey: SK };
  genIndexKeys<PK extends {}>(PrimaryKey: PK): { PrimaryKey: PK };
  genIndexKeys<PK extends {}, SK extends {}>(PrimaryKey: PK, SortKey?: SK) {
    return SortKey ? { PrimaryKey, SortKey } : { PrimaryKey };
  }
}
