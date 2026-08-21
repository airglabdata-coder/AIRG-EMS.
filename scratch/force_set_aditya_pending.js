const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function forcePending() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  const col = db.collection('employees');

  await col.updateOne(
    { id: 'AIRG00037' },
    { $set: { status: 'pending_approval', createdAt: new Date().toISOString() } }
  );

  console.log('✅ MongoDB Atlas updated for AIRG00037 status: "pending_approval"');

  const pending = await col.find({ status: 'pending_approval' }).toArray();
  console.log(`\nAll ${pending.length} pending_approval employees in MongoDB Atlas:`);
  pending.forEach(e => {
    console.log(`  - [${e.id}] ${e.name} (${e.email}) | status: ${e.status}`);
  });

  process.exit(0);
}

forcePending().catch(e => { console.error(e); process.exit(1); });
