import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SKRUN = join(import.meta.dirname, '..', 'bin', 'skrun.js');

function skrun(args, opts = {}) {
  const env = { ...process.env, ...opts.env };
  try {
    const stdout = execSync(`node ${SKRUN} ${args}`, {
      encoding: 'utf8',
      cwd: opts.cwd || process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000
    });
    return stdout;
  } catch (err) {
    if (opts.expectFail) {
      return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.status };
    }
    throw new Error(`skrun ${args} failed:\nstdout: ${err.stdout}\nstderr: ${err.stderr}`);
  }
}

function skrunAll(args, opts = {}) {
  const env = { ...process.env, ...opts.env };
  try {
    const stdout = execSync(`node ${SKRUN} ${args} 2>&1`, {
      encoding: 'utf8',
      cwd: opts.cwd || process.cwd(),
      env,
      shell: true,
      timeout: 10000
    });
    return stdout;
  } catch (err) {
    return err.stdout || err.stderr || '';
  }
}

function skrunFail(args, opts = {}) {
  return skrun(args, { ...opts, expectFail: true });
}

describe('functional: CLI basics', () => {
  it('--version prints version', () => {
    const out = skrun('--version');
    assert.match(out, /^skrun v\d+\.\d+\.\d+/);
  });

  it('--help prints usage', () => {
    const out = skrun('--help');
    assert.match(out, /Usage:/);
    assert.match(out, /skrun import/);
    assert.match(out, /skrun install/);
  });

  it('unknown command exits with error', () => {
    const result = skrunFail('badcommand');
    assert.match(result.stderr, /Unknown command/);
    assert.notEqual(result.code, 0);
  });
});

