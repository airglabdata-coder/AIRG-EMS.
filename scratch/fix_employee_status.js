const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const AIRGLABS_URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function fixStatus() {
  console.log('Connecting to AirgLabs DB...');
  await mongoose.connect(AIRGLABS_URI);
  const db = mongoose.connection.db;

  console.log('Bulk updating status to approved for all real employees...');
  const res = await db.collection('employees').updateMany(
    { id: { $nin: ['AIRGTEST999', 'AIRGTEST998'] } },
    { $set: { status: 'approved' } }
  );

  console.log(`✅ Updated ${res.modifiedCount} employees to "approved"!`);

  const emps = await db.collection('employees').find({}).toArray();
  console.log('\nUpdated List:');
  emps.forEach(e => {
    console.log(`  - ${e.id}: ${e.name} (${e.email}) | Role: ${e.role} | Status: ${e.status}`);
  });

  process.exit(0);
}

fixStatus().catch(err => {
  console.error(err);
  process.exit(1);
});
