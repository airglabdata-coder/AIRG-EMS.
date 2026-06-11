const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support base64 image uploads
app.use(express.static(__dirname)); // Serve static files (index.html, app.js, styles.css)

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR);
}

// Endpoint to fetch centralized state
app.get('/api/sync', (req, res) => {
  if (!fs.existsSync(DB_FILE)) {
    return res.json({ empty: true });
  }
  
  fs.readFile(DB_FILE, 'utf8', (err, data) => {
    if (err) {
      console.error('Failed to read database file:', err);
      return res.status(500).json({ error: 'Failed to read database' });
    }
    try {
      const parsed = JSON.parse(data);
      res.json({ state: parsed, timestamp: parsed.lastUpdated || Date.now() });
    } catch (parseErr) {
      console.error('Failed to parse database JSON:', parseErr);
      res.json({ empty: true });
    }
  });
});

// Endpoint to overwrite/sync centralized state
app.post('/api/sync', (req, res) => {
  const newState = req.body;
  if (!newState) {
    return res.status(400).json({ error: 'Missing state payload' });
  }

  // Add a server-side timestamp to verify which client's state is newer
  newState.lastUpdated = Date.now();

  fs.writeFile(DB_FILE, JSON.stringify(newState, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Failed to write database file:', err);
      return res.status(500).json({ error: 'Failed to save database' });
    }
    res.json({ success: true, timestamp: newState.lastUpdated });
  });
});

// Endpoint to send/simulate notifications (SMS/WhatsApp)
app.post('/api/send-notification', (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message parameters' });
  }

  console.log(`\n===================================================`);
  console.log(`📱 [SMS/WhatsApp GATEWAY SIMULATION]`);
  console.log(`➡️ To: ${to}`);
  console.log(`💬 Message: "${message}"`);
  console.log(`📅 Sent At: ${new Date().toISOString()}`);
  console.log(`===================================================\n`);

  res.json({ success: true, timestamp: Date.now() });
});


// Start the unified server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 AIR G International EMS Server is running!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📁 Database Path: ${DB_FILE}`);
  console.log(`===================================================`);
});
