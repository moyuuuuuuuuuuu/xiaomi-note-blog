import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFile } from './env.js';

const tempDir = await mkdtemp(join(tmpdir(), 'xiaominote-env-'));
const envPath = join(tempDir, '.env');
const originalEnv = {
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  PORT: process.env.PORT,
  DATA_DIR: process.env.DATA_DIR,
};

try {
  delete process.env.ADMIN_PASSWORD;
  process.env.PORT = '9999';
  delete process.env.DATA_DIR;

  await writeFile(
    envPath,
    [
      'ADMIN_PASSWORD=from-env-file',
      'PORT=8787',
      'DATA_DIR="./custom data"',
      'EMPTY_VALUE=',
      '# ignored comment',
    ].join('\n'),
    'utf8',
  );

  await loadEnvFile(envPath);

  assert.equal(process.env.ADMIN_PASSWORD, 'from-env-file');
  assert.equal(process.env.PORT, '9999');
  assert.equal(process.env.DATA_DIR, './custom data');
  assert.equal(process.env.EMPTY_VALUE, '');
} finally {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  delete process.env.EMPTY_VALUE;
  await rm(tempDir, { recursive: true, force: true });
}