describe('functional: import → list → tag → install → sync → purge', () => {
  let configDir, projDir, repoDir;

  before(() => {
    configDir = mkdtempSync(join(tmpdir(), 'skrun-func-config-'));
    projDir = mkdtempSync(join(tmpdir(), 'skrun-func-proj-'));
    repoDir = mkdtempSync(join(tmpdir(), 'skrun-func-repo-'));

    // create a fake git repo with two skills
    mkdirSync(join(repoDir, 'skills', 'tdd'), { recursive: true });
    writeFileSync(join(repoDir, 'skills', 'tdd', 'SKILL.md'), '# TDD Skill\nWrite tests first.');
    writeFileSync(join(repoDir, 'skills', 'tdd', 'skrun.json'), JSON.stringify({ tags: ['testing'] }));

    mkdirSync(join(repoDir, 'skills', 'lint'), { recursive: true });
    writeFileSync(join(repoDir, 'skills', 'lint', 'SKILL.md'), '# Lint Skill\nLint your code.');

    execSync('git init -q', { cwd: repoDir });
    execSync('git add -A', { cwd: repoDir });
    execSync('git commit -qm "init"', { cwd: repoDir });

    // project has .claude dir
    mkdirSync(join(projDir, '.claude'), { recursive: true });
  });

  after(() => {
    rmSync(configDir, { recursive: true, force: true });
    rmSync(projDir, { recursive: true, force: true });
    rmSync(repoDir, { recursive: true, force: true });
  });

  function skrunEnv(args, opts = {}) {
    return skrun(args, { ...opts, env: { SKRUN_CONFIG_DIR: configDir, ...(opts.env || {}) } });
  }

  function skrunEnvFail(args, opts = {}) {
    return skrunFail(args, { ...opts, env: { SKRUN_CONFIG_DIR: configDir, ...(opts.env || {}) } });
  }

  it('import --force imports skills from repo', () => {
    const out = skrunEnv(`import ${repoDir} --force`);
    assert.match(out, /Imported tdd/);
    assert.match(out, /Imported lint/);
    assert.match(out, /2 skill\(s\) imported,/);

    // verify store
    assert.ok(existsSync(join(configDir, 'skills', 'tdd', 'SKILL.md')));
    assert.ok(existsSync(join(configDir, 'skills', 'lint', 'SKILL.md')));
  });

  it('list shows imported skills', () => {
    const out = skrunEnv('list');
    assert.match(out, /tdd/);
    assert.match(out, /lint/);
    assert.match(out, /testing/); // tdd tag
  });

  it('tag add/list/remove works', () => {
    skrunEnv('tag add lint quality ci');
    const listOut = skrunEnv('tag list lint');
    assert.match(listOut, /quality/);
    assert.match(listOut, /ci/);

    skrunEnv('tag remove lint ci');
    const afterRemove = skrunEnv('tag list lint');
    assert.match(afterRemove, /quality/);
    assert.ok(!afterRemove.includes('ci'));
  });

  it('list --tag filters by tag', () => {
    const out = skrunEnv('list --tag=testing');
    assert.match(out, /tdd/);
    assert.ok(!out.includes('lint'));
  });

  it('install creates symlink into project', () => {
    const out = skrunEnv('install tdd', { cwd: projDir });
    assert.match(out, /symlink.*tdd.*claude/);
    assert.match(out, /1 install\(s\) completed/);

    const installed = join(projDir, '.claude', 'skills', 'tdd');
    assert.ok(existsSync(installed));
    assert.ok(lstatSync(installed).isSymbolicLink());

    const content = readFileSync(join(installed, 'SKILL.md'), 'utf8');
    assert.match(content, /TDD Skill/);
  });

  it('install --copy creates a copy', () => {
    const out = skrunEnv('install lint --copy', { cwd: projDir });
    assert.match(out, /copy.*lint.*claude/);

    const installed = join(projDir, '.claude', 'skills', 'lint');
    assert.ok(existsSync(installed));
    assert.ok(!lstatSync(installed).isSymbolicLink());
  });

  it('install --tag installs by tag', () => {
    // add a unique tag to lint for this test
    skrunEnv('tag add lint func-test-tag');
    const out = skrunEnv('install --tag=func-test-tag --copy', { cwd: projDir });
    assert.match(out, /lint/);
    assert.match(out, /1 install\(s\) completed/);
  });

  it('install missing skill fails', () => {
    const result = skrunEnvFail('install nonexistent', { cwd: projDir });
    assert.match(result.stderr, /not found/);
    assert.notEqual(result.code, 0);
  });

  it('install --tag with unknown tag warns', () => {
    const out = skrunAll('install --tag=no-such-tag', { cwd: projDir, env: { SKRUN_CONFIG_DIR: configDir } });
    assert.match(out, /no skills found/i);
  });

  it('sync --dry-run reports planned actions', () => {
    const out = skrunEnv('sync --dry-run', { cwd: projDir });
    assert.match(out, /dry-run/i);
  });

  it('sync re-copies copy installs', () => {
    // modify the copy to verify it gets overwritten
    const lintInstalled = join(projDir, '.claude', 'skills', 'lint', 'SKILL.md');
    writeFileSync(lintInstalled, '# Modified');

    skrunEnv('sync', { cwd: projDir });

    const content = readFileSync(lintInstalled, 'utf8');
    assert.match(content, /Lint Skill/);
  });

  it('uninstall removes symlink and registry entry', () => {
    // tdd is already installed as symlink from earlier test
    const installed = join(projDir, '.claude', 'skills', 'tdd');
    assert.ok(existsSync(installed));

    const out = skrunEnv('uninstall tdd', { cwd: projDir });
    assert.match(out, /Removed.*tdd/);
    assert.ok(!existsSync(installed));

    // verify it's gone from list --installed
    const listOut = skrunEnv('list --installed');
    // tdd for .claude should be gone (lint may still be there)
    assert.ok(!listOut.includes(installed));

    // re-install for subsequent tests
    skrunEnv('install tdd', { cwd: projDir });
  });

  it('uninstall with --target removes only from that agent', () => {
    const multiProj = mkdtempSync(join(tmpdir(), 'skrun-func-uninstall-'));
    mkdirSync(join(multiProj, '.claude'), { recursive: true });
    mkdirSync(join(multiProj, '.github'), { recursive: true });

    skrunEnv('install tdd', { cwd: multiProj });
    assert.ok(existsSync(join(multiProj, '.claude', 'skills', 'tdd')));
    assert.ok(existsSync(join(multiProj, '.github', 'skills', 'tdd')));

    skrunEnv('uninstall tdd --target=claude', { cwd: multiProj });
    assert.ok(!existsSync(join(multiProj, '.claude', 'skills', 'tdd')));
    assert.ok(existsSync(join(multiProj, '.github', 'skills', 'tdd')));

    rmSync(multiProj, { recursive: true, force: true });
  });

  it('uninstall missing skill reports nothing found', () => {
    const out = skrunEnv('uninstall nonexistent');
    assert.match(out, /No active installs/);
  });

  it('uninstall shows in history', () => {
    const out = skrunEnv('--history');
    assert.match(out, /uninstall/);
  });

  it('install --ttl with suffix units works', () => {
    const ttlProj = mkdtempSync(join(tmpdir(), 'skrun-func-ttlsuffix-'));
    mkdirSync(join(ttlProj, '.agents'), { recursive: true });

    const out = skrunEnv('install tdd --copy --ttl=30m', { cwd: ttlProj });
    assert.match(out, /expires/);

    // check registry has a future expiry
    const listOut = skrunEnv('list --installed');
    assert.match(listOut, /expires/);

    rmSync(ttlProj, { recursive: true, force: true });
  });

  it('install --ttl + purge cycle works', () => {
    // create a separate project for TTL test
    const ttlProj = mkdtempSync(join(tmpdir(), 'skrun-func-ttl-'));
    mkdirSync(join(ttlProj, '.agents'), { recursive: true });

    // install with TTL of 0.0001 hours (< 1 second)
    skrunEnv('install tdd --copy --ttl=0.0001', { cwd: ttlProj });
    const installed = join(ttlProj, '.agents', 'skills', 'tdd');
    assert.ok(existsSync(installed));

    // wait for expiry (360ms = 0.0001h)
    execSync('sleep 0.5');

    // purge
    const purgeOut = skrunEnv('purge');
    assert.match(purgeOut, /Expired.*tdd/);
    assert.ok(!existsSync(installed));

    rmSync(ttlProj, { recursive: true, force: true });
  });

  it('--history shows install history', () => {
    const out = skrunEnv('--history');
    assert.match(out, /install/);
    assert.match(out, /tdd/);
  });

  it('--history deleted shows only expire/delete entries', () => {
    const out = skrunEnv('--history deleted');
    // should have at least the TTL expire from above
    assert.match(out, /expire/i);
  });

  it('tag errors on missing skill', () => {
    const result = skrunEnvFail('tag list ghostskill');
    assert.match(result.stderr, /not found/);
  });

  it('tag remove unknown tag warns', () => {
    const out = skrunAll('tag remove tdd no-such-tag', { env: { SKRUN_CONFIG_DIR: configDir } });
    assert.match(out, /not found/i);
  });
});

