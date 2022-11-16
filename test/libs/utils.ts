import { v4 as uuidv4 } from 'uuid';

const TABLE_PREFIX = 'ORGANIZATION';

export function generateOrganizationData() {
  const [id, PK] = generateKey(TABLE_PREFIX);
  const keys = { PK, SK: `${TABLE_PREFIX}INFO#${id}` };
  const items = [
    {
      ...keys,
      id,
      organizationName: 'International Container Terminal Services Inc.'
    }
  ];

  return { id, keys, items };
}

export function generateUserData(_organizationId?: string) {
  const [organizationId, PK] = generateKey(TABLE_PREFIX, _organizationId);
  const [id1, sk1] = generateKey('USER');
  const [id2, sk2] = generateKey('USER');
  const [id3, sk3] = generateKey('USER');
  const [id4, sk4] = generateKey('USER');

  const keys = (id: string, SK: string) => ({ PK, SK, id });

  const items = [
    {
      ...keys(id1, sk1),
      organizationId,
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      email: 'juan.delacruz@test.com'
    },
    {
      ...keys(id2, sk2),
      organizationId,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@test.ing.com'
    },
    {
      ...keys(id3, sk3),
      organizationId,
      firstName: 'Celine',
      lastName: 'na',
      email: 'celine.na@test.com'
    },
    {
      ...keys(id4, sk4),
      organizationId,
      firstName: 'Jose',
      lastName: 'Miraso',
      email: 'jose.miraso@test.com'
    }
  ];

  return { keys, items };
}

function generateKey(name: string, _key?: string) {
  const key = _key ?? uuidv4();
  return [key, `${name}#${key}`];
}
