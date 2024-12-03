import { join } from 'path';

const getConfig = () => {
  const REQUIRED_CONFIG_KEYS = ['name', 'version'];

  const config = require(join(process.cwd(), 'platform.json')) as Record<string, any> & Object;
  for (const key of REQUIRED_CONFIG_KEYS) {
    if (!config.hasOwnProperty(key)) {
      throw new Error("Missing property 'version' on platform.json.");
    }
  }

  const version = `v${config.version.replace(/\./g, '-')}`;

  const VERSION = version;
  const DEPLOYMENT_NAME =
    JSON.parse(process.env.CDK_CONTEXT_JSON ?? '{}').deployment_name ?? process.env.DEPLOYMENT_NAME ?? '';
  const PLATFORM_PREFIX = config.name;
  const TABLE_PREFIX = config?.table_name?.toUpperCase() ?? '';
  const TABLE_NAME = config?.table_name ? `${config?.table_name}-${DEPLOYMENT_NAME}-table` : '';

  return { VERSION, DEPLOYMENT_NAME, PLATFORM_PREFIX, TABLE_PREFIX, TABLE_NAME };
};

export default getConfig;
