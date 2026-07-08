require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const models = require('./models');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 5000;

// Ephemeral active users tracking
const activeUsers = {};


app.use(cors());
app.use(express.json({ limit: '50mb' })); // Support base64 image uploads
app.use(express.static(__dirname)); // Serve static files (index.html, app.js, styles.css)

// Database connection Setup — MongoDB Atlas is REQUIRED
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('============================================================');
  console.error('❌ FATAL: MONGODB_URI is not set in .env file.');
  console.error('   This application requires MongoDB Atlas to function.');
  console.error('   Please set MONGODB_URI in your .env file and restart.');
  console.error('============================================================');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB Atlas successfully.');
  })
  .catch(err => {
    console.error('============================================================');
    console.error('❌ FATAL: Failed to connect to MongoDB Atlas.');
    console.error('   Error:', err.message);
    console.error('   Please check your MONGODB_URI and network connection.');
    console.error('============================================================');
    process.exit(1);
  });

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
    celebrationDays,
    schools
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
    models.CelebrationDay.find({}),
    models.School.find({})
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
      celebrationDays: celebrationDays.map(c => ({ date: c.date, name: c.name })),
      schools: schools.map(x => x.toJSON())
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
    const { _id, __v, ...cleanItem } = item; // strip existing mongo ID fields if present to prevent conflicts
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
    syncCollection(models.CelebrationDay, stateObj.celebrationDays, 'date'),
    syncCollection(models.School, stateObj.schools, 'id')
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
      models.PushSubscription.deleteMany({}),
      models.School.deleteMany({})
    ]);

    console.log('Seeding default Admin user into MongoDB Atlas...');
    const adminUser = {
      id: "AIRG00001",
      name: "Pratap Pawar",
      dept: "AI, Electronics, Lab Setup, Instructor",
      email: "pratap@gurujiair.com",
      role: "Admin",
      balance: 20,
      absent: 0,
      avatar: "PP",
      aadhar: "1234 5700 0000",
      pan: "PRATA1234P",
      bankAcc: "98765432112",
      bankIfsc: "HDFC0000123",
      password: "pratap",
      phone: "+91 98607 79172"
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

// Helper to track and clean active users
function trackAndGetActiveUsers(employeeId, isActiveParam) {
  if (employeeId) {
    if (isActiveParam === 'false') {
      delete activeUsers[employeeId];
    } else {
      activeUsers[employeeId] = Date.now();
    }
  }

  // Clean up inactive users (older than 15 seconds)
  const now = Date.now();
  for (const [id, lastSeen] of Object.entries(activeUsers)) {
    if (now - lastSeen >= 15000) {
      delete activeUsers[id];
    }
  }

  return Object.keys(activeUsers);
}

// Endpoint to fetch centralized state
app.get('/api/sync', async (req, res) => {
  try {
    const data = await getMongoDBState();
    data.activeUsers = trackAndGetActiveUsers(req.query.employeeId, req.query.active);
    return res.json(data);
  } catch (err) {
    console.error('❌ Failed to read from MongoDB Atlas:', err.message);
    return res.status(500).json({ error: 'Database read failed. Please try again.' });
  }
});

// Endpoint to overwrite/sync centralized state
app.post('/api/sync', async (req, res) => {
  const newState = req.body;
  if (!newState) {
    return res.status(400).json({ error: 'Missing state payload' });
  }

  try {
    const updatedTimestamp = await saveMongoDBState(newState);
    const activeList = trackAndGetActiveUsers(req.query.employeeId, req.query.active);
    return res.json({ success: true, timestamp: updatedTimestamp, activeUsers: activeList });
  } catch (err) {
    console.error('❌ Failed to write to MongoDB Atlas:', err.message);
    return res.status(500).json({ error: 'Database write failed. Please try again.' });
  }
});

// Endpoint to log employee activity (login/logout times by date)
app.post('/api/activity-log', async (req, res) => {
  const { employeeId, type } = req.body;
  if (!employeeId || !type) {
    return res.status(400).json({ error: 'Missing employeeId or type' });
  }

  try {
    const emp = await models.Employee.findOne({ id: employeeId });
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const dateObj = new Date();
    const dateOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' };
    const timeOptions = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };

    const formattedDate = dateObj.toLocaleDateString('en-US', dateOptions);
    const formattedTime = dateObj.toLocaleTimeString('en-US', timeOptions);
    const nowMs = dateObj.getTime();

    let logs = emp.get('activityLogs') || [];
    let dayEntry = logs.find(log => log.date === formattedDate);

    if (!dayEntry) {
      dayEntry = { date: formattedDate, sessions: [] };
      logs.push(dayEntry);
    }

    // Ensure sessions array exists (migrating old {login, logout} records)
    if (!dayEntry.sessions) {
      // Migrate legacy format
      const legacySessions = [];
      if (dayEntry.login || dayEntry.logout) {
        legacySessions.push({ login: dayEntry.login || '', logout: dayEntry.logout || '', loginMs: null, logoutMs: null });
      }
      dayEntry.sessions = legacySessions;
      delete dayEntry.login;
      delete dayEntry.logout;
    }

    if (type === 'login') {
      // Start a new session
      dayEntry.sessions.push({ login: formattedTime, logout: '', loginMs: nowMs, logoutMs: null });
    } else if (type === 'logout') {
      // Close the most recent open session (no logout yet)
      const openSession = [...dayEntry.sessions].reverse().find(s => s.login && !s.logout);
      if (openSession) {
        openSession.logout = formattedTime;
        openSession.logoutMs = nowMs;
        // Compute duration for this session in minutes
        if (openSession.loginMs) {
          openSession.durationMinutes = Math.round((nowMs - openSession.loginMs) / 60000);
        }
      } else {
        // No open session found — add a standalone logout entry
        dayEntry.sessions.push({ login: '', logout: formattedTime, loginMs: null, logoutMs: nowMs, durationMinutes: 0 });
      }
    }

    // Recalculate total worked minutes for this day
    dayEntry.totalMinutesWorked = dayEntry.sessions.reduce((sum, s) => {
      if (s.loginMs && s.logoutMs) {
        return sum + Math.round((s.logoutMs - s.loginMs) / 60000);
      }
      return sum + (s.durationMinutes || 0);
    }, 0);

    emp.set('activityLogs', logs);
    emp.markModified('activityLogs');
    await emp.save();

    // Trigger client updates by modifying sync metadata
    const timestamp = Date.now();
    await models.SystemMetadata.findOneAndUpdate(
      { key: 'lastUpdated' },
      { timestamp },
      { upsert: true }
    );

    return res.json({ success: true, activityLogs: logs, timestamp });
  } catch (err) {
    console.error('Failed to log activity:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
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
    return res.status(500).json({ error: 'Failed to save subscription' });
  }
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

  try {
    const emp = await models.Employee.findOne({ phone: to });
    if (emp) {
      employeeId = emp.id;
      employeeName = emp.name;
    }
  } catch (err) {
    console.error('Failed to lookup employee in MongoDB:', err);
  }

  // Direct ID fallback (if to is already an AIRG/EMP id)
  if (!employeeId) {
    if (to.startsWith('EMP') || to.startsWith('AIRG')) {
      employeeId = to;
    } else {
      console.log(`⚠️  Could not resolve identifier "${to}" to an employee ID. Push skipped.`);
      return res.status(404).json({ error: 'Employee not found' });
    }
  }

  // 2. Fetch active browser subscriptions
  let subscriptions = [];
  try {
    subscriptions = await models.PushSubscription.find({ employeeId });
  } catch (err) {
    console.error('Failed to load subscriptions from MongoDB:', err);
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
        await models.PushSubscription.deleteOne({ _id: sub._id });
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
  console.log(`💾 Database: MongoDB Atlas (sole data store)`);
  console.log(`===================================================`);
});
