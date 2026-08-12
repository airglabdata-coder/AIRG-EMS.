const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function testTrainerReport() {
  const client = new MongoClient(uri, { family: 4 });
  try {
    await client.connect();
    const db = client.db('airg_ems_db');
    const trainerReportsColl = db.collection('trainerreports');

    console.log('Testing TrainerReports collection in MongoDB...');
    const count = await trainerReportsColl.countDocuments();
    console.log('Current trainer reports count in DB:', count);

    // Verify all employees roles & depts
    const emps = await db.collection('employees').find({}).toArray();
    console.log(`\nVerified ${emps.length} employees in DB.`);
    const instructors = emps.filter(e => (e.dept || '').includes('Instructor') || (e.role || '').includes('Instructor'));
    console.log(`Instructors (${instructors.length}):`, instructors.map(i => `${i.name} (${i.id})`).join(', '));
    const managers = emps.filter(e => (e.dept || '').includes('School Reporting Manager') || (e.role || '').includes('Reporting Manager'));
    console.log(`School Reporting Managers (${managers.length}):`, managers.map(m => `${m.name} (${m.id})`).join(', '));
  } catch (err) {
    console.error('Error testing:', err);
  } finally {
    await client.close();
  }
}

testTrainerReport();
