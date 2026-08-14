const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// The keys that correspond to collections synced to the backend
const syncKeys = [
  'ems_requests',
  'ems_employees',
  'ems_projects',
  'ems_tasks',
  'ems_departments',
  'ems_chats',
  'ems_announcements',
  'ems_notices',
  'ems_reports',
  'ems_reimbursements',
  'ems_tickets',
  'ems_schools',
  'ems_notifications'
];

let addedCount = 0;

// Find all localStorage.setItem calls for these keys
const lines = appJs.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('localStorage.setItem(')) {
    // Check if it's one of our sync keys
    const match = syncKeys.find(key => line.includes(`'${key}'`) || line.includes(`"${key}"`));
    if (match) {
      // Check the next few lines to see if a sync is already happening
      let hasSync = false;
      for (let j = 1; j <= 4 && (i + j) < lines.length; j++) {
        if (lines[i+j].includes('triggerBackendSync') || lines[i+j].includes('syncStateNow')) {
          hasSync = true;
          break;
        }
      }
      
      // Also check the previous line (sometimes it's before)
      if (i > 0 && (lines[i-1].includes('triggerBackendSync') || lines[i-1].includes('syncStateNow'))) {
        hasSync = true;
      }
      // Also check same line
      if (line.includes('triggerBackendSync') || line.includes('syncStateNow')) {
        hasSync = true;
      }
      
      // Some safe set methods inside initial state load don't need immediate sync (they are pulling from server)
      // They are inside fetchCentralizedState or login
      // A good heuristic: if it's inside `fetchCentralizedState`, skip.
      // We know fetchCentralizedState is around line 150-300
      if (i > 150 && i < 350) {
          hasSync = true; // skip
      }
      
      // If no sync found nearby, insert one right after this line!
      if (!hasSync) {
        // preserve indentation of the current line
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        
        // Check if there is an empty line or something after
        lines.splice(i + 1, 0, `${indent}triggerBackendSync(); // [AUTO-ADDED] persist ${match} to server`);
        addedCount++;
        i++; // skip the newly added line
      }
    }
  }
}

appJs = lines.join('\n');
fs.writeFileSync('app.js', appJs, 'utf8');

console.log(`✅ Automatically added triggerBackendSync() in ${addedCount} missing locations.`);
