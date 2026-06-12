require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const models = require('./models');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support base64 image uploads
app.use(express.static(__dirname)); // Serve static files (index.html, app.js, styles.css)

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR);
}

// Database connection Setup
const MONGODB_URI = process.env.MONGODB_URI;
let useLocalDB = false;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(async () => {
      console.log('Connected to MongoDB Atlas successfully.');
      await migrateLocalToMongo();
    })
    .catch(err => {
      console.error('Failed to connect to MongoDB Atlas. Falling back to local file database.', err.message);
      useLocalDB = true;
    });
} else {
  console.log('No MONGODB_URI found in .env. Using local file database (db.json).');
  useLocalDB = true;
}

// Helper to pull entire state from MongoDB
async function getMongoDBState() {
  const [
    employees,
    requests,
    projects,
    tasks,
    chats,
    dailyReports,
    announcements,
    notices,
    reimbursements,
    tickets,
    nationalHolidays,
    celebrationDays
  ] = await Promise.all([
    models.Employee.find({}),
    models.LeaveRequest.find({}),
    models.Project.find({}),
    models.Task.find({}),
    models.Chat.find({}),
    models.DailyReport.find({}),
    models.Announcement.find({}),
    models.Notice.find({}),
    models.Reimbursement.find({}),
    models.Ticket.find({}),
    models.NationalHoliday.find({}),
    models.CelebrationDay.find({})
  ]);

  let meta = await models.SystemMetadata.findOne({ key: 'lastUpdated' });
  if (!meta) {
    meta = await models.SystemMetadata.create({ key: 'lastUpdated', timestamp: Date.now() });
  }

  return {
    state: {
      employees: employees.map(x => x.toJSON()),
      requests: requests.map(x => x.toJSON()),
      projects: projects.map(x => x.toJSON()),
      tasks: tasks.map(x => x.toJSON()),
      chats: chats.map(x => x.toJSON()),
      dailyReports: dailyReports.map(x => x.toJSON()),
      announcements: announcements.map(x => x.toJSON()),
      notices: notices.map(x => x.toJSON()),
      reimbursements: reimbursements.map(x => x.toJSON()),
      tickets: tickets.map(x => x.toJSON()),
      nationalHolidays: nationalHolidays.map(h => ({ date: h.date, name: h.name })),
      celebrationDays: celebrationDays.map(c => ({ date: c.date, name: c.name }))
    },
    timestamp: meta.timestamp
  };
}

// Helper to bulk upsert array entries & handle deletions
async function syncCollection(Model, array, keyField = 'id') {
  if (!array || !Array.isArray(array)) return;

  const incomingIds = array.map(item => item[keyField]).filter(Boolean);

  // Delete documents no longer present in the client payload
  await Model.deleteMany({ [keyField]: { $nin: incomingIds } });

  // Construct bulk upserts
  const ops = array.map(item => {
    const { _id, ...cleanItem } = item; // strip existing mongo ID fields if present to prevent conflicts
    return {
      updateOne: {
        filter: { [keyField]: cleanItem[keyField] },
        update: { $set: cleanItem },
        upsert: true
      }
    };
  });

  if (ops.length > 0) {
    await Model.bulkWrite(ops);
  }
}

// Helper to save entire state in MongoDB
async function saveMongoDBState(stateObj) {
  const syncOps = [
    syncCollection(models.Employee, stateObj.employees, 'id'),
    syncCollection(models.LeaveRequest, stateObj.requests, 'id'),
    syncCollection(models.Project, stateObj.projects, 'id'),
    syncCollection(models.Task, stateObj.tasks, 'id'),
    syncCollection(models.Chat, stateObj.chats, 'id'),
    syncCollection(models.DailyReport, stateObj.dailyReports, 'id'),
    syncCollection(models.Announcement, stateObj.announcements, 'id'),
    syncCollection(models.Notice, stateObj.notices, 'id'),
    syncCollection(models.Reimbursement, stateObj.reimbursements, 'id'),
    syncCollection(models.Ticket, stateObj.tickets, 'id'),
    syncCollection(models.NationalHoliday, stateObj.nationalHolidays, 'date'),
    syncCollection(models.CelebrationDay, stateObj.celebrationDays, 'date')
  ];

  await Promise.all(syncOps);

  const timestamp = Date.now();
  await models.SystemMetadata.findOneAndUpdate(
    { key: 'lastUpdated' },
    { timestamp },
    { upsert: true }
  );

  return timestamp;
}

// Helper to migrate local db.json data to MongoDB Atlas if MongoDB is empty
async function migrateLocalToMongo() {
  try {
    const employeeCount = await models.Employee.countDocuments();
    if (employeeCount === 0) {
      console.log('MongoDB Atlas appears to be empty. Checking for local db.json to migrate...');
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        const localData = JSON.parse(fileContent);
        console.log('Found local db.json. Migrating records to MongoDB Atlas...');
        await saveMongoDBState(localData);
        console.log('Migration to MongoDB Atlas completed successfully!');
      } else {
        console.log('No local db.json found to migrate.');
      }
    } else {
      console.log('MongoDB Atlas already contains data. Skipping migration.');
    }
  } catch (err) {
    console.error('Error during local to MongoDB migration:', err);
  }
}

