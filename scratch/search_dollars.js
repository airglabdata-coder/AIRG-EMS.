const fs = require('fs');

function searchFile(filePath, query) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const results = [];
  lines.forEach((line, index) => {
    if (line.includes(query)) {
      results.push({ lineNum: index + 1, content: line.trim() });
    }
  });
  return results;
}

console.log('=== SEARCHING app.js FOR toLocaleString ===');
console.log(searchFile('app.js', 'toLocaleString').slice(0, 30));

console.log('=== SEARCHING app.js FOR $$ ===');
console.log(searchFile('app.js', '$$').slice(0, 30));

console.log('=== SEARCHING index.html FOR ($) ===');
console.log(searchFile('index.html', '($)').slice(0, 30));

console.log('=== SEARCHING index.html FOR dollar ===');
console.log(searchFile('index.html', 'dollar').slice(0, 30));
