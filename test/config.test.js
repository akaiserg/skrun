import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('config', () => {
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'skrun-test-config-'));
    process.env.SKRUN_CONFIG_DIR = tmpDir;
  });

  after(() => {
    delete process.env.SKRUN_CONFIG_DIR;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ensureConfig creates skills dir', async () => {
    // re-import to pick up env
    const { ensureConfig, skillsDir } = await import('../src/config.js?t=1');
    // config.js reads env at module load, but SKRUN_CONFIG_DIR is checked at import
    // We need to test via the actual module
    const { ensureConfig: ec, skillsDir: sd } = await reimport();
    ec();
    assert.ok(existsSync(sd));
  });
});

async function reimport() {
  const mod = await import(`../src/config.js?t=${Date.now()}`);
  return mod;
}
