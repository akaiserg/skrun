import { readLogs, clearLogs, logPath } from '../logger.js';

export function logsCommand(flags) {
  if (flags.clear) {
    clearLogs();
    console.log('Logs cleared.');
    return;
  }

  const lines = flags.lines ? parseInt(flags.lines, 10) : 50;
  const level = flags.errors ? 'error' : (flags.level || null);
  const entries = readLogs({ lines, level });

  if (entries.length === 0) {
    console.log(`No log entries${level ? ` at level "${level}"` : ''}. Log file: ${logPath}`);
    return;
  }

  console.log(`Showing ${entries.length} log entries${level ? ` (${level})` : ''}:\n`);
  for (const e of entries) {
    const time = new Date(e.ts).toLocaleString();
    const lvl = e.level === 'error' ? 'ERR' : 'INF';
    const cmd = e.command ? `[${e.command}]` : '';
    console.log(`  ${time} ${lvl} ${cmd} ${e.message}`);
    if (e.detail) {
      console.log(`    ${e.detail}`);
    }
  }
}
