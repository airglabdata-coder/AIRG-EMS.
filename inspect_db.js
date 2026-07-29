const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function listDbs() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB cluster!");
    
    const adminDb = client.db('admin');
    const dbsInfo = await adminDb.admin().listDatabases();
    
    for (const dbInfo of dbsInfo.databases) {
      console.log(`\nDatabase: ${dbInfo.name}`);
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`  - ${coll.name}: ${count} documents`);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
listDbs();
