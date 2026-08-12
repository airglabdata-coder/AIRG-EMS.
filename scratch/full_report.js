const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function fullReport() {
  const client = new MongoClient(uri, { family: 4 });
  try {
    await client.connect();
    const db = client.db('airg_ems_db');

    const employees = await db.collection('employees')
      .find({}, { projection: { id: 1, name: 1, role: 1, dept: 1, email: 1, phone: 1, password: 1 } })
      .toArray();

    employees.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    console.log(`\n=== FULL EMPLOYEE LIST === (${employees.length} total)\n`);
    employees.forEach(e => {
      console.log(`ID: ${e.id || '?'}`);
      console.log(`  Name : ${e.name || '?'}`);
      console.log(`  Role : ${e.role || '?'}`);
      console.log(`  Dept : ${e.dept || 'NOT SET'}`);
      console.log(`  Email: ${e.email || '?'}`);
      console.log(`  Phone: ${e.phone || 'NOT SET'}`);
      console.log('');
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.close();
  }
}

fullReport();
