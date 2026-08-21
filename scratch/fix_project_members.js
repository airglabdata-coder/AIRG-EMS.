const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function fixProjectMembers() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  const col = db.collection('projects');

  // Add Nilesh Sonawane (AIRG00026) to PRJ304 - Instructors Tasks
  const prj304 = await col.findOne({ id: 'PRJ304' });
  if (prj304) {
    const currentIds = prj304.employeeIds || [];
    if (!currentIds.includes('AIRG00026')) {
      currentIds.push('AIRG00026');
      await col.updateOne({ id: 'PRJ304' }, { $set: { employeeIds: currentIds } });
      console.log('✅ Added Nilesh (AIRG00026) to PRJ304 (Instructors Tasks)');
    } else {
      console.log('Nilesh already in PRJ304');
    }
  }

  // Fix empty dept issue: update Nilesh's dept to Instructor
  const empCol = db.collection('employees');
  const nilesh = await empCol.findOne({ id: 'AIRG00026' });
  if (nilesh && (!nilesh.dept || nilesh.dept === '')) {
    await empCol.updateOne({ id: 'AIRG00026' }, { $set: { dept: 'Instructor' } });
    console.log('✅ Fixed Nilesh dept to "Instructor"');
  }

  // Also ensure PRJ305 has correct member ids (remove stale AIRG001 replace with actual)
  const allProjects = await col.find({}).toArray();
  console.log('\nAll Projects with members:');
  allProjects.forEach(p => {
    console.log(`  [${p.id}] ${p.name} | Members: ${JSON.stringify(p.employeeIds)}`);
  });

  process.exit(0);
}

fixProjectMembers().catch(e => { console.error(e); process.exit(1); });
