const mongoose = require('mongoose');
const models = require('../models');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Error: MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('Connected successfully.');

    console.log('Searching for employee with ID "EMP011" (Richard Boss)...');
    const employee = await models.Employee.findOne({ id: 'EMP011' });

    if (employee) {
      console.log(`Found: ${employee.name} (${employee.role}). Removing...`);
      await models.Employee.deleteOne({ id: 'EMP011' });
      console.log('Employee successfully removed from MongoDB.');
    } else {
      console.log('Richard Boss (EMP011) was not found in MongoDB.');
    }

    mongoose.connection.close();
  } catch (err) {
    console.error('An error occurred:', err);
    process.exit(1);
  }
}

run();
