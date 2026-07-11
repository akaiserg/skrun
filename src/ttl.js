import { execFileSync } from 'child_process';
import { isWindows } from './config.js';
import { logInfo, logError } from './logger.js';

const CRON_MARKER = '# skrun-purge-auto';
const TASK_NAME = 'skrun-purge';

export function ensureScheduler() {
  try {
    if (isWindows) {
      ensureWindowsScheduler();
    } else {
      ensureCronScheduler();
    }
  } catch (err) {
    logError('scheduler', `Could not set up TTL scheduler: ${err.message}`, err.stack);
    console.warn(`Warning: could not set up TTL scheduler: ${err.message}`);
    console.warn('Expired installs will be cleaned on next "skrun purge" or CLI invocation.');
  }
}

function ensureCronScheduler() {
  let existing = '';
  try {
    existing = execFileSync('crontab', ['-l'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    // no crontab yet
  }

  if (existing.includes(CRON_MARKER)) return;

  const skrunBin = resolveSkrun();
  const cronLine = `*/15 * * * * ${skrunBin} purge ${CRON_MARKER}`;
  const newCrontab = existing.trimEnd() + '\n' + cronLine + '\n';

  execFileSync('crontab', ['-'], { input: newCrontab, stdio: ['pipe', 'pipe', 'pipe'] });
  logInfo('scheduler', 'Cron entry installed (every 15 min)');
  console.log('TTL scheduler: cron entry installed (every 15 min).');
}

function ensureWindowsScheduler() {
  try {
    execFileSync('schtasks', ['/Query', '/TN', TASK_NAME], { stdio: 'pipe' });
    return;
  } catch {
    // task doesn't exist yet
  }

  const skrunBin = resolveSkrun();
  execFileSync(
    'schtasks',
    ['/Create', '/TN', TASK_NAME, '/SC', 'MINUTE', '/MO', '15', '/TR', `"${skrunBin}" purge`, '/F'],
    { stdio: 'pipe' }
  );
  console.log('TTL scheduler: Windows task installed (every 15 min).');
}

function resolveSkrun() {
  try {
    const which = isWindows ? 'where' : 'which';
    return execFileSync(which, ['skrun'], { encoding: 'utf8' }).trim().split('\n')[0];
  } catch {
    return 'npx skrun';
  }
}

export function removeScheduler() {
  try {
    if (isWindows) {
      execFileSync('schtasks', ['/Delete', '/TN', TASK_NAME, '/F'], { stdio: 'pipe' });
    } else {
      let existing = '';
      try {
        existing = execFileSync('crontab', ['-l'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      } catch {
        return;
      }
      const filtered = existing
        .split('\n')
        .filter(line => !line.includes(CRON_MARKER))
        .join('\n');
      execFileSync('crontab', ['-'], { input: filtered, stdio: ['pipe', 'pipe', 'pipe'] });
    }
  } catch {
    // best-effort
  }
}
