const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function listEmployees() {
  const client = new MongoClient(uri, { family: 4 });
  try {
    await client.connect();
    // Find the right DB
    const adminDb = client.db('admin');
    const dbsInfo = await adminDb.admin().listDatabases();
    let targetDb = null;
    for (const dbInfo of dbsInfo.databases) {
      if (dbInfo.name !== 'admin' && dbInfo.name !== 'local') {
        targetDb = dbInfo.name;
        break;
      }
    }
    console.log("Using DB:", targetDb);
    const db = client.db(targetDb);
    const employees = await db.collection('employees').find({}, { projection: { id: 1, name: 1, role: 1, dept: 1 } }).toArray();
    console.log(`Total employees: ${employees.length}\n`);
    employees.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    employees.forEach(e => {
      console.log(`${e.id || '?'} | ${e.name || '?'} | ${e.role || '?'} | ${e.dept || '?'}`);
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.close();
  }
}

listEmployees();
