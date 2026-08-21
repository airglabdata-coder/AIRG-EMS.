const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const AIRGLABS_URI = 'mongodb+srv://airg_ems_user:AirgEMS2026%21@cluster0.4ahcgcn.mongodb.net/airg_ems_db?retryWrites=true&w=majority&appName=Cluster0';

async function cleanupSessions() {
  console.log('Connecting to AirgLabs DB to consolidate fragmented session logs...');
  await mongoose.connect(AIRGLABS_URI);
  const db = mongoose.connection.db;

  const empCol = db.collection('employees');
  const employees = await empCol.find({}).toArray();

  const dateObj = new Date();
  const dateOptions = { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' };
  const formattedDate = dateObj.toLocaleDateString('en-US', dateOptions);

  let cleanedCount = 0;

  for (const emp of employees) {
    let logs = emp.activityLogs || [];
    let dayEntry = logs.find(log => log.date === formattedDate);

    if (dayEntry && dayEntry.sessions && dayEntry.sessions.length > 1) {
      console.log(`Consolidating ${dayEntry.sessions.length} sessions for ${emp.name} (${emp.id})...`);
      
      const firstSession = dayEntry.sessions[0];
      const lastSession = dayEntry.sessions[dayEntry.sessions.length - 1];

      const mergedSession = {
        login: firstSession.login || lastSession.login || '09:00:00 AM',
        logout: lastSession.logout || 'active',
        loginMs: firstSession.loginMs || Date.now(),
        logoutMs: Date.now(),
        durationMinutes: firstSession.loginMs ? Math.round((Date.now() - firstSession.loginMs) / 60000) : 0,
        explicitLogout: false
      };

      dayEntry.sessions = [mergedSession];
      dayEntry.totalMinutesWorked = mergedSession.durationMinutes;

      await empCol.updateOne({ _id: emp._id }, { $set: { activityLogs: logs } });
      cleanedCount++;
    }
  }

  console.log(`✅ Consolidated session activity logs for ${cleanedCount} employees for ${formattedDate}!`);
  process.exit(0);
}

cleanupSessions().catch(err => {
  console.error(err);
  process.exit(1);
});
