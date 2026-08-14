const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');
let count = 0;

function fix(oldCode, newCode, label) {
  if (appJs.includes(oldCode)) {
    appJs = appJs.replace(oldCode, newCode);
    count++;
    console.log(`✅ Fixed: ${label}`);
    return true;
  }
  // Try CRLF
  const oldCrlf = oldCode.replace(/\n/g, '\r\n');
  const newCrlf = newCode.replace(/\n/g, '\r\n');
  if (appJs.includes(oldCrlf)) {
    appJs = appJs.replace(oldCrlf, newCrlf);
    count++;
    console.log(`✅ Fixed (CRLF): ${label}`);
    return true;
  }
  console.log(`⚠️  NOT FOUND: ${label}`);
  return false;
}

// ============================================================
// FIX 1: Leave approval/rejection (processAction) - CRITICAL
// HR approves/rejects but it never saves to server!
// ============================================================
fix(
  `  // Save changes to localStorage
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));

  // Trigger SMS notification for the leave applicant`,
  `  // Save changes to localStorage AND sync to server immediately
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  triggerBackendSync(); // ← CRITICAL: persist leave status change to MongoDB

  // Trigger SMS notification for the leave applicant`,
  'processAction - leave approve/reject missing sync'
);

// ============================================================
// FIX 2: Employee leave request submission
// ============================================================
fix(
  `  // Update State
  state.requests.unshift(newReq);
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));

  // Trigger SMS notifications for HR and Admin users`,
  `  // Update State
  state.requests.unshift(newReq);
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  triggerBackendSync(); // persist leave request to server

  // Trigger SMS notifications for HR and Admin users`,
  'submitLeaveRequest - missing sync'
);

// ============================================================
// FIX 3: HR Direct Leave Recording 
// ============================================================
fix(
  `  state.requests.unshift(newRequest);

  // Save requests and update local storage
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));

  // Trigger SMS notification`,
  `  state.requests.unshift(newRequest);

  // Save requests and sync to server
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  triggerBackendSync(); // persist directly recorded leave to server

  // Trigger SMS notification`,
  'HR Direct Leave Recording - missing sync'
);

// ============================================================
// FIX 4: Add Employee function - missing sync
// ============================================================
fix(
  `  state.employees.push(newEmp);
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));

  // Reset photo upload state`,
  `  state.employees.push(newEmp);
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  triggerBackendSync(); // persist new employee to server

  // Reset photo upload state`,
  'addEmployee - missing sync'
);

// ============================================================
// FIX 5: Add Department - missing sync
// ============================================================
fix(
  `  localStorage.setItem('ems_departments', JSON.stringify(state.departments));`,
  `  localStorage.setItem('ems_departments', JSON.stringify(state.departments));
  triggerBackendSync(); // persist department changes to server`,
  'addDepartment - missing sync'
);

// ============================================================
// FIX 6: Reimbursement approve/reject functions
// ============================================================
fix(
  `    localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
  renderReimbursements();`,
  `    localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
  triggerBackendSync(); // persist reimbursement decision to server
  renderReimbursements();`,
  'approveReimbursement - missing sync'
);

// ============================================================
// FIX 7: Ticket resolution/update
// ============================================================
fix(
  `  localStorage.setItem('ems_tickets', JSON.stringify(state.tickets));
  renderTickets();`,
  `  localStorage.setItem('ems_tickets', JSON.stringify(state.tickets));
  triggerBackendSync(); // persist ticket changes to server
  renderTickets();`,
  'updateTicket - missing sync'
);

// ============================================================
// FIX 8: Delete announcement - missing sync (line 7059)
// ============================================================
fix(
  `  localStorage.setItem('ems_announcements', JSON.stringify(state.announcements));
  renderCommunicationsHub();`,
  `  localStorage.setItem('ems_announcements', JSON.stringify(state.announcements));
  triggerBackendSync(); // persist announcement deletion
  renderCommunicationsHub();`,
  'deleteAnnouncement - missing sync'
);

// ============================================================
// FIX 9: Delete notice - missing sync (line 7074)
// ============================================================
fix(
  `  localStorage.setItem('ems_notices', JSON.stringify(state.notices));
  renderCommunicationsHub();`,
  `  localStorage.setItem('ems_notices', JSON.stringify(state.notices));
  triggerBackendSync(); // persist notice deletion
  renderCommunicationsHub();`,
  'deleteNotice - missing sync'
);

// ============================================================
// FIX 10: Delete leave request (line 7089)
// ============================================================
fix(
  `  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  renderHRDashboard('requests');`,
  `  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  triggerBackendSync(); // persist request deletion
  renderHRDashboard('requests');`,
  'deleteLeaveRequest - missing sync'
);

// ============================================================
// FIX 11: Delete reimbursement (line 7116)
// ============================================================
fix(
  `  localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
  renderReimbursements();`,
  `  localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
  triggerBackendSync(); // persist reimbursement delete to server
  renderReimbursements();`,
  'deleteReimbursement - missing sync'
);

// ============================================================
// FIX 12: School/Problem reporting - check lines 11895, 12063, 12124, 12670, 12806, 13089
// Some may already have triggerBackendSync, skip if so
// ============================================================

// ============================================================
// FIX 13: Chat sending - check line 6993
// ============================================================
fix(
  `  localStorage.setItem('ems_chats', JSON.stringify(state.chats));
  renderCommunicationsHub();`,
  `  localStorage.setItem('ems_chats', JSON.stringify(state.chats));
  triggerBackendSync(); // persist chat message to server
  renderCommunicationsHub();`,
  'sendChat - missing sync'
);

// ============================================================
// FIX 14: Send notification (line 11536)
// ============================================================
fix(
  `  localStorage.setItem('ems_notifications', JSON.stringify(state.smsNotifications));`,
  `  localStorage.setItem('ems_notifications', JSON.stringify(state.smsNotifications));
  triggerBackendSync(); // persist notification to server`,
  'saveNotification - missing sync'
);

// ============================================================
// FIX 15: Registration approval - employee status update
// lines 2781, 2817, 2846, 2875
// ============================================================
// These are in approveRegistration and similar - check if sync is called
const regApproveSection = appJs.substring(
  appJs.indexOf('state.employees.findIndex(e => e.id === emp.id)'),
  appJs.indexOf('state.employees.findIndex(e => e.id === emp.id)') + 2000
);
if (!regApproveSection.includes('triggerBackendSync') && !regApproveSection.includes('syncStateNow')) {
  console.log('⚠️  Registration approval may be missing sync - check manually');
}

// ============================================================
// FIX 16: Update profile (line 10785 area)
// ============================================================
fix(
  `    localStorage.setItem('ems_logged_in_user', JSON.stringify(state.currentUser));
    state.employees[empIdx] = state.currentUser;
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    triggerBackendSync();`,
  `    localStorage.setItem('ems_logged_in_user', JSON.stringify(state.currentUser));
    state.employees[empIdx] = state.currentUser;
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    triggerBackendSync();`,
  'updateProfile - already has sync (skipping)'
);

// Save
fs.writeFileSync('app.js', appJs, 'utf8');
console.log(`\n✅ Applied ${count} fixes to app.js`);
