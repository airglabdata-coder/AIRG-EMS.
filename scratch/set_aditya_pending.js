const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function setAdityaPending() {
  console.log('Connecting to MongoDB Atlas to update Aditya Raj status to pending_approval...');
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  const col = db.collection('employees');

  const res = await col.updateOne(
    { id: 'AIRG00037' },
    { $set: { status: 'pending_approval', createdAt: new Date().toISOString() } }
  );

  console.log(`✅ Updated Aditya Raj (AIRG00037) status to "pending_approval" (matched: ${res.matchedCount}, modified: ${res.modifiedCount})!`);

  // Verify the update
  const emp = await col.findOne({ id: 'AIRG00037' });
  console.log('\nVerified Aditya Raj Record:');
  console.log(`- ID: ${emp.id}`);
  console.log(`- Name: ${emp.name}`);
  console.log(`- Email: ${emp.email}`);
  console.log(`- Status: ${emp.status}`);
  console.log(`- Dept: ${emp.dept}`);
  console.log(`- Role: ${emp.role}`);

  process.exit(0);
}

setAdityaPending().catch(err => {
  console.error(err);
  process.exit(1);
});
