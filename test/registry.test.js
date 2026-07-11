import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('registry', () => {
  let tmpDir;
  let mod;

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'skrun-test-reg-'));
    process.env.SKRUN_CONFIG_DIR = tmpDir;
    mod = await import(`../src/registry.js?t=${Date.now()}`);
  });

  after(() => {
    delete process.env.SKRUN_CONFIG_DIR;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loadRegistry returns fresh skeleton when no file', () => {
    const reg = mod.loadRegistry();
    assert.deepStrictEqual(reg.installs, []);
    assert.deepStrictEqual(reg.history, []);
  });

  it('addInstall + saveRegistry round-trips', () => {
    const reg = mod.loadRegistry();
    mod.addInstall(reg, {
      skill: 'tdd',
      projectPath: '/proj',
      installedPath: '/proj/.claude/skills/tdd',
      type: 'symlink',
      ttlExpiresAt: null
    });
    mod.saveRegistry(reg);

    const loaded = mod.loadRegistry();
    assert.equal(loaded.installs.length, 1);
    assert.equal(loaded.installs[0].skill, 'tdd');
    assert.equal(loaded.history.length, 1);
    assert.equal(loaded.history[0].action, 'install');
  });

  it('removeInstall removes and returns entry', () => {
    const reg = mod.loadRegistry();
    const removed = mod.removeInstall(reg, '/proj/.claude/skills/tdd');
    assert.equal(removed.skill, 'tdd');
    assert.equal(reg.installs.length, 0);
  });

  it('removeInstall returns null for missing path', () => {
    const reg = mod.loadRegistry();
    const result = mod.removeInstall(reg, '/nonexistent');
    assert.equal(result, null);
  });

  it('appendHistory adds timestamped entry', () => {
    const reg = mod.loadRegistry();
    mod.appendHistory(reg, 'expire', { skill: 'tdd', projectPath: '/proj' });
    const last = reg.history[reg.history.length - 1];
    assert.equal(last.action, 'expire');
    assert.ok(last.timestamp);
  });
});
