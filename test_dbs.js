const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');

const uris = [
  "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
  "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0",
  "mongodb+srv://pratap:AIGpratap1008%40@cluster0.4yu0ufe.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0",
  "mongodb+srv://pratap:AIGpratap1008@cluster0.4yu0ufe.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0"
];

async function check() {
  for (let i = 0; i < uris.length; i++) {
    console.log(`\nTesting URI ${i + 1}...`);
    try {
      const conn = await mongoose.createConnection(uris[i], { family: 4 }).asPromise();
      console.log(`✅ Connected!`);
      const Employee = conn.model('Employee', new mongoose.Schema({}, {strict:false}), 'employees');
      const count = await Employee.countDocuments();
      console.log(`Employees: ${count}`);
      await conn.close();
    } catch (e) {
      console.log(`❌ Failed: ${e.message}`);
    }
  }
}
check();
