import { cpSync, mkdirSync, rmSync, symlinkSync } from 'fs';
import { resolve, win32 } from 'path';
import { isWindows } from './config.js';

export function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
}

export function linkOrCopy(src, dst, { copy = false } = {}) {
  mkdirSync(dst, { recursive: true });
  rmSync(dst, { recursive: true, force: true });

  if (copy) {
    copyDir(src, dst);
    return 'copy';
  }

  try {
    symlinkSync(resolve(src), dst, isWindows ? 'junction' : undefined);
    return 'symlink';
  } catch (err) {
    if (err.code === 'EPERM' || err.code === 'EACCES') {
      console.warn('Warning: symlink failed (insufficient privileges), falling back to copy.');
      copyDir(src, dst);
      return 'copy';
    }
    throw err;
  }
}

const WINDOWS_ABSOLUTE_PATH = /^[a-zA-Z]:[\\/]/;

// Exported for direct unit testing of the path-depth safety guard without
// touching the filesystem (see test/fsutil.test.js, Gap G-1 regression).
export function pathDepth(p) {
  const isWindowsPath = WINDOWS_ABSOLUTE_PATH.test(p);
  const resolved = isWindowsPath ? win32.resolve(p) : resolve(p);
  const parts = resolved.split(/[\\/]/).filter(Boolean);
  // Drive-letter segment (e.g. "C:") is a root marker, equivalent to POSIX's
  // leading "/" (already excluded above by filter(Boolean)) — don't count it.
  return isWindowsPath ? parts.length - 1 : parts.length;
}

export function forceRemove(p) {
  if (!p) return;
  // ponytail: refuse to delete anything less than 3 levels deep — safety net
  if (pathDepth(p) < 3) return;
  const isWindowsPath = WINDOWS_ABSOLUTE_PATH.test(p);
  const resolved = isWindowsPath ? win32.resolve(p) : resolve(p);
  rmSync(resolved, { recursive: true, force: true });
}

