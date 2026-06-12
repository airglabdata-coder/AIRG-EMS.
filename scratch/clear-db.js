const mongoose = require('mongoose');
const models = require('../models');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in .env');
  process.exit(1);
}

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

async function clearAndSeedDatabase() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');

    // Clear collections
    console.log('Clearing collections...');
    await models.Employee.deleteMany({});
    await models.LeaveRequest.deleteMany({});
    await models.Project.deleteMany({});
    await models.Task.deleteMany({});
    await models.Chat.deleteMany({});
    await models.DailyReport.deleteMany({});
    await models.Announcement.deleteMany({});
    await models.Notice.deleteMany({});
    await models.Reimbursement.deleteMany({});
    await models.Ticket.deleteMany({});
    await models.NationalHoliday.deleteMany({});
    await models.CelebrationDay.deleteMany({});
    await models.SystemMetadata.deleteMany({});
    await models.PushSubscription.deleteMany({});

    console.log('Seeding default Admin user...');
    await models.Employee.create(adminUser);

    console.log('Seeding default holidays...');
    await models.NationalHoliday.insertMany(nationalHolidays);
    await models.CelebrationDay.insertMany(celebrationDays);

    console.log('Initializing system metadata...');
    await models.SystemMetadata.create({ key: 'lastUpdated', timestamp: Date.now() });

    console.log('Database clear & seed operations completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error clear & seed operation:', err);
    process.exit(1);
  }
}

clearAndSeedDatabase();
