import { homedir, platform } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';

const home = homedir();
const xdg = process.env.XDG_CONFIG_HOME;
const skrunOverride = process.env.SKRUN_CONFIG_DIR;

export const configDir = skrunOverride || (xdg ? join(xdg, 'skrun') : join(home, '.config', 'skrun'));
export const skillsDir = join(configDir, 'skills');
export const registryPath = join(configDir, 'registry.json');
export const isWindows = platform() === 'win32';

export function ensureConfig() {
  mkdirSync(skillsDir, { recursive: true });
}
