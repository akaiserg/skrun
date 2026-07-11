import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveTargets } from '../src/targets.js';

describe('targets', () => {
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'skrun-test-targets-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects .claude dir', () => {
    const proj = join(tmpDir, 'proj-claude');
    mkdirSync(join(proj, '.claude'), { recursive: true });

    const targets = resolveTargets(proj);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].agent, 'claude');
    assert.ok(existsSync(targets[0].skillsPath));
  });

  it('detects multiple agent dirs', () => {
    const proj = join(tmpDir, 'proj-multi');
    mkdirSync(join(proj, '.claude'), { recursive: true });
    mkdirSync(join(proj, '.github'), { recursive: true });

    const targets = resolveTargets(proj);
    assert.equal(targets.length, 2);
    const agents = targets.map(t => t.agent);
    assert.ok(agents.includes('claude'));
    assert.ok(agents.includes('github'));
  });

  it('creates .agents/skills when none detected', () => {
    const proj = join(tmpDir, 'proj-empty');
    mkdirSync(proj, { recursive: true });

    const targets = resolveTargets(proj);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].agent, 'agents');
    assert.ok(existsSync(join(proj, '.agents', 'skills')));
  });

  it('--target override selects single agent', () => {
    const proj = join(tmpDir, 'proj-override');
    mkdirSync(join(proj, '.claude'), { recursive: true });
    mkdirSync(join(proj, '.github'), { recursive: true });

    const targets = resolveTargets(proj, 'claude');
    assert.equal(targets.length, 1);
    assert.equal(targets[0].agent, 'claude');
  });

  it('throws on unknown target', () => {
    const proj = join(tmpDir, 'proj-bad');
    mkdirSync(proj, { recursive: true });

    assert.throws(() => resolveTargets(proj, 'unknown'), /Unknown target/);
  });

  it('detects .opencode dir', () => {
    const proj = join(tmpDir, 'proj-opencode');
    mkdirSync(join(proj, '.opencode'), { recursive: true });

    const targets = resolveTargets(proj);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].agent, 'opencode');
    assert.ok(existsSync(targets[0].skillsPath));
  });

  it('--target=all includes opencode when present', () => {
    const proj = join(tmpDir, 'proj-all-opencode');
    mkdirSync(join(proj, '.claude'), { recursive: true });
    mkdirSync(join(proj, '.opencode'), { recursive: true });

    const targets = resolveTargets(proj, 'all');
    assert.equal(targets.length, 2);
    const agents = targets.map(t => t.agent);
    assert.ok(agents.includes('claude'));
    assert.ok(agents.includes('opencode'));
  });

  it('--target=opencode explicit install creates .opencode/skills', () => {
    const proj = join(tmpDir, 'proj-opencode-explicit');
    mkdirSync(proj, { recursive: true });

    const targets = resolveTargets(proj, 'opencode');
    assert.equal(targets.length, 1);
    assert.equal(targets[0].agent, 'opencode');
    assert.ok(existsSync(join(proj, '.opencode', 'skills')));
  });

  it('unknown target error lists opencode', () => {
    const proj = join(tmpDir, 'proj-bad-opencode');
    mkdirSync(proj, { recursive: true });

    assert.throws(() => resolveTargets(proj, 'unknown'), /opencode/);
  });
});
