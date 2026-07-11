import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('purge', () => {
  let tmpDir;
  let registryMod;
  let purgeMod;

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'skrun-test-purge-'));
    process.env.SKRUN_CONFIG_DIR = tmpDir;
    mkdirSync(join(tmpDir, 'skills'), { recursive: true });
    registryMod = await import(`../src/registry.js?t=purge-${Date.now()}`);
    purgeMod = await import(`../src/commands/purge.js?t=${Date.now()}`);
  });

  after(() => {
    delete process.env.SKRUN_CONFIG_DIR;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('purges expired installs', () => {
    const installDir = join(tmpDir, 'proj', '.claude', 'skills', 'tdd');
    mkdirSync(installDir, { recursive: true });
    writeFileSync(join(installDir, 'SKILL.md'), '# TDD');

    const reg = registryMod.loadRegistry();
    reg.installs = [{
      skill: 'tdd',
      projectPath: join(tmpDir, 'proj'),
      installedPath: installDir,
      type: 'copy',
      ttlExpiresAt: new Date(Date.now() - 3600000).toISOString()
    }];
    reg.history = [];
    registryMod.saveRegistry(reg);

    const count = purgeMod.purgeExpired(false);
    assert.equal(count, 1);
    assert.ok(!existsSync(installDir));

    const after = registryMod.loadRegistry();
    assert.equal(after.installs.length, 0);
    assert.equal(after.history[after.history.length - 1].action, 'expire');
  });

  it('leaves non-expired installs alone', () => {
    const installDir = join(tmpDir, 'proj2', '.claude', 'skills', 'tdd');
    mkdirSync(installDir, { recursive: true });
    writeFileSync(join(installDir, 'SKILL.md'), '# TDD');

    const reg = registryMod.loadRegistry();
    reg.installs.push({
      skill: 'tdd',
      projectPath: join(tmpDir, 'proj2'),
      installedPath: installDir,
      type: 'copy',
      ttlExpiresAt: new Date(Date.now() + 3600000).toISOString()
    });
    registryMod.saveRegistry(reg);

    purgeMod.purgeExpired(false);
    assert.ok(existsSync(installDir));
  });
});
