import 'jest';
import { DynamoDbActions, dbHelper } from '../../src/software-development/services/dynamodb';
import { generateOrganizationData, generateUserData } from '../utils';

const TABLE_NAME = 'test-table';

const { id: organizationId, items: orgItems } = generateOrganizationData();
const { items: userItems } = generateUserData(organizationId);

const db = new DynamoDbActions();

describe('DynamoDB Actions', () => {
  beforeEach(async () => {
    process.env = { ...process.env, TABLE_NAME };
    await dbHelper.resetTable(TABLE_NAME);
    await dbHelper.populateItems(TABLE_NAME, [...orgItems, ...userItems]);
  });

  it('should query item from `EmailLSI` Index using `customQuery` | email = "john.doe@test.com"', async () => {
    const input = {
      TableName: TABLE_NAME,
      IndexName: 'EmailLSI',
      PrimaryKey: { PK: orgItems[0].PK },
      SortKey: { email: 'john.doe@test.ing.com' }
    };

    const { Items } = await db.customQuery(input);
    expect(Items).toHaveLength(1);
  });

  it('should query all USERS from table sing `customQuery` | begins_with(SK, USER#)', async () => {
    const input = {
      TableName: TABLE_NAME,
      PrimaryKey: { PK: orgItems[0].PK },
      SortKey: { SK: 'USER#', function: 'begins_with' as const }
    };

    const { Items } = await db.customQuery(input);
    expect(Items).toHaveLength(4);
  });

  it('should query all USERS from table using `customQuery` | FilterExpression contains(email, @test.com)', async () => {
    const { Items } = await db.customQuery({
      TableName: TABLE_NAME,
      PrimaryKey: { PK: orgItems[0].PK },
      SortKey: { SK: 'USER#', function: 'begins_with' as const },
      FilterExpression: {
        data: { email: '@test.com' },
        callback: (data) => `contains(${data.email.key}, ${data.email.value})`
      }
    });
    expect(Items).toHaveLength(3);
  });

  // @TODO Query different FilterExpression pattern with functions
  // @TODO Query using GSI
  // @TODO Test Update Item
});