// Helper to wipe all data from MongoDB Atlas and seed the clean state
async function clearAndSeedMongoDB() {
  try {
    console.log('CLEAN_DB_ONCE is set to true. Wiping MongoDB Atlas collections...');
    await Promise.all([
      models.Employee.deleteMany({}),
      models.LeaveRequest.deleteMany({}),
      models.Project.deleteMany({}),
      models.Task.deleteMany({}),
      models.Chat.deleteMany({}),
      models.DailyReport.deleteMany({}),
      models.Announcement.deleteMany({}),
      models.Notice.deleteMany({}),
      models.Reimbursement.deleteMany({}),
      models.Ticket.deleteMany({}),
      models.NationalHoliday.deleteMany({}),
      models.CelebrationDay.deleteMany({}),
      models.SystemMetadata.deleteMany({}),
      models.PushSubscription.deleteMany({})
    ]);

    console.log('Seeding default Admin user into MongoDB Atlas...');
    const adminUser = {
      id: "EMP011",
      name: "Admin",
      dept: "Administration",
      email: "admin@company.com",
      role: "Admin",
      balance: 20,
      absent: 0,
      avatar: "AD",
      aadhar: "1111 2222 3333",
      pan: "ADMIR1111B",
      bankAcc: "1234567890",
      bankIfsc: "ICIC0000456 (ICICI)",
      password: "password123",
      salary: {
        basic: 90000,
        hra: 36000,
        other: 13500,
        profTax: 200,
        lwpDays: 0
      },
      phone: "+91 87654 01235"
    };
    await models.Employee.create(adminUser);

    console.log('Seeding default holidays into MongoDB Atlas...');
    const nationalHolidays = [
      { date: '2026-01-26', name: 'Republic Day' },
      { date: '2026-02-19', name: 'Shivjayanti' },
      { date: '2026-03-03', name: 'Dhulivandan' },
      { date: '2026-03-19', name: 'Gudipadva' },
      { date: '2026-04-14', name: 'Ambedkar Jayanti' },
      { date: '2026-05-01', name: 'Maharashtra Din' },
      { date: '2026-08-15', name: 'Independence Day' },
      { date: '2026-08-28', name: 'Raksha Bandhan' },
      { date: '2026-09-05', name: 'Gopalkala' },
      { date: '2026-09-14', name: 'Ganesh Chaturthi' },
      { date: '2026-10-02', name: 'Gandhi Jayanti' },
      { date: '2026-10-20', name: 'Dasara' },
      { date: '2026-11-09', name: 'Diwali' },
      { date: '2026-11-10', name: 'Diwali' },
      { date: '2026-11-11', name: 'Bhai Duj (Bhaubij)' },
      { date: '2026-12-25', name: 'Christmas' }
    ];
    const celebrationDays = [
      { date: '2026-01-12', name: 'National Youth Day' },
      { date: '2026-01-24', name: 'National Girl Child Day' },
      { date: '2026-02-28', name: 'National Science Day' },
      { date: '2026-03-08', name: 'International Women\'s Day' },
      { date: '2026-05-11', name: 'National Technology Day' },
      { date: '2026-07-29', name: 'Gurupornima' },
      { date: '2026-09-05', name: 'Teacher\'s Day' },
      { date: '2026-09-15', name: 'Engineer\'s Day' },
      { date: '2026-11-11', name: 'National Education Day' },
      { date: '2026-11-14', name: 'Children\'s Day' },
      { date: '2026-11-19', name: 'International Men\'s Day' }
    ];
    await models.NationalHoliday.insertMany(nationalHolidays);
    await models.CelebrationDay.insertMany(celebrationDays);

    await models.SystemMetadata.create({ key: 'lastUpdated', timestamp: Date.now() });
    console.log('MongoDB Atlas successfully cleared and seeded with default state.');
  } catch (err) {
    console.error('Failed to clear and seed MongoDB Atlas:', err);
  }
}

// Endpoint to fetch centralized state
app.get('/api/sync', async (req, res) => {
  if (!useLocalDB) {
    try {
      const data = await getMongoDBState();
      return res.json(data);
    } catch (err) {
      console.error('Failed to read from MongoDB Atlas:', err);
    }
  }

  // Local File Database Fallback
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
app.post('/api/sync', async (req, res) => {
  const newState = req.body;
  if (!newState) {
    return res.status(400).json({ error: 'Missing state payload' });
  }

  // Update MongoDB Atlas if active
  if (!useLocalDB) {
    try {
      const updatedTimestamp = await saveMongoDBState(newState);
      return res.json({ success: true, timestamp: updatedTimestamp });
    } catch (err) {
      console.error('Failed to write to MongoDB Atlas:', err);
    }
  }

  // Local File Database Fallback
  newState.lastUpdated = Date.now();
  fs.writeFile(DB_FILE, JSON.stringify(newState, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Failed to write database file:', err);
      return res.status(500).json({ error: 'Failed to save database' });
    }
    res.json({ success: true, timestamp: newState.lastUpdated });
  });
});


// Configure Web Push VAPID Details
let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
let vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@company.com';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.log('\n===================================================');
  console.log('⚠️  VAPID keys not fully configured in .env.');
  console.log('Generating temporary keys for this session...');
  const keys = webpush.generateVAPIDKeys();
  vapidPublicKey = keys.publicKey;
  vapidPrivateKey = keys.privateKey;
  console.log('PUBLIC KEY (save as VAPID_PUBLIC_KEY in .env):');
  console.log(vapidPublicKey);
  console.log('PRIVATE KEY (save as VAPID_PRIVATE_KEY in .env):');
  console.log(vapidPrivateKey);
  console.log('===================================================\n');
}

