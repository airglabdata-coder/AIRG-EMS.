const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const AIRGLABS_URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function cleanupDuplicates() {
  console.log('Connecting to AirgLabs DB for account cleanup...');
  await mongoose.connect(AIRGLABS_URI);
  const db = mongoose.connection.db;

  const empCol = db.collection('employees');
  const chatCol = db.collection('chats');

  // 1. Merge Aniket Shrungare: AIRG00030 -> AIRG00360 (aniketshrungare269@gmail.com)
  console.log('Merging Aniket Shrungare (AIRG00030 -> AIRG00360)...');
  await chatCol.updateMany({ senderId: 'AIRG00030' }, { $set: { senderId: 'AIRG00360' } });
  await chatCol.updateMany({ receiverId: 'AIRG00030' }, { $set: { receiverId: 'AIRG00360' } });
  await empCol.deleteOne({ id: 'AIRG00030' });

  // 2. Merge Atharva Nahire: AIRG00041 & AIRG001 -> AIRG000182 (atharvarnahire182@gmail.com)
  console.log('Merging Atharva Nahire (AIRG00041, AIRG001 -> AIRG000182)...');
  await chatCol.updateMany({ senderId: { $in: ['AIRG00041', 'AIRG001'] } }, { $set: { senderId: 'AIRG000182' } });
  await chatCol.updateMany({ receiverId: { $in: ['AIRG00041', 'AIRG001'] } }, { $set: { receiverId: 'AIRG000182' } });
  await empCol.deleteMany({ id: { $in: ['AIRG00041', 'AIRG001'] } });

  // 3. Merge Dipak Reddy: AIRG00031 -> AIRG000311 (dipakreddy2628@gmail.com)
  console.log('Merging Dipak Reddy (AIRG00031 -> AIRG000311)...');
  await chatCol.updateMany({ senderId: 'AIRG00031' }, { $set: { senderId: 'AIRG000311' } });
  await chatCol.updateMany({ receiverId: 'AIRG00031' }, { $set: { receiverId: 'AIRG000311' } });
  await empCol.deleteOne({ id: 'AIRG00031' });

  // 4. Merge Suyash Patil: AIRG0001 -> AIRG00008 (suyash@gurujiair.com)
  console.log('Merging Suyash Patil (AIRG0001 -> AIRG00008)...');
  await chatCol.updateMany({ senderId: 'AIRG0001' }, { $set: { senderId: 'AIRG00008' } });
  await chatCol.updateMany({ receiverId: 'AIRG0001' }, { $set: { receiverId: 'AIRG00008' } });
  await empCol.deleteOne({ id: 'AIRG0001' });

  // 5. Delete test agent registrations
  console.log('Deleting test registrations AIRGTEST999 & AIRGTEST998...');
  await empCol.deleteMany({ id: { $in: ['AIRGTEST999', 'AIRGTEST998'] } });

  // 6. Set all remaining employee records to approved status
  await empCol.updateMany({}, { $set: { status: 'approved' } });

  const count = await empCol.countDocuments({});
  console.log(`\n✅ Account cleanup complete! Total active unique employees: ${count}`);

  const activeEmps = await empCol.find({}).toArray();
  console.log('\nFinal Clean Employee Directory:');
  activeEmps.forEach(e => {
    console.log(`  - [${e.id}] ${e.name} (${e.email}) | Role: ${e.role} | Status: ${e.status}`);
  });

  process.exit(0);
}

cleanupDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
