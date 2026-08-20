const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const AIRGLABS_URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function inspectRM() {
  await mongoose.connect(AIRGLABS_URI);
  const db = mongoose.connection.db;

  const emps = await db.collection('employees').find({}).toArray();
  console.log('=== EMPLOYEE DIRECTORY & REPORTING MANAGERS ===');
  emps.forEach(e => {
    console.log(`[${e.id}] ${e.name} (${e.email})`);
    console.log(`     Role: ${e.role} | Designation: ${e.designation || 'N/A'}`);
    console.log(`     reportingManagerId: "${e.reportingManagerId || ''}" | reportingManagerName: "${e.reportingManagerName || ''}"`);
  });

  process.exit(0);
}

inspectRM().catch(err => {
  console.error(err);
  process.exit(1);
});
