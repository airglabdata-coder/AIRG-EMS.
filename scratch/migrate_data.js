const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');

const SOHAM_URI = 'mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';
const AIRGLABS_URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function migrate() {
  console.log('🚀 Starting Data Migration from Soham Cluster to AirgLabs Cluster...');
  
  // Connect to Source (Soham)
  const sourceConn = await mongoose.createConnection(SOHAM_URI).asPromise();
  console.log('✅ Connected to Source Database (Soham Cluster)');

  // Connect to Target (AirgLabs)
  const targetConn = await mongoose.createConnection(AIRGLABS_URI).asPromise();
  console.log('✅ Connected to Target Database (AirgLabs Cluster)');

  const collections = await sourceConn.db.listCollections().toArray();
  console.log(`\n📦 Found ${collections.length} collections to migrate.\n`);

  for (let colInfo of collections) {
    const colName = colInfo.name;
    const sourceCol = sourceConn.db.collection(colName);
    const targetCol = targetConn.db.collection(colName);

    const docs = await sourceCol.find({}).toArray();
    console.log(`  🔄 Migrating "${colName}": ${docs.length} documents...`);

    // Clear existing target collection first to avoid duplicates
    await targetCol.deleteMany({});

    if (docs.length > 0) {
      await targetCol.insertMany(docs);
      console.log(`  ✅ Successfully migrated ${docs.length} documents into "${colName}"`);
    } else {
      console.log(`  ℹ️ "${colName}" is empty, skipped insertion.`);
    }
  }

  console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('All chats, daily reports, employee accounts, notices, projects, and tasks are now 100% inside AirgLabs Cluster!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration Error:', err);
  process.exit(1);
});
