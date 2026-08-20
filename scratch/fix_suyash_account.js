const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const AIRGLABS_URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function fixSuyashAccount() {
  console.log('Connecting to AirgLabs DB to update Suyash Patil account...');
  await mongoose.connect(AIRGLABS_URI);
  const db = mongoose.connection.db;

  const empCol = db.collection('employees');

  // Find Suyash Patil record
  const suyash = await empCol.findOne({ id: 'AIRG00008' });
  if (suyash) {
    console.log('Current Suyash record:', suyash.email, suyash.password);
    await empCol.updateOne(
      { id: 'AIRG00008' },
      {
        $set: {
          email: 'suyashpatil1224@gmail.com',
          password: 'Suyash$2412',
          status: 'approved',
          role: 'Tech Lead, Manager'
        }
      }
    );
    console.log('✅ Successfully updated Suyash Patil email to suyashpatil1224@gmail.com and password to Suyash$2412!');
  } else {
    // Upsert if missing
    await empCol.insertOne({
      id: 'AIRG00008',
      name: 'Suyash Patil',
      dept: 'AI, Electronics, Lab Setup',
      email: 'suyashpatil1224@gmail.com',
      password: 'Suyash$2412',
      role: 'Tech Lead, Manager',
      status: 'approved',
      avatar: 'SP',
      balance: 20
    });
    console.log('✅ Created Suyash Patil account!');
  }

  process.exit(0);
}

fixSuyashAccount().catch(err => {
  console.error(err);
  process.exit(1);
});
