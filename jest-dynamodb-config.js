const DEFAULT_SCHEMA = {
  KeySchema: [
    {
      AttributeName: 'PK',
      KeyType: 'HASH'
    },
    {
      AttributeName: 'SK',
      KeyType: 'RANGE'
    }
  ],
  AttributeDefinitions: [
    {
      AttributeName: 'PK',
      AttributeType: 'S'
    },
    {
      AttributeName: 'SK',
      AttributeType: 'S'
    },
    {
      AttributeName: 'organizationName',
      AttributeType: 'S'
    },
    {
      AttributeName: 'email',
      AttributeType: 'S'
    }
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'OrganizationGSI',
      KeySchema: [
        {
          AttributeName: 'organizationName',
          KeyType: 'HASH'
        }
      ],
      Projection: {
        ProjectionType: 'KEYS_ONLY'
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }
  ],
  LocalSecondaryIndexes: [
    {
      IndexName: 'EmailLSI',
      KeySchema: [
        {
          AttributeName: 'PK',
          KeyType: 'HASH'
        },
        {
          AttributeName: 'email',
          KeyType: 'RANGE'
        }
      ],
      Projection: {
        ProjectionType: 'ALL'
      }
    }
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  }
};

module.exports = {
  tables: [
    {
      ...DEFAULT_SCHEMA,
      TableName: 'test-table'
    },
    {
      ...DEFAULT_SCHEMA,
      TableName: 'idempotency-table'
    }
  ]
};
