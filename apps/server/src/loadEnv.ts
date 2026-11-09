import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const isTestEnv = process.env.NODE_ENV === 'test';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDir, '../../../.env');
const serverEnvPath = path.resolve(currentDir, '../.env');

// Load workspace root .env first, then allow local apps/server/.env overrides if present
dotenv.config({ path: rootEnvPath });
dotenv.config({ path: serverEnvPath });

// Automated test suites run deterministically against mock adapters unless RUBI_TEST_LIVE=true
if (isTestEnv && process.env.RUBI_TEST_LIVE !== 'true') {
  process.env.RUBI_MODE = 'offline';
}

// In test environment, isolate DB writes to rubi_test so rubi_dev is not polluted
if (isTestEnv && !process.env.DATABASE_URL_OVERRIDDEN) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL_TEST ||
    'postgresql://postgres@localhost:5432/rubi_test?schema=public';
}
