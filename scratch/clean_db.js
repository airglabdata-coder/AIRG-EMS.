const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const database = client.db('airg_ems_db');
    const employees = database.collection('employees');
    const result = await employees.deleteOne({ id: 'AIRG001' });
    console.log(`Deleted ${result.deletedCount} document(s)`);
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
