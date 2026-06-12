const mongoose = require('mongoose');
const models = require('../models');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  if (MONGODB_URI) {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');
    
    console.log('Deleting employee EMP011...');
    const result = await models.Employee.deleteOne({ id: 'EMP011' });
    console.log('Delete result:', result);
    
    await mongoose.connection.close();
  } else {
    console.log('No MONGODB_URI found.');
  }
}

main().catch(console.error);
