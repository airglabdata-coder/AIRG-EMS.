const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function updateDbEmployees() {
  const client = new MongoClient(uri, { family: 4 });
  try {
    await client.connect();
    const db = client.db('airg_ems_db');
    const employeesColl = db.collection('employees');

    // 1. Update Trainers to "Instructor" department
    const trainerUpdates = [
      { id: 'AIRG00026', name: 'Nilesh Sonawane', dept: 'Instructor' },
      { id: 'AIRG00044', name: 'Samiksha Juwar', dept: 'Instructor' },
      { id: 'AIRG00046', name: 'Vaishnavi Jadhav', dept: 'Instructor' },
      { id: 'AIRG00051', name: 'Mayuri Patil', dept: 'Instructor' }, // updated name from Mayuri -> Mayuri Patil
      { id: 'AIRG00045', name: 'Manali Santosh Gujar', dept: 'Instructor' },
      { id: 'AIRG00048', name: 'Shravani Bhilare', dept: 'Instructor' }
    ];

    for (const t of trainerUpdates) {
      const res = await employeesColl.updateOne(
        { id: t.id },
        { $set: { dept: t.dept, name: t.name } }
      );
      console.log(`Updated Trainer ${t.id} (${t.name}): dept -> ${t.dept}, matched=${res.matchedCount}, modified=${res.modifiedCount}`);
    }

    // 2. Update Reporting Managers
    const managerUpdates = [
      { 
        id: 'AIRG00042', 
        name: 'Shravani Khanvilkar', 
        dept: 'Electronics, Lab Setup, Instructor, School Reporting Manager'
      },
      { 
        id: 'AIRG00010', 
        name: 'Prasad Shelke', 
        dept: 'School Reporting Manager', 
        role: 'Manager, Reporting Manager'
      },
      { 
        id: 'AIRG0001', 
        name: 'Suyash Patil', 
        dept: 'AI, School Reporting Manager'
      },
      { 
        id: 'AIRG00047', 
        name: 'Atharva Durgavale', 
        dept: 'Electronics, School Reporting Manager'
      },
      { 
        id: 'AIRG00052', 
        name: 'Rajendra Khavale', 
        dept: 'School Reporting Manager', 
        role: 'Manager, Reporting Manager'
      }
    ];

    for (const m of managerUpdates) {
      const updateFields = { dept: m.dept };
      if (m.role) updateFields.role = m.role;
      const res = await employeesColl.updateOne(
        { id: m.id },
        { $set: updateFields }
      );
      console.log(`Updated Manager ${m.id} (${m.name}): dept -> ${m.dept}, role -> ${m.role || 'unchanged'}, matched=${res.matchedCount}, modified=${res.modifiedCount}`);
    }

    // 3. Update departments list in SystemState or settings if needed
    console.log('\n--- VERIFYING ALL EMPLOYEES AFTER UPDATE ---');
    const allEmps = await employeesColl.find({}, { projection: { id: 1, name: 1, role: 1, dept: 1, email: 1 } }).toArray();
    allEmps.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    allEmps.forEach(e => {
      console.log(`${e.id} | ${e.name} | ROLE: ${e.role} | DEPT: ${e.dept}`);
    });

  } catch (err) {
    console.error('Error updating DB:', err);
  } finally {
    await client.close();
  }
}

updateDbEmployees();
