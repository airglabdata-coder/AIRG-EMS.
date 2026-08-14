// using native fetch
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function testSync() {
  const payload = {
    requests: [
      {
        id: "REQ103",
        employeeId: "AIRG00055", // Assuming Atharva is this
        employeeName: "Atharva Nahire",
        status: "approved",
        duration: 1,
        type: "Work From Home (WFH)"
      }
    ]
  };

  try {
    const res = await fetch('http://localhost:5000/api/sync?employeeId=AIRG00042', { // AIRG00042 is Shravani (HR)
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    console.log("Sync response:", data);
  } catch(e) {
    console.error("Error:", e);
  }
}

testSync();
