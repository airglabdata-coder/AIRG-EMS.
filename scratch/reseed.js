const mongoose = require('mongoose');
const models = require('../models');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

const employees = [
  {
    id: "AIRG00008",
    name: "Suyash Patil",
    dept: "AI, Electronics, Lab Setup",
    email: "suyash@gurujiair.com",
    role: "Tech Lead",
    balance: 20,
    absent: 0,
    avatar: "SP",
    aadhar: "5250 6200 0000",
    pan: "SUYAS1234P",
    bankAcc: "98765432101",
    bankIfsc: "HDFC0000123",
    password: "suyash",
    phone: "+91 99752 59016"
  },
  {
    id: "AIRG00030",
    name: "Aniket Shrungare",
    dept: "Electronics, Lab Setup",
    email: "aniket@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "AS",
    aadhar: "2437 8300 0000",
    pan: "ANIKE1234S",
    bankAcc: "98765432102",
    bankIfsc: "HDFC0000123",
    password: "aniket",
    phone: "+91 97649 11848"
  },
  {
    id: "AIRG00031",
    name: "Dipak Reddy",
    dept: "Electronics, Lab Setup",
    email: "dipak@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "DR",
    aadhar: "4052 2900 0000",
    pan: "DIPAK1234R",
    bankAcc: "98765432103",
    bankIfsc: "HDFC0000123",
    password: "dipak",
    phone: "+91 78409 67594"
  },
  {
    id: "AIRG00029",
    name: "Pratik Mane",
    dept: "Electronics, Lab Setup",
    email: "pratik@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "PM",
    aadhar: "8235 4400 0000",
    pan: "PRATI1234M",
    bankAcc: "98765432104",
    bankIfsc: "HDFC0000123",
    password: "pratik",
    phone: "+91 95791 17298"
  },
  {
    id: "AIRG00010",
    name: "Prasad Shelke",
    dept: "Electronics, Lab Setup",
    email: "prasad@gurujiair.com",
    role: "Tech Lead",
    balance: 20,
    absent: 0,
    avatar: "PS",
    aadhar: "6805 0800 0000",
    pan: "PRASA1234S",
    bankAcc: "98765432105",
    bankIfsc: "HDFC0000123",
    password: "prasad",
    phone: "+91 87673 87480"
  },
  {
    id: "AIRG00038",
    name: "Rohan Patil",
    dept: "Electronics, Lab Setup",
    email: "rohan@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "RP",
    aadhar: "3678 6400 0000",
    pan: "ROHAN1234P",
    bankAcc: "98765432106",
    bankIfsc: "HDFC0000123",
    password: "rohan",
    phone: "+91 99214 14810"
  },
  {
    id: "AIRG00026",
    name: "Nilesh Sonanwane",
    dept: "Instructor",
    email: "nilesh@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "NS",
    aadhar: "6942 6200 0000",
    pan: "NILES1234S",
    bankAcc: "98765432107",
    bankIfsc: "HDFC0000123",
    password: "nilesh",
    phone: "+91 96994 41027"
  },
  {
    id: "AIRG00032",
    name: "Yash Bhisekar",
    dept: "Instructor",
    email: "yash@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "YB",
    aadhar: "5428 9600 0000",
    pan: "YASHB1234I",
    bankAcc: "98765432108",
    bankIfsc: "HDFC0000123",
    password: "yash",
    phone: "+91 94223 90685"
  },
  {
    id: "AIRG00035",
    name: "Yogesh Meena",
    dept: "AI",
    email: "yogesh@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "YM",
    aadhar: "8029 0800 0000",
    pan: "YOGES1234M",
    bankAcc: "98765432109",
    bankIfsc: "HDFC0000123",
    password: "yogesh",
    phone: "+91 96729 94136"
  },
  {
    id: "AIRG00028",
    name: "Soham Wandkar",
    dept: "AI",
    email: "soham@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "SW",
    aadhar: "2991 1000 0000",
    pan: "SOHAM1234W",
    bankAcc: "98765432110",
    bankIfsc: "HDFC0000123",
    password: "soham",
    phone: "+91 97661 33667"
  },
  {
    id: "AIRG00037",
    name: "Aditya Raj",
    dept: "AI",
    email: "aditya@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "AR",
    aadhar: "3797 2100 0000",
    pan: "ADITY1234R",
    bankAcc: "98765432111",
    bankIfsc: "HDFC0000123",
    password: "aditya",
    phone: "+91 93805 75065"
  },
  {
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
  },
  {
    id: "AIRG00040",
    name: "Mahadev Sooorvey",
    dept: "AI",
    email: "mahadev@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "MS",
    aadhar: "4493 2000 0000",
    pan: "MAHAD1234S",
    bankAcc: "98765432113",
    bankIfsc: "HDFC0000123",
    password: "mahadev",
    phone: "+91 93215 24763"
  },
  {
    id: "AIRG00041",
    name: "Atharva Nahire",
    dept: "AI",
    email: "atharva@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "AN",
    aadhar: "6117 3400 0000",
    pan: "ATHAR1234N",
    bankAcc: "98765432114",
    bankIfsc: "HDFC0000123",
    password: "atharva",
    phone: "+91 78208 48917"
  },
  {
    id: "AIRG00042",
    name: "Shravani Khanvilkar",
    dept: "AI, Electronics, Lab Setup, Instructor",
    email: "shravani@gurujiair.com",
    role: "HR",
    balance: 20,
    absent: 0,
    avatar: "SK",
    aadhar: "2275 9500 0000",
    pan: "SHRAV1234K",
    bankAcc: "98765432115",
    bankIfsc: "HDFC0000123",
    password: "shravani",
    phone: "+91 84465 31087"
  }
];

const departments = ["AI", "Electronics", "Lab Setup", "Instructor"];

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

async function runReseed() {
  const timestamp = Date.now();
  const stateObj = {
    employees,
    requests: [],
    projects: [],
    tasks: [],
    departments,
    chats: [],
    dailyReports: [],
    announcements: [],
    notices: [],
    reimbursements: [],
    tickets: [],
    nationalHolidays,
    celebrationDays,
    lastUpdated: timestamp
  };

  // 1. Write local db.json
  const DB_DIR = path.join(__dirname, '..', 'data');
  const DB_FILE = path.join(DB_DIR, 'db.json');
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(stateObj, null, 2), 'utf8');
  console.log('Successfully wrote data/db.json locally.');

  // 2. Clear & Seed MongoDB Atlas if URI is available
  if (MONGODB_URI) {
    try {
      console.log('Connecting to MongoDB Atlas...');
      await mongoose.connect(MONGODB_URI);
      console.log('Connected successfully!');

      console.log('Wiping collections...');
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

      console.log('Seeding employees...');
      await models.Employee.insertMany(employees);

      console.log('Seeding holidays...');
      await Promise.all([
        models.NationalHoliday.insertMany(nationalHolidays),
        models.CelebrationDay.insertMany(celebrationDays)
      ]);

      console.log('Writing system metadata...');
      await models.SystemMetadata.create({ key: 'lastUpdated', timestamp });

      console.log('MongoDB Atlas seeded successfully!');
      mongoose.disconnect();
    } catch (err) {
      console.error('Failed to seed MongoDB Atlas:', err);
    }
  } else {
    console.log('No MONGODB_URI in environment. MongoDB Atlas seed skipped.');
  }
  process.exit(0);
}

runReseed();
