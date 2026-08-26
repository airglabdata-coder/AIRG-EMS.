require('dotenv').config();
const dns = require('dns');
// Only override DNS on local Windows environment (NOT on Vercel — it breaks MongoDB connection)
if (!process.env.VERCEL) {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const models = require('./models');
const webpush = require('web-push');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

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

const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,  // Fail fast if DB is down (was 10s)
  socketTimeoutMS: 20000,          // Shorter socket timeout (was 45s)
  connectTimeoutMS: 5000,          // Connection attempt timeout
  maxPoolSize: 10,                 // Connection pool for serverless
  heartbeatFrequencyMS: 10000,     // Check connection health every 10s
};

// Implement connection caching for serverless environments (Vercel)
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, mongooseOptions).then(mongoose => mongoose);
  }
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    console.error('❌ FATAL: Failed to connect to MongoDB Atlas.', err.message);
    throw err;
  }
}

// Helper to pull entire state from MongoDB
async function getMongoDBState() {
  await connectDB();
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
    schools,
    trainerReports
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
    models.School.find({}),
    models.TrainerReport.find({})
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
      schools: schools.map(x => x.toJSON()),
      trainerReports: trainerReports.map(x => x.toJSON())
    },
    timestamp: meta.timestamp
  };
}

// Helper to bulk upsert array entries & handle deletions
async function syncCollection(Model, array, keyField = 'id', isReviewer = false, syncingEmployeeId = null) {
  if (!array || !Array.isArray(array)) return;

  const incomingIds = array.map(item => item[keyField]).filter(Boolean);

  let existingRecordsMap = new Map();
  if (['LeaveRequest', 'Ticket', 'Reimbursement', 'DailyReport', 'TrainerReport'].includes(Model.modelName)) {
    const existingRecords = await Model.find({ [keyField]: { $in: incomingIds } }).lean();
    existingRecordsMap = new Map(existingRecords.map(r => [r[keyField], r]));
  }

  if (Model.modelName === 'Employee') {
    // For Employee model, permanently delete any employee marked as isDeleted: true
    const deletedEmployees = array.filter(item => item.isDeleted);
    const deletedIds = deletedEmployees.map(item => item[keyField]).filter(Boolean);
    if (deletedIds.length > 0) {
      await Model.deleteMany({ [keyField]: { $in: deletedIds } });
    }
    // Filter them out so we don't upsert them
    array = array.filter(item => !item.isDeleted);
  }

  if (Model.modelName === 'Employee') {
    array = array.filter(item => {
      if (item.isDeleted) return false;
      const existing = existingRecordsMap.get(item[keyField]);
      if (!existing) {
        // Doesn't exist in DB. Allow if new registration or if synced by Admin/HR.
        if (item.status === 'pending_approval' || isReviewer) return true;
        console.log(`[Smart Merge] Blocked resurrection of employee ${item[keyField]} by non-admin`);
        return false;
      }
      return true;
    });
  }

  // Construct bulk upserts
  const ops = array.map(item => {
    const { _id, __v, ...cleanItem } = item; // strip existing mongo ID fields if present to prevent conflicts

    // === SMART MERGE AUTHORITY SYSTEM ===
    // Prevent stale data from non-HR users from overwriting HR approvals
    if (['LeaveRequest', 'Ticket', 'Reimbursement', 'DailyReport', 'TrainerReport'].includes(Model.modelName)) {
      const existing = existingRecordsMap.get(cleanItem[keyField]);
      if (existing) {
        if (['LeaveRequest', 'Ticket', 'Reimbursement'].includes(Model.modelName)) {
          if (existing.status && existing.status.toLowerCase() !== 'pending') {
            cleanItem.status = existing.status;
            if (existing.approvedBy) cleanItem.approvedBy = existing.approvedBy;
            if (existing.rejectedBy) cleanItem.rejectedBy = existing.rejectedBy;
            if (existing.comment) cleanItem.comment = existing.comment;
          }
        } else if (Model.modelName === 'DailyReport') {
          if (existing.reviewedBy) cleanItem.reviewedBy = existing.reviewedBy;
          if (existing.remarks) cleanItem.remarks = existing.remarks;
          if (existing.reviewedAt) cleanItem.reviewedAt = existing.reviewedAt;
          if (existing.starRating !== undefined) cleanItem.starRating = existing.starRating;
        } else if (Model.modelName === 'TrainerReport') {
          if (existing.status && existing.status !== 'pending_manager') {
            cleanItem.status = existing.status;
          }
          if (existing.managerReview) cleanItem.managerReview = existing.managerReview;
          if (existing.hrReview) cleanItem.hrReview = existing.hrReview;
          if (existing.ceoReview) cleanItem.ceoReview = existing.ceoReview;
        }
      }
    }

    // === TASK SMART-MERGE ===
    // PROBLEM: Multiple users are always POSTing their full local state.
    // If User A saves a task with images, then User B (who has an older copy of
    // the task with no images) does their routine sync POST, B's sync would
    // overwrite A's images with an empty array — losing the attachment.
    //
    // FIX: For the Task model, we use a protective merge strategy:
    //   - Only overwrite `images` / `details` / `driveLinks` if the incoming
    //     value is actually populated, OR if the syncing user is the
    //     task's assignee (they have full authority over their own task).
    if (Model.modelName === 'Task') {
      const setFields = { ...cleanItem };
      const isAssignee = syncingEmployeeId && cleanItem.assigneeId === syncingEmployeeId;

      if (!isAssignee) {
        // Non-assignee syncing: protect rich content fields from being wiped
        if (!cleanItem.images || cleanItem.images.length === 0) {
          delete setFields.images;
        }
        if (cleanItem.details === undefined || cleanItem.details === null || cleanItem.details === '') {
          delete setFields.details;
        }
        if (!cleanItem.driveLinks || cleanItem.driveLinks.length === 0) {
          delete setFields.driveLinks;
        }
      }

      return {
        updateOne: {
          filter: { [keyField]: cleanItem[keyField] },
          update: { $set: setFields },
          upsert: true
        }
      };
    }

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
async function saveMongoDBState(stateObj, syncingEmployeeId) {
  await connectDB();

  // 1. Fetch all existing employees from MongoDB first to validate/merge
  const existingEmployees = await models.Employee.find({});
  const existingMap = new Map(existingEmployees.map(e => [e.id, e]));

  // 2. Fetch the syncing user to check their role
  let isReviewer = false;
  if (syncingEmployeeId) {
    const syncingUser = existingMap.get(syncingEmployeeId);
    if (syncingUser) {
      const roleLower = (syncingUser.role || '').toLowerCase();
      if (roleLower.includes('admin') || roleLower.includes('hr')) {
        isReviewer = true;
      }
    }
  }

  // 3. Process the incoming employees list based on the syncing user's permissions
  let finalEmployees = [];

  if (isReviewer) {
    // Admin/HR can sync everything as is
    finalEmployees = stateObj.employees || [];
  } else {
    // If not HR/Admin (i.e. guest registering, or regular employee syncing):
    // Start with the existing database employees as the base
    finalEmployees = existingEmployees.map(e => e.toJSON());
    const finalMap = new Map(finalEmployees.map(e => [e.id, e]));

    const incomingEmployees = stateObj.employees || [];
    incomingEmployees.forEach(incoming => {
      if (!incoming || !incoming.id) return;

      const existing = finalMap.get(incoming.id);
      if (!existing) {
        // New registration request: guest registers as 'pending_approval'
        incoming.status = 'pending_approval';
        if (incoming.role && incoming.role.toLowerCase().includes('admin')) {
          incoming.role = 'Employee';
        }
        finalEmployees.push(incoming);
      } else {
        // Regular employee can only update their own record
        if (incoming.id === syncingEmployeeId) {
          // Merge their changes but preserve status and role from database
          const merged = {
            ...existing,
            ...incoming,
            status: existing.status, // Preserve status from database
            role: existing.role      // Preserve role from database
          };
          const idx = finalEmployees.findIndex(e => e.id === incoming.id);
          if (idx !== -1) {
            finalEmployees[idx] = merged;
          }
        }
      }
    });
  }

  // Assign the sanitized employees array back to the stateObj so syncCollection saves it
  stateObj.employees = finalEmployees;

  // 4. Validate and sanitize incoming Projects
  let finalProjects = [];
  const existingProjects = await models.Project.find({});
  const existingProjectsMap = new Map(existingProjects.map(p => [p.id, p]));
  const syncingUser = syncingEmployeeId ? existingMap.get(syncingEmployeeId) : null;
  const syncingUserRole = syncingUser ? (syncingUser.role || '').toLowerCase() : '';
  const isHRorAdmin = (
    syncingUserRole.includes('admin') ||
    syncingUserRole.includes('hr') ||
    syncingUserRole.includes('manager') ||
    syncingUserRole.includes('tech lead') ||
    syncingUserRole.includes('techlead')
  );

  if (isHRorAdmin) {
    // Admin and HR can modify any projects
    finalProjects = stateObj.projects || [];
  } else {
    // If not HR/Admin, start with the existing database projects as the base
    finalProjects = existingProjects.map(p => p.toJSON());
    const finalProjectsMap = new Map(finalProjects.map(p => [p.id, p]));

    const incomingProjects = stateObj.projects || [];
    incomingProjects.forEach(incoming => {
      if (!incoming || !incoming.id) return;

      const existing = finalProjectsMap.get(incoming.id);
      if (existing) {
        // Check if the syncing user is the Tech Lead of this project
        const isTechLead = syncingEmployeeId && existing.techLeadId === syncingEmployeeId;
        if (isTechLead) {
          // Tech Lead can update this project!
          const idx = finalProjects.findIndex(p => p.id === incoming.id);
          if (idx !== -1) {
            finalProjects[idx] = incoming;
          }
        }
      } else {
        // This is a new project! Allow it if the syncing user is the Tech Lead of this new project
        const isTechLead = syncingEmployeeId && incoming.techLeadId === syncingEmployeeId;
        if (isTechLead) {
          finalProjects.push(incoming);
        }
      }
    });
  }
  stateObj.projects = finalProjects;

  // 5. Validate and sanitize incoming Schools
  let finalSchools = [];
  const existingSchools = await models.School.find({});
  const isHROrManagerOrLead = syncingUserRole.includes('admin') || syncingUserRole.includes('hr') || syncingUserRole.includes('manager') || syncingUserRole.includes('tech lead') || syncingUserRole.includes('techlead');

  if (isHROrManagerOrLead) {
    finalSchools = stateObj.schools || [];
  } else {
    finalSchools = existingSchools.map(s => s.toJSON());
  }
  stateObj.schools = finalSchools;

  // Omission-based deletion block completely removed to prevent data loss.
  // All deletions now happen exclusively through the explicit /api/delete-record endpoint.

  const syncOps = [
    syncCollection(models.Employee, stateObj.employees, 'id', isReviewer),
    syncCollection(models.LeaveRequest, stateObj.requests, 'id', isReviewer),
    syncCollection(models.Project, stateObj.projects, 'id', isReviewer),
    syncCollection(models.Task, stateObj.tasks, 'id', isReviewer, syncingEmployeeId),
    syncCollection(models.Chat, stateObj.chats, 'id', isReviewer),
    syncCollection(models.DailyReport, stateObj.dailyReports, 'id', isReviewer),
    syncCollection(models.Announcement, stateObj.announcements, 'id', isReviewer),
    syncCollection(models.Notice, stateObj.notices, 'id', isReviewer),
    syncCollection(models.Reimbursement, stateObj.reimbursements, 'id', isReviewer),
    syncCollection(models.Ticket, stateObj.tickets, 'id', isReviewer),
    syncCollection(models.NationalHoliday, stateObj.nationalHolidays, 'date', isReviewer),
    syncCollection(models.CelebrationDay, stateObj.celebrationDays, 'date', isReviewer),
    syncCollection(models.School, stateObj.schools, 'id', isReviewer),
    syncCollection(models.TrainerReport, stateObj.trainerReports, 'id', isReviewer)
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

// Helper to track and clean active users with full identifier alias matching via MongoDB Atlas (serverless safe)
async function trackAndGetActiveUsers(employeeId, isActiveParam) {
  try {
    let doc = await models.SystemMetadata.findOne({ key: 'activeUsersMap' });
    let map = {};
    if (doc && doc.value) {
      if (typeof doc.value === 'object') {
        map = { ...doc.value };
      }
    }

    if (employeeId) {
      const keysToTrack = new Set([employeeId, employeeId.toLowerCase()]);
      if (employeeId === 'AIRG00041' || employeeId === 'AIRGO000182' || employeeId.includes('atharva')) {
        keysToTrack.add('AIRG00041');
        keysToTrack.add('AIRGO000182');
        keysToTrack.add('airg00041');
        keysToTrack.add('airgo000182');
        keysToTrack.add('atharva@gurujiair.com');
        keysToTrack.add('atharvarnahire182@gmail.com');
      }

      keysToTrack.forEach(key => {
        if (isActiveParam === 'false') {
          delete map[key];
        } else {
          map[key] = Date.now();
        }
      });
    }

    // Clean up inactive users (older than 45 seconds)
    const now = Date.now();
    for (const [id, lastSeen] of Object.entries(map)) {
      if (now - lastSeen >= 45000) {
        delete map[id];
      }
    }

    // Persist active users map to MongoDB Atlas
    await models.SystemMetadata.findOneAndUpdate(
      { key: 'activeUsersMap' },
      { key: 'activeUsersMap', value: map, timestamp: now },
      { upsert: true }
    );

    return Object.keys(map);
  } catch (err) {
    console.error('Error tracking active users in MongoDB Atlas:', err.message);
    return [];
  }
}

// Helper to automatically update the active session's logout time (heartbeat tracking)
async function updateUserSessionHeartbeat(employeeId) {
  if (!employeeId) return;
  try {
    const emp = await models.Employee.findOne({ id: employeeId });
    if (!emp) return;

    const dateObj = new Date();
    const dateOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' };
    const timeOptions = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };

    const formattedDate = dateObj.toLocaleDateString('en-US', dateOptions);
    const formattedTime = dateObj.toLocaleTimeString('en-US', timeOptions);
    const nowMs = dateObj.getTime();

    let logs = emp.get('activityLogs') || [];
    let dayEntry = logs.find(log => log.date === formattedDate);

    // If no entry for today, we can create one
    if (!dayEntry) {
      dayEntry = { date: formattedDate, sessions: [] };
      logs.push(dayEntry);
    }

    if (!dayEntry.sessions) {
      dayEntry.sessions = [];
    }

    // Check if there was an active session on a previous day and auto-close it
    let modifiedAny = false;
    logs.forEach(log => {
      if (log.date !== formattedDate && log.sessions) {
        log.sessions.forEach(s => {
          if (s.login && s.explicitLogout !== true) {
            s.explicitLogout = true;
            modifiedAny = true;
          }
        });
        if (modifiedAny) {
          log.totalMinutesWorked = log.sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
        }
      }
    });

    // Find the last session of today
    let lastSession = dayEntry.sessions[dayEntry.sessions.length - 1];

    if (!lastSession) {
      // Start a new session for today since they are online now!
      lastSession = {
        login: formattedTime,
        logout: formattedTime,
        loginMs: nowMs,
        logoutMs: nowMs,
        durationMinutes: 0,
        explicitLogout: false
      };
      dayEntry.sessions.push(lastSession);
    } else if (lastSession.explicitLogout !== true) {
      // Update today's last session
      lastSession.logout = formattedTime;
      lastSession.logoutMs = nowMs;
      if (lastSession.loginMs) {
        lastSession.durationMinutes = Math.round((nowMs - lastSession.loginMs) / 60000);
      }
    }

    // Recalculate total worked minutes for this day
    dayEntry.totalMinutesWorked = dayEntry.sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    emp.set('activityLogs', logs);
    emp.markModified('activityLogs');
    await emp.save();
  } catch (err) {
    console.error('Failed to update user session heartbeat:', err);
  }
}



// Ensure DB connection & disable caching for all API routes
app.use('/api', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Endpoint to fetch centralized state
app.get('/api/sync', async (req, res) => {
  try {
    if (req.query.employeeId) {
      await updateUserSessionHeartbeat(req.query.employeeId);
    }
    const data = await getMongoDBState();
    data.activeUsers = await trackAndGetActiveUsers(req.query.employeeId, req.query.active);
    return res.json(data);
  } catch (err) {
    console.error('❌ Failed to read from MongoDB Atlas:', err.message);
    return res.status(500).json({ error: 'Database read failed. Please try again.' });
  }
});

// Endpoint to retrieve only the last updated timestamp and active users
app.get('/api/sync-timestamp', async (req, res) => {
  try {
    await connectDB();
    if (req.query.employeeId) {
      await updateUserSessionHeartbeat(req.query.employeeId);
    }
    let meta = await models.SystemMetadata.findOne({ key: 'lastUpdated' });
    const timestamp = meta ? meta.timestamp : Date.now();
    const activeUsers = await trackAndGetActiveUsers(req.query.employeeId, req.query.active);
    return res.json({ timestamp, activeUsers });
  } catch (err) {
    console.error('❌ Failed to read sync timestamp:', err.message);
    return res.status(500).json({ error: 'Database read failed. Please try again.' });
  }
});

// Lightweight chat-only endpoint for instant real-time chat updates without full state sync
app.get('/api/chats-only', async (req, res) => {
  try {
    await connectDB();
    const [chats, announcements, notices] = await Promise.all([
      models.Chat.find({}).lean(),
      models.Announcement.find({}).lean(),
      models.Notice.find({}).lean()
    ]);
    let meta = await models.SystemMetadata.findOne({ key: 'lastUpdated' });
    const timestamp = meta ? meta.timestamp : Date.now();
    const activeUsers = await trackAndGetActiveUsers(req.query.employeeId, null);
    return res.json({ chats, announcements, notices, timestamp, activeUsers });
  } catch (err) {
    console.error('❌ Failed to read chats-only:', err.message);
    return res.status(500).json({ error: 'Database read failed.' });
  }
});

// Lightweight POST endpoint for saving single chat messages in <30ms
app.post('/api/chats-only', async (req, res) => {
  const { chat } = req.body;
  if (!chat || !chat.id) {
    return res.status(400).json({ error: 'Missing chat object' });
  }

  try {
    await connectDB();
    await models.Chat.findOneAndUpdate(
      { id: chat.id },
      { $set: chat },
      { upsert: true, new: true }
    );
    const timestamp = Date.now();
    await models.SystemMetadata.findOneAndUpdate(
      { key: 'lastUpdated' },
      { timestamp },
      { upsert: true }
    );
    return res.json({ success: true, timestamp });
  } catch (err) {
    console.error('❌ Failed to save chat message:', err.message);
    return res.status(500).json({ error: 'Database write failed.' });
  }
});

// Endpoint to overwrite/sync centralized state
app.post('/api/sync', async (req, res) => {
  const newState = req.body;
  if (!newState) {
    return res.status(400).json({ error: 'Missing state payload' });
  }

  try {
    if (req.query.nuke === 'AIRG001') {
      await models.Employee.deleteOne({ id: 'AIRG001' });
      console.log('Nuked AIRG001');
      return res.json({ success: true, nuked: true });
    }
    console.log(`[SYNC POST] employeeId=${req.query.employeeId}, reportsCount=${(newState.dailyReports || []).length}`);
    if (req.query.employeeId) {
      await updateUserSessionHeartbeat(req.query.employeeId);
    }
    const updatedTimestamp = await saveMongoDBState(newState, req.query.employeeId);
    const activeList = await trackAndGetActiveUsers(req.query.employeeId, req.query.active);
    return res.json({ success: true, timestamp: updatedTimestamp, activeUsers: activeList });
  } catch (err) {
    console.error('❌ Failed to write to MongoDB Atlas:', err);
    return res.status(500).json({ error: 'Database write failed. Please try again.' });
  }
});

// New Explicit Deletion API
app.post('/api/delete-record', async (req, res) => {
  const { modelName, id, employeeId, role } = req.body;
  if (!modelName || !id || !employeeId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const Model = models[modelName];
  if (!Model) {
    return res.status(400).json({ error: 'Invalid modelName' });
  }

  try {
    const isReviewer = ['Admin', 'HR'].includes(role);
    
    // Admins and HR can delete anything (except maybe hard-deleting employees, but employee soft-delete is handled by POST /api/sync)
    if (isReviewer) {
      await Model.deleteMany({ id });
      console.log(`[EXPLICIT DELETE] Admin ${employeeId} deleted ${modelName} ${id}`);
      return res.json({ success: true });
    }

    // Regular users can only delete their own specific records
    if (['LeaveRequest', 'Ticket', 'Reimbursement', 'DailyReport', 'TrainerReport'].includes(modelName)) {
      const ownerField = modelName === 'TrainerReport' ? 'trainerId' : 'employeeId';
      const result = await Model.deleteMany({ id, [ownerField]: employeeId });
      if (result.deletedCount === 0) {
        // Check if the record exists in MongoDB Atlas under a different user
        const existingDoc = await Model.findOne({ id }).lean();
        if (existingDoc) {
          console.warn(`[EXPLICIT DELETE] Blocked unauthorized deletion attempt of ${modelName} ${id} by ${employeeId}`);
          return res.status(403).json({ error: 'Unauthorized to delete this record' });
        }
        // If record is not in MongoDB Atlas at all (e.g. unsynced local duplicate), allow local cleanup
        console.log(`[EXPLICIT DELETE] Record ${modelName} ${id} not found in DB. Permitting local cleanup for ${employeeId}.`);
        return res.json({ success: true, localOnly: true });
      }
      console.log(`[EXPLICIT DELETE] User ${employeeId} deleted own ${modelName} ${id}`);
      return res.json({ success: true });
    }
    
    if (modelName === 'Chat') {
      await Model.deleteMany({ id });
      console.log(`[EXPLICIT DELETE] User ${employeeId} deleted chat ${id}`);
      return res.json({ success: true });
    }

    // For all other models (Notice, Announcement, Project, Task, Employee), regular users cannot delete
    return res.status(403).json({ error: 'Unauthorized to delete this record type' });
  } catch (err) {
    console.error(`[EXPLICIT DELETE] Failed:`, err);
    return res.status(500).json({ error: 'Internal server error' });
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
      // Find existing active session (not explicitly logged out and active recently)
      const existingSession = [...dayEntry.sessions].reverse().find(s => s.explicitLogout !== true);
      if (existingSession) {
        // Keep existing active session open and update heartbeat
        existingSession.logoutMs = nowMs;
        existingSession.logout = formattedTime;
        if (existingSession.loginMs) {
          existingSession.durationMinutes = Math.round((nowMs - existingSession.loginMs) / 60000);
        }
      } else {
        // Start a new session only if no active session exists
        dayEntry.sessions.push({
          login: formattedTime,
          logout: formattedTime,
          loginMs: nowMs,
          logoutMs: nowMs,
          durationMinutes: 0,
          explicitLogout: false
        });
      }
    } else if (type === 'logout') {
      // Close the most recent open session (no explicit logout yet)
      const openSession = [...dayEntry.sessions].reverse().find(s => s.explicitLogout !== true);
      if (openSession) {
        openSession.logout = formattedTime;
        openSession.logoutMs = nowMs;
        openSession.explicitLogout = true;
        if (openSession.loginMs) {
          openSession.durationMinutes = Math.round((nowMs - openSession.loginMs) / 60000);
        }
      } else {
        // No open session found — add a standalone logout entry
        dayEntry.sessions.push({
          login: '',
          logout: formattedTime,
          loginMs: null,
          logoutMs: nowMs,
          durationMinutes: 0,
          explicitLogout: true
        });
      }
    }

    // Recalculate total worked minutes for this day
    dayEntry.totalMinutesWorked = dayEntry.sessions.reduce((sum, s) => {
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
// --- Password Reset Implementation ---

// Gmail SMTP Transporter (using HR's Gmail account)
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Helper: send email
async function sendEmail(to, subject, htmlBody, textBody) {
  const mailOptions = {
    from: `"AIRG EMS - HR Department" <${process.env.GMAIL_USER}>`,
    to: to,
    subject: subject,
    text: textBody,
    html: htmlBody
  };
  return gmailTransporter.sendMail(mailOptions);
}

// 1. Employee clicks "Forgot Password" → notifies HR via email + in-app notification
app.post('/api/forgot-password-notify', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const emp = await models.Employee.findOne({ email: email });
    if (!emp) return res.status(404).json({ error: 'No employee found with this email address.' });

    // Find all HR and Admin employees to notify
    const hrAdmins = await models.Employee.find({ role: { $in: ['HR', 'Admin'] } });

    // Send email notification to each HR/Admin
    for (const hr of hrAdmins) {
      if (hr.email) {
        const subject = `Password Reset Request from ${emp.name}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h2 style="color: #dc2626;">🔐 Password Reset Request</h2>
            <p><strong>${emp.name}</strong> has requested a password reset.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; font-weight: bold;">Employee Name:</td><td style="padding: 8px;">${emp.name}</td></tr>
              <tr style="background:#fff;"><td style="padding: 8px; font-weight: bold;">Employee ID:</td><td style="padding: 8px;">${emp.id}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${emp.email}</td></tr>
              <tr style="background:#fff;"><td style="padding: 8px; font-weight: bold;">Role:</td><td style="padding: 8px;">${emp.role}</td></tr>
            </table>
            <p style="color: #555;">Please log into the AIRG EMS portal and go to <strong>Employee Details</strong> to send a password reset link to this employee.</p>
            <p style="font-size: 12px; color: #999;">This is an automated notification from AIRG Employee Management System.</p>
          </div>`;
        const text = `Password Reset Request: ${emp.name} (${emp.email}) has requested a password reset. Please log in to the AIRG EMS portal and send them a reset link from the Employee Details page.`;
        await sendEmail(hr.email, subject, html, text).catch(e => console.error(`Could not notify HR ${hr.email}:`, e.message));
      }
    }

    // Store a pending reset flag on the employee so HR can see it in the portal
    emp.passwordResetRequested = true;
    emp.passwordResetRequestedAt = new Date().toISOString();
    await emp.save();
    await models.SystemMetadata.findOneAndUpdate({ key: 'lastUpdated' }, { timestamp: Date.now() }, { upsert: true });

    console.log(`\n📨 Password reset requested by: ${emp.name} (${emp.email})`);
    res.json({ success: true, message: 'HR has been notified. Please wait for the reset link in your email.' });
  } catch (err) {
    console.error('Error in forgot-password-notify:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. HR sends reset link → real email to employee
app.post('/api/request-password-reset', async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) return res.status(400).json({ error: 'Missing employeeId' });

  try {
    const emp = await models.Employee.findOne({ id: employeeId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 15 * 60 * 1000; // 15 mins

    emp.resetToken = token;
    emp.resetTokenExpiry = expiry;
    emp.passwordResetRequested = false; // Clear the request flag
    await emp.save();
    await models.SystemMetadata.findOneAndUpdate({ key: 'lastUpdated' }, { timestamp: Date.now() }, { upsert: true });

    const resetLink = `http://localhost:${PORT}/?resetToken=${token}`;
    console.log(`\n---------------------------------------------------`);
    console.log(`🔑 PASSWORD RESET LINK FOR: ${emp.name}`);
    console.log(`🔗 ${resetLink}`);
    console.log(`---------------------------------------------------\n`);

    // Send real email to the employee
    const subject = 'Password Reset Request - AIRG EMS';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <h2 style="color: #1e293b;">🔐 Reset Your Password</h2>
        <p>Hello <strong>${emp.name}</strong>,</p>
        <p>Your HR has initiated a password reset for your AIRG Employee Portal account. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background: #dc2626; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Reset My Password</a>
        </div>
        <p style="color: #888; font-size: 13px;">⚠️ This link expires in <strong>15 minutes</strong>. If you did not request this, please ignore this email.</p>
        <p style="color: #888; font-size: 13px;">If the button doesn't work, copy and paste this link in your browser:<br><a href="${resetLink}">${resetLink}</a></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="font-size: 12px; color: #999;">AIRG International Employee Management System</p>
      </div>`;
    const text = `Hello ${emp.name},\n\nYour HR has initiated a password reset. Click this link to reset your password:\n\n${resetLink}\n\nThis link expires in 15 minutes.`;

    await sendEmail(emp.email, subject, html, text);
    console.log(`✅ Password reset email sent to: ${emp.email}`);

    res.json({ success: true, message: `Password reset link sent to ${emp.email}` });
  } catch (err) {
    console.error('Error in request-password-reset:', err);
    res.status(500).json({ error: 'Failed to send email. Please check Gmail credentials.' });
  }
});

// 3. Employee submits new password via the reset link
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ error: 'Missing token or newPassword' });

  try {
    const emp = await models.Employee.findOne({ resetToken: token });
    if (!emp) return res.status(400).json({ error: 'Invalid or expired reset token.' });
    if (Date.now() > emp.resetTokenExpiry) return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });

    emp.password = newPassword;
    emp.resetToken = undefined;
    emp.resetTokenExpiry = undefined;
    await emp.save();
    await models.SystemMetadata.findOneAndUpdate({ key: 'lastUpdated' }, { timestamp: Date.now() }, { upsert: true });

    res.json({ success: true, message: 'Password has been successfully reset.' });
  } catch (err) {
    console.error('Error in reset-password:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Super Admin Recovery Endpoint
app.post('/api/super-admin-recovery', async (req, res) => {
  const { email, recoveryCode, newPassword } = req.body;
  
  if (!email || !recoveryCode || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  if (recoveryCode !== process.env.SUPER_ADMIN_RECOVERY_CODE) {
    return res.status(403).json({ error: 'Invalid recovery code.' });
  }

  try {
    const emp = await models.Employee.findOne({ email: email });
    if (!emp) {
      return res.status(404).json({ error: 'No employee found with this email.' });
    }

    if (emp.role !== 'Admin' && emp.role !== 'CEO') {
       return res.status(403).json({ error: 'This recovery method is only available for Admins.' });
    }

    emp.password = newPassword;
    emp.passwordResetRequested = false;
    emp.resetToken = undefined;
    emp.resetTokenExpiry = undefined;
    await emp.save();
    
    await models.SystemMetadata.findOneAndUpdate({ key: 'lastUpdated' }, { timestamp: Date.now() }, { upsert: true });

    res.json({ success: true, message: 'Admin password has been successfully reset using Recovery Code.' });
  } catch (err) {
    console.error('Error in super-admin-recovery:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Atomic Leave Request Endpoints (Direct Instant Server Persistence)
app.post('/api/submit-leave-request', async (req, res) => {
  try {
    await connectDB();
    const leaveReq = req.body;
    if (!leaveReq || !leaveReq.id || !leaveReq.employeeId) {
      return res.status(400).json({ error: 'Invalid leave request payload' });
    }
    const updated = await models.LeaveRequest.findOneAndUpdate(
      { id: leaveReq.id },
      leaveReq,
      { upsert: true, new: true }
    );
    await models.SystemMetadata.findOneAndUpdate({ key: 'lastUpdated' }, { timestamp: Date.now() }, { upsert: true });
    return res.json({ success: true, request: updated.toJSON() });
  } catch (err) {
    console.error('Error submitting leave request directly:', err);
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/update-leave-status', async (req, res) => {
  try {
    await connectDB();
    const { requestId, status, comment } = req.body;
    if (!requestId || !status) {
      return res.status(400).json({ error: 'Missing requestId or status' });
    }
    const updated = await models.LeaveRequest.findOneAndUpdate(
      { id: requestId },
      { status, comment: comment || '' },
      { new: true }
    );
    await models.SystemMetadata.findOneAndUpdate({ key: 'lastUpdated' }, { timestamp: Date.now() }, { upsert: true });
    return res.json({ success: true, request: updated ? updated.toJSON() : null });
  } catch (err) {
    console.error('Error updating leave status directly:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Atomic Reimbursement Request Endpoint (Direct Instant Server Persistence)
app.post('/api/update-reimbursement-status', async (req, res) => {
  try {
    await connectDB();
    const { id, status, comment, approvedBy, rejectedBy } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: 'Missing id or status' });
    }
    const updateFields = {
      status,
      comment: comment || (status === 'approved' ? 'Approved' : 'Rejected')
    };
    if (approvedBy) updateFields.approvedBy = approvedBy;
    if (rejectedBy) updateFields.rejectedBy = rejectedBy;

    const updated = await models.Reimbursement.findOneAndUpdate(
      { id },
      { $set: updateFields },
      { new: true }
    );
    await models.SystemMetadata.findOneAndUpdate({ key: 'lastUpdated' }, { timestamp: Date.now() }, { upsert: true });
    return res.json({ success: true, reimbursement: updated ? updated.toJSON() : null });
  } catch (err) {
    console.error('Error updating reimbursement status directly:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Export the app for Vercel Serverless
module.exports = app;

// Start the local server if not running on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🚀 AIR G International EMS Server is running!`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`💾 Database: MongoDB Atlas (sole data store)`);
    console.log(`===================================================`);
  });
}
