const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const AIRGLABS_URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function seedProjects() {
  console.log('Connecting to AirgLabs DB to insert Bionic Butterfly & Pirangut School...');
  await mongoose.connect(AIRGLABS_URI);
  const db = mongoose.connection.db;

  const projectCol = db.collection('projects');

  const bionicButterfly = {
    id: 'PRJ306',
    name: 'Bionic Butterfly',
    dept: 'Electronics',
    status: 'Active',
    dueDate: '2026-09-20',
    description: 'Electronics Product Launch',
    techLeadId: 'AIRG00047',
    progress: 0,
    files: [],
    employeeIds: ['AIRG00047', 'AIRG00360', 'AIRG00038']
  };

  const pirangutSchool = {
    id: 'PRJ307',
    name: 'Pirangut School',
    dept: 'Electronics',
    status: 'Active',
    dueDate: '2027-03-31',
    description: 'Pirangut School Tutor',
    techLeadId: 'AIRG00047',
    progress: 0,
    files: [],
    employeeIds: ['AIRG00047', 'AIRG00045']
  };

  await projectCol.updateOne({ id: 'PRJ306' }, { $set: bionicButterfly }, { upsert: true });
  await projectCol.updateOne({ id: 'PRJ307' }, { $set: pirangutSchool }, { upsert: true });

  console.log('✅ Successfully created/restored "Bionic Butterfly" & "Pirangut School" projects in MongoDB Atlas!');

  const allProjects = await projectCol.find({}).toArray();
  console.log('\nAll Active Projects in Database:');
  allProjects.forEach(p => {
    console.log(`  - [${p.id}] ${p.name} | Dept: ${p.dept} | TechLead: ${p.techLeadId} | Members: ${JSON.stringify(p.employeeIds)}`);
  });

  process.exit(0);
}

seedProjects().catch(err => {
  console.error(err);
  process.exit(1);
});
