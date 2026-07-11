import { createInterface } from 'readline';

export function multiSelect(items, { message = 'Select items:' } = {}) {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive selection requires a TTY. Use --force or pipe input.');
  }

  return new Promise((resolve, reject) => {
    const selected = new Set();
    let cursor = 0;

    const stdin = process.stdin;
    const stdout = process.stdout;

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    function render() {
      // move cursor up to re-render (clear previous output)
      stdout.write(`\x1b[${items.length + 2}A\x1b[J`);
      draw();
    }

    function draw() {
      stdout.write(`${message}\n`);
      stdout.write('  (↑/↓ navigate, space toggle, a all, enter confirm, esc cancel)\n');
      for (let i = 0; i < items.length; i++) {
        const check = selected.has(i) ? '●' : '○';
        const pointer = i === cursor ? '▸' : ' ';
        stdout.write(`  ${pointer} ${check} ${items[i].label || items[i].name || items[i]}\n`);
      }
    }

    // initial draw
    draw();

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onKey);
    }

    function onKey(key) {
      // ctrl-c
      if (key === '\x03') {
        cleanup();
        reject(new Error('Cancelled'));
        return;
      }

      // escape
      if (key === '\x1b' && key.length === 1) {
        cleanup();
        reject(new Error('Cancelled'));
        return;
      }

      // enter
      if (key === '\r' || key === '\n') {
        cleanup();
        const result = items.filter((_, i) => selected.has(i));
        resolve(result);
        return;
      }

      // arrow up
      if (key === '\x1b[A') {
        cursor = cursor > 0 ? cursor - 1 : items.length - 1;
        render();
        return;
      }

      // arrow down
      if (key === '\x1b[B') {
        cursor = cursor < items.length - 1 ? cursor + 1 : 0;
        render();
        return;
      }

      // space - toggle
      if (key === ' ') {
        if (selected.has(cursor)) {
          selected.delete(cursor);
        } else {
          selected.add(cursor);
        }
        render();
        return;
      }

      // 'a' - toggle all
      if (key === 'a' || key === 'A') {
        if (selected.size === items.length) {
          selected.clear();
        } else {
          for (let i = 0; i < items.length; i++) selected.add(i);
        }
        render();
        return;
      }
    }

    stdin.on('data', onKey);
  });
}

export function confirm(question) {
  if (!process.stdin.isTTY) return Promise.resolve(false);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${question} [y/N] `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