describe('functional: target resolution', () => {
  let configDir;

  before(() => {
    configDir = mkdtempSync(join(tmpdir(), 'skrun-func-tgt-'));
    mkdirSync(join(configDir, 'skills', 'dummy'), { recursive: true });
    writeFileSync(join(configDir, 'skills', 'dummy', 'SKILL.md'), '# dummy');
  });

  after(() => {
    rmSync(configDir, { recursive: true, force: true });
  });

  function skrunEnv(args, opts = {}) {
    return skrun(args, { ...opts, env: { SKRUN_CONFIG_DIR: configDir, ...(opts.env || {}) } });
  }

  it('creates .agents/skills when no agent dirs exist', () => {
    const proj = mkdtempSync(join(tmpdir(), 'skrun-func-noagent-'));
    skrunEnv('install dummy', { cwd: proj });
    assert.ok(existsSync(join(proj, '.agents', 'skills', 'dummy')));
    rmSync(proj, { recursive: true, force: true });
  });

  it('--target=claude creates .claude/skills', () => {
    const proj = mkdtempSync(join(tmpdir(), 'skrun-func-target-'));
    skrunEnv('install dummy --target=claude', { cwd: proj });
    assert.ok(existsSync(join(proj, '.claude', 'skills', 'dummy')));
    rmSync(proj, { recursive: true, force: true });
  });

  it('installs into all detected agent dirs', () => {
    const proj = mkdtempSync(join(tmpdir(), 'skrun-func-multi-'));
    mkdirSync(join(proj, '.claude'), { recursive: true });
    mkdirSync(join(proj, '.github'), { recursive: true });

    const out = skrunEnv('install dummy', { cwd: proj });
    assert.ok(existsSync(join(proj, '.claude', 'skills', 'dummy')));
    assert.ok(existsSync(join(proj, '.github', 'skills', 'dummy')));
    assert.match(out, /2 install\(s\) completed/);

    rmSync(proj, { recursive: true, force: true });
  });

  it('installs into all detected agent dirs including opencode', () => {
    const proj = mkdtempSync(join(tmpdir(), 'skrun-func-multi-opencode-'));
    mkdirSync(join(proj, '.claude'), { recursive: true });
    mkdirSync(join(proj, '.github'), { recursive: true });
    mkdirSync(join(proj, '.opencode'), { recursive: true });

    const out = skrunEnv('install dummy --target=all', { cwd: proj });
    assert.ok(existsSync(join(proj, '.claude', 'skills', 'dummy')));
    assert.ok(existsSync(join(proj, '.github', 'skills', 'dummy')));
    assert.ok(existsSync(join(proj, '.opencode', 'skills', 'dummy')));
    assert.match(out, /3 install\(s\) completed/);

    rmSync(proj, { recursive: true, force: true });
  });

  it('falls back to .agents when no agent dirs present, even with opencode support added', () => {
    const proj = mkdtempSync(join(tmpdir(), 'skrun-func-noagent-opencode-'));
    skrunEnv('install dummy', { cwd: proj });
    assert.ok(existsSync(join(proj, '.agents', 'skills', 'dummy')));
    assert.ok(!existsSync(join(proj, '.opencode')));
    rmSync(proj, { recursive: true, force: true });
  });
});

