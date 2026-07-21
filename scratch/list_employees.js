require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const models = require('../models');
const dns = require('dns');

// Force Google DNS
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { family: 4 })
  .then(async () => {
    const employees = await models.Employee.find({}, { id: 1, name: 1, role: 1, dept: 1, _id: 0 });
    console.log("=== EMPLOYEE LIST ===");
    employees.forEach(emp => {
      console.log(`ID: ${emp.id} | Name: ${emp.name} | Role: ${emp.role || 'Employee'} | Dept: ${emp.dept || 'None'}`);
    });
    console.log("=====================");
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to connect:', err);
    process.exit(1);
  });
