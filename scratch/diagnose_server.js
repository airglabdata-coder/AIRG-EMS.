const http = require('http');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'diagnose.log');

// Clear existing log
fs.writeFileSync(logFile, '=== Diagnostic Log ===\n');

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const logMsg = `[${data.type.toUpperCase()}] ${data.message}\n`;
        fs.appendFileSync(logFile, logMsg);
        console.log(logMsg.trim());
      } catch (err) {
        fs.appendFileSync(logFile, `[RAW] ${body}\n`);
        console.log(`[RAW] ${body}`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(51948, '127.0.0.1', () => {
  console.log('Diagnostic server listening on http://127.0.0.1:51948');
});
