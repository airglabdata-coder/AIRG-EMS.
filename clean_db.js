const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Minimal schema to just delete documents
const employeeSchema = new mongoose.Schema({
  role: String,
  email: String,
  name: String
}, { strict: false });

const Employee = mongoose.model('Employee', employeeSchema);

async function cleanDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, { family: 4 });
    console.log('✅ Connected to MongoDB Atlas');

    // Find all employees
    const allEmployees = await Employee.find({});
    console.log(`Total employees found: ${allEmployees.length}`);

    let deletedCount = 0;
    let keptCount = 0;

    for (const emp of allEmployees) {
      // Keep Admin (CEO) and HR
      if (emp.role === 'Admin' || emp.role === 'HR' || emp.role === 'HR Manager') {
        console.log(`Keeping: ${emp.name} (${emp.role}) - ${emp.email}`);
        keptCount++;
      } else {
        console.log(`Deleting: ${emp.name} (${emp.role}) - ${emp.email}`);
        await Employee.deleteOne({ _id: emp._id });
        deletedCount++;
      }
    }

    console.log(`\n🎉 Cleanup Complete!`);
    console.log(`Deleted: ${deletedCount} employees`);
    console.log(`Kept: ${keptCount} (HR/Admin)`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

cleanDatabase();
