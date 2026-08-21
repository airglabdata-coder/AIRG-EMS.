const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const AIRGLABS_URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function cleanupDipakReports() {
  console.log('Connecting to AirgLabs DB to clean up duplicate daily reports...');
  await mongoose.connect(AIRGLABS_URI);
  const db = mongoose.connection.db;

  const reportCol = db.collection('dailyreports');

  // Find reports submitted by Dipak Reddy
  const reports = await reportCol.find({ employeeId: 'AIRG000311' }).toArray();
  console.log(`Found ${reports.length} reports for Dipak Reddy.`);

  // Group by details + date to identify duplicates
  const seenMap = new Map();
  const toDeleteIds = [];

  reports.forEach(r => {
    const key = `${r.date}_${(r.details || '').trim()}`;
    if (seenMap.has(key)) {
      toDeleteIds.push(r._id);
    } else {
      seenMap.set(key, r._id);
    }
  });

  if (toDeleteIds.length > 0) {
    const res = await reportCol.deleteMany({ _id: { $in: toDeleteIds } });
    console.log(`✅ Deleted ${res.deletedCount} duplicate daily reports from MongoDB Atlas!`);
  } else {
    console.log('No duplicate reports found in DB.');
  }

  process.exit(0);
}

cleanupDipakReports().catch(err => {
  console.error(err);
  process.exit(1);
});
