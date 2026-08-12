const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function addRajendra() {
  const client = new MongoClient(uri, { family: 4 });
  try {
    await client.connect();
    const db = client.db('airg_ems_db');

    // Check if already exists
    const existing = await db.collection('employees').findOne({ 
      $or: [{ email: 'rajendrakhavale@gmail.com' }, { id: 'AIRG00052' }] 
    });
    if (existing) {
      console.log('Already exists:', existing.name, existing.id);
      return;
    }

    const rajendra = {
      id: 'AIRG00052',
      name: 'Rajendra Khavale',
      email: 'rajendrakhavale@gmail.com',
      password: 'Rajendra@1234',
      role: 'Manager, Reporting Manager',
      dept: 'School Cluster',
      phone: '',
      avatar: 'RK',
      balance: 20,
      absent: 0,
      aadhar: '',
      pan: '',
      bankAcc: '',
      bankIfsc: '',
      salary: { basic: 0, hra: 0, other: 0, profTax: 200, lwpDays: 0 },
      activityLogs: [],
      createdAt: new Date().toISOString()
    };

    const result = await db.collection('employees').insertOne(rajendra);
    console.log('SUCCESS: Rajendra Khavale added!');
    console.log('ID: AIRG00052');
    console.log('Email: rajendrakhavale@gmail.com');
    console.log('Role: Manager, Reporting Manager');
    console.log('Dept: School Cluster');
    console.log('MongoDB insertedId:', result.insertedId);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.close();
  }
}

addRajendra();
