import 'jest';
import { APIGatewayProxyResultV2, Callback, Context } from 'aws-lambda';

import { BackendError } from '../../src/software-development/exceptions';
import { BaseHandler } from '../../src/software-development/lib';
import { gql } from '../../src/software-development/types';
import { makeIdempotent } from '../../src/software-development/services/idempotency';
import { dbHelper } from '../../src/software-development/services/dynamodb';

const context = {} as Context;
const callback: Callback<APIGatewayProxyResultV2> = () => {};

const TABLE_NAME = 'idempotency-table';

describe('Test Idempotency', () => {
  beforeEach(async () => {
    process.env = { ...process.env, TABLE_NAME };
    await dbHelper.resetDatabase();
  });

  it('should return IN_PROGRESS error on 2nd request', async () => {
    const data = {
      name: 'John Doe',
      age: 30,
      email: 'john@gmail.com'
    };

    class Test extends BaseHandler {
      @makeIdempotent('testIdempotency', ['name', 'age', 'email'])
      async perform(event: any) {
        return await new Promise((resolve) => setTimeout(() => resolve(event), 100));
      }
    }

    const t = new Test();

    // fire the first call
    const p1 = t.handler(data, context, callback);

    // give it a head-start so it can write the idempotency lock
    await new Promise((r) => setTimeout(r, 100));

    // second call with the same intent
    const p2 = t.handler(data, context, callback);

    // Wait for both without short-circuiting
    const [r1, r2] = await Promise.allSettled([p1, p2]);

    // First call should succeed
    expect(r1.status).toBe('fulfilled');
    expect((r1 as PromiseFulfilledResult<any>).value).toMatchObject(data);

    // Second call should be rejected with the IN_PROGRESS response
    expect(r2.status).toBe('fulfilled');
    expect((r2 as PromiseFulfilledResult<any>).value).toMatchObject({
      __typename: 'BackendError',
      message: 'Operation already in progress'
    });
  });

  it('should return data without re-running side effect on 2nd request', async () => {
    const data = {
      name: 'John Doe',
      age: 30,
      email: 'john@gmail.com'
    };

    class Test extends BaseHandler {
      @makeIdempotent('testIdempotency', ['name', 'age', 'email'])
      async perform(event: any) {
        return await new Promise((resolve) => setTimeout(() => resolve(event), 100));
      }
    }

    const t = new Test();

    // fire the first call
    const p1 = t.handler(data, context, callback);

    // give it a head-start so it can write the idempotency lock
    await new Promise((r) => setTimeout(r, 200));

    // second call with the same intent
    const p2 = t.handler(data, context, callback);

    // Wait for both without short-circuiting
    const [r1, r2] = await Promise.allSettled([p1, p2]);

    // First call should succeed
    expect(r1.status).toBe('fulfilled');
    expect((r1 as PromiseFulfilledResult<any>).value).toMatchObject(data);

    // Second call should be rejected with the IN_PROGRESS response
    expect(r2.status).toBe('fulfilled');
    expect((r2 as PromiseFulfilledResult<any>).value).toMatchObject(data);
  });
});

describe('Test empty values', () => {
  it('should return null if object is empty', async () => {
    class Test extends BaseHandler {
      perform() {
        return {};
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toBeNull();
  });

  it('should return null if object = { array: [] }', async () => {
    class Test extends BaseHandler {
      perform() {
        return { array: [] };
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toBeNull();
  });

  it('should return null if object = { object: {} }', async () => {
    class Test extends BaseHandler {
      perform() {
        return { object: {} };
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toBeNull();
  });

  it('should return null if object = { object: {}, array: [] }', async () => {
    class Test extends BaseHandler {
      perform() {
        return { object: {}, array: [] };
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toBeNull();
  });
});

describe('Test existing values', () => {
  it('should return an object if object = { one: 0 }', async () => {
    const obj = { one: 0 };
    class Test extends BaseHandler {
      perform() {
        return obj;
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toStrictEqual(obj);
  });

  it('should return an object if object = { one: false }', async () => {
    const obj = { one: false };
    class Test extends BaseHandler {
      perform() {
        return obj;
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toStrictEqual(obj);
  });

  it('should return an object if object = { object: { one: 1 }, array: [] }', async () => {
    const obj = { object: { one: 1 }, array: [] };
    class Test extends BaseHandler {
      perform() {
        return obj;
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toStrictEqual(obj);
  });

  it('should return an object if object = { object: {}, array: [1] }', async () => {
    const obj = { object: {}, array: [1] };
    class Test extends BaseHandler {
      perform() {
        return obj;
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toStrictEqual(obj);
  });

  it('should return an object if object = { object: { one: 1 } }', async () => {
    const obj = { object: { one: 1 } };
    class Test extends BaseHandler {
      perform() {
        return obj;
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toStrictEqual(obj);
  });

  it('should return an object if object = { array: [1] }', async () => {
    const obj = { array: [1] };
    class Test extends BaseHandler {
      perform() {
        return obj;
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toStrictEqual(obj);
  });

  it('should return an object if object = { property: "one" }', async () => {
    const obj = { property: 'one' };
    class Test extends BaseHandler {
      perform() {
        return obj;
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toStrictEqual(obj);
  });

  it('should return an object with "__typename" property if object = { property: "one" }', async () => {
    const obj = { property: 'one' };
    class Test extends BaseHandler {
      __typename = 'Typename';
      perform() {
        return obj;
      }
    }
    const result = await new Test().handler({}, context, callback);
    expect(result).toStrictEqual({ ...obj, __typename: 'Typename' });
  });
});

describe('Test error handling', () => {
  it('should throw an error if strict = true', async () => {
    class Test extends BaseHandler {
      constructor() {
        super(true);
      }
      perform() {
        const error = new Error('Error');
        throw new BackendError(error);
      }
    }

    await expect(new Test().handler({}, context, callback)).rejects.toThrow(BackendError);
  });

  it('should return a data if strict = false', async () => {
    class Test extends BaseHandler {
      perform() {
        const error = new Error('Error');
        throw new BackendError(error);
      }
    }
    const expectedData = {
      __typename: gql.CommonErrors.BACKEND_ERROR,
      message: 'Internal server error.',
      body: {
        status: 500,
        details: 'Internal server error.'
      }
    };

    const result = await new Test().handler({}, context, callback);
    expect(result).toStrictEqual(expect.objectContaining(expectedData));
  });
});
