const mongoose = require('mongoose');
const models = require('../models');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  if (MONGODB_URI) {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');
    const employees = await models.Employee.find({});
    console.log('Employees in MongoDB:');
    employees.forEach(e => {
      console.log(`- ID: ${e.id}, Name: ${e.name}, Email: ${e.email}, Role: ${e.role}`);
    });
    await mongoose.connection.close();
  } else {
    console.log('No MONGODB_URI found.');
  }
}

main().catch(console.error);
