const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app.js');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Lines to remove (0-indexed): 10579 to 10587 (1-indexed: 10580 to 10588)
// We need to delete lines at 0-indexed positions 10579..10587 (inclusive)
// But keep line 10579 (0-indexed) which is "        </div>"
// The orphaned lines are at 0-indexed 10579..10587 i.e., 1-indexed 10580-10588

// Remove 0-indexed lines 10579 through 10587 (9 lines: tbody, ${rows}, /tbody, /table, /div, backtick+semi, })()}, /div, backtick)
// Confirm: line at index 10579 (1-indexed 10580) = "                  <tbody>"

const removedLines = lines.splice(10579, 9);
console.log('Removed lines:');
removedLines.forEach((l, i) => console.log(`  ${10580 + i}: ${l}`));

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Done. File written successfully.');
