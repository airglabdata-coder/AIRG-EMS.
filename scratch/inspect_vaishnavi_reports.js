const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const models = require('../models');

const uri = "mongodb+srv://sohamwandkar3114_db_user:HyyFOChP36tp3hAn@cluster0.4yu0ufe.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0";

async function main() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB!");

    const reports = await models.DailyReport.find({ employeeName: /Vaishnavi/i });
    console.log("=== VAISHNAVI REPORTS IN MONGODB ===");
    console.log(reports.map(r => ({ id: r.id, employeeName: r.employeeName, employeeId: r.employeeId, date: r.date, details: r.details })));

  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.connection.close();
  }
}
main();