describe('functional: import duplicate handling', () => {
  let configDir, repoDir;

  before(() => {
    configDir = mkdtempSync(join(tmpdir(), 'skrun-func-dup-'));
    repoDir = mkdtempSync(join(tmpdir(), 'skrun-func-duprepo-'));

    mkdirSync(join(repoDir, 'skills', 'dup-skill'), { recursive: true });
    writeFileSync(join(repoDir, 'skills', 'dup-skill', 'SKILL.md'), '# v1');

    execSync('git init -q', { cwd: repoDir });
    execSync('git add -A', { cwd: repoDir });
    execSync('git commit -qm "init"', { cwd: repoDir });
  });

  after(() => {
    rmSync(configDir, { recursive: true, force: true });
    rmSync(repoDir, { recursive: true, force: true });
  });

  function skrunEnv(args) {
    return skrun(args, { env: { SKRUN_CONFIG_DIR: configDir } });
  }

  it('--force overwrites existing skill on re-import', () => {
    skrunEnv(`import ${repoDir} --force`);
    const v1 = readFileSync(join(configDir, 'skills', 'dup-skill', 'SKILL.md'), 'utf8');
    assert.match(v1, /v1/);

    // update repo
    writeFileSync(join(repoDir, 'skills', 'dup-skill', 'SKILL.md'), '# v2');
    execSync('git add -A && git commit -qm "v2"', { cwd: repoDir });

    skrunEnv(`import ${repoDir} --force`);
    const v2 = readFileSync(join(configDir, 'skills', 'dup-skill', 'SKILL.md'), 'utf8');
    assert.match(v2, /v2/);
  });
});

describe('functional: import with no skills', () => {
  let configDir, emptyRepo;

  before(() => {
    configDir = mkdtempSync(join(tmpdir(), 'skrun-func-empty-'));
    emptyRepo = mkdtempSync(join(tmpdir(), 'skrun-func-emptyrepo-'));
    writeFileSync(join(emptyRepo, 'README.md'), '# nothing here');
    execSync('git init -q', { cwd: emptyRepo });
    execSync('git add -A && git commit -qm "init"', { cwd: emptyRepo });
  });

  after(() => {
    rmSync(configDir, { recursive: true, force: true });
    rmSync(emptyRepo, { recursive: true, force: true });
  });

  it('reports no skills found', () => {
    const out = skrun(`import ${emptyRepo} --force`, { env: { SKRUN_CONFIG_DIR: configDir } });
    assert.match(out, /No skills found/);
  });
});

describe('functional: import from local non-git directory', () => {
  let configDir, localDir;

  before(() => {
    configDir = mkdtempSync(join(tmpdir(), 'skrun-func-local-'));
    localDir = mkdtempSync(join(tmpdir(), 'skrun-func-localskills-'));

    // a skill folder directly inside localDir
    mkdirSync(join(localDir, 'my-skill'), { recursive: true });
    writeFileSync(join(localDir, 'my-skill', 'SKILL.md'), '# My Skill\nDoes things.');

    // a nested skill
    mkdirSync(join(localDir, 'sub', 'nested-skill'), { recursive: true });
    writeFileSync(join(localDir, 'sub', 'nested-skill', 'SKILL.md'), '# Nested\nAlso does things.');
  });

  after(() => {
    rmSync(configDir, { recursive: true, force: true });
    rmSync(localDir, { recursive: true, force: true });
  });

  it('imports skills from a local folder without git', () => {
    const out = skrun(`import ${localDir} --force`, { env: { SKRUN_CONFIG_DIR: configDir } });
    assert.match(out, /Imported my-skill/);
    assert.match(out, /Imported nested-skill/);
    assert.match(out, /2 skill\(s\) imported,/);
    assert.ok(existsSync(join(configDir, 'skills', 'my-skill', 'SKILL.md')));
    assert.ok(existsSync(join(configDir, 'skills', 'nested-skill', 'SKILL.md')));
  });

  it('imports a single skill folder directly', () => {
    const configDir2 = mkdtempSync(join(tmpdir(), 'skrun-func-local2-'));
    try {
      const out = skrun(`import ${join(localDir, 'my-skill')} --force`, { env: { SKRUN_CONFIG_DIR: configDir2 } });
      assert.match(out, /Imported my-skill/);
      assert.match(out, /1 skill\(s\) imported,/);
    } finally {
      rmSync(configDir2, { recursive: true, force: true });
    }
  });
});

describe('functional: purge with nothing expired', () => {
  let configDir;

  before(() => {
    configDir = mkdtempSync(join(tmpdir(), 'skrun-func-purge-'));
  });

  after(() => {
    rmSync(configDir, { recursive: true, force: true });
  });

  it('purge on empty registry reports no expired', () => {
    const out = skrun('purge', { env: { SKRUN_CONFIG_DIR: configDir } });
    assert.match(out, /No expired/);
  });
});
