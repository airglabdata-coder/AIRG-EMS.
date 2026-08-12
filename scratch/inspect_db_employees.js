const mongoose = require('mongoose');
require('dotenv').config();
const models = require('../models.js');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');
  
  const employees = await models.Employee.find({});
  console.log('=== Employees ===');
  employees.forEach(e => {
    console.log(`ID: ${e.id}, Name: ${e.name}, Email: ${e.email}, Role: ${e.role}, Dept: ${e.dept}, Status: ${e.status}`);
  });

  const projects = await models.Project.find({});
  console.log('=== Projects ===');
  projects.forEach(p => {
    console.log(`ID: ${p.id}, Name: ${p.name}, Dept: ${p.dept}, TechLead: ${p.techLeadId}, EmployeeIds: ${JSON.stringify(p.employeeIds)}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
