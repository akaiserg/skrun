import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, mkdirSync, lstatSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { copyDir, linkOrCopy, forceRemove, pathDepth } from '../src/fsutil.js';

describe('fsutil', () => {
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'skrun-test-fs-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('copyDir recursively copies files', () => {
    const src = join(tmpDir, 'src1');
    const dst = join(tmpDir, 'dst1');
    mkdirSync(join(src, 'sub'), { recursive: true });
    writeFileSync(join(src, 'SKILL.md'), '# test');
    writeFileSync(join(src, 'sub', 'file.txt'), 'content');

    copyDir(src, dst);

    assert.equal(readFileSync(join(dst, 'SKILL.md'), 'utf8'), '# test');
    assert.equal(readFileSync(join(dst, 'sub', 'file.txt'), 'utf8'), 'content');
  });

  it('linkOrCopy creates symlink by default', () => {
    const src = join(tmpDir, 'src2');
    const dst = join(tmpDir, 'dst2');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'SKILL.md'), '# symlink test');

    const type = linkOrCopy(src, dst);
    assert.equal(type, 'symlink');
    assert.ok(lstatSync(dst).isSymbolicLink());
    assert.equal(readFileSync(join(dst, 'SKILL.md'), 'utf8'), '# symlink test');
  });

  it('linkOrCopy with copy flag creates copy', () => {
    const src = join(tmpDir, 'src3');
    const dst = join(tmpDir, 'dst3');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'SKILL.md'), '# copy test');

    const type = linkOrCopy(src, dst, { copy: true });
    assert.equal(type, 'copy');
    assert.ok(!lstatSync(dst).isSymbolicLink());
    assert.equal(readFileSync(join(dst, 'SKILL.md'), 'utf8'), '# copy test');
  });

  it('forceRemove deletes recursively', () => {
    const dir = join(tmpDir, 'rm-test');
    mkdirSync(join(dir, 'deep'), { recursive: true });
    writeFileSync(join(dir, 'deep', 'file.txt'), 'data');

    forceRemove(dir);
    assert.ok(!existsSync(dir));
  });

  it('forceRemove is safe with null/empty', () => {
    forceRemove(null);
    forceRemove('');
    // should not throw
  });

  it('forceRemove refuses a shallow 2-segment POSIX path (regression)', () => {
    // A path like /tmp/skrun-test-guard-xxx resolves to exactly 2 segments
    // ("tmp", "skrun-test-guard-xxx"), which must be refused by the
    // `parts.length < 3` guard in src/fsutil.js. This locks in today's
    // correct POSIX behavior so the upcoming Windows fix (Gap G-1) cannot
    // regress it.
    // Use the literal `/tmp` root (not os.tmpdir(), which on macOS resolves
    // to a deep path like /var/folders/.../T) so the resolved path is
    // exactly 2 segments: "tmp", "skrun-test-guard-regress".
    const shallow = join('/tmp', 'skrun-test-guard-regress');
    mkdirSync(shallow, { recursive: true });
    try {
      forceRemove(shallow);
      assert.ok(existsSync(shallow), 'forceRemove must refuse to delete a 2-segment path');
    } finally {
      rmSync(shallow, { recursive: true, force: true });
    }
  });

  it('forceRemove\'s depth guard treats a shallow Windows drive-letter path as refused (Gap G-1)', () => {
    // Drive-letter segment ("C:") must not count toward depth, so
    // 'C:\Users\name' must compute the same effective depth (2) as the
    // already-refused POSIX '/Users/name' — and therefore be refused by
    // forceRemove's `< 3` guard, same as the POSIX case above.
    assert.equal(pathDepth('C:\\Users\\name'), 2);
    assert.equal(pathDepth('C:/Users/name'), 2);
    // A deeper Windows path must still be allowed through the guard.
    assert.equal(pathDepth('C:\\Users\\name\\skrun\\skills\\foo'), 5);
  });
});
