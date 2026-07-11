import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('skills', () => {
  let tmpDir;
  let mod;

  before(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'skrun-test-skills-'));
    process.env.SKRUN_CONFIG_DIR = tmpDir;
    mod = await import(`../src/skills.js?t=${Date.now()}`);
  });

  after(() => {
    delete process.env.SKRUN_CONFIG_DIR;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scanForSkills finds folders with SKILL.md', () => {
    const root = join(tmpDir, 'scan-root');
    mkdirSync(join(root, 'tdd'), { recursive: true });
    writeFileSync(join(root, 'tdd', 'SKILL.md'), '# TDD');
    mkdirSync(join(root, 'empty'), { recursive: true });
    mkdirSync(join(root, 'nested', 'deep'), { recursive: true });
    writeFileSync(join(root, 'nested', 'deep', 'SKILL.md'), '# Deep');

    const results = mod.scanForSkills(root);
    const names = results.map(r => r.name);
    assert.ok(names.includes('tdd'));
    assert.ok(names.includes('deep'));
    assert.ok(!names.includes('empty'));
  });

  it('getTags/setTags round-trip', () => {
    const skillDir = join(tmpDir, 'skills', 'testskill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '# test');

    mod.setTags('testskill', ['backend', 'testing']);
    const tags = mod.getTags('testskill');
    assert.deepStrictEqual(tags, ['backend', 'testing']);
  });

  it('getTags returns empty array for missing skrun.json', () => {
    const skillDir = join(tmpDir, 'skills', 'notags');
    mkdirSync(skillDir, { recursive: true });

    const tags = mod.getTags('notags');
    assert.deepStrictEqual(tags, []);
  });

  it('findByTag with OR matching', () => {
    const s1 = join(tmpDir, 'skills', 's1');
    const s2 = join(tmpDir, 'skills', 's2');
    mkdirSync(s1, { recursive: true });
    mkdirSync(s2, { recursive: true });
    mod.setTags('s1', ['api-only']);
    mod.setTags('s2', ['ui-only']);

    const found = mod.findByTag('api-only');
    assert.equal(found.length, 1);
    assert.equal(found[0].id, 's1');
  });

  it('findByTag with AND matching', () => {
    mod.setTags('s1', ['api-only', 'strict-mode']);

    const found = mod.findByTag('api-only,strict-mode', true);
    assert.equal(found.length, 1);
    assert.equal(found[0].id, 's1');

    const notFound = mod.findByTag('api-only,ui-only', true);
    assert.equal(notFound.length, 0);
  });
});
