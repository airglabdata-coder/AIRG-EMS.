const fs = require('fs');
const path = require('path');

const file = process.argv[2];
const query = process.argv[3];

if (!file || !query) {
  console.log('Usage: node search_keyword.js <file> <query>');
  process.exit(1);
}

const filePath = path.isAbsolute(file) ? file : path.join(__dirname, '..', file);
if (!fs.existsSync(filePath)) {
  console.error(`File does not exist: ${filePath}`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let count = 0;
lines.forEach((line, index) => {
  if (line.toLowerCase().includes(query.toLowerCase())) {
    console.log(`${index + 1}: ${line.trim()}`);
    count++;
  }
});
console.log(`\nFound ${count} matches for "${query}" in ${file}`);
