const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function findAllAditya() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  const col = db.collection('employees');

  const allEmps = await col.find({}).toArray();
  const matches = allEmps.filter(e => 
    (e.name || '').toLowerCase().includes('aditya') || 
    (e.id || '').includes('37') || 
    (e.phone || '').includes('93805')
  );

  console.log(`Found ${matches.length} matching accounts:`);
  matches.forEach(e => {
    console.log(`- ID: ${e.id} | Name: ${e.name} | Email: ${e.email} | Phone: ${e.phone} | Status: ${e.status} | Role: ${e.role}`);
  });

  process.exit(0);
}

findAllAditya().catch(err => {
  console.error(err);
  process.exit(1);
});
