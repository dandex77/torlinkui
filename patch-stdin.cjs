// This script monkey-patches process.stdin to provide setRawMode, ref, and unref 
// for environments like Docker where process.stdin is a pipe and not a TTY.
// It then executes the intended command in the same process.

console.log('DEBUG: patch-stdin.cjs is being loaded');

// Patch isTTY for all standard streams
Object.defineProperty(process.stdin, 'isTTY', {
  get: () => true,
  configurable: true
});
Object.defineProperty(process.stdout, 'isTTY', {
  get: () => true,
  configurable: true
});
Object.defineProperty(process.stderr, 'isTTY', {
  get: () => true,
  configurable: true
});

// Patch missing TTY methods
if (typeof process.stdin.setRawMode !== 'function') {
  process.stdin.setRawMode = () => {};
}
if (typeof process.stdin.ref !== 'function') {
  process.stdin.ref = () => {};
}
if (typeof process.stdin.unref !== 'function') {
  process.stdin.unref = () => {};
}

// Patch tty.isatty to return true for stdin/out/err
// We use a proxy or redefine the method if possible.
// Since we are in a module being loaded via -r, we can attempt to patch the tty module.
try {
  const tty = require('tty');
  const originalIsatty = tty.isatty;
  tty.isatty = function(fd) {
    if (fd === process.stdin.fd || fd === process.stdout.fd || fd === process.stderr.fd) {
      return true;
    }
    return originalIsatty ? originalIsatty(fd) : false;
  };
  console.log('tty.isatty has been monkey-patched');
} catch (e) {
  console.error('Failed to patch tty.isatty:', e);
}

console.log('process.stdin has been monkey-patched');
