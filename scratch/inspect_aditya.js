const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function findAditya() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  const col = db.collection('employees');

  const records = await col.find({
    $or: [
      { name: /aditya/i },
      { id: /37/i },
      { email: /aditya/i }
    ]
  }).toArray();

  console.log(`Found ${records.length} records matching Aditya / 37:`);
  records.forEach(e => {
    console.log(`- ID: "${e.id}", Name: "${e.name}", Email: "${e.email}", Status: "${e.status}", Role: "${e.role}", isDeleted: ${e.isDeleted}`);
  });

  process.exit(0);
}

findAditya().catch(err => {
  console.error(err);
  process.exit(1);
});
