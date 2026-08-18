const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    const employees = await mongoose.connection.collection('employees').find({}, {projection: {name:1, dateOfBirth:1, joinDate:1}}).toArray();
    console.table(employees.map(e => ({name: e.name, dateOfBirth: e.dateOfBirth, joinDate: e.joinDate})));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
