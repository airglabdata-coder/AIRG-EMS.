const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const models = require('../models');

const uri = "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB!");

    const res = await models.DailyReport.deleteMany({ id: { $in: ['REP509', 'REP510', 'REP511'] } });
    console.log("Deleted duplicates:", res.deletedCount);

    const reports = await models.DailyReport.find({ employeeName: /Vaishnavi/i });
    console.log("Remaining reports:", reports.map(r => r.id));

  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.connection.close();
  }
}
main();
