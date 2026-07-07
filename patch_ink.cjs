const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.join('node_modules', 'ink', 'build', 'components', 'App.js'),
  path.join('node_modules', 'ink', 'build', 'hooks', 'use-input.js')
];

filesToPatch.forEach(relativeFilePath => {
  const filePath = path.resolve(relativeFilePath);
  
  if (fs.existsSync(filePath)) {
    console.log(`Patching ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Replace all occurrences of stdin.setRawMode(true/false);
    // We'll use a regex that matches the pattern regardless of what's before it.
    const stdinSetRawModeRegex = /stdin\.setRawMode\s*\((true|false)\);/g;
    if (stdinSetRawModeRegex.test(content)) {
        // We use replace with a function to handle the replacement safely.
        // To avoid the "double replacement" issue, we check if it's already patched.
        content = content.replace(stdinSetRawModeRegex, (match, value) => {
            // Check if the match is already part of a safety check
            // This is a bit hacky but we want to avoid re-patching if possible.
            // However, since we are rebuilding the container, this shouldn't be a problem.
            // The real problem was the indentation in the previous version.
            // We'll just do a simple replacement.
            changed = true;
            return `if (typeof stdin.setRawMode === "function") stdin.setRawMode(${value});`;
        });
    }

    // 2. Replace all occurrences of setRawMode(true/false);
    const setRawModeRegex = /setRawMode\s*\((true|false)\);/g;
    if (setRawModeRegex.test(content)) {
        content = content.replace(setRawModeRegex, (match, value) => {
            changed = true;
            return `if (typeof setRawMode === "function") setRawMode(${value});`;
        });
    }

    // 3. Replace all occurrences of stdin.ref();
    const stdinRefRegex = /stdin\.ref\s*\(\);/g;
    if (stdinRefRegex.test(content)) {
        content = content.replace(stdinRefRegex, 'if (typeof stdin.ref === "function") stdin.ref();');
        changed = true;
    }
    
    // 4. Replace all occurrences of stdin.unref();
    const stdinUnrefRegex = /stdin\.unref\s*\(\);/g;
    if (stdinUnrefRegex.test(content)) {
        content = content.replace(stdinUnrefRegex, 'if (typeof stdin.unref === "function") stdin.unref();');
        changed = true;
    }

    // 5. Replace all occurrences of isRawModeSupported assignment
    const isRawModeRegex = /const isRawModeSupported = stdin\.isTTY;/g;
    if (isRawModeRegex.test(content)) {
        content = content.replace(isRawModeRegex, 'const isRawModeSupported = true;');
        changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Successfully patched ${filePath}`);
    } else {
      console.log(`No changes needed for ${filePath}`);
    }
  } else {
    console.error(`Could not find ${filePath}`);
  }
});