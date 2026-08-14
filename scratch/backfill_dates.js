require('dotenv').config();
const mongoose = require('mongoose');
const models = require('../models');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const data = {
  "Pratap Pawar": { dob: "1995-10-30", joinDate: "" },
  "Rajendra Khavale": { dob: "", joinDate: "" },
  "Suyash Patil": { dob: "2002-12-24", joinDate: "2025-07-25" },
  "Aniket Shrungare": { dob: "2004-05-26", joinDate: "2026-07-09" },
  "Dipak Reddy": { dob: "2004-07-26", joinDate: "2026-07-09" },
  "Prasad Shelke": { dob: "2003-10-17", joinDate: "2025-07-10" },
  "Rohan Patil": { dob: "2004-06-09", joinDate: "2026-07-01" },
  "Nilesh Sonawane": { dob: "2003-10-28", joinDate: "2025-01-12" },
  "Atharva Nahire": { dob: "2002-11-30", joinDate: "2026-07-13" },
  "Shravani Khanvilkar": { dob: "2002-08-09", joinDate: "2026-05-13" },
  "Shravani Bhilare": { dob: "2004-05-08", joinDate: "2026-07-06" },
  "Atharva Durgavale": { dob: "2004-05-07", joinDate: "2026-06-27" },
  "Vivek Krishnat Shinde": { dob: "2002-12-08", joinDate: "2026-07-13" },
  "Mayuri": { dob: "1994-11-17", joinDate: "2026-08-03" },
  "Manali Santosh Gujar": { dob: "2004-06-27", joinDate: "2026-06-16" },
  "Samiksha Juwar": { dob: "2003-12-03", joinDate: "2026-06-16" },
  "Vaishnavi Jadhav": { dob: "2004-08-07", joinDate: "2026-06-26" }
};

async function backfill() {
  await mongoose.connect(process.env.MONGODB_URI);
  const emps = await models.Employee.find({});
  
  let count = 0;
  for (const emp of emps) {
    if (data[emp.name]) {
      emp.dateOfBirth = data[emp.name].dob;
      emp.joinDate = data[emp.name].joinDate;
      await emp.save();
      count++;
      console.log(`Updated ${emp.name}`);
    }
  }
  
  console.log(`Successfully backfilled dates for ${count} employees.`);
  process.exit();
}

backfill();
