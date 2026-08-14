require('dotenv').config();
const mongoose = require('mongoose');
const models = require('../models');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");
  
  const requests = await models.LeaveRequest.find({});
  console.log("=== LEAVE REQUESTS ===");
  requests.forEach(r => {
    console.log(`ID: ${r.id} | Employee: ${r.employeeName} | Status: ${r.status} | Dates: ${r.startDate} to ${r.endDate}`);
  });

  const employees = await models.Employee.find({ role: { $regex: 'HR', $options: 'i' } });
  console.log("\n=== HR EMPLOYEES ===");
  employees.forEach(e => {
    console.log(`ID: ${e.id} | Name: ${e.name} | Role: ${e.role}`);
  });

  process.exit();
}

test();
