const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function checkAllEmps() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  const col = db.collection('employees');

  const all = await col.find({}).toArray();
  console.log(`Total employees in MongoDB Atlas: ${all.length}`);

  const pending = all.filter(e => e.status === 'pending_approval');
  console.log(`\nPending approval in MongoDB Atlas (${pending.length}):`);
  pending.forEach(e => {
    console.log(`  - [${e.id}] ${e.name} (${e.email}) | status: ${e.status}`);
  });

  const adityaMatches = all.filter(e => (e.name||'').toLowerCase().includes('aditya') || (e.id||'').includes('37'));
  console.log(`\nAditya/37 matches in MongoDB Atlas (${adityaMatches.length}):`);
  adityaMatches.forEach(e => {
    console.log(`  - [${e.id}] ${e.name} (${e.email}) | status: ${e.status} | isDeleted: ${e.isDeleted}`);
  });

  process.exit(0);
}

checkAllEmps().catch(e => { console.error(e); process.exit(1); });
