require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const models = require('../models');
const dns = require('dns');

// Force Google DNS
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { family: 4 })
  .then(async () => {
    console.log("Connected to MongoDB for cleanup...");

    // 1. Delete test employees
    const testUserIds = ['123', '1233', '1334'];
    const empResult = await models.Employee.deleteMany({ id: { $in: testUserIds } });
    console.log(`Deleted ${empResult.deletedCount} test employees.`);

    // 2. Delete ALL projects (they were all just for testing)
    const projResult = await models.Project.deleteMany({});
    console.log(`Deleted ${projResult.deletedCount} test projects.`);

    // 3. Delete ALL tasks (they were all just for testing)
    const taskResult = await models.Task.deleteMany({});
    console.log(`Deleted ${taskResult.deletedCount} test tasks.`);

    console.log("Cleanup complete! 🧹");
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to connect:', err);
    process.exit(1);
  });
