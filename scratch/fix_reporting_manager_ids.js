const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const AIRGLABS_URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function fixReportingManagers() {
  console.log('Connecting to AirgLabs DB to fix Reporting Manager IDs...');
  await mongoose.connect(AIRGLABS_URI);
  const db = mongoose.connection.db;

  const empCol = db.collection('employees');

  // Update all employees who report to Suyash Patil to use reportingManagerId: "AIRG00008"
  const res = await empCol.updateMany(
    { reportingManagerName: 'Suyash Patil' },
    { $set: { reportingManagerId: 'AIRG00008' } }
  );

  console.log(`✅ Updated ${res.modifiedCount} employee records to use reportingManagerId: "AIRG00008" (Suyash Patil)!`);

  // Verify the updated employees
  const updatedEmps = await empCol.find({ reportingManagerName: 'Suyash Patil' }).toArray();
  console.log('\nVerified Employees reporting to Suyash Patil:');
  updatedEmps.forEach(e => {
    console.log(`  - [${e.id}] ${e.name} (${e.email}) -> RM ID: ${e.reportingManagerId}, RM Name: ${e.reportingManagerName}`);
  });

  process.exit(0);
}

fixReportingManagers().catch(err => {
  console.error(err);
  process.exit(1);
});