webpush.setVapidDetails(
  vapidEmail,
  vapidPublicKey,
  vapidPrivateKey
);

// Keep a local in-memory fallback list of subscriptions if MongoDB fails or is not used
let localSubscriptions = [];

// Endpoint to share Public VAPID Key with client dynamically
app.get('/api/notifications/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// Endpoint to register a Web Push subscription
app.post('/api/notifications/subscribe', async (req, res) => {
  const { employeeId, subscription } = req.body;
  if (!employeeId || !subscription) {
    return res.status(400).json({ error: 'Missing employeeId or subscription' });
  }

  if (!useLocalDB) {
    try {
      // Remove this endpoint from any other employees to prevent cross-user notification leakage
      await models.PushSubscription.deleteMany({
        employeeId: { $ne: employeeId },
        'subscription.endpoint': subscription.endpoint
      });

      await models.PushSubscription.findOneAndUpdate(
        { employeeId, 'subscription.endpoint': subscription.endpoint },
        { employeeId, subscription },
        { upsert: true, new: true }
      );
      return res.json({ success: true });
    } catch (err) {
      console.error('Failed to save subscription to MongoDB:', err);
    }
  }

  // Local fallback
  localSubscriptions = localSubscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
  localSubscriptions.push({ employeeId, subscription });
  res.json({ success: true });
});

// Endpoint to send/simulate push notifications
app.post('/api/send-notification', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message parameters' });
  }

  // 1. Resolve target employeeId from phone number or name
  let employeeId = null;
  let employeeName = 'Employee';

  if (!useLocalDB) {
    try {
      const emp = await models.Employee.findOne({ phone: to });
      if (emp) {
        employeeId = emp.id;
        employeeName = emp.name;
      }
    } catch (err) {
      console.error('Failed to lookup employee in MongoDB:', err);
    }
  } else {
    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        const dbData = JSON.parse(fileContent);
        const emp = (dbData.employees || []).find(e => e.phone === to);
        if (emp) {
          employeeId = emp.id;
          employeeName = emp.name;
        }
      } catch (err) {
        console.error('Failed to read db.json locally for lookup:', err);
      }
    }
  }

  // Direct ID fallback (if to is already an EMPxxx id)
  if (!employeeId) {
    if (to.startsWith('EMP')) {
      employeeId = to;
    } else {
      console.log(`⚠️  Could not resolve identifier "${to}" to an employee ID. Push skipped.`);
      return res.status(404).json({ error: 'Employee not found' });
    }
  }

  // 2. Fetch active browser subscriptions
  let subscriptions = [];
  if (!useLocalDB) {
    try {
      subscriptions = await models.PushSubscription.find({ employeeId });
    } catch (err) {
      console.error('Failed to load subscriptions from MongoDB:', err);
    }
  } else {
    subscriptions = localSubscriptions.filter(s => s.employeeId === employeeId);
  }

  if (subscriptions.length === 0) {
    console.log(`📱 [Web Push Simulation (No Subscriptions)] To: ${employeeName} (${employeeId}) - Msg: "${message}"`);
    return res.json({ success: true, mode: 'simulation', reason: 'No subscriptions' });
  }

  // 3. Dispatch payloads
  const payload = JSON.stringify({
    title: 'AIRG Employee Portal',
    body: message,
    url: '/'
  });

  const sendPromises = subscriptions.map(async sub => {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      console.log(`📱 [Web Push Sent] To: ${employeeName} (${employeeId}), Endpoint: ${sub.subscription.endpoint.substring(0, 45)}...`);
    } catch (pushErr) {
      // Clean up expired subscriptions
      if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
        console.log(`🧹 Cleaning up expired push subscription for employee ${employeeId}`);
        if (!useLocalDB) {
          await models.PushSubscription.deleteOne({ _id: sub._id });
        } else {
          localSubscriptions = localSubscriptions.filter(s => s.subscription.endpoint !== sub.subscription.endpoint);
        }
      } else {
        console.error(`❌ Web Push failed:`, pushErr.message);
      }
    }
  });

  await Promise.all(sendPromises);
  res.json({ success: true, mode: 'webpush', count: subscriptions.length });
});


// Start the unified server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 AIR G International EMS Server is running!`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📁 Local Database Path: ${DB_FILE}`);
  console.log(`===================================================`);
});
