const dns = require('dns');
// Fix Windows DNS issue for MongoDB SRV records
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const mongoose = require('mongoose');

// THIS MUST BE THE VERCEL DATABASE URL!
const MONGODB_URI = "mongodb+srv://pratap:AIGpratap1008%40@cluster0.4yu0ufe.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0";

const employeeSchema = new mongoose.Schema({
  role: String,
  name: String
}, { strict: false });

const Employee = mongoose.model('Employee', employeeSchema);

async function clean() {
  try {
    console.log("Connecting to the live database...");
    await mongoose.connect(MONGODB_URI, { family: 4 });
    console.log("✅ Connected successfully!");

    const all = await Employee.find({});
    console.log(`Found ${all.length} employees.`);

    let kept = 0;
    let deleted = 0;

    for (let e of all) {
      if (e.role && (e.role.includes('HR') || e.role.includes('Admin') || e.role.includes('CEO') || e.role.includes('Manager'))) {
        console.log(`Keeping: ${e.name} (${e.role})`);
        kept++;
      } else {
        console.log(`Deleting: ${e.name} (${e.role})`);
        await Employee.deleteOne({ _id: e._id });
        deleted++;
      }
    }

    console.log(`\n🎉 Finished! Deleted ${deleted} regular employees. Kept ${kept} admins/HR.`);
    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
}

clean();
