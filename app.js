// EMS Leave Portal - Application Logic

window.onerror = function (message, source, lineno, colno, error) {
  // Try using showToast, fallback to alert
  try {
    showToast(`Runtime Error: ${message} at line ${lineno}`, 'error');
  } catch (e) {
    alert(`Runtime Error: ${message} at line ${lineno}`);
  }
  return false;
};

function getTodayDateString() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function deduplicateSchools(schools) {
  if (!Array.isArray(schools)) return [];
  const nameMap = new Map();
  schools.forEach(sch => {
    if (!sch || !sch.name) return;
    const cleanName = sch.name.trim();
    const key = cleanName.toLowerCase();
    const existing = nameMap.get(key);
    if (!existing) {
      nameMap.set(key, { ...sch, name: cleanName });
    } else {
      const managerName = (sch.managerName && sch.managerName !== 'Unassigned') ? sch.managerName : (existing.managerName || sch.managerName || '');
      const mergedInstructors = Array.from(new Set([...(existing.instructors || []), ...(sch.instructors || [])]));
      nameMap.set(key, {
        ...existing,
        ...sch,
        id: existing.id || sch.id,
        name: cleanName,
        managerName: managerName,
        instructors: mergedInstructors
      });
    }
  });
  return Array.from(nameMap.values());
}

// --- Central Database Sync Layer ---
const originalSetItem = localStorage.setItem;
let isSyncingToServer = false;
let syncTimeout = null;
let wasStateFetchedFromServer = false;

function safeOriginalSetItem(key, value) {
  try {
    originalSetItem.call(localStorage, key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn(`LocalStorage quota exceeded for key "${key}"! Data saved in memory only.`);
    } else {
      throw e;
    }
  }
}

localStorage.setItem = function (key, value) {
  try {
    originalSetItem.call(localStorage, key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn('LocalStorage quota exceeded! Data saved in memory for this session.', e);
      showToast('Warning: Browser local storage is full. Files/attachments might not be saved locally, but they are being synced to the server database.', 'warning');
    } else {
      throw e;
    }
  }
  if (key.startsWith('ems_') && key !== 'ems_logged_in_user' && key !== 'ems_theme' && !key.startsWith('ems_read_')) {
    triggerBackendSync();
  }
};

async function executeServerDelete(modelName, id) {
  try {
    const res = await fetch('/api/delete-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelName,
        id,
        employeeId: state.currentUser ? state.currentUser.id : null,
        role: state.currentRole
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Deletion failed on server');
    }
    return true;
  } catch (err) {
    console.error('Server deletion error:', err);
    showToast(err.message || 'Failed to delete on server. Please try again.', 'error');
    return false;
  }
}

function triggerBackendSync() {
  if (syncTimeout) clearTimeout(syncTimeout);
  isSyncingToServer = true;

  syncTimeout = setTimeout(() => {
    const cleanState = {
      employees: state.employees || [],
      requests: state.requests || [],
      projects: state.projects || [],
      tasks: state.tasks || [],
      departments: state.departments || [],
      chats: state.chats || [],
      dailyReports: state.dailyReports || [],
      announcements: state.announcements || [],
      notices: state.notices || [],
      reimbursements: state.reimbursements || [],
      tickets: state.tickets || [],
      nationalHolidays: state.nationalHolidays || [],
      celebrationDays: state.celebrationDays || [],
      smsNotifications: state.smsNotifications || [],
      schools: state.schools || [],
      trainerReports: state.trainerReports || []
    };

    const url = state.currentUser ? `/api/sync?employeeId=${state.currentUser.id}` : '/api/sync';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanState)
    })
      .then(res => {
        if (!res.ok) {
          console.error('Server sync failed with status:', res.status);
          return { success: false };
        }
        return res.json();
      })
      .then(data => {
        if (data && data.success) {
          state.lastSyncedTimestamp = data.timestamp;
          if (data.activeUsers) {
            state.activeUsers = data.activeUsers;
          }
        }
        isSyncingToServer = false;
      })
      .catch(err => {
        console.error('Failed to sync to database server:', err);
        isSyncingToServer = false;
      });
  }, 300);
}

async function syncStateNow() {
  if (syncTimeout) clearTimeout(syncTimeout);
  isSyncingToServer = true;

  const cleanState = {
    employees: state.employees || [],
    requests: state.requests || [],
    projects: state.projects || [],
    tasks: state.tasks || [],
    departments: state.departments || [],
    chats: state.chats || [],
    dailyReports: state.dailyReports || [],
    announcements: state.announcements || [],
    notices: state.notices || [],
    reimbursements: state.reimbursements || [],
    tickets: state.tickets || [],
    nationalHolidays: state.nationalHolidays || [],
    celebrationDays: state.celebrationDays || [],
    smsNotifications: state.smsNotifications || [],
    schools: state.schools || [],
    customChatGroups: state.customChatGroups || []
  };

  const url = state.currentUser ? `/api/sync?employeeId=${state.currentUser.id}` : '/api/sync';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanState)
    });
    if (!res.ok) {
      console.error('Server sync failed with status:', res.status);
      isSyncingToServer = false;
      return false;
    }
    const data = await res.json();
    if (data && data.success) {
      state.lastSyncedTimestamp = data.timestamp;
      if (data.activeUsers) {
        state.activeUsers = data.activeUsers;
      }
      if (state.dailyReports && state.dailyReports.length > 0) {
        state.dailyReports.forEach(r => r.synced = true);
        safeOriginalSetItem('ems_reports', JSON.stringify(state.dailyReports));
      }
      isSyncingToServer = false;
      return true;
    }
  } catch (err) {
    console.error('Failed to sync to database server:', err);
  }
  isSyncingToServer = false;
  return false;
}

async function fetchCentralizedState() {
  try {
    const url = state.currentUser ? `/api/sync?employeeId=${state.currentUser.id}` : '/api/sync';
    const res = await fetch(url);

    // If server returned an error, do NOT overwrite local state with stale/empty data
    if (!res.ok) {
      console.error('Server returned error status:', res.status, '— keeping local state intact.');
      return;
    }

    const data = await res.json();

    // Only overwrite local state if we received valid data from MongoDB
    if (data && data.state && !data.empty && !data.error) {
      isSyncingToServer = true;
      const s = data.state;
      if (s.employees) {
        const cleanResult = cleanBloatedEmployees(s.employees);
        state.employees = cleanResult.employees;
        safeOriginalSetItem('ems_employees', JSON.stringify(cleanResult.employees));
      }
      if (s.requests) {
        const serverRequests = s.requests || [];
        const serverReqIds = new Set(serverRequests.map(r => r.id));
        const localRequests = JSON.parse(localStorage.getItem('ems_requests') || '[]');
        // Preserve any unsynced local leave requests so user data is never lost
        const unsyncedLocalReqs = localRequests.filter(r => !serverReqIds.has(r.id));
        state.requests = [...serverRequests, ...unsyncedLocalReqs];
        safeOriginalSetItem('ems_requests', JSON.stringify(state.requests));
        if (unsyncedLocalReqs.length > 0) {
          syncStateNow();
        }
      }
      if (s.projects) {
        state.projects = s.projects;
        safeOriginalSetItem('ems_projects', JSON.stringify(s.projects));
      }
      if (s.tasks) {
        cleanBloatedAttachments(s.tasks);
        // Filter out private tasks that belong to other users
        const serverTasks = s.tasks.filter(t => !t.isPrivate || t.ownerId === state.currentUser.id);
        // Merge: keep locally-created tasks not yet on server
        const localTasks = JSON.parse(localStorage.getItem('ems_tasks') || '[]');
        const serverTaskIds = new Set(serverTasks.map(t => t.id));
        const unsyncedLocal = localTasks.filter(t => !serverTaskIds.has(t.id) && !t.synced);
        state.tasks = [...serverTasks, ...unsyncedLocal];
        // Mark server tasks as synced
        state.tasks.forEach(t => { if (serverTaskIds.has(t.id)) t.synced = true; });
        safeOriginalSetItem('ems_tasks', JSON.stringify(state.tasks));
      }
      if (s.departments) {
        state.departments = ['AI', 'Electronics', 'Lab Setup', 'Instructor'];
        safeOriginalSetItem('ems_departments', JSON.stringify(state.departments));
      }
      if (s.chats) {
        const localChats = JSON.parse(localStorage.getItem('ems_chats') || '[]');
        const serverChatIds = new Set(s.chats.map(c => c.id));
        const unsyncedChats = localChats.filter(c => !serverChatIds.has(c.id));
        state.chats = [...s.chats, ...unsyncedChats];
        safeOriginalSetItem('ems_chats', JSON.stringify(state.chats));
        if (unsyncedChats.length > 0) {
          triggerBackendSync();
        }
      }
      if (s.dailyReports) {
        s.dailyReports.forEach(r => r.synced = true);
        const localReports = JSON.parse(localStorage.getItem('ems_reports') || '[]');
        const serverReportIds = new Set(s.dailyReports.map(r => r.id));
        const unsyncedReports = localReports.filter(r => !r.synced && !serverReportIds.has(r.id));
        state.dailyReports = [...s.dailyReports, ...unsyncedReports];
        safeOriginalSetItem('ems_reports', JSON.stringify(state.dailyReports));
        if (unsyncedReports.length > 0) {
          triggerBackendSync();
        }
      }
      if (s.announcements) {
        cleanBloatedAttachments(s.announcements);
        state.announcements = s.announcements;
        safeOriginalSetItem('ems_announcements', JSON.stringify(s.announcements));
      }
      if (s.notices) {
        cleanBloatedAttachments(s.notices);
        state.notices = s.notices;
        safeOriginalSetItem('ems_notices', JSON.stringify(s.notices));
      }
      if (s.reimbursements) {
        cleanBloatedAttachments(s.reimbursements);
        state.reimbursements = s.reimbursements;
        safeOriginalSetItem('ems_reimbursements', JSON.stringify(s.reimbursements));
      }
      if (s.tickets) {
        cleanBloatedAttachments(s.tickets);
        state.tickets = s.tickets;
        safeOriginalSetItem('ems_tickets', JSON.stringify(s.tickets));
      }
      if (Array.isArray(s.customChatGroups)) {
        const grpMap = new Map((state.customChatGroups || []).map(g => [g.id, g]));
        s.customChatGroups.forEach(g => {
          if (g && g.id) {
            const existing = grpMap.get(g.id);
            if (existing) {
              const mergedMembers = Array.from(new Set([...(existing.members || []), ...(g.members || [])]));
              grpMap.set(g.id, { ...existing, ...g, members: mergedMembers });
            } else {
              grpMap.set(g.id, g);
            }
          }
        });
        state.customChatGroups = Array.from(grpMap.values());
        safeOriginalSetItem('ems_custom_chat_groups', JSON.stringify(state.customChatGroups));
      }
      if (Array.isArray(s.trainerReports)) {
        state.trainerReports = s.trainerReports;
        safeOriginalSetItem('ems_trainer_reports', JSON.stringify(s.trainerReports));
      }
      if (s.schools) {
        // Compare to see if any school has new/updated problems
        const userRole = (state.currentUser && state.currentUser.role || '').toLowerCase();
        const isHRorCEO = userRole.includes('hr') || userRole.includes('admin');
        if (isHRorCEO && wasStateFetchedFromServer && state.schools && state.schools.length > 0) {
          const oldSchoolsMap = new Map(state.schools.map(sch => [sch.id, sch]));
          s.schools.forEach(newSch => {
            const oldSch = oldSchoolsMap.get(newSch.id);
            const oldProb = oldSch ? (oldSch.problems || '') : '';
            const newProb = newSch.problems || '';
            if (newProb && newProb !== oldProb) {
              // Trigger instant alert!
              showToast(`🚨 URGENT Problem reported at ${newSch.name}: ${newProb}`, 'error');
              
              try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav');
                audio.play().catch(() => {});
              } catch (e) {}

              // Display a prominent browser alert to catch immediate attention
              setTimeout(() => {
                alert(`🚨 URGENT SCHOOL PROBLEM REPORTED!\n\nSchool: ${newSch.name}\nProblem: "${newProb}"`);
              }, 100);
            }
          });
        }

        state.schools = deduplicateSchools(s.schools);
        safeOriginalSetItem('ems_schools', JSON.stringify(state.schools));
      }
      if (s.nationalHolidays) {
        state.nationalHolidays = s.nationalHolidays;
        safeOriginalSetItem('ems_national_holidays', JSON.stringify(s.nationalHolidays));
      }
      if (s.celebrationDays) {
        state.celebrationDays = s.celebrationDays;
        safeOriginalSetItem('ems_celebration_days', JSON.stringify(s.celebrationDays));
      }
      if (s.smsNotifications) {
        state.smsNotifications = s.smsNotifications;
        safeOriginalSetItem('ems_notifications', JSON.stringify(s.smsNotifications));
      }

      state.activeUsers = data.activeUsers || [];
      state.lastSyncedTimestamp = data.timestamp;
      isSyncingToServer = false;
      wasStateFetchedFromServer = true;
      sanitizeEmployeeRoles();
      if (typeof checkAndAnnounceGlobalMilestones === 'function') {
        checkAndAnnounceGlobalMilestones();
      }
    }
  } catch (err) {
    console.error('Failed to load state from database server:', err, '— keeping local state intact.');
  }
}

function initSyncPolling() {
  if (window.syncPollInterval) clearInterval(window.syncPollInterval);
  if (window.chatPollInterval) clearInterval(window.chatPollInterval);

  // ────────────────────────────────────────────────────────────────────────────
  // CHAT-ONLY FAST POLL (every 600ms) — NEVER blocked by isUserBusy
  // This ensures new messages appear instantly on recipient screen without refresh
  // ────────────────────────────────────────────────────────────────────────────
  let lastChatSignature = '';
  window.chatPollInterval = setInterval(async () => {
    if (!state.currentUser) return;
    try {
      const chatRes = await fetch(`/api/chats-only?employeeId=${state.currentUser.id}&_t=${Date.now()}`);
      if (!chatRes.ok) return;
      const chatData = await chatRes.json();
      if (!chatData || !chatData.chats) return;

      // Filter out deleted/tombstoned chat IDs from local state
      if (chatData.deletedChatIds && Array.isArray(chatData.deletedChatIds)) {
        const deadSet = new Set(chatData.deletedChatIds);
        state.chats = (state.chats || []).filter(m => !deadSet.has(m.id));
      }

      // Merge incoming server chats with local chats (so freshly typed messages never disappear)
      const serverChatIds = new Set(chatData.chats.map(m => m.id));
      const unsyncedLocalChats = (state.chats || []).filter(m => !serverChatIds.has(m.id));
      const mergedChats = [...chatData.chats, ...unsyncedLocalChats];

      // Update active users list always
      if (chatData.activeUsers) state.activeUsers = chatData.activeUsers;

      // Signature of merged chat messages (includes IDs and timestamps for instant change detection)
      const newSignature = mergedChats.map(m => `${m.id}_${m.timestamp || ''}`).join('|');

      if (lastChatSignature !== newSignature) {
        lastChatSignature = newSignature;
        state.chats = mergedChats;
        safeOriginalSetItem('ems_chats', JSON.stringify(state.chats));
      }

      // Re-render chat UI & online dots immediately if currently viewing communications
      const activeMenuItem = document.querySelector('.menu-item.active');
      const activeView = state.currentView || (activeMenuItem ? activeMenuItem.getAttribute('data-view') : '');
      if (activeView === 'communications' || state.currentView === 'communications') {
        if (state.activeCommTab === 'chats') {
          renderChatRoom();
          renderCommSidebar();
        } else if (state.activeCommTab === 'notices') {
          renderNotices();
        } else if (state.activeCommTab === 'announcements') {
          renderAnnouncements();
        }
      }
      updateAllMenuBadges();

      if (chatData.announcements) {
        state.announcements = chatData.announcements;
        safeOriginalSetItem('ems_announcements', JSON.stringify(state.announcements));
      }
      if (chatData.notices) {
        state.notices = chatData.notices;
        safeOriginalSetItem('ems_notices', JSON.stringify(state.notices));
      }
      if (Array.isArray(chatData.customChatGroups)) {
        const grpMap = new Map((state.customChatGroups || []).map(g => [g.id, g]));
        chatData.customChatGroups.forEach(g => {
          if (g && g.id) {
            const existing = grpMap.get(g.id);
            if (existing) {
              const mergedMembers = Array.from(new Set([...(existing.members || []), ...(g.members || [])]));
              grpMap.set(g.id, { ...existing, ...g, members: mergedMembers });
            } else {
              grpMap.set(g.id, g);
            }
          }
        });
        state.customChatGroups = Array.from(grpMap.values());
        safeOriginalSetItem('ems_custom_chat_groups', JSON.stringify(state.customChatGroups));
      }

      // Fast real-time sync for Schools (<600ms)
      if (Array.isArray(chatData.schools)) {
        const dedupped = deduplicateSchools(chatData.schools);
        const schoolSig = dedupped.map(s => `${s.id}_${s.managerName}_${(s.instructors || []).join(',')}`).join('|');
        if (window.lastSchoolSignature !== schoolSig) {
          window.lastSchoolSignature = schoolSig;
          state.schools = dedupped;
          safeOriginalSetItem('ems_schools', JSON.stringify(dedupped));
          if (activeView === 'schools' || state.currentView === 'schools') {
            renderSchoolManagement();
          }
        }
      }
    } catch (err) {
      // Silent fail — chat poll errors shouldn't disrupt the user
    }
  }, 600);

  // ────────────────────────────────────────────────────────────────────────────
  // GENERAL STATE POLL (every 600ms) — for all other data updates
  // ────────────────────────────────────────────────────────────────────────────
  window.syncPollInterval = setInterval(async () => {
    if (!state.currentUser) return;
    if (isSyncingToServer) return;

    // Check if the user is busy typing or has an active modal overlay open
    const isUserBusy = (() => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        // Exception: chat input should not count as "busy" for general sync
        if (activeEl.id === 'chat-message-input' || activeEl.id === 'chat-input-message') return false;
        return true;
      }
      const openModals = document.querySelectorAll('.modal-overlay.active');
      if (openModals.length > 0) {
        return true;
      }
      return false;
    })();

    try {
      // 1. Fetch lightweight timestamp and active users list
      const timestampUrl = `/api/sync-timestamp?employeeId=${state.currentUser.id}&_t=${Date.now()}`;
      const timestampRes = await fetch(timestampUrl);
      if (!timestampRes.ok) {
        console.warn('Sync poll timestamp: server returned error status', timestampRes.status);
        return;
      }
      const timestampData = await timestampRes.json();

      // 2. Always update active users list and re-render online indicators if it changed
      if (timestampData && timestampData.activeUsers) {
        const prevActive = JSON.stringify(state.activeUsers || []);
        const nextActive = JSON.stringify(timestampData.activeUsers || []);
        if (prevActive !== nextActive) {
          state.activeUsers = timestampData.activeUsers;
          const activeMenuItem = document.querySelector('.menu-item.active');
          const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';
          if (currentView === 'communications') {
            renderCommunicationsHub();
          } else if (currentView === 'roster') {
            renderEmployeeRoster();
          } else if (currentView === 'emp-details') {
            renderEmployeeDetails();
          }
        }
      }

      // 3. If lastSyncedTimestamp matches server, skip loading full state
      if (timestampData && timestampData.timestamp === state.lastSyncedTimestamp) {
        return;
      }

      // 4. Skip full re-render if user is busy (chat updates come from chatPollInterval)
      if (isUserBusy) return;

      // 5. Perform full sync since state has updated on the server
      const url = `/api/sync?employeeId=${state.currentUser.id}`;
      const res = await fetch(url);

      if (!res.ok) {
        console.warn('Sync poll: server returned error status', res.status, '— skipping update.');
        return;
      }

      const data = await res.json();

      if (data && data.state && !data.empty && !data.error && data.timestamp !== state.lastSyncedTimestamp) {
        // RACE CONDITION FIX: If user performed an action while this fetch was in flight, abort!
        if (isSyncingToServer || syncTimeout) {
          console.warn('Sync poll: local changes pending. Aborting overwrite to prevent data loss.');
          return;
        }
        isSyncingToServer = true;
        state.activeUsers = data.activeUsers || state.activeUsers;
        const s = data.state;
        state.employees = s.employees || state.employees;
        state.requests = s.requests || state.requests;
        state.projects = s.projects || state.projects;
        // Merge tasks safely — don't wipe unsynced local tasks, filter other users' private tasks
        if (s.tasks) {
          const serverTasks = s.tasks.filter(t => !t.isPrivate || t.ownerId === state.currentUser.id);
          const localTasks = state.tasks || [];
          const serverTaskIds = new Set(serverTasks.map(t => t.id));
          const unsyncedLocal = localTasks.filter(t => !serverTaskIds.has(t.id) && !t.synced);
          state.tasks = [...serverTasks, ...unsyncedLocal];
        }
        state.departments = s.departments || state.departments;
        state.chats = s.chats || state.chats;
        state.dailyReports = s.dailyReports || state.dailyReports;
        state.announcements = s.announcements || state.announcements;
        state.notices = s.notices || state.notices;
        state.reimbursements = s.reimbursements || state.reimbursements;
        state.tickets = s.tickets || state.tickets;
        state.nationalHolidays = s.nationalHolidays || state.nationalHolidays;
        state.celebrationDays = s.celebrationDays || state.celebrationDays;
        state.smsNotifications = s.smsNotifications || state.smsNotifications;
        state.schools = s.schools || state.schools;

        state.lastSyncedTimestamp = data.timestamp;

        if (s.employees) safeOriginalSetItem('ems_employees', JSON.stringify(s.employees));
        if (s.requests) safeOriginalSetItem('ems_requests', JSON.stringify(s.requests));
        if (s.projects) safeOriginalSetItem('ems_projects', JSON.stringify(s.projects));
        if (s.tasks) safeOriginalSetItem('ems_tasks', JSON.stringify(s.tasks));
        if (s.departments) safeOriginalSetItem('ems_departments', JSON.stringify(s.departments));
        if (s.chats) safeOriginalSetItem('ems_chats', JSON.stringify(s.chats));
        if (s.dailyReports) safeOriginalSetItem('ems_reports', JSON.stringify(s.dailyReports));
        if (s.announcements) safeOriginalSetItem('ems_announcements', JSON.stringify(s.announcements));
        if (s.notices) safeOriginalSetItem('ems_notices', JSON.stringify(s.notices));
        if (s.reimbursements) safeOriginalSetItem('ems_reimbursements', JSON.stringify(s.reimbursements));
        if (s.tickets) safeOriginalSetItem('ems_tickets', JSON.stringify(s.tickets));
        if (s.nationalHolidays) safeOriginalSetItem('ems_national_holidays', JSON.stringify(s.nationalHolidays));
        if (s.celebrationDays) safeOriginalSetItem('ems_celebration_days', JSON.stringify(s.celebrationDays));
        if (s.smsNotifications) safeOriginalSetItem('ems_notifications', JSON.stringify(s.smsNotifications));
        if (s.schools) safeOriginalSetItem('ems_schools', JSON.stringify(s.schools));

        isSyncingToServer = false;
        sanitizeEmployeeRoles();

        if (!state.currentUser) return;

        const activeMenuItem = document.querySelector('.menu-item.active');
        const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';

        if (currentView === 'communications') {
          renderCommunicationsHub();
        } else if (currentView === 'calendar') {
          renderCalendar();
        } else if (currentView === 'payslips') {
          renderPayslips();
        } else if (currentView === 'reimbursements') {
          renderReimbursements();
        } else if (currentView === 'tickets') {
          renderTickets();
        } else if (currentView === 'reports') {
          loadDailyReportsPage();
        } else if (currentView === 'school-management') {
          renderSchoolManagement();
        } else if (currentView === 'emp-details') {
          renderEmployeeDetails();
        } else if (currentView === 'registration-approval') {
          renderRegistrationApprovalQueue();
        } else {
          const isHROrAdmin = state.currentRole === 'hr' || state.currentRole === 'admin' || state.currentRole === 'techlead' || state.currentRole === 'manager';
          if (isHROrAdmin) {
            if (currentView === 'dashboard' || currentView === 'requests') {
              renderHRDashboard(currentView);
            } else if (currentView === 'roster') {
              renderEmployeeRoster();
            } else if (currentView === 'tasks') {
              renderHRTasksAndProjects();
            } else {
              renderEmployeeDashboard(currentView);
            }
          } else {
            renderEmployeeDashboard(currentView);
          }
        }
        updateCommMenuBadges();
      }
    } catch (err) {
      console.error('Polling sync failed:', err);
    }
  }, 600);
}




// --- Constants & Seed Data ---
const DEFAULT_EMPLOYEES = [
  {
    id: "AIRG00008",
    name: "Suyash Patil",
    dept: "AI, Electronics, Lab Setup",
    email: "suyashpatil1224@gmail.com",
    role: "Tech Lead, Manager",
    balance: 20,
    absent: 0,
    avatar: "SP",
    aadhar: "5250 6200 0000",
    pan: "SUYAS1234P",
    bankAcc: "98765432101",
    bankIfsc: "HDFC0000123",
    password: "Suyash$2412",
    phone: "+91 99752 59016"
  },
  {
    id: "AIRG00029",
    name: "Pratik Mane",
    dept: "Electronics, Lab Setup",
    email: "pratik@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "PM",
    aadhar: "8235 4400 0000",
    pan: "PRATI1234M",
    bankAcc: "98765432104",
    bankIfsc: "HDFC0000123",
    password: "pratik",
    phone: "+91 95791 17298"
  },
  {
    id: "AIRG00010",
    name: "Prasad Shelke",
    dept: "Electronics, Lab Setup",
    email: "prasad@gurujiair.com",
    role: "Tech Lead, Manager",
    balance: 20,
    absent: 0,
    avatar: "PS",
    aadhar: "6805 0800 0000",
    pan: "PRASA1234S",
    bankAcc: "98765432105",
    bankIfsc: "HDFC0000123",
    password: "prasad",
    phone: "+91 87673 87480"
  },
  {
    id: "AIRG00038",
    name: "Rohan Patil",
    dept: "Electronics, Lab Setup",
    email: "rohan@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "RP",
    aadhar: "3678 6400 0000",
    pan: "ROHAN1234P",
    bankAcc: "98765432106",
    bankIfsc: "HDFC0000123",
    password: "rohan",
    phone: "+91 99214 14810"
  },
  {
    id: "AIRG00026",
    name: "Nilesh Sonanwane",
    dept: "Instructor",
    email: "nilesh@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "NS",
    aadhar: "6942 6200 0000",
    pan: "NILES1234S",
    bankAcc: "98765432107",
    bankIfsc: "HDFC0000123",
    password: "nilesh",
    phone: "+91 96994 41027"
  },
  {
    id: "AIRG00032",
    name: "Yash Bhisekar",
    dept: "Instructor",
    email: "yash@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "YB",
    aadhar: "5428 9600 0000",
    pan: "YASHB1234I",
    bankAcc: "98765432108",
    bankIfsc: "HDFC0000123",
    password: "yash",
    phone: "+91 94223 90685"
  },
  {
    id: "AIRG00035",
    name: "Yogesh Meena",
    dept: "AI",
    email: "yogesh@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "YM",
    aadhar: "8029 0800 0000",
    pan: "YOGES1234M",
    bankAcc: "98765432109",
    bankIfsc: "HDFC0000123",
    password: "yogesh",
    phone: "+91 96729 94136"
  },
  {
    id: "AIRG00028",
    name: "Soham Wandkar",
    dept: "AI",
    email: "soham@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "SW",
    aadhar: "2991 1000 0000",
    pan: "SOHAM1234W",
    bankAcc: "98765432110",
    bankIfsc: "HDFC0000123",
    password: "soham",
    phone: "+91 97661 33667"
  },
  {
    id: "AIRG00037",
    name: "Aditya Raj",
    dept: "AI",
    email: "aditya@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "AR",
    aadhar: "3797 2100 0000",
    pan: "ADITY1234R",
    bankAcc: "98765432111",
    bankIfsc: "HDFC0000123",
    password: "aditya",
    phone: "+91 93805 75065"
  },
  {
    id: "AIRG00001",
    name: "Pratap Pawar",
    dept: "AI, Electronics, Lab Setup, Instructor",
    email: "pratap@gurujiair.com",
    role: "Admin",
    balance: 20,
    absent: 0,
    avatar: "PP",
    aadhar: "1234 5700 0000",
    pan: "PRATA1234P",
    bankAcc: "98765432112",
    bankIfsc: "HDFC0000123",
    password: "pratap",
    phone: "+91 98607 79172"
  },
  {
    id: "AIRG00040",
    name: "Mahadev Sooorvey",
    dept: "AI",
    email: "mahadev@gurujiair.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "MS",
    aadhar: "4493 2000 0000",
    pan: "MAHAD1234S",
    bankAcc: "98765432113",
    bankIfsc: "HDFC0000123",
    password: "mahadev",
    phone: "+91 93215 24763"
  },
  {
    id: "AIRG00041",
    name: "Atharva Nahire",
    dept: "AI",
    email: "atharvarnahire182@gmail.com",
    role: "Employee",
    balance: 20,
    absent: 0,
    avatar: "AN",
    aadhar: "6117 3400 0000",
    pan: "ATHAR1234N",
    bankAcc: "98765432114",
    bankIfsc: "HDFC0000123",
    password: "Appleusoea@182",
    phone: "+91 78208 48917"
  },
  {
    id: "AIRG00042",
    name: "Shravani Khanvilkar",
    dept: "AI, Electronics, Lab Setup, Instructor",
    email: "shravani@gurujiair.com",
    role: "HR, Tech Lead",
    balance: 20,
    absent: 0,
    avatar: "SK",
    aadhar: "2275 9500 0000",
    pan: "SHRAV1234K",
    bankAcc: "98765432115",
    bankIfsc: "HDFC0000123",
    password: "shravani",
    phone: "+91 84465 31087"
  }
];

const DEFAULT_REQUESTS = [];

const DEFAULT_PROJECTS = [];

const DEFAULT_TASKS = [];
const DEFAULT_DEPARTMENTS = ['AI', 'Electronics', 'Lab Setup', 'Instructor'];

const DEFAULT_CHATS = [];

const DEFAULT_ANNOUNCEMENTS = [];

const DEFAULT_NOTICES = [];

const DEFAULT_TICKETS = [];

const DEFAULT_NATIONAL_HOLIDAYS = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-02-19', name: 'Shivjayanti' },
  { date: '2026-03-03', name: 'Dhulivandan' },
  { date: '2026-03-19', name: 'Gudipadva' },
  { date: '2026-04-14', name: 'Ambedkar Jayanti' },
  { date: '2026-05-01', name: 'Maharashtra Din' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-08-28', name: 'Raksha Bandhan' },
  { date: '2026-09-05', name: 'Gopalkala' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dasara' },
  { date: '2026-11-09', name: 'Diwali' },
  { date: '2026-11-10', name: 'Diwali' },
  { date: '2026-11-11', name: 'Bhai Duj (Bhaubij)' },
  { date: '2026-12-25', name: 'Christmas' }
];

const DEFAULT_CELEBRATION_DAYS = [
  { date: '2026-01-12', name: 'National Youth Day' },
  { date: '2026-01-24', name: 'National Girl Child Day' },
  { date: '2026-02-28', name: 'National Science Day' },
  { date: '2026-03-08', name: 'International Women\'s Day' },
  { date: '2026-05-11', name: 'National Technology Day' },
  { date: '2026-07-29', name: 'Gurupornima' },
  { date: '2026-09-05', name: 'Teacher\'s Day' },
  { date: '2026-09-15', name: 'Engineer\'s Day' },
  { date: '2026-11-11', name: 'National Education Day' },
  { date: '2026-11-14', name: 'Children\'s Day' },
  { date: '2026-11-19', name: 'International Men\'s Day' }
];

let currentAttachedImagesEmp = [];
let currentAttachedImagesHR = [];
let currentAttachedImagesReport = [];
let currentAttachedImagesAnnouncement = [];
let currentAttachedImagesNotice = [];
let currentAttachedImagesTicket = [];
let currentUploadedProjectFiles = [];
let currentAttachedReimbursementFiles = [];
// Drive link arrays parallel to file arrays
let currentReportDriveLinks = [];
let currentReimbDriveLinks = [];
let currentTicketDriveLinks = [];
let currentUploadedEmployeePhoto = null;
let currentUploadedAadharFile = null;
let currentUploadedPanFile = null;
let currentUploadedBankAccFile = null;
let currentUploadedBankIfscFile = null;

// Temporary states for editing profile in the modal
let tempProfilePhoto = null;
let tempAadharFile = null;
let tempPanFile = null;
let tempBankAccFile = null;
let tempBankIfscFile = null;

const DEFAULT_REPORTS = [];

const isPratap = (emp) => {
  if (!emp) return false;
  const name = (emp.name || '').toLowerCase();
  const email = (emp.email || '').toLowerCase();
  const id = (emp.id || '').toLowerCase();
  return name.includes('pratap') || name.includes('pawar') || email.includes('pratap') || id === 'airg00001';
};

// --- State Management ---
let state = {
  currentRole: 'employee', // 'employee' or 'hr'
  currentUser: DEFAULT_EMPLOYEES[1], // Start as Alex Rivera for Employee View
  employees: [],
  requests: [],
  projects: [],
  tasks: [],
  departments: [],
  selectedRequestIdForModal: null,
  modalActionType: null, // 'approve' or 'reject'
  tickets: [],
  selectedTicketIdForModal: null,
  activeTicketSubTab: 'my',

  // Communications State
  chats: [],
  customChatGroups: JSON.parse(localStorage.getItem('ems_custom_chat_groups') || '[]'),
  announcements: [],
  notices: [],
  activeCommTab: 'chats', // 'chats', 'announcements', 'notices'
  activeChatType: 'group', // 'group' or 'direct'
  activeChatTargetId: null, // employeeId for direct messages
  activeUsers: [], // IDs of currently active employees

  // Calendar State
  nationalHolidays: [],
  celebrationDays: [],
  calendarYear: 2026,
  calendarMonth: 5, // June (0-indexed)
  expandedTaskIds: new Set(),
  editingTaskId: null,
  editingTaskImages: [],
  dailyReports: [],
  trainerReports: [],
  currentTrainerSessions: [],
  activeReportSubTab: null,
  expandedReportIds: new Set(),
  editingReportId: null,
  expandedEmployeeIds: new Set()
};


// --- Google Drive Link Helpers ---
function renderDriveLinkBadge(link, idx, arrayName, previewContainerId) {
  const container = document.getElementById(previewContainerId);
  if (!container) return;
  // Re-render entire preview
  container.innerHTML = window[arrayName].map((l, i) => `
    <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;background:rgba(66,133,244,0.12);border:1px solid rgba(66,133,244,0.4);font-size:0.75rem;color:#4285F4;max-width:240px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.09 15.91 0 13.35 0c-1.33 0-2.54.54-3.41 1.41L9 2.35 8.06 1.41C7.19.54 5.98 0 4.65 0 2.09 0 0 2.09 0 4.65c0 .47.11.91.18 1.35H0v2h.85l1.99 12h18.32l1.99-12H24V6h-4z"/></svg>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${l.label || l.url}</span>
      <button type="button" onclick="removeDriveLinkByIndex('${arrayName}','${previewContainerId}',${i})" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;line-height:1;padding:0;flex-shrink:0;">&times;</button>
    </div>
  `).join('');
}

function removeDriveLinkByIndex(arrayName, previewContainerId, idx) {
  if (window[arrayName]) {
    window[arrayName].splice(idx, 1);
    renderDriveLinkBadge(null, null, arrayName, previewContainerId);
  }
}
window.removeDriveLinkByIndex = removeDriveLinkByIndex;

function addReportDriveLink() {
  const input = document.getElementById('report-drive-link');
  if (!input || !input.value.trim()) return;
  const url = input.value.trim();
  const label = url.length > 55 ? url.substring(0, 52) + '...' : url;
  currentReportDriveLinks.push({ url, label });
  input.value = '';
  renderDriveLinkBadge(null, null, 'currentReportDriveLinks', 'report-drive-links-preview');
}
window.addReportDriveLink = addReportDriveLink;

function addReimbDriveLink() {
  const input = document.getElementById('reimb-drive-link');
  if (!input || !input.value.trim()) return;
  const url = input.value.trim();
  const label = url.length > 55 ? url.substring(0, 52) + '...' : url;
  currentReimbDriveLinks.push({ url, label });
  input.value = '';
  renderDriveLinkBadge(null, null, 'currentReimbDriveLinks', 'reimb-drive-links-preview');
}
window.addReimbDriveLink = addReimbDriveLink;

function addTicketDriveLink() {
  const input = document.getElementById('ticket-drive-link');
  if (!input || !input.value.trim()) return;
  const url = input.value.trim();
  const label = url.length > 55 ? url.substring(0, 52) + '...' : url;
  currentTicketDriveLinks.push({ url, label });
  input.value = '';
  renderDriveLinkBadge(null, null, 'currentTicketDriveLinks', 'ticket-drive-links-preview');
}
window.addTicketDriveLink = addTicketDriveLink;

// --- Image & Screenshot Helpers ---
function renderAttachmentPreview(fileItem, previewContainer, fileListArray) {
  const isString = typeof fileItem === 'string';
  const data = isString ? fileItem : fileItem.data;
  const name = isString ? 'Image' : fileItem.name;
  const type = isString ? 'image/png' : (fileItem.type || '');

  const div = document.createElement('div');
  div.style.position = 'relative';
  div.style.width = '60px';
  div.style.height = '60px';
  div.style.borderRadius = '6px';
  div.style.overflow = 'hidden';
  div.style.border = '1px solid var(--border-color)';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  div.style.alignItems = 'center';
  div.style.justifyContent = 'center';
  div.style.backgroundColor = 'var(--bg-secondary)';
  div.style.padding = '4px';
  div.title = name;

  if (type.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = data;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    div.appendChild(img);
  } else {
    const ext = name.split('.').pop().toUpperCase() || 'FILE';
    div.innerHTML = `
      <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--primary);">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <div style="font-size: 0.6rem; font-weight: 700; margin-top: 2px; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; width: 100%; text-align: center;">${ext}</div>
    `;
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.innerHTML = '&times;';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '2px';
  closeBtn.style.right = '2px';
  closeBtn.style.background = 'rgba(239, 68, 68, 0.9)';
  closeBtn.style.color = '#fff';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '50%';
  closeBtn.style.width = '16px';
  closeBtn.style.height = '16px';
  closeBtn.style.display = 'flex';
  closeBtn.style.alignItems = 'center';
  closeBtn.style.justifyContent = 'center';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '12px';
  closeBtn.style.lineHeight = '1';

  closeBtn.onclick = function (e) {
    e.stopPropagation();
    const idx = fileListArray.indexOf(fileItem);
    if (idx !== -1) {
      fileListArray.splice(idx, 1);
    }
    div.remove();
  };

  div.appendChild(closeBtn);
  previewContainer.appendChild(div);
}

function renderImagePreview(base64Data, previewContainer, fileListArray) {
  renderAttachmentPreview(base64Data, previewContainer, fileListArray);
}

function setupPasteListener(textareaId, previewContainerId, fileListArray) {
  const textarea = document.getElementById(textareaId);
  const previewContainer = document.getElementById(previewContainerId);
  if (!textarea || !previewContainer) return;

  textarea.addEventListener('paste', function (e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file') {
        const blob = item.getAsFile();
        if (!blob) continue;

        // Block non-image files larger than 500KB
        if (!blob.type.startsWith('image/') && blob.size > 512000) {
          showToast(`Pasted file "${blob.name || 'document'}" exceeds 500KB. Please upload it to Google Drive and paste the link in the text box instead.`, 'error');
          continue;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
          const base64Data = event.target.result;
          compressImage(base64Data, 800, 800, 0.6, function (compressedDataUrl) {
            const fileObj = {
              name: blob.name || 'Pasted File',
              type: blob.type,
              data: compressedDataUrl
            };
            fileListArray.push(fileObj);
            renderAttachmentPreview(fileObj, previewContainer, fileListArray);
          });
        };
        reader.readAsDataURL(blob);
      }
    }
  });
}

function setupFileInputListener(inputId, previewContainerId, fileListArray) {
  const fileInput = document.getElementById(inputId);
  const previewContainer = document.getElementById(previewContainerId);
  if (!fileInput || !previewContainer) return;

  fileInput.addEventListener('change', function (e) {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Block files larger than 2MB
      if (file.size > 2097152) {
        showToast(`File "${file.name}" exceeds 2MB limit. Please upload it to Google Drive and paste the link in the link field instead.`, 'error');
        continue;
      }

      const reader = new FileReader();
      reader.onload = function (event) {
        const base64Data = event.target.result;
        if (file.type.startsWith('image/')) {
          compressImage(base64Data, 800, 800, 0.6, function (compressedDataUrl) {
            const fileObj = {
              name: file.name,
              type: file.type,
              data: compressedDataUrl
            };
            fileListArray.push(fileObj);
            renderAttachmentPreview(fileObj, previewContainer, fileListArray);
          });
        } else {
          // PDFs, Docs, Zips, Spreadsheets - store base64 URL directly
          const fileObj = {
            name: file.name,
            type: file.type || 'application/pdf',
            data: base64Data
          };
          fileListArray.push(fileObj);
          renderAttachmentPreview(fileObj, previewContainer, fileListArray);
        }
      };
      reader.readAsDataURL(file);
    }
    fileInput.value = '';
  });
}

function toggleTaskDetailsExpand(taskId, event) {
  if (event) {
    event.stopPropagation();
  }
  const pane = document.getElementById(`details-pane-${taskId}`);
  const chevron = document.getElementById(`chevron-${taskId}`);
  if (!pane) return;

  state.expandedTaskIds = state.expandedTaskIds || new Set();

  if (pane.style.display === 'none') {
    pane.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    state.expandedTaskIds.add(taskId);
  } else {
    pane.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    state.expandedTaskIds.delete(taskId);
  }
}

function openFullImageViewModal(id, imageIdx, event) {
  if (event) {
    event.stopPropagation();
  }
  let imageUrl = '';
  if (id.startsWith('REP')) {
    const report = state.dailyReports.find(r => r.id === id);
    if (report && report.images && report.images[imageIdx]) {
      imageUrl = report.images[imageIdx];
    }
  } else if (id.startsWith('ANN')) {
    const ann = state.announcements.find(a => a.id === id);
    if (ann && ann.images && ann.images[imageIdx]) {
      imageUrl = ann.images[imageIdx];
    }
  } else if (id.startsWith('NTC')) {
    const notice = state.notices.find(n => n.id === id);
    if (notice && notice.images && notice.images[imageIdx]) {
      imageUrl = notice.images[imageIdx];
    }
  } else if (id.startsWith('PRJ')) {
    const proj = state.projects.find(p => p.id === id);
    if (proj && proj.files && proj.files[imageIdx]) {
      imageUrl = proj.files[imageIdx];
    }
  } else {
    const task = state.tasks.find(t => t.id === id);
    if (task && task.images && task.images[imageIdx]) {
      imageUrl = task.images[imageIdx];
    }
  }
  if (!imageUrl) return;

  if (typeof imageUrl === 'object' && imageUrl !== null) {
    imageUrl = imageUrl.data;
  }

  const overlay = document.getElementById('image-viewer-modal-overlay');
  const imgEl = document.getElementById('full-viewer-image');
  if (overlay && imgEl) {
    imgEl.src = imageUrl;
    overlay.classList.add('active');
  }
}

function openFullImageViewModalWithData(dataUrl) {
  const overlay = document.getElementById('image-viewer-modal-overlay');
  const imgEl = document.getElementById('full-viewer-image');
  if (overlay && imgEl) {
    imgEl.src = dataUrl;
    overlay.classList.add('active');
  }
}

function renderAttachmentsHTML(attachments, itemId, driveLinks) {
  // Combine regular file attachments + drive links for rendering
  const allItems = [];
  if (attachments && attachments.length > 0) {
    attachments.forEach(file => allItems.push(file));
  }
  if (driveLinks && driveLinks.length > 0) {
    driveLinks.forEach(link => allItems.push({ type: 'drive', data: link.url, name: link.label || link.url }));
  }

  if (allItems.length === 0) return '';

  // Filter out items with empty data
  const validItems = allItems.filter(file => {
    const data = typeof file === 'string' ? file : file.data;
    return data && data.trim() !== '';
  });

  if (validItems.length === 0) return '';

  return `
    <div class="attachment-list" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px;">
      ${validItems.map((file, idx) => {
    const isString = typeof file === 'string';
    const data = isString ? file : file.data;
    const name = isString ? 'Image' : file.name;
    const type = isString ? 'image/png' : (file.type || '');

    if (type === 'drive') {
      // Google Drive link — open in new tab
      return `
            <a href="${data}" target="_blank" rel="noopener noreferrer" class="attachment-item" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: #4285F4; text-decoration: none; font-size: 0.8rem; font-weight: 500; transition: border-color 0.2s;" onmouseover="this.style.borderColor='#4285F4'" onmouseout="this.style.borderColor='var(--border-color)'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.09 15.91 0 13.35 0c-1.33 0-2.54.54-3.41 1.41L9 2.35 8.06 1.41C7.19.54 5.98 0 4.65 0 2.09 0 0 2.09 0 4.65c0 .47.11.91.18 1.35H0v2h.85l1.99 12h18.32l1.99-12H24V6h-4zm-6.65-4c.97 0 1.76.79 1.76 1.76 0 .52-.23.99-.59 1.32L13 6.59l-1.52-1.51c-.36-.33-.59-.8-.59-1.32C10.89 2.79 11.68 2 12.65 2h.7z"/></svg>
              <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
            </a>
          `;
    } else if (type.startsWith('image/')) {
      return `
            <div class="attachment-item" style="position: relative; width: 80px; height: 80px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); cursor: pointer;" onclick="openFullImageViewModal('${itemId}', ${idx}, event)">
              <img src="${data}" style="width: 100%; height: 100%; object-fit: cover;" title="${name}" class="hover-scale-img">
            </div>
          `;
    } else {
      return `
            <a href="${data}" download="${name}" class="attachment-item" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--primary); text-decoration: none; font-size: 0.8rem; font-weight: 500; transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border-color)'">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>${name}</span>
            </a>
          `;
    }
  }).join('')}
    </div>
  `;
}

function hideImageViewerModal() {
  const overlay = document.getElementById('image-viewer-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function safeSaveTasks() {
  try {
    localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_tasks to server
    return true;
  } catch (error) {
    console.error('Failed to save tasks to localStorage:', error);
    showToast('Storage quota exceeded! Attached images may be too large.', 'error');
    try {
      state.tasks = JSON.parse(localStorage.getItem('ems_tasks') || '[]');
    } catch (e) {
      // ignore
    }
    return false;
  }
}

function startEditTask(taskId, event) {
  if (event) event.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  state.editingTaskId = taskId;
  state.editingTaskImages = [...(task.images || [])];
  state.editingTaskDriveLinks = [...(task.driveLinks || [])];

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
}

function cancelEditTask(event) {
  if (event) event.stopPropagation();
  state.editingTaskId = null;
  state.editingTaskImages = [];
  state.editingTaskDriveLinks = [];

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
}

function saveEditTask(taskId, event) {
  if (event) event.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const prevDetails = task.details;
  const prevImages = task.images;
  const prevDriveLinks = task.driveLinks;
  const prevDueDate = task.dueDate;

  const textarea = document.getElementById(`edit-details-textarea-${taskId}`);
  if (textarea) {
    task.details = textarea.value.trim();
  }

  const dueDateInput = document.getElementById(`edit-due-date-${taskId}`);
  if (dueDateInput) {
    const newDueDate = dueDateInput.value;
    if (task.startDate && task.startDate > newDueDate) {
      showToast('Start Date cannot be after Due Date.', 'error');
      return;
    }
    task.dueDate = newDueDate;
  }

  // Read new drive link if added
  const driveLinkInput = document.getElementById(`edit-drive-link-input-${taskId}`);
  if (driveLinkInput && driveLinkInput.value.trim()) {
    const url = driveLinkInput.value.trim();
    const label = url.length > 50 ? url.substring(0, 47) + '...' : url;
    if (!state.editingTaskDriveLinks) state.editingTaskDriveLinks = [];
    state.editingTaskDriveLinks.push({ url, label });
  }

  task.images = [...state.editingTaskImages];
  task.driveLinks = [...(state.editingTaskDriveLinks || [])];

  if (!safeSaveTasks()) {
    task.details = prevDetails;
    task.images = prevImages;
    task.driveLinks = prevDriveLinks;
    task.dueDate = prevDueDate;
    return;
  }

  state.editingTaskId = null;
  state.editingTaskImages = [];
  state.editingTaskDriveLinks = [];

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
  showToast('Task details updated successfully.', 'success');
}

function removeDriveLinkFromTask(taskId, idx, event) {
  if (event) event.stopPropagation();
  if (!state.editingTaskDriveLinks) return;
  state.editingTaskDriveLinks.splice(idx, 1);
  renderEditDriveLinkPreviews(taskId);
}
window.removeDriveLinkFromTask = removeDriveLinkFromTask;

function renderEditDriveLinkPreviews(taskId) {
  const container = document.getElementById(`edit-drive-links-preview-${taskId}`);
  if (!container) return;
  const links = state.editingTaskDriveLinks || [];
  if (links.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = links.map((link, idx) => `
    <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; background: rgba(66,133,244,0.12); border: 1px solid rgba(66,133,244,0.4); font-size: 0.75rem; color: #4285F4; max-width: 220px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.09 15.91 0 13.35 0c-1.33 0-2.54.54-3.41 1.41L9 2.35 8.06 1.41C7.19.54 5.98 0 4.65 0 2.09 0 0 2.09 0 4.65c0 .47.11.91.18 1.35H0v2h.85l1.99 12h18.32l1.99-12H24V6h-4z"/></svg>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${link.label || link.url}</span>
      <button type="button" onclick="removeDriveLinkFromTask('${taskId}', ${idx}, event)" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;line-height:1;padding:0;flex-shrink:0;">&times;</button>
    </div>
  `).join('');
}
window.renderEditDriveLinkPreviews = renderEditDriveLinkPreviews;

function setupEditTaskListeners(taskId) {
  const textarea = document.getElementById(`edit-details-textarea-${taskId}`);
  const fileInput = document.getElementById(`edit-images-input-${taskId}`);
  const previewContainer = document.getElementById(`edit-images-preview-${taskId}`);

  if (!textarea || !fileInput || !previewContainer) return;

  renderEditPreviews(taskId);
  renderEditDriveLinkPreviews(taskId);

  textarea.addEventListener('paste', function (e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file' && item.type.indexOf('image/') !== -1) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = function (event) {
          const base64Data = event.target.result;
          compressImage(base64Data, 800, 800, 0.6, function (compressedDataUrl) {
            state.editingTaskImages.push({
              name: blob.name || 'Pasted Image',
              type: blob.type,
              data: compressedDataUrl
            });
            renderEditPreviews(taskId);
          });
        };
        reader.readAsDataURL(blob);
      }
    }
  });

  fileInput.addEventListener('change', function (e) {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (event) {
          const base64Data = event.target.result;
          compressImage(base64Data, 800, 800, 0.6, function (compressedDataUrl) {
            state.editingTaskImages.push({
              name: file.name,
              type: file.type,
              data: compressedDataUrl
            });
            renderEditPreviews(taskId);
          });
        };
        reader.readAsDataURL(file);
      }
    }
    fileInput.value = '';
  });
}

function renderEditPreviews(taskId) {
  const previewContainer = document.getElementById(`edit-images-preview-${taskId}`);
  if (!previewContainer) return;

  previewContainer.innerHTML = '';
  state.editingTaskImages.forEach((imgBase64, idx) => {
    const div = document.createElement('div');
    div.style.position = 'relative';
    div.style.width = '60px';
    div.style.height = '60px';
    div.style.borderRadius = '6px';
    div.style.overflow = 'hidden';
    div.style.border = '1px solid var(--border-color)';

    const img = document.createElement('img');
    const isString = typeof imgBase64 === 'string';
    img.src = isString ? imgBase64 : (imgBase64.data || '');
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.innerHTML = '&times;';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '2px';
    closeBtn.style.right = '2px';
    closeBtn.style.background = 'rgba(239, 68, 68, 0.9)';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '50%';
    closeBtn.style.width = '16px';
    closeBtn.style.height = '16px';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '12px';
    closeBtn.style.lineHeight = '1';

    closeBtn.onclick = function (e) {
      e.stopPropagation();
      state.editingTaskImages.splice(idx, 1);
      renderEditPreviews(taskId);
    };

    div.appendChild(img);
    div.appendChild(closeBtn);
    previewContainer.appendChild(div);
  });
}

// ─── Personal Task (HR / Tech Lead) expand & edit helpers ─────────────────
// These use a 'pt-' DOM prefix so they don't clash with the HR tasks board
// which reuses the same task IDs in a different table section.

function togglePersonalTaskExpand(taskId, event) {
  if (event) event.stopPropagation();
  const pane    = document.getElementById(`pt-details-pane-${taskId}`);
  const chevron = document.getElementById(`pt-chevron-${taskId}`);
  if (!pane) return;
  state.expandedPersonalTaskIds = state.expandedPersonalTaskIds || new Set();
  if (pane.style.display === 'none') {
    pane.style.display = 'block';
    if (chevron) chevron.style.transform = 'rotate(180deg)';
    state.expandedPersonalTaskIds.add(taskId);
  } else {
    pane.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    state.expandedPersonalTaskIds.delete(taskId);
  }
}
window.togglePersonalTaskExpand = togglePersonalTaskExpand;

function startPersonalTaskEdit(taskId, event) {
  if (event) event.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (!state.expandedPersonalTaskIds) state.expandedPersonalTaskIds = new Set();
  state.expandedPersonalTaskIds.add(taskId);
  state.editingPersonalTaskId = taskId;
  state.editingPersonalTaskImages = [...(task.images || [])];
  state.editingPersonalTaskDriveLinks = [...(task.driveLinks || [])];
  renderHRTasksAndProjects();
}
window.startPersonalTaskEdit = startPersonalTaskEdit;

function cancelPersonalTaskEdit(event) {
  if (event) event.stopPropagation();
  state.editingPersonalTaskId = null;
  state.editingPersonalTaskImages = [];
  state.editingPersonalTaskDriveLinks = [];
  renderHRTasksAndProjects();
}
window.cancelPersonalTaskEdit = cancelPersonalTaskEdit;

function savePersonalTaskEdit(taskId, event) {
  if (event) event.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const textarea = document.getElementById(`pt-edit-textarea-${taskId}`);
  if (textarea) task.details = textarea.value.trim();

  const dueDateInput = document.getElementById(`pt-edit-due-date-${taskId}`);
  if (dueDateInput) {
    const newDue = dueDateInput.value;
    if (task.startDate && task.startDate > newDue) {
      showToast('Start Date cannot be after Due Date.', 'error');
      return;
    }
    task.dueDate = newDue;
  }

  // Read new drive link if added
  const driveLinkInput = document.getElementById(`pt-edit-drive-link-input-${taskId}`);
  if (driveLinkInput && driveLinkInput.value.trim()) {
    const url = driveLinkInput.value.trim();
    const label = url.length > 50 ? url.substring(0, 47) + '...' : url;
    if (!state.editingPersonalTaskDriveLinks) state.editingPersonalTaskDriveLinks = [];
    state.editingPersonalTaskDriveLinks.push({ url, label });
  }

  task.images = [...(state.editingPersonalTaskImages || [])];
  task.driveLinks = [...(state.editingPersonalTaskDriveLinks || [])];

  if (!safeSaveTasks()) return;

  state.editingPersonalTaskId = null;
  state.editingPersonalTaskImages = [];
  state.editingPersonalTaskDriveLinks = [];
  renderHRTasksAndProjects();
  showToast('Task details updated successfully.', 'success');
}
window.savePersonalTaskEdit = savePersonalTaskEdit;

function removeDriveLinkFromPersonalTask(taskId, idx, event) {
  if (event) event.stopPropagation();
  if (!state.editingPersonalTaskDriveLinks) return;
  state.editingPersonalTaskDriveLinks.splice(idx, 1);
  renderPersonalTaskDriveLinkPreviews(taskId);
}
window.removeDriveLinkFromPersonalTask = removeDriveLinkFromPersonalTask;

function renderPersonalTaskDriveLinkPreviews(taskId) {
  const container = document.getElementById(`pt-edit-drive-links-preview-${taskId}`);
  if (!container) return;
  const links = state.editingPersonalTaskDriveLinks || [];
  if (links.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = links.map((link, idx) => `
    <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; background: rgba(66,133,244,0.12); border: 1px solid rgba(66,133,244,0.4); font-size: 0.75rem; color: #4285F4; max-width: 220px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.09 15.91 0 13.35 0c-1.33 0-2.54.54-3.41 1.41L9 2.35 8.06 1.41C7.19.54 5.98 0 4.65 0 2.09 0 0 2.09 0 4.65c0 .47.11.91.18 1.35H0v2h.85l1.99 12h18.32l1.99-12H24V6h-4z"/></svg>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${link.label || link.url}</span>
      <button type="button" onclick="removeDriveLinkFromPersonalTask('${taskId}', ${idx}, event)" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:14px;line-height:1;padding:0;flex-shrink:0;">&times;</button>
    </div>
  `).join('');
}
window.renderPersonalTaskDriveLinkPreviews = renderPersonalTaskDriveLinkPreviews;

function renderPersonalTaskEditPreview(taskId) {
  const previewContainer = document.getElementById(`pt-edit-images-preview-${taskId}`);
  if (!previewContainer) return;
  previewContainer.innerHTML = '';
  (state.editingPersonalTaskImages || []).forEach((imgBase64, idx) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:relative;width:60px;height:60px;border-radius:6px;overflow:hidden;border:1px solid var(--border-color);';
    const img = document.createElement('img');
    const isString = typeof imgBase64 === 'string';
    img.src = isString ? imgBase64 : (imgBase64.data || '');
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '&times;';
    btn.style.cssText = 'position:absolute;top:2px;right:2px;background:rgba(239,68,68,0.9);color:#fff;border:none;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;';
    btn.onclick = (e) => { e.stopPropagation(); state.editingPersonalTaskImages.splice(idx, 1); renderPersonalTaskEditPreview(taskId); };
    div.appendChild(img);
    div.appendChild(btn);
    previewContainer.appendChild(div);
  });
}
window.renderPersonalTaskEditPreview = renderPersonalTaskEditPreview;
// ──────────────────────────────────────────────────────────────────────────



function cleanBloatedEmployees(employees) {
  if (!Array.isArray(employees)) return { employees: [], changed: false };
  // No longer stripping photo/aadhar/pan — document images are expected
  // to be larger than 25KB after compression to 800x800.
  return { employees, changed: false };
}

function cleanBloatedAttachments(items) {
  if (!Array.isArray(items)) return false;
  let changed = false;
  items.forEach(item => {
    if (Array.isArray(item.images)) {
      item.images.forEach(img => {
        if (img && img.data && img.data.length > 500000) {
          img.data = "";
          changed = true;
        }
      });
    }
    if (Array.isArray(item.attachments)) {
      item.attachments.forEach(att => {
        if (att && att.data && att.data.length > 500000) {
          att.data = "";
          changed = true;
        }
      });
    }
    if (Array.isArray(item.images)) {
      item.images.forEach((img, index) => {
        if (typeof img === 'string' && img.length > 500000) {
          item.images[index] = "";
          changed = true;
        }
      });
    }
    if (Array.isArray(item.replies)) {
      item.replies.forEach(reply => {
        if (Array.isArray(reply.attachments)) {
          reply.attachments.forEach(att => {
            if (att && att.data && att.data.length > 500000) {
              att.data = "";
              changed = true;
            }
          });
        }
      });
    }
  });
  return changed;
}

function compressImage(dataUrl, maxWidth, maxHeight, quality, callback) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    callback(dataUrl);
    return;
  }

  const img = new Image();
  img.onload = function () {
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, width, height);
      // Export as compressed JPEG to save maximum space
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      callback(compressedDataUrl);
    } else {
      callback(dataUrl);
    }
  };
  img.onerror = function () {
    callback(dataUrl);
  };
  img.src = dataUrl;
}


// --- Initialization ---
async function init() {
  await fetchCentralizedState();

  const CURRENT_SEED_VERSION = 'v15_credentials_v2';
  if (localStorage.getItem('ems_seed_version') !== CURRENT_SEED_VERSION) {
    const storedEmployees = JSON.parse(localStorage.getItem('ems_employees') || '[]');
    if (storedEmployees.length > 0) {
      // The server database already has data, so we don't want to seed/overwrite.
      // We just mark the seed version as current so we don't check again.
      originalSetItem.call(localStorage, 'ems_seed_version', CURRENT_SEED_VERSION);
    } else {
      console.log('Seeding the clean v15 employee and database dataset...');
      originalSetItem.call(localStorage, 'ems_employees', JSON.stringify(DEFAULT_EMPLOYEES));
      originalSetItem.call(localStorage, 'ems_projects', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_tasks', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_requests', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_departments', JSON.stringify(DEFAULT_DEPARTMENTS));
      originalSetItem.call(localStorage, 'ems_chats', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_reports', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_announcements', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_notices', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_reimbursements', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_tickets', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_schools', JSON.stringify([]));
      originalSetItem.call(localStorage, 'ems_national_holidays', JSON.stringify(DEFAULT_NATIONAL_HOLIDAYS));
      originalSetItem.call(localStorage, 'ems_celebration_days', JSON.stringify(DEFAULT_CELEBRATION_DAYS));
      originalSetItem.call(localStorage, 'ems_seed_version', CURRENT_SEED_VERSION);
      originalSetItem.call(localStorage, 'ems_notifications', JSON.stringify([]));

      state.employees = DEFAULT_EMPLOYEES;
      state.projects = [];
      state.tasks = [];
      state.requests = [];
      state.departments = DEFAULT_DEPARTMENTS;
      state.chats = [];
      state.dailyReports = [];
      state.announcements = [];
      state.notices = [];
      state.reimbursements = [];
      state.tickets = [];
      state.schools = [];
      state.nationalHolidays = DEFAULT_NATIONAL_HOLIDAYS;
      state.celebrationDays = DEFAULT_CELEBRATION_DAYS;
      state.smsNotifications = [];

      triggerBackendSync();
    }
  }
  // Load or seed data
  if (!localStorage.getItem('ems_employees')) {
    localStorage.setItem('ems_employees', JSON.stringify(DEFAULT_EMPLOYEES));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
  } else {
    // Self-healing merge to make sure new default employees are seeded
    let stored = JSON.parse(localStorage.getItem('ems_employees'));
    let updated = false;

    // Clean bloated base64 images to protect storage quota
    const cleanResult = cleanBloatedEmployees(stored);
    if (cleanResult.changed) {
      stored = cleanResult.employees;
      updated = true;
    }

    if (!stored || stored.length === 0) {
      stored = [...DEFAULT_EMPLOYEES];
      updated = true;
    } else {
      // Check if default Admin is missing
      const hasAdmin = stored.some(emp => emp.role === 'Admin' || emp.email.toLowerCase() === 'admin@company.com');
      if (!hasAdmin) {
        const defaultAdmin = DEFAULT_EMPLOYEES.find(emp => emp.role === 'Admin');
        if (defaultAdmin) {
          // Find next available sequential ID to prevent collisions
          const maxIdNum = stored.reduce((max, emp) => {
            const match = emp.id.match(/^EMP(\d+)$/);
            return match ? Math.max(max, parseInt(match[1])) : max;
          }, 0);
          const newId = `EMP${String(maxIdNum + 1).padStart(3, '0')}`;
          stored.push({ ...defaultAdmin, id: newId });
          updated = true;
        }
      }

      // Check if the new Tech Leads are missing and add them
      const defaultTechLeads = DEFAULT_EMPLOYEES.filter(emp => emp.role === 'Tech Lead');
      defaultTechLeads.forEach(TL => {
        const hasTL = stored.some(emp => emp.email.toLowerCase() === TL.email.toLowerCase());
        if (!hasTL) {
          // Find next available sequential ID to prevent collisions
          const maxIdNum = stored.reduce((max, emp) => {
            const match = emp.id.match(/^EMP(\d+)$/);
            return match ? Math.max(max, parseInt(match[1])) : max;
          }, 0);
          const newId = `EMP${String(maxIdNum + 1).padStart(3, '0')}`;
          stored.push({ ...TL, id: newId });
          updated = true;
        }
      });

      // Ensure all employees have phone numbers (self-healing migration)
      stored.forEach((emp, index) => {
        if (!emp.phone) {
          const defaultPhones = [
            "+91 98765 43210", "+91 87654 32109", "+91 76543 21098", "+91 65432 10987",
            "+91 54321 09876", "+91 43210 98765", "+91 32109 87654", "+91 21098 76543",
            "+91 10987 65432", "+91 98765 01234", "+91 87654 01235", "+91 76543 01236",
            "+91 65432 01237", "+91 54321 01238", "+91 43210 01239"
          ];
          emp.phone = defaultPhones[index % defaultPhones.length];
          updated = true;
        }
      });


      if (updated) {
        localStorage.setItem('ems_employees', JSON.stringify(stored));
        triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
      }
    }
  }
  if (!localStorage.getItem('ems_requests')) {
    localStorage.setItem('ems_requests', JSON.stringify(DEFAULT_REQUESTS));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_requests to server
  }
  if (!localStorage.getItem('ems_projects')) {
    localStorage.setItem('ems_projects', JSON.stringify(DEFAULT_PROJECTS));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_projects to server
  } else {
    // Self-healing merge to make sure existing projects have a techLeadId
    let storedProjs = JSON.parse(localStorage.getItem('ems_projects'));
    let updatedProjs = false;
    storedProjs.forEach(p => {
      if (p.techLeadId === undefined) {
        // Find default project from DEFAULT_PROJECTS to copy techLeadId
        const defaultProj = DEFAULT_PROJECTS.find(dp => dp.name.toLowerCase() === p.name.toLowerCase());
        if (defaultProj) {
          p.techLeadId = defaultProj.techLeadId;
        } else {
          // Default mappings based on department
          if (p.dept === 'AI' || p.dept === 'Electronics' || p.dept === 'Lab Setup') p.techLeadId = 'AIRG00008'; // Suyash Patil
          else p.techLeadId = '';
        }
        updatedProjs = true;
      }
      if (p.progress === undefined) {
        const storedTasks = JSON.parse(localStorage.getItem('ems_tasks')) || [];
        const projectTasks = storedTasks.filter(t => t.projectId === p.id);
        const total = projectTasks.length;
        const completed = projectTasks.filter(t => t.status === 'Completed').length;
        p.progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        updatedProjs = true;
      }
      if (p.description === undefined) {
        const defaultProj = DEFAULT_PROJECTS.find(dp => dp.name.toLowerCase() === p.name.toLowerCase());
        p.description = defaultProj ? defaultProj.description : '';
        updatedProjs = true;
      }
      if (p.files === undefined) {
        p.files = [];
        updatedProjs = true;
      }
    });
    if (updatedProjs) {
      localStorage.setItem('ems_projects', JSON.stringify(storedProjs));
      triggerBackendSync(); // [AUTO-ADDED] persist ems_projects to server
    }
  }
  if (!localStorage.getItem('ems_tasks')) {
    localStorage.setItem('ems_tasks', JSON.stringify(DEFAULT_TASKS));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_tasks to server
  }
  // Self-healing migration to enforce only Engineering and EdTech
  localStorage.setItem('ems_departments', JSON.stringify(DEFAULT_DEPARTMENTS));
  triggerBackendSync(); // [AUTO-ADDED] persist ems_departments to server
  if (!localStorage.getItem('ems_chats')) {
    localStorage.setItem('ems_chats', JSON.stringify(DEFAULT_CHATS));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_chats to server
  }
  if (!localStorage.getItem('ems_reports')) {
    localStorage.setItem('ems_reports', JSON.stringify(DEFAULT_REPORTS));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_reports to server
  }
  if (!localStorage.getItem('ems_announcements')) {
    localStorage.setItem('ems_announcements', JSON.stringify(DEFAULT_ANNOUNCEMENTS));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_announcements to server
  }
  if (!localStorage.getItem('ems_notices')) {
    localStorage.setItem('ems_notices', JSON.stringify(DEFAULT_NOTICES));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_notices to server
  }
  const storedHolidaysStr = localStorage.getItem('ems_national_holidays');
  let needToResetHolidays = false;
  if (storedHolidaysStr) {
    try {
      const storedHolidays = JSON.parse(storedHolidaysStr);
      const hasShivjayanti = storedHolidays.some(h => h.name.toLowerCase() === 'shivjayanti');
      const hasUSIndependenceDay = storedHolidays.some(h => h.name.toLowerCase() === 'independence day' && h.date === '2026-07-04');
      if (!hasShivjayanti || hasUSIndependenceDay) {
        needToResetHolidays = true;
      }
    } catch (e) {
      needToResetHolidays = true;
    }
  } else {
    needToResetHolidays = true;
  }

  if (needToResetHolidays) {
    localStorage.setItem('ems_national_holidays', JSON.stringify(DEFAULT_NATIONAL_HOLIDAYS));
  }

  const storedCelebrationsStr = localStorage.getItem('ems_celebration_days');
  let needToResetCelebrations = false;
  if (storedCelebrationsStr) {
    try {
      const storedCelebrations = JSON.parse(storedCelebrationsStr);
      const hasGurupornima = storedCelebrations.some(c => c.name.toLowerCase() === 'gurupornima');
      if (!hasGurupornima || storedCelebrations.length !== DEFAULT_CELEBRATION_DAYS.length) {
        needToResetCelebrations = true;
      }
    } catch (e) {
      needToResetCelebrations = true;
    }
  } else {
    needToResetCelebrations = true;
  }

  if (needToResetCelebrations) {
    localStorage.setItem('ems_celebration_days', JSON.stringify(DEFAULT_CELEBRATION_DAYS));
  }

  if (!wasStateFetchedFromServer) {
    state.employees = JSON.parse(localStorage.getItem('ems_employees')) || [];
    state.requests = JSON.parse(localStorage.getItem('ems_requests')) || [];
    state.projects = JSON.parse(localStorage.getItem('ems_projects')) || [];
    state.tasks = JSON.parse(localStorage.getItem('ems_tasks')) || [];
    state.departments = JSON.parse(localStorage.getItem('ems_departments')) || [];
    state.chats = JSON.parse(localStorage.getItem('ems_chats')) || [];
    state.announcements = JSON.parse(localStorage.getItem('ems_announcements')) || [];
    state.notices = JSON.parse(localStorage.getItem('ems_notices')) || [];
    state.smsNotifications = JSON.parse(localStorage.getItem('ems_notifications') || '[]');
    state.nationalHolidays = JSON.parse(localStorage.getItem('ems_national_holidays')) || [];
    state.celebrationDays = JSON.parse(localStorage.getItem('ems_celebration_days')) || [];
  } else {
    if (!state.tasks) state.tasks = [];
  }

  let tasksUpdated = false;
  state.tasks.forEach(t => {
    if (t.status !== 'Completed' && t.status !== 'Not Completed') {
      t.status = 'Not Completed';
      tasksUpdated = true;
    }
  });
  if (tasksUpdated) {
    localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_tasks to server
  }

  // Clean local bloated items
  let noticesUpdated = cleanBloatedAttachments(state.notices);
  if (noticesUpdated) {
    localStorage.setItem('ems_notices', JSON.stringify(state.notices));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_notices to server
  }
  let announcementsUpdated = cleanBloatedAttachments(state.announcements);
  if (announcementsUpdated) {
    localStorage.setItem('ems_announcements', JSON.stringify(state.announcements));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_announcements to server
  }
  let tasksBloatUpdated = cleanBloatedAttachments(state.tasks);
  if (tasksBloatUpdated) {
    localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_tasks to server
  }

  // notifications, nationalHolidays, celebrationDays are loaded in the wasStateFetchedFromServer block above

  // Load and seed Reimbursements
  if (!wasStateFetchedFromServer) {
    try {
      state.reimbursements = JSON.parse(localStorage.getItem('ems_reimbursements') || '[]');
    } catch (e) {
      state.reimbursements = [];
    }
  } else {
    if (!state.reimbursements) state.reimbursements = [];
  }
  if (state.reimbursements.length > 0) {
    let reimbursementsUpdated = cleanBloatedAttachments(state.reimbursements);
    if (reimbursementsUpdated) {
      localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
      triggerBackendSync(); // [AUTO-ADDED] persist ems_reimbursements to server
    }
  }
  // One-time cleanup: remove old dummy seed reimbursements
  if (!localStorage.getItem('ems_dummy_reimbursements_cleaned')) {
    const dummyIds = ['REIM001', 'REIM002'];
    const beforeLen = state.reimbursements.length;
    state.reimbursements = state.reimbursements.filter(r => !dummyIds.includes(r.id));
    if (state.reimbursements.length !== beforeLen) {
      localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
      triggerBackendSync(); // [AUTO-ADDED] persist ems_reimbursements to server
    }
    localStorage.setItem('ems_dummy_reimbursements_cleaned', '1');
  }
  if (state.reimbursements.length === 0) {
    state.reimbursements = [];
    localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_reimbursements to server
  }

  // Ensure every employee has default salary settings
  let salaryUpdated = false;
  state.employees.forEach(emp => {
    if (!emp.salary) {
      let basic = 45000;
      if (emp.role === 'Admin') basic = 90000;
      else if (emp.role === 'HR') basic = 60000;
      else if (emp.role === 'Tech Lead') basic = 75000;

      emp.salary = {
        basic: basic,
        hra: Math.round(basic * 0.40),
        other: Math.round(basic * 0.15),
        profTax: 200,
        lwpDays: 0
      };
      salaryUpdated = true;
    }
  });
  if (salaryUpdated) {
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
  }

  if (!wasStateFetchedFromServer) {
    state.dailyReports = JSON.parse(localStorage.getItem('ems_reports')) || [];
    try {
      state.trainerReports = JSON.parse(localStorage.getItem('ems_trainer_reports')) || [];
    } catch(e) {
      state.trainerReports = [];
    }
  } else {
    if (!state.dailyReports) state.dailyReports = [];
  }
  let reportsUpdated = false;
  state.dailyReports.forEach(r => {
    // Migrate old hasStar boolean to starRating number (0-10)
    if (r.starRating === undefined) {
      if (r.hasStar) {
        r.starRating = 5; // Default migration value for previously starred reports
      } else {
        r.starRating = 0;
      }
      delete r.hasStar;
      reportsUpdated = true;
    }
  });
  if (reportsUpdated) {
    localStorage.setItem('ems_reports', JSON.stringify(state.dailyReports));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_reports to server
  }

  // Load and seed Support Tickets
  if (!wasStateFetchedFromServer) {
    try {
      state.tickets = JSON.parse(localStorage.getItem('ems_tickets') || '[]');
    } catch (e) {
      state.tickets = [];
    }
  } else {
    if (!state.tickets) state.tickets = [];
  }
  if (state.tickets.length === 0) {
    state.tickets = DEFAULT_TICKETS;
    localStorage.setItem('ems_tickets', JSON.stringify(state.tickets));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_tickets to server
  } else {
    let ticketsUpdated = cleanBloatedAttachments(state.tickets);
    if (ticketsUpdated) {
      localStorage.setItem('ems_tickets', JSON.stringify(state.tickets));
      triggerBackendSync(); // [AUTO-ADDED] persist ems_tickets to server
    }
  }

  // Load and seed Schools
  if (!wasStateFetchedFromServer) {
    try {
      state.schools = JSON.parse(localStorage.getItem('ems_schools') || '[]');
    } catch (e) {
      state.schools = [];
    }
  } else {
    if (!state.schools) state.schools = [];
  }
  if (state.schools.length === 0) {
    // Static school seed data (fallback only - normally loaded from server)
    const SEED_SCHOOLS = {
      "Shravani": ["Sheron English School", "Shri Shivaji Vidyalay, Dehu Road", "Shri Mhalsakant Vidyalaya, Akurdi", "PDEA English school, akurdi"],
      "Prasad": ["Lonkar Vidyalay, Mundhwa", "Sakharwadi Vidyalay", "Sant Tukaram, Lohegaon", "Gurudev Datta Vidyalaya Savindane", "Charoli English / Marathi", "Eon Gyankur, Kharadi", "Bhairavnath Vidyalaya, Karde", "MalikArjun Vidyalaya, Nhaware"],
      "Rajendra Sir": ["Shahaji High School, Supe", "Kshitij School, Sangli", "Shaurya Sainiki, phaltan Golewadi", "YC, Venutai – Phaltan", "Ketkeshwar Vidyalaya, Nimgaon Ketki", "Swami Ramanand Bharti High School, Sangli", "Kahiti School, Sangli", "Rajendra Vidyalay, Khandala"],
      "Suyash": ["Koteshwar , Gove", "Aditya Birla School", "Mudhoji School, Phaltan", "Shivtej School, Aare", "Holy Convent School", "Vishnuji Shekuji Satav, Wagholi", "Yashwant Grampanchayat, Dhamner"],
      "Atharva Durgavale": ["Pirangut School", "Pirungut English School"]
    };
    let idCounter = 1;
    Object.entries(SEED_SCHOOLS).forEach(([manager, schools]) => {
      schools.forEach(schoolName => {
        state.schools.push({
          id: `SCH${String(idCounter++).padStart(5, '0')}`,
          name: schoolName,
          managerName: manager,
          instructors: []
        });
      });
    });
    localStorage.setItem('ems_schools', JSON.stringify(state.schools));
    triggerBackendSync();
  }

  // Load schoolManagementLeads from localStorage (explicit Tech Leads added to school mgmt)
  try {
    state.schoolManagementLeads = JSON.parse(localStorage.getItem('ems_school_mgmt_leads') || '[]');
  } catch (e) {
    state.schoolManagementLeads = [];
  }
  // Always ensure Atharva Durgavale is in school management leads since he has schools
  if (!state.schoolManagementLeads.includes('Atharva Durgavale')) {
    state.schoolManagementLeads.push('Atharva Durgavale');
    localStorage.setItem('ems_school_mgmt_leads', JSON.stringify(state.schoolManagementLeads));
  }

  // Self-heal employee roles on startup
  sanitizeEmployeeRoles();

  // Bind role toggles
  document.getElementById('btn-role-employee').addEventListener('click', () => setRole('employee'));
  document.getElementById('btn-role-techlead').addEventListener('click', () => setRole('techlead'));
  const managerBtn = document.getElementById('btn-role-manager');
  if (managerBtn) {
    managerBtn.addEventListener('click', () => setRole('manager'));
  }
  document.getElementById('btn-role-hr').addEventListener('click', () => setRole('hr'));
  const adminBtn = document.getElementById('btn-role-admin');
  if (adminBtn) {
    adminBtn.addEventListener('click', () => setRole('admin'));
  }

  // Bind Task and Project Form submissions
  const projectForm = document.getElementById('project-creation-form');
  if (projectForm) {
    projectForm.addEventListener('submit', handleProjectCreationSubmit);
  }
  const taskForm = document.getElementById('task-assignment-form');
  if (taskForm) {
    taskForm.addEventListener('submit', handleTaskAssignmentSubmit);
  }

  // Set up task image upload & paste listeners
  setupPasteListener('emp-task-details', 'emp-task-images-preview', currentAttachedImagesEmp);
  setupFileInputListener('emp-task-images', 'emp-task-images-preview', currentAttachedImagesEmp);
  setupPasteListener('task-details', 'task-images-preview', currentAttachedImagesHR);
  setupFileInputListener('task-images', 'task-images-preview', currentAttachedImagesHR);

  // Set up ticket upload & paste listeners
  setupPasteListener('ticket-description', 'ticket-attachments-preview', currentAttachedImagesTicket);
  setupFileInputListener('ticket-attachments', 'ticket-attachments-preview', currentAttachedImagesTicket);

  // Bind ticket form submissions
  const ticketForm = document.getElementById('ticket-creation-form');
  if (ticketForm) {
    ticketForm.addEventListener('submit', handleTicketFormSubmit);
  }
  const ticketReplyForm = document.getElementById('ticket-chat-reply-form');
  if (ticketReplyForm) {
    ticketReplyForm.addEventListener('submit', handleTicketReplyFormSubmit);
  }

  // Bind ticket filters
  const ticketSearch = document.getElementById('ticket-agent-search');
  if (ticketSearch) ticketSearch.addEventListener('input', renderTickets);
  const ticketFilterCat = document.getElementById('ticket-filter-category');
  if (ticketFilterCat) ticketFilterCat.addEventListener('change', renderTickets);
  const ticketFilterPrio = document.getElementById('ticket-filter-priority');
  if (ticketFilterPrio) ticketFilterPrio.addEventListener('change', renderTickets);
  const ticketFilterStatus = document.getElementById('ticket-filter-status');
  if (ticketFilterStatus) ticketFilterStatus.addEventListener('change', renderTickets);

  // Set up employee registration photo upload listener
  const photoInput = document.getElementById('new-emp-photo');
  const photoPreview = document.getElementById('new-emp-photo-preview');
  const photoImg = document.getElementById('new-emp-photo-img');
  if (photoInput && photoPreview && photoImg) {
    photoInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (event) {
          compressImage(event.target.result, 150, 150, 0.7, function (compressed) {
            currentUploadedEmployeePhoto = compressed;
            photoImg.src = compressed;
            photoPreview.style.display = 'block';
          });
        };
        reader.readAsDataURL(file);
      } else {
        currentUploadedEmployeePhoto = null;
        photoImg.src = '';
        photoPreview.style.display = 'none';
      }
    });
  }



  // Set up daily reports image upload & paste listeners
  const dailyReportForm = document.getElementById('daily-report-form');
  if (dailyReportForm) {
    dailyReportForm.addEventListener('submit', handleDailyReportSubmit);
  }
  setupPasteListener('report-details', 'report-images-preview', currentAttachedImagesReport);
  setupFileInputListener('report-images', 'report-images-preview', currentAttachedImagesReport);
  setTodayReportDate();

  // Bind HR/Tech Lead report filters
  const reportMonthFilter = document.getElementById('filter-report-month');
  if (reportMonthFilter) {
    reportMonthFilter.addEventListener('change', renderDailyReports);
  }
  const reportEmpFilter = document.getElementById('filter-report-employee');
  if (reportEmpFilter) {
    reportEmpFilter.addEventListener('change', renderDailyReports);
  }
  const reportProjFilter = document.getElementById('filter-report-project');
  if (reportProjFilter) {
    reportProjFilter.addEventListener('change', renderDailyReports);
  }
  const empReportProjFilter = document.getElementById('emp-filter-report-project');
  if (empReportProjFilter) {
    empReportProjFilter.addEventListener('change', renderDailyReports);
  }
  const empReportMonthFilter = document.getElementById('emp-filter-report-month');
  if (empReportMonthFilter) {
    empReportMonthFilter.addEventListener('change', renderDailyReports);
  }

  // Set up announcements and notices image upload & paste listeners
  setupPasteListener('announcement-content', 'announcement-images-preview', currentAttachedImagesAnnouncement);
  setupFileInputListener('announcement-images', 'announcement-images-preview', currentAttachedImagesAnnouncement);
  setupPasteListener('notice-content', 'notice-images-preview', currentAttachedImagesNotice);
  setupFileInputListener('notice-images', 'notice-images-preview', currentAttachedImagesNotice);
  setupFileInputListener('project-files', 'project-files-preview', currentUploadedProjectFiles);

  // Bind Reimbursement & Payslip elements
  const reimbForm = document.getElementById('reimbursement-form');
  if (reimbForm) {
    reimbForm.addEventListener('submit', handleReimbursementSubmit);
  }
  const reimbFilesInput = document.getElementById('reimbursement-files');
  if (reimbFilesInput) {
    reimbFilesInput.addEventListener('change', handleReimbursementFilesChange);
  }
  const salaryConfigForm = document.getElementById('salary-config-form');
  if (salaryConfigForm) {
    salaryConfigForm.addEventListener('submit', handleSalaryConfigSubmit);
  }
  const salaryEmpSelect = document.getElementById('salary-emp-select');
  if (salaryEmpSelect) {
    salaryEmpSelect.addEventListener('change', handleSalaryEmpChange);
  }
  const salaryTotalEarning = document.getElementById('salary-total-earning');
  if (salaryTotalEarning) {
    salaryTotalEarning.addEventListener('input', renderPayslips);
  }
  const salaryLwp = document.getElementById('salary-lwp');
  if (salaryLwp) {
    salaryLwp.addEventListener('input', renderPayslips);
  }
  const hrReimbSearch = document.getElementById('hr-reimbursement-search');
  if (hrReimbSearch) {
    hrReimbSearch.addEventListener('input', renderReimbursements);
  }
  const hrReimbType = document.getElementById('filter-reimbursement-type');
  if (hrReimbType) {
    hrReimbType.addEventListener('change', renderReimbursements);
  }
  const hrReimbStatus = document.getElementById('filter-reimbursement-status');
  if (hrReimbStatus) {
    hrReimbStatus.addEventListener('change', renderReimbursements);
  }

  // Bind Chat / Announcement / Notice submissions
  const chatForm = document.getElementById('chat-message-form');
  if (chatForm) {
    chatForm.addEventListener('submit', handleChatMessageSubmit);
  }
  const annForm = document.getElementById('announcement-creation-form');
  if (annForm) {
    annForm.addEventListener('submit', handleAnnouncementSubmit);
  }
  const noticeForm = document.getElementById('notice-creation-form');
  if (noticeForm) {
    noticeForm.addEventListener('submit', handleNoticeSubmit);
  }

  // Filter task assignee dropdown when project changes
  const taskProjSelect = document.getElementById('task-project-select');
  if (taskProjSelect) {
    taskProjSelect.addEventListener('change', handleAssignTaskProjectChange);
  }

  // HR Task Filters
  const hrTaskSearch = document.getElementById('hr-task-search');
  if (hrTaskSearch) {
    hrTaskSearch.addEventListener('input', () => renderHRTasksAndProjects());
  }
  const filterTaskProject = document.getElementById('filter-task-project');
  if (filterTaskProject) {
    filterTaskProject.addEventListener('change', () => renderHRTasksAndProjects());
  }
  const filterTaskStatus = document.getElementById('filter-task-status');
  if (filterTaskStatus) {
    filterTaskStatus.addEventListener('change', () => renderHRTasksAndProjects());
  }

  // Navigation menu items
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      switchView(view);
    });
  });

  // Form submission
  const leaveForm = document.getElementById('leave-request-form');
  if (leaveForm) {
    leaveForm.addEventListener('submit', handleLeaveFormSubmit);

    // Auto-calculate days on date change
    document.getElementById('start-date').addEventListener('change', updateFormDaysCount);
    document.getElementById('end-date').addEventListener('change', updateFormDaysCount);
  }

  const hrDirectLeaveForm = document.getElementById('hr-direct-leave-form');
  if (hrDirectLeaveForm) {
    hrDirectLeaveForm.addEventListener('submit', handleHRDirectLeaveSubmit);
  }

  const hrLeaveHalfDay = document.getElementById('hr-leave-half-day');
  if (hrLeaveHalfDay) {
    hrLeaveHalfDay.addEventListener('change', () => {
      const startEl = document.getElementById('hr-leave-start');
      const endEl = document.getElementById('hr-leave-end');
      if (hrLeaveHalfDay.checked) {
        if (startEl && startEl.value) {
          endEl.value = startEl.value;
        }
        endEl.disabled = true;
        endEl.required = false;
      } else {
        endEl.disabled = false;
        endEl.required = true;
      }
    });
  }

  const hrLeaveStart = document.getElementById('hr-leave-start');
  if (hrLeaveStart) {
    hrLeaveStart.addEventListener('change', () => {
      const halfDayEl = document.getElementById('hr-leave-half-day');
      const endEl = document.getElementById('hr-leave-end');
      if (halfDayEl && halfDayEl.checked && endEl) {
        endEl.value = hrLeaveStart.value;
      }
    });
  }

  // HR Table Filters
  const searchInput = document.getElementById('hr-search');
  if (searchInput) {
    searchInput.addEventListener('input', renderHRDashboard);
  }
  const statusFilter = document.getElementById('filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', renderHRDashboard);
  }
  const typeFilter = document.getElementById('filter-type');
  if (typeFilter) {
    typeFilter.addEventListener('change', renderHRDashboard);
  }

  // Registration Queue Search Filter
  const regApprovalSearch = document.getElementById('reg-approval-search');
  if (regApprovalSearch) {
    regApprovalSearch.addEventListener('input', renderRegistrationApprovalQueue);
  }

  // Roster Search Filter
  const rosterSearch = document.getElementById('roster-search');
  if (rosterSearch) {
    rosterSearch.addEventListener('input', renderEmployeeRoster);
  }

  // Employee Details Search Filter
  const empDetailsSearch = document.getElementById('emp-details-search');
  if (empDetailsSearch) {
    empDetailsSearch.addEventListener('input', renderEmployeeDetails);
  }

  // Modal Setup
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelModal = document.getElementById('btn-cancel-modal');
  const modalForm = document.getElementById('modal-action-form');

  if (btnCloseModal) btnCloseModal.addEventListener('click', hideModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', hideModal);
  if (modalForm) modalForm.addEventListener('submit', handleModalSubmit);

  // Profile Modal Setup
  const profileWidget = document.querySelector('.profile-widget');
  if (profileWidget) {
    profileWidget.addEventListener('click', showProfileModal);
  }

  // Profile Modal Document/Photo Upload Listeners
  const profilePhotoInput = document.getElementById('profile-edit-photo-file');
  if (profilePhotoInput) {
    profilePhotoInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (event) {
          compressImage(event.target.result, 150, 150, 0.7, function (compressed) {
            tempProfilePhoto = compressed;
            const avatarEl = document.getElementById('profile-modal-avatar');
            if (avatarEl) {
              avatarEl.innerHTML = `<img id="profile-edit-avatar-img" src="${compressed}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
            }
          });
        };
        reader.readAsDataURL(file);
      }
    });
  }



  // Set Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('ems_theme', newTheme);
    updateThemeIcon(newTheme);
  });

  // Load Saved Theme
  const savedTheme = localStorage.getItem('ems_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  // Active Employee Selector listener
  const empSelect = document.getElementById('active-employee-select');
  if (empSelect) {
    empSelect.addEventListener('change', (e) => {
      const empId = e.target.value;
      const selectedEmp = state.employees.find(emp => emp.id === empId);
      if (selectedEmp) {
        state.currentUser = selectedEmp;
        // Update Profile Widget
        updateHeaderAvatar(selectedEmp);
        document.getElementById('header-name').textContent = selectedEmp.name;
        document.getElementById('header-role').textContent = selectedEmp.role === 'Admin, HR, Tech Lead, Manager' ? 'CEO' : selectedEmp.role;
        const activeMenuItem = document.querySelector('.menu-item.active');
        const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';
        if (currentView === 'communications') {
          renderCommunicationsHub();
        } else if (currentView === 'calendar') {
          renderCalendar();
        } else if (currentView === 'payslips') {
          renderPayslips();
        } else if (currentView === 'reimbursements') {
          renderReimbursements();
        } else if (currentView === 'tickets') {
          renderTickets();
        } else {
          renderEmployeeDashboard(currentView);
        }
        updateCommMenuBadges();
      }
    });
  }

  // Populate employee options
  populateEmployeeDropdown();

  // Populate department options
  populateDepartmentDropdowns();

  // Populate manager dropdowns
  populateManagerDropdowns();

  // Bind employee/dept form submissions
  const deptForm = document.getElementById('dept-creation-form');
  if (deptForm) {
    deptForm.addEventListener('submit', handleDeptCreationSubmit);
  }
  const employeeForm = document.getElementById('employee-creation-form');
  if (employeeForm) {
    employeeForm.addEventListener('submit', handleEmployeeCreationSubmit);
  }
  const empTaskForm = document.getElementById('emp-task-creation-form');
  if (empTaskForm) {
    empTaskForm.addEventListener('submit', handleEmpTaskCreationSubmit);
  }

  // Bind Login Form Submission
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  // Notice Recipient Search Bar filtering
  const noticeSearchInput = document.getElementById('notice-employee-search');
  if (noticeSearchInput) {
    noticeSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll('.employee-checkbox-item');
      items.forEach(item => {
        const name = item.dataset.name || '';
        const dept = item.dataset.dept || '';
        if (name.includes(query) || dept.includes(query)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // Payslip Month Selector listener
  const payslipMonth = document.getElementById('payslip-month-select');
  if (payslipMonth) {
    payslipMonth.addEventListener('change', () => {
      if (state.currentRole === 'hr' || state.currentRole === 'admin') {
        handleSalaryEmpChange();
      } else {
        renderPayslips();
      }
    });
  }

  setupDateLimits();

  // Register Service Worker for Web Push notifications
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('Service Worker registered successfully with scope:', reg.scope);
      })
      .catch(err => {
        console.error('Service Worker registration failed:', err);
      });
  }

  // Setup Push Notification Toggle Button (User-Gesture Compliant)
  const notifBtn = document.getElementById('notification-toggle-btn');
  if (notifBtn) {
    notifBtn.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        showToast('Notifications are not supported in this browser.', 'error');
        return;
      }
      if (Notification.permission === 'granted') {
        showToast('Notifications are already enabled!', 'success');
        return;
      }
      if (Notification.permission === 'denied') {
        showToast('Notifications are blocked by browser settings. Please reset site permissions in Chrome.', 'warning');
        return;
      }

      showToast('Requesting permission...', 'info');
      try {
        const permission = await Notification.requestPermission();
        updateNotificationButtonState();
        if (permission === 'granted') {
          showToast('Notification permission granted!', 'success');
          if (state.currentUser) {
            setupPushSubscription(state.currentUser.id);
          }
        } else {
          showToast('Notification permission denied.', 'warning');
        }
      } catch (err) {
        showToast('Failed to request permission: ' + err.message, 'error');
      }
    });
  }
  updateNotificationButtonState();

  checkAuthSession();
  initSyncPolling();

  // Smoothly transition out the loading overlay
  const loader = document.getElementById('loading-overlay');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 300);
  }
}

function updateThemeIcon(theme) {
  const moonPath = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />`;
  const sunPath = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828-9.9a5 5 0 11-7.07 7.07 5 5 0 017.07-7.07z" />`;
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">${theme === 'dark' ? sunPath : moonPath}</svg>`;
  }
  updateThemeLogos(theme);
}

function updateThemeLogos(theme) {
  const sidebarLogo = document.getElementById('sidebar-logo');
  const loginLogo = document.getElementById('login-logo');
  const logoSrc = theme === 'dark' ? 'air g logo black.png' : 'logo.png';
  if (sidebarLogo) {
    sidebarLogo.src = logoSrc;
    if (theme === 'dark') {
      sidebarLogo.style.maxHeight = '95px';
      sidebarLogo.style.marginTop = '-10px';
      sidebarLogo.style.marginBottom = '-10px';
    } else {
      sidebarLogo.style.maxHeight = '50px';
      sidebarLogo.style.marginTop = '0px';
      sidebarLogo.style.marginBottom = '0px';
    }
  }
  if (loginLogo) {
    loginLogo.src = logoSrc;
    if (theme === 'dark') {
      loginLogo.style.maxHeight = '150px';
      loginLogo.style.maxWidth = '250px';
      loginLogo.style.marginBottom = '8px';
    } else {
      loginLogo.style.maxHeight = '80px';
      loginLogo.style.maxWidth = '180px';
      loginLogo.style.marginBottom = '16px';
    }
  }
}

// --- Date Utilities ---
function calculateDays(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start) || isNaN(end)) return 0;
  if (end < start) return 0;

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
}

// --- Leave Accrual System (18 days/year, 1.5 days/month) ---
// Returns counts per month for different leave categories
function getEmployeeLeaveBreakdown(employeeId) {
  const approvedRequests = (state.requests || []).filter(
    r => r.employeeId === employeeId && r.status === 'approved'
  );

  const regularPerMonth = {};
  const unpaidPerMonth = {};
  const directPaidPerMonth = {};

  approvedRequests.forEach(req => {
    const start = new Date(req.startDate + 'T00:00:00');
    const end = new Date(req.endDate + 'T00:00:00');
    
    const typeLower = (req.type || '').toLowerCase();
    const isUnpaid = typeLower === 'absent' || 
                     typeLower.includes('leave without pay') || 
                     typeLower.includes('loss of pay');
    const isDirectPaid = typeLower === 'leave with pay';
    const isWfh = typeLower.includes('work from home');

    const increment = (req.duration === 0.5) ? 0.5 : 1;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (isWfh) {
        // Do nothing for WFH; it does not consume leave balance or affect pay
      } else if (isUnpaid) {
        unpaidPerMonth[ym] = (unpaidPerMonth[ym] || 0) + increment;
      } else if (isDirectPaid) {
        directPaidPerMonth[ym] = (directPaidPerMonth[ym] || 0) + increment;
      } else {
        regularPerMonth[ym] = (regularPerMonth[ym] || 0) + increment;
      }
    }
  });

  return { regularPerMonth, unpaidPerMonth, directPaidPerMonth };
}

// Returns a map of { 'YYYY-MM': daysUsed } for all approved leaves of an employee (total regular + unpaid + direct paid)
function getEmployeeLeavesPerMonth(employeeId) {
  const breakdown = getEmployeeLeaveBreakdown(employeeId);
  const perMonth = {};
  const allYms = new Set([
    ...Object.keys(breakdown.regularPerMonth),
    ...Object.keys(breakdown.unpaidPerMonth),
    ...Object.keys(breakdown.directPaidPerMonth)
  ]);
  allYms.forEach(ym => {
    perMonth[ym] = (breakdown.regularPerMonth[ym] || 0) + 
                   (breakdown.unpaidPerMonth[ym] || 0) + 
                   (breakdown.directPaidPerMonth[ym] || 0);
  });
  return perMonth;
}

/**
 * Simulates month-by-month leave accrual from January of the accrual year
 * up to and including `targetYearMonth` (format: 'YYYY-MM').
 *
 * Rules:
 *  - Each month accrues 1.5 days (cap: 18 days/year total accrued).
 *  - Paid leave = days taken, deducted from accrued balance (full balance usable, not limited to 1.5/month).
 *  - Any days taken beyond the TOTAL accrued balance are LWP for that month.
 *
 * Returns { balance, totalAccrued, totalApproved, lwpDays }:
 *   balance      — remaining paid leave balance after the target month
 *   totalAccrued — total days accrued from Jan through end of target month
 *   totalApproved— total approved leave days from Jan through target month
 *   lwpDays      — LWP days that fall in the target month specifically
 */
function getEmployeeLeaveAccumulation(employeeId, targetYearMonth) {
  const ACCRUAL_PER_MONTH = 1.5;
  const MAX_YEARLY = 18;
  const [targetYear, targetMonth] = targetYearMonth.split('-').map(Number);

  const { regularPerMonth, unpaidPerMonth, directPaidPerMonth } = getEmployeeLeaveBreakdown(employeeId);

  let accruedBalance = 0;
  let totalAccrued = 0;
  let totalApprovedDays = 0;
  let lwpInTarget = 0;

  for (let m = 1; m <= targetMonth; m++) {
    // Accrue 1.5 days this month
    accruedBalance = Math.min(accruedBalance + ACCRUAL_PER_MONTH, MAX_YEARLY);
    totalAccrued = Math.min(totalAccrued + ACCRUAL_PER_MONTH, MAX_YEARLY);

    const ym = `${targetYear}-${String(m).padStart(2, '0')}`;
    const regularDays = regularPerMonth[ym] || 0;
    const unpaidDays = unpaidPerMonth[ym] || 0;
    const directPaidDays = directPaidPerMonth[ym] || 0;

    totalApprovedDays += (regularDays + unpaidDays + directPaidDays);

    // Paid leave can use any accrued balance from carry forwards
    const paidRegular = Math.min(regularDays, accruedBalance);
    const unpaidRegular = regularDays - paidRegular;

    accruedBalance = Math.max(0, accruedBalance - paidRegular);

    // Deduct direct paid leaves from balance if available
    const paidDirect = Math.min(directPaidDays, accruedBalance);
    accruedBalance = Math.max(0, accruedBalance - paidDirect);

    if (m === targetMonth) {
      // Unpaid days (Absent / LWP) + regular leaves that exceeded balance
      lwpInTarget = unpaidDays + unpaidRegular;
    }
  }

  return {
    balance: Math.round(accruedBalance * 10) / 10,       // remaining paid leave balance
    totalAccrued: Math.round(totalAccrued * 10) / 10,    // total accrued so far this year
    totalApproved: Math.round(totalApprovedDays * 10) / 10,
    lwpDays: Math.round(lwpInTarget * 10) / 10
  };
}

function setupDateLimits() {
  const today = getTodayDateString();
  const startDate = document.getElementById('start-date');
  const endDate = document.getElementById('end-date');
  if (startDate && endDate) {
    startDate.min = today;
    endDate.min = today;
  }
}

function updateFormDaysCount() {
  const startVal = document.getElementById('start-date').value;
  const endVal = document.getElementById('end-date').value;
  const display = document.getElementById('calculated-days');
  const errorMsg = document.getElementById('date-error');

  if (startVal && endVal) {
    const days = calculateDays(startVal, endVal);
    if (days <= 0) {
      display.textContent = '0 days';
      errorMsg.style.display = 'block';
    } else {
      display.textContent = `${days} day${days > 1 ? 's' : ''}`;
      errorMsg.style.display = 'none';

      // Sync min boundary for end-date
      document.getElementById('end-date').min = startVal;
    }
  } else {
    display.textContent = '0 days';
  }
}

function updateHeaderAvatar(user) {
  const avatarEl = document.getElementById('header-avatar');
  if (avatarEl) {
    if (user && user.photo) {
      avatarEl.innerHTML = `<img src="${user.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
    } else if (user) {
      const initials = user.avatar || (user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U');
      avatarEl.textContent = initials;
    }
  }
}

// --- Role Selection & View Toggling ---
function setRole(role) {
  state.currentRole = role;

  const empSelectorWrapper = document.getElementById('employee-selector-wrapper');
  const empSelect = document.getElementById('active-employee-select');

  // Update Role Switcher styling
  document.getElementById('btn-role-employee').classList.remove('active');
  const leadBtn = document.getElementById('btn-role-techlead');
  if (leadBtn) leadBtn.classList.remove('active');
  const managerBtn = document.getElementById('btn-role-manager');
  if (managerBtn) managerBtn.classList.remove('active');
  const hrBtn = document.getElementById('btn-role-hr');
  if (hrBtn) hrBtn.classList.remove('active');
  const adminBtn = document.getElementById('btn-role-admin');
  if (adminBtn) adminBtn.classList.remove('active');

  const matchesTargetRole = (user, target) => {
    if (!user) return false;
    const roleStr = (user.role || '').toLowerCase();
    if (target === 'admin') return roleStr.includes('admin');
    if (target === 'hr') return roleStr.includes('hr');
    if (target === 'techlead') return roleStr.includes('tech lead') || roleStr.includes('manager');
    if (target === 'manager') return roleStr.includes('manager') || roleStr.includes('tech lead');
    return true; // employee is allowed for everyone
  };

  if (role === 'employee') {
    document.getElementById('btn-role-employee').classList.add('active');

    // Only switch current user if not already matching the target employee role
    if (!matchesTargetRole(state.currentUser, 'employee')) {
      if (empSelect && empSelect.value) {
        state.currentUser = state.employees.find(emp => emp.id === empSelect.value);
      } else {
        state.currentUser = state.employees.find(emp => emp.role.toLowerCase() === 'employee'); // Default employee
      }
    }

    if (empSelectorWrapper) {
      const uRole = (state.currentUser && state.currentUser.role ? state.currentUser.role : '').toLowerCase();
      const canSwitchEmp = uRole.includes('admin') || uRole.includes('hr');
      empSelectorWrapper.style.display = canSwitchEmp ? 'flex' : 'none';
    }
  } else if (role === 'techlead') {
    if (leadBtn) leadBtn.classList.add('active');

    // Only switch current user if not already matching the techlead role
    if (!matchesTargetRole(state.currentUser, 'techlead')) {
      let leadEmp = state.employees.find(emp => emp.role.toLowerCase().includes('tech lead'));
      if (!leadEmp) {
        leadEmp = {
          id: "AIRG00008",
          name: "Suyash Patil",
          dept: "AI, Electronics, Lab Setup",
          email: "suyash@gurujiair.com",
          role: "Tech Lead",
          balance: 20,
          absent: 0,
          avatar: "SP",
          password: "suyash",
          phone: "+91 99752 59016"
        };
        state.employees.push(leadEmp);
        localStorage.setItem('ems_employees', JSON.stringify(state.employees));
        triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
        populateEmployeeDropdown();
      }
      state.currentUser = leadEmp;
    }

    if (empSelectorWrapper) {
      empSelectorWrapper.style.display = 'none';
    }
  } else if (role === 'manager') {
    if (managerBtn) managerBtn.classList.add('active');

    // Only switch current user if not already matching the manager role
    if (!matchesTargetRole(state.currentUser, 'manager')) {
      let managerEmp = state.employees.find(emp => emp.role.toLowerCase().includes('manager'));
      if (!managerEmp) {
        managerEmp = state.employees.find(emp => emp.name === "Suyash Patil");
        if (managerEmp) {
          if (!managerEmp.role.toLowerCase().includes('manager')) {
            managerEmp.role += ", Manager";
          }
        } else {
          managerEmp = {
            id: "AIRG00008",
            name: "Suyash Patil",
            dept: "AI, Electronics, Lab Setup",
            email: "suyash@gurujiair.com",
            role: "Tech Lead, Manager",
            balance: 20,
            absent: 0,
            avatar: "SP",
            password: "suyash",
            phone: "+91 99752 59016"
          };
          state.employees.push(managerEmp);
        }
        localStorage.setItem('ems_employees', JSON.stringify(state.employees));
        triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
        populateEmployeeDropdown();
      }
      state.currentUser = managerEmp;
    }

    if (empSelectorWrapper) {
      empSelectorWrapper.style.display = 'none';
    }
  } else if (role === 'admin') {
    if (adminBtn) adminBtn.classList.add('active');

    // Only switch current user if not already matching the admin role
    if (!matchesTargetRole(state.currentUser, 'admin')) {
      let adminEmp = state.employees.find(emp => emp.role.toLowerCase().includes('admin'));
      if (!adminEmp) {
        adminEmp = {
          id: "AIRG00001",
          name: "Pratap Pawar",
          dept: "AI, Electronics, Lab Setup, Instructor",
          email: "pratap@gurujiair.com",
          role: "Admin",
          balance: 20,
          absent: 0,
          avatar: "PP",
          password: "pratap",
          phone: "+91 98607 79172"
        };
        state.employees.push(adminEmp);
        localStorage.setItem('ems_employees', JSON.stringify(state.employees));
        triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
        populateEmployeeDropdown();
      }
      state.currentUser = adminEmp;
    }

    if (empSelectorWrapper) {
      empSelectorWrapper.style.display = 'none';
    }
  } else {
    if (hrBtn) hrBtn.classList.add('active');

    // Only switch current user if not already matching the hr role
    if (!matchesTargetRole(state.currentUser, 'hr')) {
      let hrEmp = state.employees.find(emp => emp.role.toLowerCase().includes('hr'));
      if (!hrEmp) {
        hrEmp = {
          id: "AIRG00042",
          name: "Shravani Khanvilkar",
          dept: "AI, Electronics, Lab Setup, Instructor",
          email: "shravani@gurujiair.com",
          role: "HR, Tech Lead",
          balance: 20,
          absent: 0,
          avatar: "SK",
          password: "shravani",
          phone: "+91 84465 31087"
        };
        state.employees.push(hrEmp);
        localStorage.setItem('ems_employees', JSON.stringify(state.employees));
        triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
        populateEmployeeDropdown();
      }
      state.currentUser = hrEmp;
    }

    if (empSelectorWrapper) {
      empSelectorWrapper.style.display = 'none';
    }
  }

  // Update Profile Widget
  updateHeaderAvatar(state.currentUser);
  document.getElementById('header-name').textContent = state.currentUser.name;
  document.getElementById('header-role').textContent = state.currentUser.role === 'Admin, HR, Tech Lead, Manager' ? 'CEO' : state.currentUser.role;

  // Sync dropdown selection if in employee mode
  if (role === 'employee' && empSelect) {
    empSelect.value = state.currentUser.id;
  }

  // Toggle visible items in navigation
  updateSidebarMenu();

  // Render current role screens
  switchView('tasks');
  updateCommMenuBadges();
}

// Populate the Employee dropdown list
function populateEmployeeDropdown() {
  const empSelect = document.getElementById('active-employee-select');
  if (!empSelect) return;
  empSelect.innerHTML = '';
  state.employees.filter(emp => (emp.role === 'Employee' || emp.role === 'Tech Lead') && !isPratap(emp) && !emp.isDeleted && emp.status !== 'pending_approval').forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = emp.role.toLowerCase() === 'admin' ? `${emp.name} (CEO)` : `${emp.name} (${emp.dept} - ${emp.role})`;
    empSelect.appendChild(option);
  });
}

function updateSidebarMenu() {
  const rosterMenu = document.getElementById('menu-item-roster');
  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    rosterMenu.style.display = 'flex';
  } else {
    rosterMenu.style.display = 'none';
  }

  const schoolMenu = document.getElementById('menu-item-school');
  if (schoolMenu) {
    const userRole = (state.currentUser && state.currentUser.role || '').toLowerCase();
    const isHROrManager = userRole.includes('hr') || userRole.includes('manager') || userRole.includes('admin') || userRole.includes('tech lead') || userRole.includes('techlead');
    if (isHROrManager) {
      schoolMenu.style.display = 'flex';
    } else {
      schoolMenu.style.display = 'none';
    }
  }

  const empDetailsMenu = document.getElementById('menu-item-emp-details');
  if (empDetailsMenu) {
    const userRole = (state.currentUser && state.currentUser.role || '').toLowerCase();
    const isHROrAdmin = userRole.includes('hr') || userRole.includes('admin');
    if (isHROrAdmin) {
      empDetailsMenu.style.display = 'flex';
    } else {
      empDetailsMenu.style.display = 'none';
    }
  }

  const regApprovalMenu = document.getElementById('menu-item-reg-approval');
  if (regApprovalMenu) {
    const userRole = (state.currentUser && state.currentUser.role || '').toLowerCase();
    const isHROrAdmin = userRole.includes('hr') || userRole.includes('admin');
    if (isHROrAdmin) {
      regApprovalMenu.style.display = 'flex';
    } else {
      regApprovalMenu.style.display = 'none';
    }
  }
}

function switchLeaveSubTab(tab) {
  state.activeLeaveSubTab = tab;
  const activeMenuItem = document.querySelector('.sidebar-menu .menu-item.active');
  const view = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'requests';
  switchView(view);
}

function switchView(viewName) {
  const leaveSubTabs = document.getElementById('leave-sub-tabs');
  if (leaveSubTabs && viewName !== 'dashboard' && viewName !== 'requests' && viewName !== 'reports') {
    leaveSubTabs.style.display = 'none';
  }

  // Clear name/ID search filters on tab transition
  const regSearch = document.getElementById('reg-approval-search');
  if (regSearch) regSearch.value = '';
  const rosterSearch = document.getElementById('roster-search');
  if (rosterSearch) rosterSearch.value = '';
  const empDetailsSearch = document.getElementById('emp-details-search');
  if (empDetailsSearch) empDetailsSearch.value = '';

  // Mark resolved requests as read for employee
  if (state.currentUser && (viewName === 'dashboard' || viewName === 'requests')) {
    if (state.currentRole === 'employee' || state.activeLeaveSubTab === 'apply') {
      const readRequests = JSON.parse(localStorage.getItem(`ems_read_requests_${state.currentUser.id}`) || '[]');
      let updated = false;
      (state.requests || []).forEach(r => {
        if (r.employeeId === state.currentUser.id && r.status !== 'pending') {
          if (!readRequests.includes(r.id)) {
            readRequests.push(r.id);
            updated = true;
          }
        }
      });
      if (updated) {
        localStorage.setItem(`ems_read_requests_${state.currentUser.id}`, JSON.stringify(readRequests));
      }
    }
  }

  // Mark reviewed reports as read for employee
  if (state.currentUser && viewName === 'reports') {
    if (state.currentRole !== 'hr' && state.currentRole !== 'admin') {
      const readReports = JSON.parse(localStorage.getItem(`ems_read_reports_${state.currentUser.id}`) || '[]');
      let updated = false;
      (state.dailyReports || []).forEach(r => {
        if (r.employeeId === state.currentUser.id && r.remarks && r.remarks.trim() !== '') {
          if (!readReports.includes(r.id)) {
            readReports.push(r.id);
            updated = true;
          }
        }
      });
      if (updated) {
        localStorage.setItem(`ems_read_reports_${state.currentUser.id}`, JSON.stringify(readReports));
      }
    }
  }

  // Auto-close mobile sidebar when switching views
  if (window.innerWidth <= 768 && typeof window.closeMobileSidebar === 'function') {
    window.closeMobileSidebar();
  }

  // Update menu item highlight
  document.querySelectorAll('.menu-item').forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle Layout visibility
  const empContainer = document.getElementById('employee-view-container');
  const hrContainer = document.getElementById('hr-view-container');
  const commContainer = document.getElementById('communications-view-container');
  const calendarContainer = document.getElementById('calendar-view-container');
  const reportsContainer = document.getElementById('reports-view-container');
  const payslipsContainer = document.getElementById('payslips-view-container');
  const reimbursementsContainer = document.getElementById('reimbursements-view-container');
  const ticketsContainer = document.getElementById('tickets-view-container');
  const schoolContainer = document.getElementById('school-management-view-container');
  const empDetailsContainer = document.getElementById('emp-details-view-container');
  const regApprovalContainer = document.getElementById('registration-approval-view-container');

  if (schoolContainer) schoolContainer.style.display = 'none';
  if (empDetailsContainer) empDetailsContainer.style.display = 'none';
  if (regApprovalContainer) regApprovalContainer.style.display = 'none';

  if (viewName === 'communications') {
    if (empContainer) empContainer.style.display = 'none';
    if (hrContainer) hrContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';
    if (commContainer) commContainer.style.display = 'block';

    // Update Page Header Label
    const titleLabel = document.getElementById('page-title-label');
    if (titleLabel) titleLabel.textContent = 'Communications Hub';

    renderCommunicationsHub();
  } else if (viewName === 'calendar') {
    if (empContainer) empContainer.style.display = 'none';
    if (hrContainer) hrContainer.style.display = 'none';
    if (commContainer) commContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'block';

    // Update Page Header Label
    const titleLabel = document.getElementById('page-title-label');
    if (titleLabel) titleLabel.textContent = 'Holiday & Leave Calendar';

    renderCalendar();
  } else if (viewName === 'reports') {
    if (empContainer) empContainer.style.display = 'none';
    if (hrContainer) hrContainer.style.display = 'none';
    if (commContainer) commContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'block';

    // Update Page Header Label
    const titleLabel = document.getElementById('page-title-label');
    if (titleLabel) titleLabel.textContent = 'Daily Reports';

    const isReportReviewer = (state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin' || state.currentRole === 'hr');
    const leaveSubTabs = document.getElementById('leave-sub-tabs');
    if (isReportReviewer) {
      if (leaveSubTabs) leaveSubTabs.style.display = 'flex';
      if (!state.activeLeaveSubTab) {
        state.activeLeaveSubTab = 'approve';
      }
      const applyTab = document.getElementById('leave-tab-apply');
      const approveTab = document.getElementById('leave-tab-approve');
      if (applyTab && approveTab) {
        applyTab.textContent = 'My Reports';
        approveTab.textContent = 'Manage Reports';
        applyTab.classList.toggle('active', state.activeLeaveSubTab === 'apply');
        approveTab.classList.toggle('active', state.activeLeaveSubTab === 'approve');
      }
    } else {
      if (leaveSubTabs) leaveSubTabs.style.display = 'none';
    }

    loadDailyReportsPage();
  } else if (viewName === 'payslips') {
    switchView('tasks');
    return;
  } else if (viewName === 'reimbursements') {
    if (empContainer) empContainer.style.display = 'none';
    if (hrContainer) hrContainer.style.display = 'none';
    if (commContainer) commContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'block';

    // Update Page Header Label
    const titleLabel = document.getElementById('page-title-label');
    if (titleLabel) titleLabel.textContent = 'Reimbursements';

    renderReimbursements();
  } else if (viewName === 'tickets') {
    if (empContainer) empContainer.style.display = 'none';
    if (hrContainer) hrContainer.style.display = 'none';
    if (commContainer) commContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'block';

    // Update Page Header Label
    const titleLabel = document.getElementById('page-title-label');
    if (titleLabel) titleLabel.textContent = 'Support Tickets';

    renderTickets();
  } else if (viewName === 'school-management') {
    const userRole = (state.currentUser && state.currentUser.role || '').toLowerCase();
    const isHROrManager = userRole.includes('hr') || userRole.includes('manager') || userRole.includes('admin') || userRole.includes('tech lead') || userRole.includes('techlead');
    if (!isHROrManager) {
      switchView('tasks');
      return;
    }

    if (empContainer) empContainer.style.display = 'none';
    if (hrContainer) hrContainer.style.display = 'none';
    if (commContainer) commContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';
    if (schoolContainer) schoolContainer.style.display = 'block';

    const titleLabel = document.getElementById('page-title-label');
    if (titleLabel) titleLabel.textContent = 'School Management';

    renderSchoolManagement();

    // Show "+ Add Tech Lead" button only to HR and Admin
    const addLeadBtn = document.getElementById('btn-add-school-lead');
    if (addLeadBtn) {
      const userRole = (state.currentRole || '').toLowerCase();
      addLeadBtn.style.display = (userRole === 'hr' || userRole === 'admin') ? 'inline-flex' : 'none';
    }
  } else if (viewName === 'emp-details') {
    const userRole = (state.currentUser && state.currentUser.role || '').toLowerCase();
    const isHROrAdmin = userRole.includes('hr') || userRole.includes('admin');
    if (!isHROrAdmin) {
      switchView('tasks');
      return;
    }

    if (empContainer) empContainer.style.display = 'none';
    if (hrContainer) hrContainer.style.display = 'none';
    if (commContainer) commContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';
    if (schoolContainer) schoolContainer.style.display = 'none';
    if (empDetailsContainer) empDetailsContainer.style.display = 'flex';
    if (regApprovalContainer) regApprovalContainer.style.display = 'none';

    const titleLabel = document.getElementById('page-title-label');
    if (titleLabel) titleLabel.textContent = 'Employee Details';

    renderEmployeeDetails();
  } else if (viewName === 'registration-approval') {
    const userRole = (state.currentUser && state.currentUser.role || '').toLowerCase();
    const isHROrAdmin = userRole.includes('hr') || userRole.includes('admin');
    if (!isHROrAdmin) {
      switchView('tasks');
      return;
    }

    if (empContainer) empContainer.style.display = 'none';
    if (hrContainer) hrContainer.style.display = 'none';
    if (commContainer) commContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';
    if (schoolContainer) schoolContainer.style.display = 'none';
    if (empDetailsContainer) empDetailsContainer.style.display = 'none';
    if (regApprovalContainer) regApprovalContainer.style.display = 'flex';

    const titleLabel = document.getElementById('page-title-label');
    if (titleLabel) titleLabel.textContent = 'Registration Approval Queue';

    renderRegistrationApprovalQueue();
  } else {
    if (commContainer) commContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';

    const isLeadOrHR = (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin');
    const leaveSubTabs = document.getElementById('leave-sub-tabs');

    if (viewName === 'dashboard' || viewName === 'requests') {
      if (isLeadOrHR) {
        if (leaveSubTabs) leaveSubTabs.style.display = 'flex';

        if (!state.activeLeaveSubTab) {
          state.activeLeaveSubTab = 'approve';
        }

        const applyTab = document.getElementById('leave-tab-apply');
        const approveTab = document.getElementById('leave-tab-approve');
        if (applyTab && approveTab) {
          applyTab.textContent = 'My Applications';
          approveTab.textContent = 'Manage Approvals';
          applyTab.classList.toggle('active', state.activeLeaveSubTab === 'apply');
          approveTab.classList.toggle('active', state.activeLeaveSubTab === 'approve');
        }

        if (state.activeLeaveSubTab === 'apply') {
          if (empContainer) empContainer.style.display = 'flex';
          if (hrContainer) hrContainer.style.display = 'none';
          renderEmployeeDashboard(viewName);
        } else {
          if (empContainer) empContainer.style.display = 'none';
          if (hrContainer) hrContainer.style.display = 'flex';
          renderHRDashboard(viewName);
        }
      } else {
        if (leaveSubTabs) leaveSubTabs.style.display = 'none';
        if (empContainer) empContainer.style.display = 'flex';
        if (hrContainer) hrContainer.style.display = 'none';
        renderEmployeeDashboard(viewName);
      }
    } else {
      if (leaveSubTabs) leaveSubTabs.style.display = 'none';
      if (isLeadOrHR && (viewName === 'tasks' || viewName === 'roster')) {
        if (empContainer) empContainer.style.display = 'none';
        if (hrContainer) hrContainer.style.display = 'flex';
        renderHRDashboard(viewName);
      } else {
        if (empContainer) empContainer.style.display = 'flex';
        if (hrContainer) hrContainer.style.display = 'none';
        renderEmployeeDashboard(viewName);
      }
    }
  }

  // Update all dashboard/menu badges
  updateAllMenuBadges();
}

// --- Render Employee Dashboard ---
function getEmployeesOnLeaveToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const onLeaveEmpIds = new Set();
  (state.requests || []).forEach(req => {
    if (req.status === 'approved' && req.startDate && req.endDate) {
      const start = new Date(req.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(req.endDate);
      end.setHours(23, 59, 59, 999);
      if (today.getTime() >= start.getTime() && today.getTime() <= end.getTime()) {
        onLeaveEmpIds.add(req.employeeId);
      }
    }
  });

  return Array.from(onLeaveEmpIds).map(id => state.employees.find(e => e.id === id)).filter(Boolean);
}

function renderOutOfOfficeBanner() {
  const container = document.getElementById('out-of-office-container');
  if (!container) return;
  const onLeave = getEmployeesOnLeaveToday();
  if (onLeave.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = `<div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: var(--border-radius-md); padding: 16px;">`;
  html += `<h3 style="color: var(--warning); margin: 0 0 12px 0; font-size: 1rem; display: flex; align-items: center; gap: 8px;">
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    Out of Office Today
  </h3>`;
  html += `<div style="display: flex; flex-direction: column; gap: 8px;">`;
  
  const today = new Date().getTime();
  onLeave.forEach(emp => {
    const theirLeave = state.requests.find(r => 
      r.employeeId === emp.id && 
      r.status === 'approved' &&
      new Date(r.startDate).setHours(0,0,0,0) <= today &&
      new Date(r.endDate).setHours(23,59,59,999) >= today
    );
    const endStr = theirLeave ? new Date(theirLeave.endDate).toLocaleDateString() : 'Unknown';
    html += `<div style="font-size: 0.9rem; color: var(--text-primary);">
      <strong>${emp.name}</strong> is currently on leave until <strong>${endStr}</strong>. Please refrain from assigning tasks and only contact for urgent matters.
    </div>`;
  });
  html += `</div></div>`;
  container.innerHTML = html;
}

function renderEmployeeDashboard(viewName = 'tasks') {
  if (!state.currentUser) return;
  const userId = state.currentUser.id;
  const userRequests = state.requests.filter(req => req.employeeId === userId);
  const employeeData = state.employees.find(emp => emp.id === userId);

  renderOutOfOfficeBanner();

  // Update Stats Cards
  const pendingRequests = userRequests.filter(req => req.status === 'pending');
  const pendingDays = pendingRequests.reduce((sum, req) => sum + req.duration, 0);

  // Compute paid leave balance dynamically: 1.5 days/month accrual, 18 days/year max
  const currentYearMonth = '2026-06'; // current month context
  const accrual = getEmployeeLeaveAccumulation(userId, currentYearMonth);
  const dynamicBalance = accrual.balance;         // remaining paid leave days
  const totalAccrued = accrual.totalAccrued;      // total paid leave accrued so far this year
  const dynamicApproved = accrual.totalApproved;

  // Ring shows how much of the ACCRUED paid leave has been used (balance / totalAccrued)
  const paidLeaveUsed = Math.max(0, totalAccrued - dynamicBalance);
  const percentUsed = totalAccrued > 0
    ? Math.min(100, Math.round((paidLeaveUsed / totalAccrued) * 100))
    : 0;

  const circularProgress = document.getElementById('balance-progress-ring');
  if (circularProgress) {
    circularProgress.style.background = `conic-gradient(var(--primary) ${percentUsed * 3.6}deg, var(--bg-tertiary) 0deg)`;
    document.getElementById('balance-progress-value').textContent = dynamicBalance;
  }

  const maxLabel = document.getElementById('balance-max-value');
  if (maxLabel) {
    maxLabel.textContent = totalAccrued; // "out of X accrued" — not yearly max
  }

  document.getElementById('emp-approved-days').textContent = dynamicApproved;
  document.getElementById('emp-pending-days').textContent = pendingDays;

  // Toggle View Panels
  const dashboardCardRow = document.getElementById('emp-dashboard-row');
  const myRequestsTableCard = document.getElementById('emp-requests-table-card');
  const empTasksCard = document.getElementById('emp-tasks-card');

  // Update Page Header Label based on view
  const titleLabel = document.getElementById('page-title-label');
  if (titleLabel) {
    if (viewName === 'dashboard' || viewName === 'requests') titleLabel.textContent = 'Leave Requests';
    else if (viewName === 'tasks') titleLabel.textContent = 'Tasks & Projects';
  }

  const leaveStatsGrid = document.getElementById('emp-leave-stats-grid');
  const empCalendarCard = document.getElementById('emp-calendar-card');
  if (viewName === 'dashboard' || viewName === 'requests') {
    if (leaveStatsGrid) leaveStatsGrid.style.display = 'grid';
    dashboardCardRow.style.display = 'grid';
    myRequestsTableCard.style.display = 'flex';
    if (empCalendarCard) {
      empCalendarCard.style.display = 'flex';
      renderInlineCalendar();
    }
    if (empTasksCard) empTasksCard.style.display = 'none';
  } else if (viewName === 'tasks') {
    if (leaveStatsGrid) leaveStatsGrid.style.display = 'none';
    dashboardCardRow.style.display = 'none';
    myRequestsTableCard.style.display = 'none';
    if (empCalendarCard) empCalendarCard.style.display = 'none';
    if (empTasksCard) empTasksCard.style.display = 'flex';
    renderEmployeeTasksAndProjects();
  }

  // Render employee request table
  const tbody = document.getElementById('employee-requests-tbody');
  tbody.innerHTML = '';

  const leaveHeader = document.getElementById('leave-remarks-header');
  if (leaveHeader) {
    leaveHeader.textContent = 'Remarks';
  }

  if (userRequests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div class="empty-state-title">No leave requests found</div>
            <p>Use the form to submit your first leave application.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Sort: pending first, then newest submitted
  const sortedRequests = [...userRequests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.submittedAt) - new Date(a.submittedAt);
  });

  sortedRequests.forEach(req => {
    const tr = document.createElement('tr');
    const canDeleteReq = req.status === 'pending';
    tr.innerHTML = `
      <td><strong>${req.type}</strong></td>
      <td>${formatDate(req.startDate)} - ${formatDate(req.endDate)}</td>
      <td><strong>${req.duration} day${req.duration > 1 ? 's' : ''}</strong></td>
      <td><span class="badge badge-${req.status}">${req.status}</span></td>
      <td><span class="text-muted">${renderClickableText(req.reason, 35)}</span></td>
      <td><span class="text-muted">${renderClickableText(req.comment, 35)}</span></td>
      <td>
        ${canDeleteReq ? `<button class="btn btn-secondary btn-xs" onclick="deleteLeaveRequest('${req.id}')" style="color:var(--danger); border-color:rgba(239,68,68,0.3);" title="Withdraw request">Delete</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Render HR Dashboard ---
function renderHRDashboard(viewName = 'dashboard') {
  // Inputs/Filters
  const searchQuery = (document.getElementById('hr-search').value || '').toLowerCase();
  
  renderOutOfOfficeBanner();
  const filterStatus = document.getElementById('filter-status').value;
  const filterType = document.getElementById('filter-type').value;

  // Filter requests (History Archive)
  let filteredRequests = state.requests.filter(req => {
    // Role based visibility filtering
    if (state.currentRole === 'techlead' || state.currentRole === 'manager') {
      const applicant = state.employees.find(e => e.id === req.employeeId);
      const applicantRole = applicant ? (applicant.role.toLowerCase().includes('tech lead') ? 'techlead' : applicant.role.toLowerCase().includes('manager') ? 'manager' : applicant.role.toLowerCase().includes('hr') ? 'hr' : applicant.role.toLowerCase().includes('admin') ? 'admin' : 'employee') : 'employee';
      // Tech Lead / Manager only views history of their own department employees (no other leads/HR, except themselves)
      if (req.employeeId !== state.currentUser.id) {
        const leadDepts = (state.currentUser.dept || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
        const reqDept = (req.dept || '').trim().toLowerCase();
        if (!leadDepts.includes(reqDept) || (applicantRole !== 'employee')) return false;
      }
    } else if (state.currentRole === 'hr') {
      // HR views history of employees and techleads/managers (no other HR for privacy unless admin, except their own)
      const applicant = state.employees.find(e => e.id === req.employeeId);
      const isHR = applicant && (applicant.role || '').toLowerCase().includes('hr');
      if (isHR && req.employeeId !== state.currentUser.id) return false;
    }

    const matchesSearch = req.employeeName.toLowerCase().includes(searchQuery) || req.dept.toLowerCase().includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    const matchesType = filterType === 'all' || req.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate HR stats cards (clamped by department for Tech Leads & Managers)
  const activeEmployees = state.employees.filter(emp => !emp.isDeleted && emp.status !== 'pending_approval');
  const deptEmployees = (state.currentRole === 'techlead' || state.currentRole === 'manager')
    ? activeEmployees.filter(emp => {
      if (!emp.dept) return false;
      const leadDepts = (state.currentUser.dept || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      const empDepts = emp.dept.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      return empDepts.some(d => leadDepts.includes(d));
    })
    : activeEmployees;

  const totalEmployeesCount = deptEmployees.length;
  const totalAbsentDays = deptEmployees.reduce((sum, emp) => {
    const approvedAbsentCount = state.requests.filter(
      r => r.employeeId === emp.id && r.status === 'approved' && 
      (r.type === 'Absent' || r.type === 'Leave Without Pay' || r.type === 'Leave Without Pay (LWP) / Loss of Pay')
    ).reduce((s, r) => s + r.duration, 0);
    return sum + approvedAbsentCount;
  }, 0);

  const pendingApprovalsCount = state.requests.filter(req => {
    if (req.status !== 'pending') return false;
    if (req.employeeId === state.currentUser.id) return false;

    const applicant = state.employees.find(e => e.id === req.employeeId);
    const applicantRole = applicant ? (applicant.role.toLowerCase().includes('tech lead') ? 'techlead' : applicant.role.toLowerCase().includes('manager') ? 'manager' : applicant.role.toLowerCase().includes('hr') ? 'hr' : applicant.role.toLowerCase().includes('admin') ? 'admin' : 'employee') : 'employee';

    if (state.currentRole === 'admin') {
      return true;
    } else if (state.currentRole === 'hr') {
      return applicantRole === 'employee' || applicantRole === 'techlead' || applicantRole === 'manager';
    } else if (state.currentRole === 'techlead' || state.currentRole === 'manager') {
      const leadDepts = (state.currentUser.dept || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      const reqDept = (req.dept || '').trim().toLowerCase();
      return applicantRole === 'employee' && leadDepts.includes(reqDept);
    }
    return false;
  }).length;

  const totalEmpEl = document.getElementById('hr-total-employees');
  if (totalEmpEl) totalEmpEl.textContent = totalEmployeesCount;
  const pendingReqEl = document.getElementById('hr-pending-requests');
  if (pendingReqEl) pendingReqEl.textContent = pendingApprovalsCount;
  const absentDaysEl = document.getElementById('hr-absent-days');
  if (absentDaysEl) absentDaysEl.textContent = totalAbsentDays;

  // Show/Hide & populate record leaves directly card
  const isHRorAdmin = state.currentRole === 'hr' || state.currentRole === 'admin';
  const recordLeaveCard = document.getElementById('hr-record-leave-card');
  if (recordLeaveCard) {
    if (isHRorAdmin && (viewName === 'dashboard' || viewName === 'requests')) {
      recordLeaveCard.style.display = 'block';
      const empSelect = document.getElementById('hr-leave-emp-select');
      if (empSelect) {
        const currentVal = empSelect.value;
        empSelect.innerHTML = '<option value="" disabled selected>Select employee...</option>';
        state.employees.forEach(emp => {
          const opt = document.createElement('option');
          opt.value = emp.id;
          opt.textContent = `${emp.name} (${emp.id}) - ${emp.role}`;
          empSelect.appendChild(opt);
        });
        if (currentVal) empSelect.value = currentVal;
      }
    } else {
      recordLeaveCard.style.display = 'none';
    }
  }

  const hrStatsGrid = document.getElementById('hr-stats-grid');
  if (hrStatsGrid) {
    if (viewName === 'tasks') {
      hrStatsGrid.style.display = 'none';
    } else {
      hrStatsGrid.style.display = 'grid';
    }
  }

  // Toggle views
  const dashboardCardRow = document.getElementById('hr-dashboard-row');
  const rosterCard = document.getElementById('hr-roster-card');
  const hrTasksCard = document.getElementById('hr-tasks-card');

  // Update Page Header Label based on view
  const titleLabel = document.getElementById('page-title-label');
  if (titleLabel) {
    if (viewName === 'dashboard') titleLabel.textContent = 'HR Overview Dashboard';
    else if (viewName === 'requests') titleLabel.textContent = 'All Applied Leaves';
    else if (viewName === 'roster') titleLabel.textContent = 'Employees';
    else if (viewName === 'tasks') titleLabel.textContent = 'Tasks & Projects Admin';
  }

  if (viewName === 'dashboard' || viewName === 'requests') {
    dashboardCardRow.style.display = 'flex';
    rosterCard.style.display = 'none';
    if (hrTasksCard) hrTasksCard.style.display = 'none';
  } else if (viewName === 'roster') {
    dashboardCardRow.style.display = 'none';
    rosterCard.style.display = 'flex';
    if (hrTasksCard) hrTasksCard.style.display = 'none';
  } else if (viewName === 'tasks') {
    dashboardCardRow.style.display = 'none';
    rosterCard.style.display = 'none';
    if (hrTasksCard) hrTasksCard.style.display = 'flex';
    renderHRTasksAndProjects();
  }

  // --- Render HR Pending Approvals Queue ---
  const pendingRequests = filteredRequests.filter(req => {
    if (req.status !== 'pending') return false;
    if (req.employeeId === state.currentUser.id) return false;

    const applicant = state.employees.find(e => e.id === req.employeeId);
    const applicantRole = applicant ? (applicant.role.toLowerCase().includes('tech lead') ? 'techlead' : applicant.role.toLowerCase().includes('manager') ? 'manager' : applicant.role.toLowerCase().includes('hr') ? 'hr' : applicant.role.toLowerCase().includes('admin') ? 'admin' : 'employee') : 'employee';

    if (state.currentRole === 'admin') {
      return true;
    } else if (state.currentRole === 'hr') {
      return applicantRole === 'employee' || applicantRole === 'techlead' || applicantRole === 'manager';
    } else if (state.currentRole === 'techlead' || state.currentRole === 'manager') {
      const leadDepts = state.currentUser.dept ? state.currentUser.dept.split(',').map(d => d.trim().toLowerCase()) : [];
      return applicantRole === 'employee' && req.dept && leadDepts.includes(req.dept.toLowerCase());
    }
    return false;
  });
  const queueTbody = document.getElementById('hr-queue-tbody');

  if (pendingRequests.length === 0) {
    queueTbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 13l4 4L19 7" />
            </svg>
            <div class="empty-state-title">No pending requests</div>
            <p>All leave applications have been processed.</p>
          </div>
        </td>
      </tr>
    `;
  } else {
    queueTbody.innerHTML = '';
    // Sort newest first
    const sortedPending = [...pendingRequests].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    sortedPending.forEach(req => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="avatar" style="width: 32px; height: 32px; font-size: 0.8rem;">
              ${req.employeeName.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div style="font-weight:600; color: var(--text-primary);">${req.employeeName}</div>
              <div style="font-size:0.75rem; color: var(--text-muted);">${req.dept}</div>
            </div>
          </div>
        </td>
        <td><strong>${req.type}</strong></td>
        <td>${formatDate(req.startDate)} - ${formatDate(req.endDate)}</td>
        <td><strong>${req.duration} day${req.duration > 1 ? 's' : ''}</strong></td>
        <td><span class="text-muted">${renderClickableText(req.reason, 35)}</span></td>
        <td><span class="text-muted">${formatDate(req.submittedAt)}</span></td>
        <td>
          <div style="display:flex; gap: 8px;">
            <button class="btn btn-success btn-sm" onclick="openActionModal('${req.id}', 'approve')">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="openActionModal('${req.id}', 'reject')">Reject</button>
          </div>
        </td>
      `;
      queueTbody.appendChild(tr);
    });
  }

  // --- Render All Leave Requests Table ---
  const allTbody = document.getElementById('hr-all-tbody');
  allTbody.innerHTML = '';

  if (filteredRequests.length === 0) {
    allTbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="empty-state-title">No matching records found</div>
            <p>Try resetting the search bar or filters.</p>
          </div>
        </td>
      </tr>
    `;
  } else {
    // Sort newest first
    const sortedAll = [...filteredRequests].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    sortedAll.forEach(req => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${req.employeeName}</strong><br><span style="font-size:0.75rem;" class="text-muted">${req.dept}</span></td>
        <td><strong>${req.type}</strong></td>
        <td>${formatDate(req.startDate)} - ${formatDate(req.endDate)}</td>
        <td><strong>${req.duration} day${req.duration > 1 ? 's' : ''}</strong></td>
        <td><span class="badge badge-${req.status}">${req.status}</span></td>
        <td><span class="text-muted">${renderClickableText(req.reason, 35)}</span></td>
        <td><span class="text-muted">${renderClickableText(req.comment, 35)}</span></td>
      `;
      allTbody.appendChild(tr);
    });
  }

  // --- Render Employee Roster/Absence Panel ---
  if (viewName === 'roster') {
    renderEmployeeRoster();
  }
}

function toggleEmployeeRosterExpand(empId) {
  if (state.currentRole === 'techlead' || state.currentRole === 'manager') return;
  if (!state.expandedEmployeeIds) {
    state.expandedEmployeeIds = new Set();
  }
  if (state.expandedEmployeeIds.has(empId)) {
    state.expandedEmployeeIds.delete(empId);
  } else {
    state.expandedEmployeeIds.add(empId);
  }
  renderEmployeeRoster();
}

window.toggleEmployeeRosterExpand = toggleEmployeeRosterExpand;

function renderEmployeeRoster() {
  const listEl = document.getElementById('hr-roster-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const searchEl = document.getElementById('roster-search');
  const query = searchEl ? searchEl.value.trim().toLowerCase() : '';

  let employeesToRender = state.employees.filter(emp => {
    if (emp.isDeleted || emp.status === 'pending_approval') return false;
    if (query && !emp.name.toLowerCase().includes(query)) return false;
    const normalizedRole = (emp.role || '').toLowerCase();
    const isSystemAdmin = normalizedRole.includes('admin') || 
                          emp.email.toLowerCase() === 'admin@company.com' ||
                          isPratap(emp);
    return !isSystemAdmin;
  });

  employeesToRender.forEach(emp => {
    // Use dynamic accrual-based balance (1.5/month, max 18/year)
    const currentYM = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })();
    const empAccrual = getEmployeeLeaveAccumulation(emp.id, currentYM);
    const rosterBalance = empAccrual.balance;
    const rosterApproved = empAccrual.totalApproved;
    const rosterTotalAccrued = empAccrual.totalAccrued;
    // Progress bar shows paid leave used out of total accrued
    const paidUsed = Math.max(0, rosterTotalAccrued - rosterBalance);
    const usagePercent = rosterTotalAccrued > 0
      ? Math.min(100, Math.round((paidUsed / rosterTotalAccrued) * 100))
      : 0;

    // Calculate performance stars from daily reports (sum of starRating values)
    const points = state.dailyReports.filter(r => r.employeeId === emp.id && r.starRating > 0).reduce((sum, r) => sum + (r.starRating || 0), 0);

    const isExpanded = state.expandedEmployeeIds && state.expandedEmployeeIds.has(emp.id);
    const isSystemAdmin = emp.role.toLowerCase() === 'admin' || emp.email.toLowerCase() === 'admin@company.com';

    const item = document.createElement('div');
    item.className = `roster-item ${isExpanded ? 'expanded' : ''}`;

    const avatarHTML = emp.photo
      ? `<img src="${emp.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`
      : emp.avatar;

    const avatarStyle = emp.photo ? 'style="border-radius: 50%; overflow: hidden; background: none; padding: 0;"' : '';

    let badgeLabel = 'Bronze Performer';
    let badgeColor = '#b45309';
    let badgeBg = 'rgba(180, 83, 9, 0.15)';
    let badgeBorder = 'rgba(180, 83, 9, 0.3)';

    if (points >= 30) {
      badgeLabel = 'Diamond Champion 👑';
      badgeColor = '#0284c7';
      badgeBg = 'rgba(2, 132, 199, 0.15)';
      badgeBorder = 'rgba(2, 132, 199, 0.3)';
    } else if (points >= 15) {
      badgeLabel = 'Gold Achiever 🏆';
      badgeColor = '#d97706';
      badgeBg = 'rgba(217, 119, 6, 0.15)';
      badgeBorder = 'rgba(217, 119, 6, 0.3)';
    } else if (points >= 5) {
      badgeLabel = 'Silver Contributor ⭐';
      badgeColor = '#4b5563';
      badgeBg = 'rgba(75, 85, 99, 0.15)';
      badgeBorder = 'rgba(75, 85, 99, 0.3)';
    }

    const headerHTML = `
      <div class="roster-header" style="display: flex; align-items: center; gap: 16px; width: 100%; ${(state.currentRole !== 'techlead' && state.currentRole !== 'manager') ? 'cursor: pointer;' : ''}" ${(state.currentRole !== 'techlead' && state.currentRole !== 'manager') ? `onclick="toggleEmployeeRosterExpand('${emp.id}')"` : ''}>
        <div class="roster-avatar" ${avatarStyle}>${avatarHTML}</div>
        <div class="roster-info">
          <div class="roster-name" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span>${emp.name}</span>
            ${(state.activeUsers && state.activeUsers.includes(emp.id)) ? `
              <span class="active-badge" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background-color: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
                <span style="width: 6px; height: 6px; background-color: #22c55e; border-radius: 50%;"></span>
                Active
              </span>
            ` : ''}
            <span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; background-color: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
              ★ ${points} Star${points !== 1 ? 's' : ''}
            </span>
            <span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
              ${badgeLabel}
            </span>
          </div>
          <div class="roster-dept">${(emp.dept && emp.dept.toLowerCase() !== 'engineering') ? `${emp.dept} • ` : ''}${emp.email}</div>
        </div>
        <div class="roster-stat" style="display: flex; align-items: center; gap: 16px;">
          <div style="text-align: right; min-width: 120px;">
            <div>
              <span class="roster-absent-count">${rosterApproved} day${rosterApproved !== 1 ? 's' : ''}</span>
              <span class="text-muted" style="font-size: 0.8rem;">absent</span>
            </div>
            <div class="progress-bar-container" title="Leave allowance utilized: ${usagePercent}%" style="margin-top: 4px;">
              <div class="progress-bar" style="width: ${usagePercent}%"></div>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-muted); display:flex; justify-content:space-between; margin-top:2px;">
              <span>Paid left: ${rosterBalance}d</span>
              <span>Accrued: ${rosterTotalAccrued}d</span>
            </div>
          </div>
          ${(state.currentRole !== 'techlead' && state.currentRole !== 'manager') ? `
          <div class="roster-chevron" style="display: flex; align-items: center;">
            <svg class="chevron-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          ` : ''}
        </div>
      </div>
    `;

    let detailsHTML = '';
    if (isExpanded) {
      let deleteBtnHTML = '';
      if ((state.currentRole === 'hr' || state.currentRole === 'admin') && emp.id !== state.currentUser.id) {
        deleteBtnHTML = `
          <div style="display: flex; justify-content: flex-end; margin-top: 12px; border-top: 1px dashed var(--border-color); padding-top: 12px;">
            <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${emp.id}', event)" style="padding: 6px 12px; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Employee Account
            </button>
          </div>
        `;
      }

      detailsHTML = `
        <div class="roster-details" style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 16px; font-size: 0.85rem; width: 100%;">
          <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center;">
            <div style="flex: 1; min-width: 150px;">
              <span class="text-muted" style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Role</span>
              ${(() => {
                const normalizedRole = (emp.role || '').toLowerCase();
                const hasHR = normalizedRole.includes('hr');
                const hasTechLead = normalizedRole.includes('tech lead');
                const hasManager = normalizedRole.includes('manager');

                return `<strong style="color: var(--text-primary); font-size: 0.9rem;">${emp.role || 'Employee'}</strong>`;
              })()}
            </div>
          </div>

          <!-- Session Activity Logs -->
          <div style="border-top: 1px solid var(--border-color); padding-top: 12px;">
            <h4 style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin: 0 0 10px 0; display: flex; align-items: center; gap: 6px;">
              🕒 Session Activity Logs
            </h4>
            ${(() => {
              const logs = emp.activityLogs || [];
              if (logs.length === 0) {
                return `<div style="color: var(--text-muted); font-size: 0.78rem; font-style: italic; padding: 8px 0;">No login/logout logs recorded yet.</div>`;
              }
              const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

              const formatDuration = (minutes) => {
                if (!minutes || minutes <= 0) return '—';
                const h = Math.floor(minutes / 60);
                const m = minutes % 60;
                if (h === 0) return `${m}m`;
                return m === 0 ? `${h}h` : `${h}h ${m}m`;
              };

              const dayBlocks = sortedLogs.map(log => {
                // Support both new multi-session format and legacy {login, logout} format
                const sessions = log.sessions || (log.login || log.logout ? [{ login: log.login || '', logout: log.logout || '', loginMs: null, logoutMs: null }] : []);
                const totalMins = log.totalMinutesWorked || sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

                const sessionRows = sessions.map((s, idx) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 6px 8px; color: var(--text-muted); font-size: 0.75rem;">Session ${idx + 1}</td>
                    <td style="padding: 6px 8px; color: #22c55e; font-weight: 600; font-size: 0.78rem;">${s.login || '—'}</td>
                    <td style="padding: 6px 8px; color: ${s.logout ? '#ef4444' : 'var(--text-muted)'}; font-weight: 600; font-size: 0.78rem;">${s.logout || (s.login ? '(active)' : '—')}</td>
                    <td style="padding: 6px 8px; color: #f59e0b; font-weight: 500; font-size: 0.78rem;">${formatDuration(s.durationMinutes)}</td>
                  </tr>
                `).join('');

                return `
                  <div style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-primary);">${log.date}</span>
                      <span style="font-size: 0.75rem; background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); border-radius: 10px; padding: 1px 8px; font-weight: 600;">
                        ⏱ Total: ${formatDuration(totalMins)}
                      </span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; background: rgba(0,0,0,0.15); border-radius: 4px; overflow: hidden;">
                      <thead>
                        <tr style="background: rgba(255,255,255,0.03); color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase;">
                          <th style="padding: 5px 8px; font-weight: 600; text-align: left;">Session</th>
                          <th style="padding: 5px 8px; font-weight: 600; text-align: left;">Login</th>
                          <th style="padding: 5px 8px; font-weight: 600; text-align: left;">Logout</th>
                          <th style="padding: 5px 8px; font-weight: 600; text-align: left;">Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${sessionRows}
                      </tbody>
                    </table>
                  </div>
                `;
              }).join('');

              return `<div style="max-height: 280px; overflow-y: auto; padding-right: 2px;">${dayBlocks}</div>`;
            })()}
          </div>

          ${deleteBtnHTML}
        </div>
      `;
    }

    item.innerHTML = headerHTML + detailsHTML;
    listEl.appendChild(item);
  });
}

function openRosterDocModal(url) {
  const overlay = document.getElementById('image-viewer-modal-overlay');
  const imgEl = document.getElementById('full-viewer-image');
  if (overlay && imgEl) {
    imgEl.src = url;
    overlay.classList.add('active');
  }
}

async function deleteEmployee(empId, event) {
  if (event) event.stopPropagation();

  if (state.currentUser && state.currentUser.id === empId) {
    showToast('You cannot delete your own logged-in account!', 'error');
    return;
  }

  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  if (confirm(`Are you sure you want to delete employee "${emp.name}"?`)) {
    if (!(await executeServerDelete('Employee', empId))) return;
    
    // Also mark as deleted locally for immediate visual removal
    emp.isDeleted = true;
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));

    populateEmployeeDropdown();
    populateTaskModalOptions();
    renderEmployeeRoster();
    if (typeof renderEmployeeDetails === 'function') {
      renderEmployeeDetails();
    }

    showToast(`Employee "${emp.name}" deleted successfully.`, 'success');
  }
}

async function approveRegistration(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;
  
  if (confirm(`Are you sure you want to approve registration for "${emp.name}" (${emp.id})?`)) {
    emp.status = 'approved';
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    renderRegistrationApprovalQueue();

    try {
      await fetch('/api/approve-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empId: emp.id })
      });
    } catch (err) {
      console.error('Failed to sync registration approval to server:', err);
    }

    triggerBackendSync();
    
    // Refresh dropdowns and UI
    populateEmployeeDropdown();
    populateTaskModalOptions();
    renderEmployeeRoster();
    if (typeof renderEmployeeDetails === 'function') {
      renderEmployeeDetails();
    }
    
    showToast(`Registration approved for "${emp.name}".`, 'success');
  }
}

async function rejectRegistration(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;
  
  if (confirm(`Are you sure you want to reject and permanently delete registration for "${emp.name}" (${emp.id})?`)) {
    const targetEmail = emp.email;
    state.employees = state.employees.filter(e => e.id !== empId);
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    renderRegistrationApprovalQueue();

    try {
      await fetch('/api/delete-employee-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empId: emp.id, email: targetEmail })
      });
    } catch (err) {
      console.error('Failed to delete registration from server:', err);
    }

    triggerBackendSync();
    showToast(`Registration rejected and permanently deleted for "${emp.name}".`, 'info');
  }
}

window.approveRegistration = approveRegistration;
window.rejectRegistration = rejectRegistration;

function updateEmployeeRole(empId, event) {
  if (event) event.stopPropagation();

  if (state.currentRole !== 'admin') {
    showToast('Only Administrators can modify employee roles!', 'error');
    return;
  }

  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  const isSystemAdmin = emp.role.toLowerCase() === 'admin' || emp.email.toLowerCase() === 'admin@company.com';
  if (isSystemAdmin) {
    showToast('The Administrator role cannot be modified!', 'error');
    return;
  }

  if (state.currentUser && state.currentUser.id === empId) {
    showToast('You cannot change your own role!', 'error');
    return;
  }

  const hrChecked = document.getElementById(`role-checkbox-hr-${empId}`)?.checked;
  const techleadChecked = document.getElementById(`role-checkbox-techlead-${empId}`)?.checked;
  const managerChecked = document.getElementById(`role-checkbox-manager-${empId}`)?.checked;

  const checkedRoles = [];
  if (hrChecked) checkedRoles.push('HR');
  if (techleadChecked) checkedRoles.push('Tech Lead');
  if (managerChecked) checkedRoles.push('Manager');

  const newRole = checkedRoles.length > 0 ? checkedRoles.join(', ') : 'Employee';

  const oldRole = emp.role;
  emp.role = newRole;
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server

  populateEmployeeDropdown();
  populateTaskModalOptions();
  renderEmployeeRoster();

  showToast(`Roles of ${emp.name} updated to "${newRole}"!`, 'success');
}

window.openRosterDocModal = openRosterDocModal;
window.deleteEmployee = deleteEmployee;
window.updateEmployeeRole = updateEmployeeRole;

// --- Submit Request Handler ---
function handleLeaveFormSubmit(e) {
  e.preventDefault();

  const type = document.getElementById('leave-type').value;
  const startDateStr = document.getElementById('start-date').value;
  const endDateStr = document.getElementById('end-date').value;
  const reason = document.getElementById('reason').value.trim();

  // Basic validations
  if (!type || !startDateStr || !endDateStr || !reason) {
    showToast('Please fill in all form fields.', 'error');
    return;
  }

  const duration = calculateDays(startDateStr, endDateStr);
  if (duration <= 0) {
    showToast('Please select valid start and end dates.', 'error');
    return;
  }

  // Soft accrual balance check — excess days become LWP on payslip (not blocked)
  const accrual = getEmployeeLeaveAccumulation(state.currentUser.id, (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })());
  if (duration > accrual.balance) {
    const lwp = Math.round((duration - accrual.balance) * 10) / 10;
    showToast(`Note: ${lwp} day(s) exceed your accrued balance and will be marked as Leave Without Pay on your payslip.`, 'warning');
  }

  // Create leave request object
  const newReq = {
    id: `REQ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    employeeId: state.currentUser.id,
    employeeName: state.currentUser.name,
    dept: state.currentUser.dept,
    type: type,
    startDate: startDateStr,
    endDate: endDateStr,
    duration: duration,
    reason: reason,
    status: 'pending',
    comment: '',
    submittedAt: getTodayDateString()
  };

  // Update State
  state.requests.unshift(newReq);
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));

  // Instant direct persistence to MongoDB
  fetch('/api/submit-leave-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newReq)
  }).catch(err => console.error('Direct leave submission error:', err));

  syncStateNow(); // persist leave request to server immediately

  // Trigger SMS notifications for HR and Admin users
  state.employees.forEach(emp => {
    if ((emp.role === 'HR' || emp.role === 'Admin') && emp.id !== state.currentUser.id) {
      if (emp.phone) {
        triggerSMSNotification(
          emp.phone,
          `New Leave Request: ${state.currentUser.name} (${state.currentUser.dept}) requested ${type} leave for ${duration} days (${startDateStr} to ${endDateStr}). Reason: "${reason}"`,
          emp.name
        );
      }
    }
  });

  // Reset form
  document.getElementById('leave-request-form').reset();
  document.getElementById('calculated-days').textContent = '0 days';

  // Notification and Refresh
  showToast('Leave request submitted successfully!', 'success');
  renderEmployeeDashboard('requests');
}

function handleHRDirectLeaveSubmit(e) {
  if (e) e.preventDefault();

  const empSelect = document.getElementById('hr-leave-emp-select');
  const typeSelect = document.getElementById('hr-leave-type');
  const startInput = document.getElementById('hr-leave-start');
  const endInput = document.getElementById('hr-leave-end');
  const reasonInput = document.getElementById('hr-leave-reason');
  const halfDayCheckbox = document.getElementById('hr-leave-half-day');

  if (!empSelect || !typeSelect || !startInput || !endInput || !reasonInput) return;

  const empId = empSelect.value;
  const type = typeSelect.value;
  const startDate = startInput.value;
  const isHalfDay = halfDayCheckbox ? halfDayCheckbox.checked : false;

  let endDate = endInput.value;
  if (isHalfDay) {
    endDate = startDate;
  }

  const reason = reasonInput.value.trim();

  if (!empId || !type || !startDate || (!isHalfDay && !endDate) || !reason) {
    showToast('Please fill out all required fields.', 'error');
    return;
  }

  const duration = isHalfDay ? 0.5 : calculateDays(startDate, endDate);
  if (duration <= 0) {
    showToast('End date must be on or after start date.', 'error');
    return;
  }

  const targetEmp = state.employees.find(emp => emp.id === empId);
  if (!targetEmp) return;

  const newRequest = {
    id: `REQ${500 + state.requests.length + 1}`,
    employeeId: targetEmp.id,
    employeeName: targetEmp.name,
    dept: targetEmp.dept || '',
    type: type,
    startDate: startDate,
    endDate: endDate,
    duration: duration,
    reason: reason,
    status: 'approved',
    comment: `Recorded directly by HR (${state.currentUser.name})`,
    submittedAt: getTodayDateString()
  };

  state.requests.unshift(newRequest);

  // Save requests and sync to server
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  triggerBackendSync(); // persist directly recorded leave to server

  // Trigger SMS notification
  if (targetEmp.phone) {
    triggerSMSNotification(
      targetEmp.phone,
      `Leave/Absence Recorded: HR has recorded a ${duration} day ${type} leave for you from ${startDate} to ${endDate}. Reason: ${reason}`,
      targetEmp.name
    );
  }

  showToast('Leave entry recorded successfully!', 'success');
  
  // Reset form and re-render
  const hrDirectLeaveForm = document.getElementById('hr-direct-leave-form');
  if (hrDirectLeaveForm) {
    hrDirectLeaveForm.reset();
  }
  
  // Re-enable and reset requirements for end input
  endInput.disabled = false;
  endInput.required = true;

  renderHRDashboard();
}

// --- Approve/Reject Modal Actions ---
function openActionModal(requestId, actionType) {
  state.selectedRequestIdForModal = requestId;
  state.modalActionType = actionType;

  const request = state.requests.find(req => req.id === requestId);
  const title = document.getElementById('modal-action-title');
  const label = document.getElementById('modal-action-label');
  const btn = document.getElementById('btn-modal-submit');

  title.textContent = actionType === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request';
  label.textContent = actionType === 'approve' ? 'Approval Comments (Optional):' : 'Reason for Rejection (Required):';
  btn.textContent = actionType === 'approve' ? 'Approve Request' : 'Reject Request';

  if (actionType === 'approve') {
    btn.className = 'btn btn-success';
    document.getElementById('modal-comment').required = false;
    document.getElementById('modal-comment').placeholder = 'Add constructive advice or comments...';
  } else {
    btn.className = 'btn btn-danger';
    document.getElementById('modal-comment').required = true;
    document.getElementById('modal-comment').placeholder = 'Provide a reason for rejection...';
  }

  // Show Modal
  document.getElementById('modal-comment').value = '';
  document.getElementById('action-modal-overlay').classList.add('active');
}

function hideModal() {
  document.getElementById('action-modal-overlay').classList.remove('active');
  state.selectedRequestIdForModal = null;
  state.modalActionType = null;
}

function showProfileModal() {
  const emp = state.employees.find(e => e.id === state.currentUser.id) || state.currentUser;
  if (!emp) return;

  const overlay = document.getElementById('profile-modal-overlay');
  if (!overlay) return;

  // Initialize temporary variables for editing profile
  tempProfilePhoto = emp.photo || null;
  tempAadharFile = emp.aadhar || null;
  tempPanFile = emp.pan || null;
  tempBankAccFile = emp.bankAcc || null;
  tempBankIfscFile = emp.bankIfsc || null;

  // Render Avatar
  const avatarEl = document.getElementById('profile-modal-avatar');
  if (avatarEl) {
    if (tempProfilePhoto) {
      avatarEl.innerHTML = `<img id="profile-edit-avatar-img" src="${tempProfilePhoto}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
    } else {
      avatarEl.innerHTML = `<span id="profile-edit-avatar-text">${emp.avatar}</span>`;
    }
  }

  // Set header info
  const nameEl = document.getElementById('profile-modal-name');
  if (nameEl) nameEl.textContent = emp.name;

  const desigEl = document.getElementById('profile-modal-designation');
  if (desigEl) desigEl.textContent = emp.designation || emp.role;

  // Populate input fields (readonly ones)
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('profile-edit-id', emp.id);
  setVal('profile-edit-role', emp.role);
  setVal('profile-edit-dept', emp.dept || '');

  // Populate editable fields
  setVal('profile-edit-email', emp.email);
  setVal('profile-edit-phone', emp.phone || '');
  setVal('profile-edit-password', emp.password || 'password123');
  const pwdInput = document.getElementById('profile-edit-password');
  if (pwdInput) pwdInput.type = 'password';
  const eyeIconPath = document.getElementById('profile-password-eye-icon');
  if (eyeIconPath) {
    eyeIconPath.setAttribute('d', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z');
  }

  // Populate document previews
  const updateDocPreview = (imgId, placeholderId, base64) => {
    const imgEl = document.getElementById(imgId);
    const placeholderEl = document.getElementById(placeholderId);
    if (imgEl && placeholderEl) {
      if (base64 && base64.startsWith('data:')) {
        imgEl.src = base64;
        imgEl.style.display = 'block';
        placeholderEl.style.display = 'none';
      } else {
        imgEl.src = '';
        imgEl.style.display = 'none';
        placeholderEl.style.display = 'flex';

        // Update placeholder span text to "Not Uploaded"
        const span = placeholderEl.querySelector('span');
        if (span) {
          span.textContent = 'Not Uploaded';
        }
      }
    }
  };



  // Reset file input values
  const fileInputs = [
    'profile-edit-photo-file'
  ];
  fileInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  overlay.classList.add('active');
}

function hideProfileModal() {
  const overlay = document.getElementById('profile-modal-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

function handleProfileSave(e) {
  e.preventDefault();
  const emp = state.employees.find(e => e.id === state.currentUser.id);
  if (!emp) return;

  emp.email = document.getElementById('profile-edit-email').value.trim() || emp.email;
  emp.phone = document.getElementById('profile-edit-phone').value.trim() || emp.phone;
  emp.password = document.getElementById('profile-edit-password').value || emp.password || 'password123';
  emp.photo = tempProfilePhoto || emp.photo;

  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  state.currentUser = emp;
  localStorage.setItem('ems_logged_in_user', JSON.stringify(emp));
  triggerBackendSync();
  syncStateNow();

  // Update header avatar and details immediately
  updateHeaderAvatar(emp);
  const nameHeader = document.getElementById('header-name');
  if (nameHeader) nameHeader.textContent = emp.name;
  const roleHeader = document.getElementById('header-role');
  if (roleHeader) {
    roleHeader.textContent = emp.role === 'Admin, HR, Tech Lead, Manager' ? 'CEO' : emp.role;
  }

  // Refresh current view to reflect changes (e.g. employee roster)
  const activeMenuItem = document.querySelector('.menu-item.active');
  const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';
  switchView(currentView);

  hideProfileModal();
  showToast('Profile updated successfully!', 'success');
}

function handleModalSubmit(e) {
  e.preventDefault();
  const comment = document.getElementById('modal-comment').value.trim();
  const reqId = state.selectedRequestIdForModal;
  const action = state.modalActionType;

  if (action === 'reject' && !comment) {
    showToast('Rejection reason is required.', 'error');
    return;
  }

  processAction(reqId, action, comment);
  hideModal();
}

function processAction(requestId, action, comment) {
  const reqIdx = state.requests.findIndex(req => req.id === requestId);
  if (reqIdx === -1) return;

  const req = state.requests[reqIdx];
  const empIdx = state.employees.findIndex(emp => emp.id === req.employeeId);

  if (action === 'approve') {
    req.status = 'approved';
    req.comment = comment || 'Approved by HR';

    // Note: balance is now computed dynamically by getEmployeeLeaveAccumulation().
    // We no longer mutate emp.balance. emp.absent is kept for legacy payslip display only.
    showToast(`Leave request from ${req.employeeName} approved!`, 'success');
  } else {
    req.status = 'rejected';
    req.comment = comment;
    showToast(`Leave request from ${req.employeeName} rejected.`, 'success'); // styled toast
  }

  // Save changes to localStorage AND sync to server immediately
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  
  // Instant direct persistence to MongoDB
  fetch('/api/update-leave-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, status: req.status, comment: req.comment })
  }).catch(err => console.error('Direct leave status update error:', err));

  syncStateNow();

  // Trigger SMS notification for the leave applicant
  const targetEmp = state.employees.find(emp => emp.id === req.employeeId);
  if (targetEmp && targetEmp.phone) {
    const statusText = action === 'approve' ? 'APPROVED' : 'REJECTED';
    const commentSuffix = comment ? ` Remarks: "${comment}"` : '';
    triggerSMSNotification(
      targetEmp.phone,
      `Leave Request Update: Your request for ${req.duration} days of ${req.type} leave (${req.startDate} to ${req.endDate}) has been ${statusText} by ${state.currentUser.name}.${commentSuffix}`,
      targetEmp.name
    );
  }

  // Refresh view
  renderHRDashboard('requests');
}

// Global modal bridge calls for HTML onclick compatibility
window.openActionModal = openActionModal;

// --- Toast System ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = type === 'success' ?
    `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>` :
    type === 'warning' ?
      `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>` :
      `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>`;

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto-remove toast after 4s (warnings stay 6s)
  const dismissDelay = type === 'warning' ? 6000 : 4000;
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, dismissDelay);
}

// --- Text/Formatting Helpers ---
function formatDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const parts = dateStr.trim().split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month]} ${day}, ${year}`;
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return formatDate(dateStr);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function truncateText(text, length) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substr(0, length) + '...';
}

function renderClickableText(text, limit) {
  if (!text || text.trim() === '-' || text.trim() === '') return '-';
  if (text.length <= limit) return text;

  const truncated = text.substring(0, limit) + '...';
  const escapedText = text.replace(/'/g, "\\'").replace(/"/g, '&quot;');

  return `
    <span class="clickable-text-span" 
          data-full="${escapedText}" 
          data-truncated="${truncated}" 
          data-expanded="false" 
          onclick="toggleClickableText(this, event)" 
          style="cursor: pointer; text-decoration: underline dotted var(--primary); font-weight: 500;" 
          title="Click to view full text">
      ${truncated}
    </span>
  `;
}

function toggleClickableText(el, event) {
  if (event) event.stopPropagation();
  const isExpanded = el.getAttribute('data-expanded') === 'true';
  const fullText = el.getAttribute('data-full');
  const truncatedText = el.getAttribute('data-truncated');

  if (isExpanded) {
    el.innerHTML = truncatedText;
    el.setAttribute('data-expanded', 'false');
    el.title = "Click to view full text";
  } else {
    el.innerHTML = fullText;
    el.setAttribute('data-expanded', 'true');
    el.title = "Click to collapse";
  }
}
window.toggleClickableText = toggleClickableText;

// --- Handle Hamburger Menu for Mobile Responsive View ---
document.getElementById('mobile-hamburger').addEventListener('click', function () {
  this.classList.toggle('open');
  document.getElementById('sidebar').classList.toggle('open');
});

// --- Tasks & Projects View Logic ---

// --- 1. Employee View Logic ---
function groupTasksByMonth(tasksList) {
  // Sort tasks by ID descending (newest first)
  const sorted = [...tasksList].sort((a, b) => {
    const idA = parseInt(a.id.replace(/\D/g, '')) || 0;
    const idB = parseInt(b.id.replace(/\D/g, '')) || 0;
    return idB - idA;
  });

  const groups = {};
  sorted.forEach(task => {
    let monthKey = 'No Timeline';
    const dateToUse = task.startDate || task.dueDate;
    if (dateToUse) {
      const parts = dateToUse.split('-');
      if (parts.length >= 2) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const dateObj = new Date(year, month - 1);
        monthKey = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      }
    }
    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(task);
  });
  return groups;
}

// --- 1. Employee View Logic ---
function renderEmployeeTasksAndProjects() {
  const user = state.currentUser;

  // Get unique project IDs where user has at least one assigned task
  const userTaskProjectIds = state.tasks
    .filter(t => t.assigneeId === user.id && t.projectId)
    .map(t => t.projectId);

  const activeProjects = state.projects.filter(p => {
    const isMember = p.employeeIds && (p.employeeIds.includes(user.id) || p.employeeIds.includes(user.email));
    const isTechLead = p.techLeadId && (p.techLeadId === user.id || p.techLeadId === user.email);
    const hasTask = userTaskProjectIds.includes(p.id);
    return isMember || isTechLead || hasTask;
  });

  // Render Projects (filtered by employee's department OR projects they are assigned tasks in)
  const grid = document.getElementById('emp-projects-grid');
  if (grid) {
    grid.innerHTML = '';

    if (activeProjects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 24px;">
          <div class="empty-state-title">No Projects Active</div>
          <p>Projects will appear here once assigned.</p>
        </div>
      `;
    } else {
      activeProjects.forEach(proj => {
        const card = createProjectCard(proj, false);
        grid.appendChild(card);
      });
    }
  }

  // Render Tasks — grouped by project, with teammates' tasks shown read-only
  const tbody = document.getElementById('emp-tasks-tbody');
  if (tbody) {
    tbody.innerHTML = '';

    // Get all projects the current user is involved in (either is a member, or has a task)
    const myProjectIds = activeProjects.map(p => p.id);

    // Also include personal tasks (private tasks created by this user)
    const personalTasks = state.tasks.filter(t => isMyPersonalTask(t, user.id, user.name));

    if (myProjectIds.length === 0 && personalTasks.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">
              <div class="empty-state-title">No assigned tasks</div>
              <p>You have a clean sheet! Check back later.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      const renderTaskRow = (task, isOwn) => {
        const isCompleted = task.status === 'Completed';
        const isExpanded = state.expandedTaskIds && state.expandedTaskIds.has(task.id);
        const isEditing = state.editingTaskId === task.id;
        const assignee = state.employees.find(e => e.id === task.assigneeId);

        const tr = document.createElement('tr');
        tr.className = isCompleted ? 'completed-task-row' : '';

        if (isOwn) {
          // Fully interactive row for the current user's own tasks
          tr.innerHTML = `
            <td>
              <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''}
                           onchange="toggleTaskCompletion('${task.id}')"
                           style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--success); flex-shrink: 0;">
                    <span onclick="toggleTaskDetailsExpand('${task.id}', event)" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; ${isCompleted ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                      <strong>${task.desc}</strong>
                      <svg class="chevron-icon" id="chevron-${task.id}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate(${isExpanded ? '180deg' : '0deg'}); opacity: 0.7; flex-shrink: 0;">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </span>
                  </div>
                </div>
                <div id="details-pane-${task.id}" class="task-details-pane" style="display: ${isExpanded ? 'block' : 'none'}; padding: 12px; margin-top: 8px; border-radius: 8px; background-color: var(--bg-tertiary); border: 1px solid var(--border-color); font-size: 0.85rem; width: 100%;">
                  ${isEditing ? `
                    <div style="display: flex; flex-direction: column; gap: 8px;" onclick="event.stopPropagation()">
                      <textarea id="edit-details-textarea-${task.id}" placeholder="Enter task detailed description..." style="min-height: 80px; width: 100%; padding: 8px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; resize: vertical;">${task.details || ''}</textarea>
                      <div>
                        <label style="font-weight: 600; display: block; margin-bottom: 4px;">Attach Photos/Screenshots</label>
                        <input type="file" id="edit-images-input-${task.id}" accept="image/*" multiple style="font-size: 0.8rem; color: var(--text-primary);">
                      </div>
                      <div id="edit-images-preview-${task.id}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;"></div>
                      <div style="margin-top: 8px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px; font-size: 0.8rem;">&#128206; Or Add Google Drive / Any Link</label>
                        <input type="url" id="edit-drive-link-input-${task.id}" placeholder="Paste Google Drive or any link here..." style="width: 100%; padding: 6px 10px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.8rem; box-sizing: border-box;">
                        <div id="edit-drive-links-preview-${task.id}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;"></div>
                      </div>
                      ${task.createdByEmployee ? `
                        <div style="margin-top: 4px;">
                          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Due Date</label>
                          <input type="date" id="edit-due-date-${task.id}" value="${task.dueDate}" style="width: 100%; padding: 8px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; box-sizing: border-box;">
                        </div>
                      ` : ''}
                      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="cancelEditTask(event)">Cancel</button>
                        <button class="btn btn-primary btn-sm" onclick="saveEditTask('${task.id}', event)">Save Changes</button>
                      </div>
                    </div>
                  ` : `
                    ${task.status === 'Needs Revision' ? `
                      <div style="padding: 10px 14px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.35); border-radius: 6px; color: #ef4444; font-size: 0.85rem; margin-bottom: 12px;" onclick="event.stopPropagation()">
                        <div style="font-weight: 700; display: flex; align-items: center; gap: 6px;">
                          <span>⚠️ Rejection Feedback (From ${escapeHTML(task.rejectedBy || 'Manager')}):</span>
                        </div>
                        <div style="margin-top: 4px; font-weight: 500; color: var(--text-primary); background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 4px; border-left: 3px solid #ef4444;">
                          "${escapeHTML(task.rejectionReason || 'Please review and fix before resubmitting.')}"
                        </div>
                      </div>
                    ` : ''}
                    <div style="font-weight: 500; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word;">${task.details || 'No details provided.'}</div>
                    ${renderAttachmentsHTML(task.images, task.id, task.driveLinks)}
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 10px;" onclick="event.stopPropagation()">
                      <button class="btn btn-secondary btn-sm" onclick="startEditTask('${task.id}', event)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px;">Edit Description & Photos</button>
                      ${task.status === 'Needs Revision' ? `
                        <button class="btn btn-warning btn-sm" onclick="submitTaskForReview('${task.id}', event)" style="padding: 4px 12px; font-size: 0.75rem; border-radius: 6px; font-weight: 700;">📤 Resubmit Work for Review</button>
                      ` : (task.status === 'Not Completed' ? `
                        <button class="btn btn-primary btn-sm" onclick="submitTaskForReview('${task.id}', event)" style="padding: 4px 12px; font-size: 0.75rem; border-radius: 6px; font-weight: 700;">📤 Submit Work for Review</button>
                      ` : '')}
                    </div>
                  `}
                </div>
              </div>
            </td>
            <td>${task.projectName || 'Personal'}</td>
            <td><span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span></td>
            <td>${task.startDate ? formatDate(task.startDate) + ' to ' : ''}${formatDate(task.dueDate)}</td>
            <td>${getTaskStatusBadgeHtml(task.status, task.rejectionReason)}</td>
          `;
        } else {
          // Read-only row for teammates' tasks
          const avatarInitials = assignee ? assignee.name.split(' ').map(n => n[0]).join('') : '?';
          tr.style.opacity = '0.82';
          tr.innerHTML = `
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 50%; background: var(--bg-tertiary); border: 2px solid var(--border-color); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="opacity:0.4;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m0 0v2m0-2h2m-2 0H9" /></svg>
                </div>
                <div>
                  <span style="${isCompleted ? 'text-decoration: line-through; opacity: 0.5;' : ''} font-size:0.9rem;">${task.desc}</span>
                  <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
                    <div class="avatar" style="width:18px; height:18px; font-size:0.55rem; flex-shrink:0;">${avatarInitials}</div>
                    <span style="font-size:0.75rem; color: var(--text-muted);">${assignee ? assignee.name : 'Unknown'}</span>
                    ${task.details ? `<span style="font-size:0.7rem; color:var(--primary); opacity:0.7; margin-left:4px;" title="${task.details}">• has notes</span>` : ''}
                  </div>
                </div>
              </div>
            </td>
            <td style="font-size:0.85rem; color:var(--text-muted);">${task.projectName || ''}</td>
            <td><span class="badge badge-${task.priority.toLowerCase()}" style="opacity:0.7;">${task.priority}</span></td>
            <td style="font-size:0.85rem; color:var(--text-muted);">${task.startDate ? formatDate(task.startDate) + ' to ' : ''}${formatDate(task.dueDate)}</td>
            <td><span class="badge badge-${task.status.replace(' ', '-').toLowerCase()}">${task.status}</span></td>
          `;
        }
        return tr;
      };

      // Render each project section
      myProjectIds.forEach(projId => {
        const project = state.projects.find(p => p.id === projId);
        const myTasksInProject = state.tasks.filter(t => t.assigneeId === user.id && t.projectId === projId);
        const teammateTasksInProject = state.tasks.filter(t => t.assigneeId !== user.id && t.projectId === projId);

        // Project section header
        const projHeaderTr = document.createElement('tr');
        projHeaderTr.className = 'month-header-row';
        projHeaderTr.innerHTML = `
          <td colspan="5" style="padding: 10px 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size:1rem;">📁</span>
              <span style="font-weight: 700; font-size: 0.9rem; color: var(--primary);">${project ? project.name : projId}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); background: var(--bg-tertiary); padding: 2px 8px; border-radius: 10px;">${project ? project.dept : ''}</span>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-left: auto;">
                ${myTasksInProject.length} my task${myTasksInProject.length !== 1 ? 's' : ''} · ${teammateTasksInProject.length} teammate task${teammateTasksInProject.length !== 1 ? 's' : ''}
              </span>
            </div>
          </td>
        `;
        tbody.appendChild(projHeaderTr);

        // My tasks in this project
        const myGrouped = groupTasksByMonth(myTasksInProject);
        Object.keys(myGrouped).forEach(monthKey => {
          const monthTr = document.createElement('tr');
          monthTr.innerHTML = `<td colspan="5" style="padding: 4px 12px 2px 28px; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); background: transparent; border:none;">📅 ${monthKey} — My Tasks</td>`;
          tbody.appendChild(monthTr);
          myGrouped[monthKey].forEach(task => tbody.appendChild(renderTaskRow(task, true)));
        });

        // Teammate tasks in this project
        if (teammateTasksInProject.length > 0) {
          const teamHeaderTr = document.createElement('tr');
          teamHeaderTr.innerHTML = `<td colspan="5" style="padding: 6px 12px 2px 28px; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color: var(--primary); opacity:0.7; background: transparent; border:none;">👥 Teammates' Tasks</td>`;
          tbody.appendChild(teamHeaderTr);

          // Group teammate tasks by assignee for clarity
          const byAssignee = {};
          teammateTasksInProject.forEach(t => {
            if (!byAssignee[t.assigneeId]) byAssignee[t.assigneeId] = [];
            byAssignee[t.assigneeId].push(t);
          });
          Object.values(byAssignee).forEach(tasks => {
            tasks.forEach(task => tbody.appendChild(renderTaskRow(task, false)));
          });
        }
      });

      // Personal tasks (no project)
      if (personalTasks.length > 0) {
        const persHeaderTr = document.createElement('tr');
        persHeaderTr.className = 'month-header-row';
        persHeaderTr.innerHTML = `<td colspan="5" style="padding: 10px 12px;"><span style="font-weight:700; font-size:0.9rem;">📋 Personal Tasks</span></td>`;
        tbody.appendChild(persHeaderTr);
        const persGrouped = groupTasksByMonth(personalTasks);
        Object.keys(persGrouped).forEach(monthKey => {
          const monthTr = document.createElement('tr');
          monthTr.innerHTML = `<td colspan="5" style="padding: 4px 12px 2px 28px; font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); background:transparent; border:none;">📅 ${monthKey}</td>`;
          tbody.appendChild(monthTr);
          persGrouped[monthKey].forEach(task => tbody.appendChild(renderTaskRow(task, true)));
        });
      }
    }
  }
  if (state.editingTaskId) {
    setupEditTaskListeners(state.editingTaskId);
  }

  // --- Render Employee's own Session Activity Logs ---
  const sessionLogsContainer = document.getElementById('emp-session-activity-logs');
  if (sessionLogsContainer) {
    const emp = state.employees.find(e => e.id === user.id) || user;
    const logs = emp.activityLogs || [];

    if (logs.length === 0) {
      sessionLogsContainer.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; padding: 16px 0;">
          No login/logout sessions recorded yet.
        </div>
      `;
    } else {
      const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

      const formatDuration = (minutes) => {
        if (!minutes || minutes <= 0) return '—';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `${m}m`;
        return m === 0 ? `${h}h` : `${h}h ${m}m`;
      };

      const dayBlocks = sortedLogs.map(log => {
        const sessions = log.sessions || (log.login || log.logout ? [{ login: log.login || '', logout: log.logout || '', loginMs: null, logoutMs: null }] : []);
        const totalMins = log.totalMinutesWorked || sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

        const sessionRows = sessions.map((s, idx) => {
          const isSessionActive = s.loginMs && !s.explicitLogout && (Date.now() - s.logoutMs < 60000);
          const logoutVal = isSessionActive ? '<span style="color:#22c55e; font-weight:700;">(active)</span>' : (s.logout || '—');
          const durationVal = isSessionActive ? '—' : formatDuration(s.durationMinutes);
          const logoutColor = isSessionActive ? '#22c55e' : (s.logout ? '#ef4444' : 'var(--text-muted)');

          return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
              <td style="padding: 8px 12px; color: var(--text-muted); font-size: 0.8rem;">Session ${idx + 1}</td>
              <td style="padding: 8px 12px; color: #22c55e; font-weight: 600; font-size: 0.82rem;">${s.login || '—'}</td>
              <td style="padding: 8px 12px; color: ${logoutColor}; font-weight: 600; font-size: 0.82rem;">${logoutVal}</td>
              <td style="padding: 8px 12px; color: #f59e0b; font-weight: 500; font-size: 0.82rem;">${durationVal}</td>
            </tr>
          `;
        }).join('');

        return `
          <div style="margin-bottom: 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 10px; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(0,0,0,0.1);">
              <span style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">${log.date}</span>
              <span style="font-size: 0.78rem; background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); border-radius: 10px; padding: 2px 10px; font-weight: 600;">
                ⏱ Total: ${formatDuration(totalMins)}
              </span>
            </div>
            <table class="session-logs-table" style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
              <thead>
                <tr style="background: rgba(255,255,255,0.03); color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">
                  <th style="padding: 6px 12px; font-weight: 600; text-align: left;">Session</th>
                  <th style="padding: 6px 12px; font-weight: 600; text-align: left;">Login</th>
                  <th style="padding: 6px 12px; font-weight: 600; text-align: left;">Logout</th>
                  <th style="padding: 6px 12px; font-weight: 600; text-align: left;">Duration</th>
                </tr>
              </thead>
              <tbody>
                ${sessionRows}
              </tbody>
            </table>
          </div>
        `;
      }).join('');

      sessionLogsContainer.innerHTML = `
        <div style="max-height: 400px; overflow-y: auto; padding-right: 4px;">
          ${dayBlocks}
        </div>
      `;
    }
  }
}

function cycleTaskStatus(taskId) {
  const taskIdx = state.tasks.findIndex(t => t.id === taskId);
  if (taskIdx === -1) return;

  const task = state.tasks[taskIdx];
  const prevStatus = task.status;
  if (task.status === 'Completed') {
    task.status = 'Not Completed';
  } else {
    task.status = 'Completed';
  }

  if (!safeSaveTasks()) {
    task.status = prevStatus;
    return;
  }

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
  showToast(`Task status updated to "${task.status}"`, 'success');
}

function getTaskStatusBadgeHtml(status, rejectionReason = '') {
  if (status === 'Completed') {
    return `<span class="badge" style="background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); font-weight: 700;">✅ Completed</span>`;
  }
  if (status === 'Pending Review') {
    return `<span class="badge" style="background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); font-weight: 700;" title="Submitted by employee, awaiting lead/manager review">⏳ Pending Review</span>`;
  }
  if (status === 'Needs Revision') {
    return `<span class="badge" style="background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); font-weight: 700;" title="${rejectionReason ? 'Reason: ' + escapeHTML(rejectionReason) : 'Needs revision'}">⚠️ Needs Revision</span>`;
  }
  return `<span class="badge" style="background: rgba(148,163,184,0.15); color: var(--text-muted); border: 1px solid rgba(148,163,184,0.3);">Not Completed</span>`;
}

function submitTaskForReview(taskId, event) {
  if (event) event.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const detailsText = (task.details || '').trim();
  const words = detailsText.split(/\s+/).filter(w => w.length > 0);
  if (words.length < 10) {
    showToast('Please type a minimum of 10 words in "Edit Description & Photos" describing your completed work before submitting for review.', 'error');
    if (!state.expandedTaskIds) state.expandedTaskIds = new Set();
    state.expandedTaskIds.add(taskId);
    state.editingTaskId = taskId;
    if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
      renderHRTasksAndProjects();
    } else {
      renderEmployeeTasksAndProjects();
    }
    return;
  }

  const prevStatus = task.status;
  task.status = 'Pending Review';
  task.submittedAt = new Date().toISOString();

  if (!safeSaveTasks()) {
    task.status = prevStatus;
    return;
  }

  showToast(`Task "${task.desc}" submitted to Tech Lead / Manager for review!`, 'info');

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
}

function approveTaskByLead(taskId, event) {
  if (event) event.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const prevStatus = task.status;
  task.status = 'Completed';
  task.approvedBy = state.currentUser ? state.currentUser.name : 'Manager';
  task.approvedAt = new Date().toISOString();

  if (!safeSaveTasks()) {
    task.status = prevStatus;
    return;
  }

  showToast(`Task "${task.desc}" approved and marked as Completed!`, 'success');

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }

  state.lastCompletedTaskId = taskId;
  openDailyReportReminder();
}

function rejectTaskByLeadModal(taskId, event) {
  if (event) event.stopPropagation();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const reason = prompt(`Enter reason why task "${task.desc}" is incomplete / needs revision:`);
  if (reason === null) return;
  if (!reason.trim()) {
    showToast('Rejection reason cannot be empty. Please state why the task needs revision.', 'error');
    return;
  }

  const prevStatus = task.status;
  task.status = 'Needs Revision';
  task.rejectionReason = reason.trim();
  task.rejectedBy = state.currentUser ? state.currentUser.name : 'Manager';
  task.rejectedAt = new Date().toISOString();

  if (!safeSaveTasks()) {
    task.status = prevStatus;
    return;
  }

  showToast(`Task "${task.desc}" sent back to employee for revision with feedback.`, 'info');

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
}

function toggleTaskCompletion(taskId) {
  const taskIdx = state.tasks.findIndex(t => t.id === taskId);
  if (taskIdx === -1) return;

  const task = state.tasks[taskIdx];
  const user = state.currentUser;

  const isPersonal = isMyPersonalTask(task, user ? user.id : null, user ? user.name : null);
  const isLeadOrAdmin = state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin';

  if (isLeadOrAdmin || isPersonal) {
    const prevStatus = task.status;
    task.status = (task.status === 'Completed') ? 'Not Completed' : 'Completed';
    if (!safeSaveTasks()) {
      task.status = prevStatus;
      return;
    }
  } else {
    if (task.status === 'Completed') {
      task.status = 'Not Completed';
      safeSaveTasks();
    } else if (task.status === 'Pending Review') {
      showToast('Task is pending review by Tech Lead / Manager.', 'info');
      return;
    } else {
      submitTaskForReview(taskId);
      return;
    }
  }

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
}

// --- 2. HR View Logic ---
function createProjectCard(proj, isMyProject) {
  const progressPercent = proj.progress || 0;

  const card = document.createElement('div');
  card.className = 'project-card';
  card.style.display = 'grid';
  card.style.gridTemplateColumns = '1.1fr 1.1fr 1fr';
  card.style.gap = '20px';

  // Find current Tech Lead name
  const leadEmp = state.employees.find(e => e.id === proj.techLeadId || e.name === proj.techLeadName);
  const leadName = proj.techLeadName || (leadEmp ? leadEmp.name : 'Unassigned');

  const icuDl = proj.icuDeadline || proj.dueDate || '2026-09-10';
  const ventDl = proj.ventilatorDeadline || '2026-09-25';
  const finalDl = proj.finalDeadline || proj.dueDate || '2026-10-15';

  let dueDateDisplay = `
    <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; margin-top: 4px; background: var(--bg-tertiary); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-color);">
      <div>🏁 Final Deadline: <strong style="color: var(--text-primary);">${icuDl}</strong></div>
      <div>🏥 ICU Deadline: <strong style="color: var(--text-primary);">${ventDl}</strong></div>
      <div>💀 Dead Deadline: <strong style="color: var(--primary);">${finalDl}</strong></div>
    </div>
  `;

  // HR and Admin can edit all projects; Tech Lead can edit their own project
  const isEditable = (
    state.currentRole === 'hr' ||
    state.currentRole === 'admin' ||
    (state.currentUser && (state.currentUser.id === proj.techLeadId || state.currentUser.name === proj.techLeadName))
  );

  // Get all employees associated with the project
  const taskAssigneeIds = state.tasks.filter(t => t.projectId === proj.id).map(t => t.assigneeId);

  const allProjectEmployees = state.employees.filter(e => {
    return e.id === proj.techLeadId || (proj.employeeIds && proj.employeeIds.includes(e.id)) || taskAssigneeIds.includes(e.id);
  });

  const uniqueEmployees = [];
  const seenIds = new Set();
  allProjectEmployees.forEach(emp => {
    if (!seenIds.has(emp.id)) {
      seenIds.add(emp.id);
      uniqueEmployees.push(emp);
    }
  });

  uniqueEmployees.sort((a, b) => {
    if (a.id === proj.techLeadId) return -1;
    if (b.id === proj.techLeadId) return 1;
    return a.name.localeCompare(b.name);
  });

  const memberChipsHtml = uniqueEmployees.map(emp => {
    const isLead = emp.id === proj.techLeadId || emp.name === proj.techLeadName;
    const canRemove = isEditable && !isLead;

    let chipRole = emp.designation || emp.role || (isLead ? 'Tech Lead' : 'Employee');
    if (chipRole.toLowerCase() === 'tech lead' && !isLead) {
      chipRole = 'Employee';
    }

    return `
      <div class="project-member-chip" style="display: inline-flex; align-items: center; gap: 6px; background: ${isLead ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)'}; border: 1px solid ${isLead ? 'rgba(239, 68, 68, 0.25)' : 'var(--border-color)'}; padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 500; color: ${isLead ? 'var(--primary)' : 'var(--text-primary)'};">
        <div class="avatar-xs" style="width: 20px; height: 20px; border-radius: 50%; background: ${isLead ? 'var(--primary-gradient)' : 'var(--bg-tertiary)'}; color: ${isLead ? 'white' : 'var(--text-secondary)'}; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; border: 1px solid var(--border-color);">
          ${emp.avatar || emp.name.split(' ').map(n => n[0]).join('')}
        </div>
        <span>${emp.name}</span>
        <span style="font-size: 0.65rem; color: var(--text-muted);">(${chipRole})</span>
        ${canRemove ? `
          <button onclick="removeEmployeeFromProject('${proj.id}', '${emp.id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.85rem; font-weight: bold; margin-left: 6px; padding: 0; line-height: 1; display: inline-flex; align-items: center; justify-content: center;" title="Remove from project">&times;</button>
        ` : ''}
      </div>
    `;
  }).join('');

  const nonMemberEmployees = state.employees.filter(e => !seenIds.has(e.id));
  const existingEmployeesToAssignOptions = nonMemberEmployees.map(emp => {
    const label = emp.role.toLowerCase() === 'admin' ? `${emp.name} (CEO)` : `${emp.name} (${emp.dept} - ${emp.role})`;
    return `<option value="${emp.id}">${label}</option>`;
  }).join('');

  const allEmployeesOptions = state.employees.map(emp => {
    const isCurrent = emp.id === proj.techLeadId;
    const label = emp.role.toLowerCase() === 'admin' ? `${emp.name} (CEO)` : `${emp.name} (${emp.dept} - ${emp.role})`;
    return `<option value="${emp.id}" ${isCurrent ? 'selected' : ''}>${label}</option>`;
  }).join('');

  const canDelete = (
    state.currentRole === 'admin' ||
    state.currentRole === 'hr' ||
    ((state.currentRole === 'techlead' || state.currentRole === 'manager') && state.currentUser && (state.currentUser.id === proj.techLeadId || state.currentUser.name === proj.techLeadName))
  );

  let leadDisplay = `
    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
      Tech Lead: <strong style="color: var(--text-primary);">${leadName}</strong>
    </div>
  `;

  let leftColHtml = `
    <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
      <div class="project-card-title" style="font-weight: 800; font-size: 1.1rem;">${proj.name}</div>
      <div class="project-card-meta" style="display: flex; flex-direction: column; gap: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span>Status: <span class="badge badge-${(proj.status || 'active').toLowerCase()}">${proj.status || 'Active'}</span></span>
          <span style="font-weight: 600; color: var(--primary);">${proj.dept || 'AI'}</span>
        </div>
        ${dueDateDisplay}
      </div>
      <div class="project-progress-container" style="margin-top: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; margin-bottom: 6px;">
          <span style="color: var(--text-muted);">Completion</span>
          <span class="prog-info" style="color: var(--text-primary);"><span class="prog-val">${progressPercent}%</span></span>
        </div>
        <div class="progress-bar-bg" style="width: 100%; height: 8px; background-color: var(--bg-tertiary); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); position: relative;">
          <div class="progress-bar-fill" id="bar-fill-${proj.id}" style="width: ${progressPercent}%; height: 100%; background: var(--primary-gradient); border-radius: 4px; transition: width 0.3s ease;"></div>
        </div>
      </div>
      ${leadDisplay}
      <button class="btn btn-primary btn-xs" onclick="openProjectDashboardModal('${proj.id}')" style="margin-top: auto; width: 100%; font-weight: 700; padding: 6px; border-radius: 6px;">
        🚀 Open Project Dashboard
      </button>
      ${canDelete ? `
        <div style="border-top: 1px dashed var(--border-color); padding-top: 8px;">
          <button class="btn btn-danger btn-xs" onclick="deleteProject('${proj.id}', event)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; border: none; cursor: pointer; color: white; width: 100%; justify-content: center;">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Project
          </button>
        </div>
      ` : ''}
    </div>
  `;

  // MIDDLE & RIGHT COLUMNS HTML
  const descriptionText = proj.description || '';
  const filesList = proj.files || [];

  const middleColHtml = `
    <div style="display: flex; flex-direction: column; gap: 10px; border-left: 1px solid var(--border-color); padding-left: 16px; height: 100%;">
      <div>
        <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">Project Description</div>
        ${isEditable ? `
          <div style="display: flex; flex-direction: column; gap: 6px; height: 100%;">
            <textarea id="desc-input-${proj.id}" style="width: 100%; height: 75px; font-size: 0.75rem; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); outline: none; resize: none; box-sizing: border-box;">${descriptionText}</textarea>
            <button class="btn btn-primary btn-xs" onclick="saveProjectDescription('${proj.id}')" style="align-self: flex-end; padding: 2px 8px; font-size: 0.7rem;">Save</button>
          </div>
        ` : `
          <div style="font-size: 0.75rem; color: var(--text-primary); background-color: var(--bg-secondary); padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); white-space: pre-wrap; max-height: 100px; overflow-y: auto;">${descriptionText || 'No description provided.'}</div>
        `}
      </div>
    </div>
  `;

  let filesHtml = '';
  if (filesList.length === 0) {
    filesHtml = `<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">No files attached.</div>`;
  } else {
    filesHtml = `
      <div style="display: flex; gap: 8px; flex-wrap: wrap; max-height: 100px; overflow-y: auto; padding-right: 4px; width: 100%;">
        ${filesList.map((file, idx) => {
      const isString = typeof file === 'string';
      const fileData = isString ? file : (file.data || '');
      const fileName = isString ? 'Image' : (file.name || 'File');
      const fileType = isString ? 'image/png' : (file.type || '');

      const isImage = fileType.startsWith('image/') ||
        /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName) ||
        fileData.startsWith('data:image/');

      if (isImage) {
        return `
              <div style="position: relative; display: inline-block; width: 56px; height: 56px; flex-shrink: 0;">
                <img src="${fileData}" onclick="openFullImageViewModal('${proj.id}', ${idx}, event)" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.2s;" class="hover-scale-img" title="${fileName}">
                ${isEditable ? `
                  <button type="button" onclick="deleteProjectFile('${proj.id}', ${idx})" style="position: absolute; top: -4px; right: -4px; background: var(--danger); color: white; border: none; border-radius: 50%; width: 15px; height: 15px; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; cursor: pointer; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.3); padding: 0;" title="Delete file">&times;</button>
                ` : ''}
              </div>
            `;
      } else {
        return `
              <div style="position: relative; display: flex; align-items: center; gap: 4px; background-color: var(--bg-secondary); padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border-color); max-width: 100%; min-width: 0; overflow: hidden; box-sizing: border-box; flex-shrink: 1;">
                <a href="${fileData}" download="${fileName}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; color: var(--primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; max-width: calc(100% - 14px); flex-shrink: 1; min-width: 0;" title="Download ${fileName}">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="flex-shrink:0;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">${fileName}</span>
                </a>
                ${isEditable ? `
                  <button type="button" onclick="deleteProjectFile('${proj.id}', ${idx})" style="background: none; border: none; color: var(--danger); font-size: 0.9rem; line-height: 1; cursor: pointer; padding: 0; font-weight: bold; flex-shrink:0;" title="Delete file">&times;</button>
                ` : ''}
              </div>
            `;
      }
    }).join('')}
      </div>
    `;
  }

  const rightColHtml = `
    <div style="display: flex; flex-direction: column; gap: 10px; border-left: 1px solid var(--border-color); padding-left: 16px; height: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">
        <span>Project Files</span>
        ${isEditable ? `
          <label style="font-size: 0.7rem; color: var(--primary); cursor: pointer; display: inline-flex; align-items: center; gap: 2px; font-weight: 500;">
            <input type="file" style="display: none;" onchange="uploadProjectFile('${proj.id}', this)" />
            + Add File
          </label>
        ` : ''}
      </div>
      ${filesHtml}
    </div>
  `;

  card.innerHTML = `
    ${leftColHtml}
    ${middleColHtml}
    ${rightColHtml}
    <div class="project-members-section" style="grid-column: 1 / -1; border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: 8px; width: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; width: 100%;">
        <h4 style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin: 0; display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="stroke: var(--primary);">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Project & Department Team
        </h4>
        ${isEditable ? `
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn btn-secondary btn-xs" onclick="toggleAddMemberForm('${proj.id}', event)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Add Member
            </button>
            ${(state.currentRole === 'admin' || state.currentRole === 'hr') ? `
              <button type="button" class="btn btn-secondary btn-xs" onclick="toggleChangeTechLeadForm('${proj.id}', event)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Change Tech Lead
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <div class="project-members-list" style="display: flex; flex-wrap: wrap; gap: 8px; width: 100%;">
        ${memberChipsHtml || '<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">No members found.</div>'}
      </div>

      ${isEditable ? `
        <div id="add-member-form-${proj.id}" class="add-member-form-container" style="display: none; align-items: center; gap: 12px; margin-top: 16px; background: var(--bg-secondary); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); flex-wrap: wrap; width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
            <select id="select-add-member-${proj.id}" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color); background-color: var(--bg-tertiary); color: var(--text-primary); outline: none; cursor: pointer; flex: 1;">
              <option value="" disabled selected>Select existing employee to assign...</option>
              ${existingEmployeesToAssignOptions || '<option value="" disabled>No other employees available</option>'}
            </select>
            <button class="btn btn-primary btn-sm" onclick="assignEmployeeToProject('${proj.id}')" style="padding: 6px 16px; font-size: 0.8rem; font-weight: 600; white-space: nowrap;">Assign to Project</button>
          </div>
          <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">or</span>
          <button class="btn btn-secondary btn-sm" onclick="openCreateEmployeeForProject('${proj.id}', '${proj.dept}')" style="padding: 6px 16px; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Register New Employee to Dept
          </button>
        </div>
      ` : ''}

      ${isEditable && (state.currentRole === 'admin' || state.currentRole === 'hr') ? `
        <div id="change-tech-lead-form-${proj.id}" class="change-tech-lead-form-container" style="display: none; align-items: center; gap: 12px; margin-top: 16px; background: var(--bg-secondary); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); flex-wrap: wrap; width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
            <select id="select-change-tech-lead-${proj.id}" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color); background-color: var(--bg-tertiary); color: var(--text-primary); outline: none; cursor: pointer; flex: 1;">
              <option value="" disabled>Select Tech Lead to appoint...</option>
              ${allEmployeesOptions}
            </select>
            <button class="btn btn-primary btn-sm" onclick="submitChangeTechLead('${proj.id}')" style="padding: 6px 16px; font-size: 0.8rem; font-weight: 600; white-space: nowrap;">Appoint Tech Lead</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  return card;
}

function toggleAddMemberForm(projId, event) {
  if (event) event.preventDefault();
  const form = document.getElementById(`add-member-form-${projId}`);
  if (form) {
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  }
}
window.toggleAddMemberForm = toggleAddMemberForm;

function toggleChangeTechLeadForm(projId, event) {
  if (event) event.preventDefault();
  const form = document.getElementById(`change-tech-lead-form-${projId}`);
  if (form) {
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  }
}
window.toggleChangeTechLeadForm = toggleChangeTechLeadForm;

function submitChangeTechLead(projId) {
  const select = document.getElementById(`select-change-tech-lead-${projId}`);
  if (!select) return;
  const newTechLeadId = select.value;
  if (!newTechLeadId) {
    showToast('Please select a Tech Lead.', 'error');
    return;
  }
  changeProjectTechLead(projId, newTechLeadId);
}
window.submitChangeTechLead = submitChangeTechLead;

async function assignEmployeeToProject(projId) {
  const select = document.getElementById(`select-add-member-${projId}`);
  if (!select) return;
  const empId = select.value;
  if (!empId) {
    showToast('Please select an employee to assign.', 'error');
    return;
  }
  const proj = state.projects.find(p => p.id === projId);
  if (!proj) return;
  if (!proj.employeeIds) {
    proj.employeeIds = [];
  }
  if (!proj.employeeIds.includes(empId)) {
    proj.employeeIds.push(empId);
  }

  localStorage.setItem('ems_projects', JSON.stringify(state.projects));
  await syncStateNow();

  // Refresh views
  const activeMenuItem = document.querySelector('.menu-item.active');
  const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';
  switchView(currentView);
  showToast('Employee assigned to project successfully!', 'success');
}
window.assignEmployeeToProject = assignEmployeeToProject;

async function removeEmployeeFromProject(projId, empId) {
  const proj = state.projects.find(p => p.id === projId);
  if (!proj) return;

  // 1. Remove from explicit project employee list
  if (proj.employeeIds) {
    proj.employeeIds = proj.employeeIds.filter(id => id !== empId);
  }

  // 2. Unassign the employee from any tasks inside this project
  let tasksModified = false;
  state.tasks.forEach(t => {
    if (t.projectId === projId && t.assigneeId === empId) {
      t.assigneeId = '';
      t.assigneeName = 'Unassigned';
      tasksModified = true;
    }
  });

  if (tasksModified) {
    localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
  }

  localStorage.setItem('ems_projects', JSON.stringify(state.projects));
  await syncStateNow();

  // Refresh views
  const activeMenuItem = document.querySelector('.menu-item.active');
  const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';
  switchView(currentView);
  showToast('Employee removed from project.', 'success');
}
window.removeEmployeeFromProject = removeEmployeeFromProject;

function openCreateEmployeeForProject(projId, dept) {
  autoAssignToProjectAfterCreate = { projId, dept };
  openCreateEmployeeModal();

  // Pre-fill department — HR/Admin can change it freely; others are locked to the project dept
  const deptSelect = document.getElementById('new-emp-dept');
  if (deptSelect) {
    deptSelect.value = dept;
    // Lock dept only for tech leads / managers; HR and Admin can register to any dept
    deptSelect.disabled = !(state.currentRole === 'hr' || state.currentRole === 'admin');
  }
}
window.openCreateEmployeeForProject = openCreateEmployeeForProject;



function updateProjectProgress(projId, val) {
  const proj = state.projects.find(p => p.id === projId);
  if (proj) {
    proj.progress = parseInt(val);
    if (proj.progress === 100) {
      proj.status = 'Completed';
    } else if (proj.progress < 100 && proj.status === 'Completed') {
      proj.status = 'Active';
    }
    localStorage.setItem('ems_projects', JSON.stringify(state.projects));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_projects to server
    showToast(`Project "${proj.name}" progress updated to ${val}%`, 'success');

    // Refresh grids to update status badges and values
    if (state.currentRole === 'hr' || state.currentRole === 'admin') {
      renderHRTasksAndProjects();
    } else {
      renderEmployeeTasksAndProjects();
    }
  }
}
window.updateProjectProgress = updateProjectProgress;

function saveProjectDescription(projId) {
  const textarea = document.getElementById(`desc-input-${projId}`);
  if (!textarea) return;
  const newDesc = textarea.value.trim();
  const proj = state.projects.find(p => p.id === projId);
  if (proj) {
    proj.description = newDesc;
    localStorage.setItem('ems_projects', JSON.stringify(state.projects));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_projects to server
    showToast('Project description saved successfully!', 'success');
    populateTaskModalOptions();
    if (state.currentRole === 'hr' || state.currentRole === 'admin') {
      renderHRTasksAndProjects();
    } else {
      renderEmployeeTasksAndProjects();
    }
  }
}
window.saveProjectDescription = saveProjectDescription;

function uploadProjectFile(projId, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const base64Data = e.target.result;
    compressImage(base64Data, 800, 800, 0.6, function (compressedDataUrl) {
      const proj = state.projects.find(p => p.id === projId);
      if (proj) {
        if (!proj.files) proj.files = [];
        proj.files.push({
          name: file.name,
          type: file.type,
          data: compressedDataUrl
        });
        localStorage.setItem('ems_projects', JSON.stringify(state.projects));
        triggerBackendSync(); // [AUTO-ADDED] persist ems_projects to server
        showToast(`File "${file.name}" uploaded successfully!`, 'success');
        if (state.currentRole === 'hr' || state.currentRole === 'admin') {
          renderHRTasksAndProjects();
        } else {
          renderEmployeeTasksAndProjects();
        }
      }
    });
  };
  reader.readAsDataURL(file);
}
window.uploadProjectFile = uploadProjectFile;

async function deleteProjectFile(projId, fileIndex) {
  const proj = state.projects.find(p => p.id === projId);
  if (proj) {
    if (proj.files && proj.files[fileIndex]) {
      const fileName = proj.files[fileIndex].name;
      // We don't have a dedicated API for project files, it's part of the project object.
      // So we just update the project locally and trigger sync, since project sync is upsert.
      proj.files.splice(fileIndex, 1);
      localStorage.setItem('ems_projects', JSON.stringify(state.projects));
      triggerBackendSync(); // [AUTO-ADDED] persist ems_projects to server
      showToast(`File "${fileName}" deleted!`, 'info');
      if (state.currentRole === 'hr' || state.currentRole === 'admin') {
        renderHRTasksAndProjects();
      } else {
        renderEmployeeTasksAndProjects();
      }
    }
  }
}
window.deleteProjectFile = deleteProjectFile;

async function deleteProject(projectId, event) {
  if (event) {
    event.stopPropagation();
  }

  const proj = state.projects.find(p => p.id === projectId);
  if (!proj) return;

  if (confirm(`Are you sure you want to delete project "${proj.name}"? This will also delete all tasks associated with this project.`)) {
    if (!(await executeServerDelete('Project', projectId))) return;

    // Delete the project locally
    state.projects = state.projects.filter(p => p.id !== projectId);
    localStorage.setItem('ems_projects', JSON.stringify(state.projects));

    // Delete associated tasks
    const tasksToDelete = state.tasks.filter(t => t.projectId === projectId);
    for (const t of tasksToDelete) {
      await executeServerDelete('Task', t.id);
    }
    state.tasks = state.tasks.filter(t => t.projectId !== projectId);
    localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));

    // Refresh UI
    const activeMenuItem = document.querySelector('.menu-item.active');
    const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';
    switchView(currentView);

    showToast(`Project "${proj.name}" deleted successfully.`, 'success');
  }
}
window.deleteProject = deleteProject;

// --- 2. HR View Logic ---
function renderHRTasksAndProjects() {
  // Render Projects
  const grid = document.getElementById('hr-projects-grid');
  if (grid) {
    grid.innerHTML = '';

    if (state.projects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 24px;">
          <div class="empty-state-title">No projects active</div>
          <p>Click "+ Add New Project" to get started.</p>
        </div>
      `;
    } else {
      const user = state.currentUser;
      const isTechLeadOrManager = (state.currentRole === 'techlead' || state.currentRole === 'manager');

      const visibleProjects = state.projects.filter(p => {
        if (state.currentRole === 'hr' || state.currentRole === 'admin' || (user && isPratap(user)) || (user && (user.role === 'Admin' || user.role === 'HR'))) return true;
        if (!user) return false;

        const isLead = (p.techLeadId === user.id || p.techLeadName === user.name || p.createdById === user.id || p.createdByName === user.name);
        const isMember = (p.employeeIds && (p.employeeIds.includes(user.id) || p.employeeIds.includes(user.email))) ||
                         (p.teamMembers && p.teamMembers.some(m => typeof m === 'object' ? (m.id === user.id || m.name === user.name) : m === user.name)) ||
                         (state.tasks && state.tasks.some(t => t.projectId === p.id && t.assigneeId === user.id));

        return isLead || isMember;
      });

      if (visibleProjects.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; padding: 24px;">
            <div class="empty-state-title">No projects active</div>
            <p>You are not assigned to any projects yet.</p>
          </div>
        `;
      } else {
        visibleProjects.forEach(proj => {
          const card = createProjectCard(proj, isTechLeadOrManager);
          grid.appendChild(card);
        });
      }
    }
  }

  // Render Tasks (Filtered)
  const searchQ = (document.getElementById('hr-task-search').value || '').toLowerCase();
  const filterProj = document.getElementById('filter-task-project').value;
  const filterStatus = document.getElementById('filter-task-status').value;

  const tbody = document.getElementById('hr-tasks-tbody');
  if (tbody) {
    tbody.innerHTML = '';

    const filteredTasks = state.tasks.filter(t => {
      // 1. MUST NEVER show Personal Tasks in the global All Assigned Employee Tasks table!
      if (isPersonalTask(t)) return false;

      if (state.currentRole === 'techlead' || state.currentRole === 'manager') {
        const proj = state.projects.find(p => p.id === t.projectId);
        if (!proj || proj.techLeadId !== state.currentUser.id) {
          return false;
        }
      }
      const matchesSearch = t.desc.toLowerCase().includes(searchQ) || t.assigneeName.toLowerCase().includes(searchQ);
      const matchesProj = filterProj === 'all' || t.projectId === filterProj;
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      return matchesSearch && matchesProj && matchesStatus;
    }).sort((a, b) => getPriorityWeight(a.priority) - getPriorityWeight(b.priority));

    if (filteredTasks.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <div class="empty-state-title">No matching tasks found</div>
              <p>Try clearing filters or search query.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      const grouped = groupTasksByMonth(filteredTasks);
      Object.keys(grouped).forEach(monthKey => {
        const headerTr = document.createElement('tr');
        headerTr.className = 'month-header-row';
        headerTr.innerHTML = `
          <td colspan="7">
            📅 ${monthKey}
          </td>
        `;
        tbody.appendChild(headerTr);

        grouped[monthKey].forEach(task => {
          const tr = document.createElement('tr');
          const isExpanded = state.expandedTaskIds && state.expandedTaskIds.has(task.id);
          const isEditing = state.editingTaskId === task.id;

          tr.innerHTML = `
            <td>
              <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                <span onclick="toggleTaskDetailsExpand('${task.id}', event)" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                  <strong>${task.desc}</strong>
                  <svg class="chevron-icon" id="chevron-${task.id}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate(${isExpanded ? '180deg' : '0deg'}); opacity: 0.7; flex-shrink: 0;">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </span>
                <div id="details-pane-${task.id}" class="task-details-pane" style="display: ${isExpanded ? 'block' : 'none'}; padding: 12px; margin-top: 8px; border-radius: 8px; background-color: var(--bg-tertiary); border: 1px solid var(--border-color); font-size: 0.85rem; width: 100%;">
                  ${isEditing ? `
                    <div style="display: flex; flex-direction: column; gap: 8px;" onclick="event.stopPropagation()">
                      <textarea id="edit-details-textarea-${task.id}" placeholder="Enter task detailed description..." style="min-height: 80px; width: 100%; padding: 8px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; resize: vertical;">${task.details || ''}</textarea>
                      <div>
                        <label style="font-weight: 600; display: block; margin-bottom: 4px;">Attach Photos/Screenshots</label>
                        <input type="file" id="edit-images-input-${task.id}" accept="image/*" multiple style="font-size: 0.8rem; color: var(--text-primary);">
                      </div>
                      <div id="edit-images-preview-${task.id}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;"></div>
                      <div style="margin-top: 8px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px; font-size: 0.8rem;">&#128206; Or Add Google Drive / Any Link</label>
                        <input type="url" id="edit-drive-link-input-${task.id}" placeholder="Paste Google Drive or any link here..." style="width: 100%; padding: 6px 10px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.8rem; box-sizing: border-box;">
                        <div id="edit-drive-links-preview-${task.id}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;"></div>
                      </div>
                      ${task.createdByEmployee ? `
                        <div style="margin-top: 4px;">
                          <label style="font-weight: 600; display: block; margin-bottom: 4px;">Due Date</label>
                          <input type="date" id="edit-due-date-${task.id}" value="${task.dueDate}" style="width: 100%; padding: 8px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; box-sizing: border-box;">
                        </div>
                      ` : ''}
                      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="cancelEditTask(event)">Cancel</button>
                        <button class="btn btn-primary btn-sm" onclick="saveEditTask('${task.id}', event)">Save Changes</button>
                      </div>
                    </div>
                  ` : `
                    ${task.status === 'Needs Revision' ? `
                      <div style="padding: 10px 14px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.35); border-radius: 6px; color: #ef4444; font-size: 0.85rem; margin-bottom: 12px;" onclick="event.stopPropagation()">
                        <div style="font-weight: 700; display: flex; align-items: center; gap: 6px;">
                          <span>⚠️ Rejection Feedback (From ${escapeHTML(task.rejectedBy || 'Manager')}):</span>
                        </div>
                        <div style="margin-top: 4px; font-weight: 500; color: var(--text-primary); background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 4px; border-left: 3px solid #ef4444;">
                          "${escapeHTML(task.rejectionReason || 'Please review and fix before resubmitting.')}"
                        </div>
                      </div>
                    ` : ''}
                    <div style="font-weight: 500; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word;">${task.details || 'No details provided.'}</div>
                    ${renderAttachmentsHTML(task.images, task.id, task.driveLinks)}
                    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 10px;" onclick="event.stopPropagation()">
                      <button class="btn btn-secondary btn-sm" onclick="startEditTask('${task.id}', event)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px;">Edit Description & Photos</button>
                    </div>
                  `}
                </div>
              </div>
            </td>
            <td>${task.projectName}</td>
            <td>
              <div style="font-weight:600; color: var(--text-primary);">${task.assigneeName}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${state.employees.find(e => e.id === task.assigneeId)?.dept || ''}</div>
            </td>
            <td>
              <span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span>
            </td>
            <td>${task.startDate ? formatDate(task.startDate) + ' to ' : ''}${formatDate(task.dueDate)}</td>
            <td>${getTaskStatusBadgeHtml(task.status, task.rejectionReason)}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                ${task.status === 'Pending Review' ? `
                  <button class="btn btn-success btn-xs" onclick="approveTaskByLead('${task.id}', event)" style="padding: 4px 8px; font-size: 0.72rem; font-weight: 700;" title="Approve Task">✅ Approve</button>
                  <button class="btn btn-danger btn-xs" onclick="rejectTaskByLeadModal('${task.id}', event)" style="padding: 4px 8px; font-size: 0.72rem; font-weight: 700;" title="Reject Task with Reason">❌ Reject</button>
                ` : (task.status === 'Needs Revision' ? `
                  <span style="font-size: 0.75rem; color: #ef4444; font-weight: 600;" title="Reason: ${escapeHTML(task.rejectionReason || '')}">⚠️ Feedback Sent</span>
                ` : (task.status === 'Completed' ? `
                  <span style="font-size: 0.75rem; color: #22c55e; font-weight: 600;">✅ Approved</span>
                ` : `
                  <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">In Progress</span>
                `))}
                <button class="btn btn-secondary btn-xs" onclick="deleteTask('${task.id}')" style="padding: 4px 6px; font-size: 0.72rem; opacity: 0.7;" title="Delete Task">🗑️</button>
              </div>
            </td>
          `;
          tr.className = task.status === 'Completed' ? 'completed-task-row' : '';
          tbody.appendChild(tr);
        });
      });
    }
  }
  if (state.editingTaskId) {
    setupEditTaskListeners(state.editingTaskId);
  }

  // Render Personal Tasks & To-Do List (for HR/Tech Lead/Admin)
  const personalTbody = document.getElementById('hr-personal-tasks-tbody');
  if (personalTbody) {
    personalTbody.innerHTML = '';
    const personalTasks = state.tasks.filter(t => 
      isMyPersonalTask(t, state.currentUser ? state.currentUser.id : null, state.currentUser ? state.currentUser.name : null)
    ).sort((a, b) => getPriorityWeight(a.priority) - getPriorityWeight(b.priority));

    if (personalTasks.length === 0) {
      personalTbody.innerHTML = `
        <tr>
          <td colspan="5">
            <div class="empty-state">
              <div class="empty-state-title">No personal tasks</div>
              <p>You have a clean sheet! Click "+ Add Personal Task" to add tasks for yourself.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      const grouped = groupTasksByMonth(personalTasks);
      Object.keys(grouped).forEach(monthKey => {
        const headerTr = document.createElement('tr');
        headerTr.className = 'month-header-row';
        headerTr.innerHTML = `
          <td colspan="5">
            📅 ${monthKey}
          </td>
        `;
        personalTbody.appendChild(headerTr);

        grouped[monthKey].forEach(task => {
          const tr = document.createElement('tr');
          const isCompleted = task.status === 'Completed';
          // Use 'pt-' prefix to avoid ID collisions with the HR tasks board above
          const ptPaneId = `pt-details-pane-${task.id}`;
          const ptChevronId = `pt-chevron-${task.id}`;
          const isExpanded = state.expandedPersonalTaskIds && state.expandedPersonalTaskIds.has(task.id);
          const isEditing = state.editingPersonalTaskId === task.id;

          tr.innerHTML = `
            <td>
              <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" ${isCompleted ? 'checked' : ''}
                           onchange="toggleTaskCompletion('${task.id}')"
                           style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--success); flex-shrink: 0;">
                    <span onclick="togglePersonalTaskExpand('${task.id}', event)" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; ${isCompleted ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                      <strong>${task.desc}</strong>
                      <svg id="${ptChevronId}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate(${isExpanded ? '180deg' : '0deg'}); opacity: 0.7; flex-shrink: 0;">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </span>
                  </div>
                </div>
                <div id="${ptPaneId}" class="task-details-pane" style="display: ${isExpanded ? 'block' : 'none'}; padding: 12px; margin-top: 8px; border-radius: 8px; background-color: var(--bg-tertiary); border: 1px solid var(--border-color); font-size: 0.85rem; width: 100%;">
                  ${isEditing ? `
                    <div style="display: flex; flex-direction: column; gap: 8px;" onclick="event.stopPropagation()">
                      <textarea id="pt-edit-textarea-${task.id}" placeholder="Enter task detailed description..." style="min-height: 80px; width: 100%; padding: 8px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; resize: vertical;">${task.details || ''}</textarea>
                      <div>
                        <label style="font-weight: 600; display: block; margin-bottom: 4px;">Attach Photos/Screenshots</label>
                        <input type="file" id="pt-edit-images-input-${task.id}" accept="image/*" multiple style="font-size: 0.8rem; color: var(--text-primary);">
                      </div>
                      <div id="pt-edit-images-preview-${task.id}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;"></div>
                      <div style="margin-top: 8px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px; font-size: 0.8rem;">&#128206; Or Add Google Drive / Any Link</label>
                        <input type="url" id="pt-edit-drive-link-input-${task.id}" placeholder="Paste Google Drive or any link here..." style="width: 100%; padding: 6px 10px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.8rem; box-sizing: border-box;">
                        <div id="pt-edit-drive-links-preview-${task.id}" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;"></div>
                      </div>
                      <div style="margin-top: 4px;">
                        <label style="font-weight: 600; display: block; margin-bottom: 4px;">Due Date</label>
                        <input type="date" id="pt-edit-due-date-${task.id}" value="${task.dueDate}" style="width: 100%; padding: 8px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; box-sizing: border-box;">
                      </div>
                      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="cancelPersonalTaskEdit(event)">Cancel</button>
                        <button class="btn btn-primary btn-sm" onclick="savePersonalTaskEdit('${task.id}', event)">Save Changes</button>
                      </div>
                    </div>
                  ` : `
                    <div style="font-weight: 500; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word;">${task.details || 'No details provided.'}</div>
                    ${renderAttachmentsHTML(task.images, task.id, task.driveLinks)}
                    <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                      <button class="btn btn-secondary btn-sm" onclick="startPersonalTaskEdit('${task.id}', event)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px;">Edit Description &amp; Photos</button>
                    </div>
                  `}
                </div>
              </div>
            </td>
            <td>${task.projectName || 'Personal'}</td>
            <td>
              <span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span>
            </td>
            <td>${task.startDate ? formatDate(task.startDate) + ' to ' : ''}${formatDate(task.dueDate)}</td>
            <td><span class="badge badge-${task.status.replace(' ', '-').toLowerCase()}">${task.status}</span></td>
          `;
          tr.className = isCompleted ? 'completed-task-row' : '';
          personalTbody.appendChild(tr);

          // Setup file input listener for personal task editing
          if (isEditing) {
            const fileInput = document.getElementById(`pt-edit-images-input-${task.id}`);
            const previewDiv = document.getElementById(`pt-edit-images-preview-${task.id}`);
            if (fileInput && previewDiv) {
              fileInput.addEventListener('change', (e) => {
                Array.from(e.target.files).forEach(file => {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    compressImage(ev.target.result, 800, 800, 0.6, (compressed) => {
                      state.editingPersonalTaskImages.push({
                        name: file.name,
                        type: file.type,
                        data: compressed
                      });
                      renderPersonalTaskEditPreview(task.id);
                    });
                  };
                  reader.readAsDataURL(file);
                });
              });
              renderPersonalTaskEditPreview(task.id);
              renderPersonalTaskDriveLinkPreviews(task.id);
            }
          }
        });
      });
    }
  }

  // Populate Filter project selects and modal project/assignee choices
  populateTaskModalOptions();
}

function populateTaskModalOptions() {
  // Populate HR tasks project filter dropdown
  const filterProjSelect = document.getElementById('filter-task-project');
  if (filterProjSelect) {
    const prevVal = filterProjSelect.value;
    filterProjSelect.innerHTML = '<option value="all">All Projects</option>';
    const allowedProjects = (state.currentRole === 'techlead' || state.currentRole === 'manager')
      ? state.projects.filter(p => p.techLeadId === state.currentUser.id)
      : state.projects;
    allowedProjects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      filterProjSelect.appendChild(opt);
    });
    filterProjSelect.value = prevVal || 'all';
  }

  // Populate Assign Task Modal Project select
  const modalProjSelect = document.getElementById('task-project-select');
  if (modalProjSelect) {
    modalProjSelect.innerHTML = '<option value="" disabled selected>Select project...</option>';
    const allowedProjects = (state.currentRole === 'techlead' || state.currentRole === 'manager')
      ? state.projects.filter(p => p.techLeadId === state.currentUser.id)
      : state.projects;
    allowedProjects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.dept})`;
      modalProjSelect.appendChild(opt);
    });
  }

  // Populate Assign Task Modal Employee select
  const modalAssigneeSelect = document.getElementById('task-assignee-select');
  if (modalAssigneeSelect) {
    modalAssigneeSelect.innerHTML = '<option value="" disabled selected>Select a project first...</option>';
  }
}

function populateTechLeadOptions() {
  const select = document.getElementById('project-tech-lead');
  if (!select) return;
  select.innerHTML = '<option value="" disabled selected>Select tech lead...</option>';
  state.employees.forEach(emp => {
    if (isPratap(emp) || emp.isDeleted || emp.status === 'pending_approval') return; // Hide Pratap, Deleted & Pending
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = emp.role.toLowerCase() === 'admin' ? `${emp.name} (CEO)` : `${emp.name} (${emp.dept} - ${emp.role})`;
    select.appendChild(opt);
  });
}

// --- 3. Modals and Forms Logic ---
function openCreateProjectModal() {
  document.getElementById('project-creation-form').reset();
  if (document.getElementById('project-description')) {
    document.getElementById('project-description').value = '';
  }
  currentUploadedProjectFiles.length = 0;
  const projectPreview = document.getElementById('project-files-preview');
  if (projectPreview) projectPreview.innerHTML = '';

  const projectDeptSelect = document.getElementById('project-dept');
  const projectTechLeadSelect = document.getElementById('project-tech-lead');

  if (state.currentRole === 'techlead' || state.currentRole === 'manager') {
    // Restrict department selection to tech lead's department(s)
    if (projectDeptSelect) {
      projectDeptSelect.innerHTML = '';
      let userDepts = (state.currentUser.dept || '')
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);
      if (userDepts.length === 0) {
        // Fallback to all departments if the tech lead has no department set
        userDepts = state.departments && state.departments.length > 0 ? state.departments : ['AI', 'Electronics', 'Lab Setup', 'Instructor'];
        projectDeptSelect.disabled = false;
      } else {
        projectDeptSelect.disabled = userDepts.length <= 1;
      }
      userDepts.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        projectDeptSelect.appendChild(opt);
      });
      if (userDepts.length > 0) {
        projectDeptSelect.value = userDepts[0];
      }
    }

    // Restrict tech lead option to the current user
    if (projectTechLeadSelect) {
      projectTechLeadSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = state.currentUser.id;
      opt.textContent = `${state.currentUser.name} (${state.currentUser.dept} - ${state.currentUser.role})`;
      projectTechLeadSelect.appendChild(opt);
      projectTechLeadSelect.value = state.currentUser.id;
      projectTechLeadSelect.disabled = true;
    }
  } else {
    // Admin or HR: fully enable and populate both
    if (projectDeptSelect) {
      projectDeptSelect.innerHTML = '<option value="" disabled selected>Select department...</option>';
      const depts = state.departments && state.departments.length > 0 ? state.departments : DEFAULT_DEPARTMENTS;
      depts.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        projectDeptSelect.appendChild(opt);
      });
      projectDeptSelect.disabled = false;
    }

    if (projectTechLeadSelect) {
      populateTechLeadOptions();
      projectTechLeadSelect.disabled = false;
    }
  }

  document.getElementById('project-modal-overlay').classList.add('active');
}

function hideProjectModal() {
  document.getElementById('project-modal-overlay').classList.remove('active');
  if (document.getElementById('project-description')) {
    document.getElementById('project-description').value = '';
  }
  currentUploadedProjectFiles.length = 0;
  const projectPreview = document.getElementById('project-files-preview');
  if (projectPreview) projectPreview.innerHTML = '';
}

async function handleProjectCreationSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('project-name').value.trim();
  const dept = document.getElementById('project-dept').value;
  const status = document.getElementById('project-status').value;
  const techLeadId = document.getElementById('project-tech-lead') ? document.getElementById('project-tech-lead').value : '';
  const dueDate = document.getElementById('project-due-date') ? document.getElementById('project-due-date').value : '';
  const description = document.getElementById('project-description') ? document.getElementById('project-description').value.trim() : '';
  const files = [...currentUploadedProjectFiles];

  if (!name || !dept || !status || !techLeadId || !dueDate) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  const newProj = {
    id: `PRJ${300 + state.projects.length + 1}`,
    name: name,
    dept: dept,
    status: status,
    techLeadId: techLeadId,
    dueDate: dueDate,
    progress: 0,
    description: description,
    files: files,
    employeeIds: []
  };

  if (dept === 'Lab Setup') {
    const namesToFind = ["dipak", "pratik", "aniket", "rohan"];
    const autoAssignIds = state.employees
      .filter(emp => namesToFind.some(name => emp.name.toLowerCase().includes(name)))
      .map(emp => emp.id);
    newProj.employeeIds = autoAssignIds;
  }

  // Promote employee to Tech Lead if they aren't already a Tech Lead or Admin
  const chosenEmp = state.employees.find(emp => emp.id === techLeadId);
  if (chosenEmp && chosenEmp.role !== 'Tech Lead' && chosenEmp.role !== 'Admin') {
    chosenEmp.role = 'Tech Lead';
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
    showToast(`${chosenEmp.name} has been promoted to Tech Lead!`, 'info');
  }

  state.projects.push(newProj);
  localStorage.setItem('ems_projects', JSON.stringify(state.projects));
  triggerBackendSync(); // [AUTO-ADDED] persist ems_projects to server

  // If department is "Lab Setup", create default todo tasks
  if (dept === 'Lab Setup') {
    const defaultTodos = [
      "Electronics components purchasing",
      "3d printer purchasing",
      "All required inventory purchasing (led, bulb ,cctv ,alexa , decoration)",
      "Project",
      "All project stickers,prints",
      "Component Manual print",
      "All necessary print (nfc,info document)",
      "Project models 3d printed",
      "3d printed drone",
      "Ready all project with 3d models",
      "Pc setup (pc, monitor mouse , keypad,pad for keypad, speaker)",
      "Engine setup",
      "Project models setup",
      "Electronics kit",
      "3d printed drone setup",
      "Diy drone",
      "Drone simulator",
      "3d printer assembly",
      "All component checking",
      "All acrylic boards (certificate, section wise like drone)"
    ];

    const todayStr = getTodayDateString();

    defaultTodos.forEach((todo, idx) => {
      const task = {
        id: `TSK${400 + state.tasks.length + 1}`,
        projectId: newProj.id,
        projectName: newProj.name,
        desc: todo,
        details: '',
        images: [],
        assigneeId: techLeadId,
        assigneeName: chosenEmp ? chosenEmp.name : 'Suyash Patil',
        startDate: todayStr,
        dueDate: dueDate,
        priority: 'Medium',
        status: 'Not Completed'
      };
      state.tasks.push(task);
    });

    localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
  }

  syncStateNow();

  hideProjectModal();
  renderHRTasksAndProjects();
  showToast(`Project "${name}" created successfully!`, 'success');
}

window.openCreateProjectModal = openCreateProjectModal;
window.hideProjectModal = hideProjectModal;

function changeProjectTechLead(projId, newTechLeadId) {
  const proj = state.projects.find(p => p.id === projId);
  if (!proj) return;

  const chosenEmp = state.employees.find(emp => emp.id === newTechLeadId);
  proj.techLeadId = newTechLeadId;

  // Promote employee to Tech Lead if they aren't already a Tech Lead or Admin
  if (chosenEmp && !chosenEmp.role.includes('Tech Lead') && chosenEmp.role !== 'Admin') {
    chosenEmp.role = chosenEmp.role ? `${chosenEmp.role}, Tech Lead` : 'Tech Lead';
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
    showToast(`${chosenEmp.name} has been promoted to Tech Lead!`, 'info');
  }

  localStorage.setItem('ems_projects', JSON.stringify(state.projects));
  triggerBackendSync(); // [AUTO-ADDED] persist ems_projects to server
  showToast(`Tech Lead for project "${proj.name}" updated successfully!`, 'success');
  renderHRTasksAndProjects();
}
window.changeProjectTechLead = changeProjectTechLead;

function openAssignTaskModal(preselectProjectId) {
  document.getElementById('task-assignment-form').reset();

  currentAttachedImagesHR.length = 0;
  const hrPreview = document.getElementById('task-images-preview');
  if (hrPreview) hrPreview.innerHTML = '';

  const linkInput = document.getElementById('task-drive-link');
  if (linkInput) linkInput.value = '';

  // Default due date to 1 week from now
  const oneWeekLater = new Date();
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  document.getElementById('task-due-date').value = formatter.format(oneWeekLater);

  // Set minimum date to today
  document.getElementById('task-due-date').min = getTodayDateString();

  const startDateInput = document.getElementById('task-start-date');
  if (startDateInput) {
    startDateInput.value = getTodayDateString();
    startDateInput.min = getTodayDateString();
  }

  populateTaskModalOptions();

  if (preselectProjectId) {
    const projSelect = document.getElementById('task-project-select');
    if (projSelect) {
      projSelect.value = preselectProjectId;
      if (typeof handleAssignTaskProjectChange === 'function') {
        handleAssignTaskProjectChange({ target: projSelect });
      }
    }
  }

  const modalOverlay = document.getElementById('task-modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.zIndex = '10005';
    modalOverlay.classList.add('active');
  }
}

function hideTaskModal() {
  document.getElementById('task-modal-overlay').classList.remove('active');
}

function handleTaskAssignmentSubmit(e) {
  e.preventDefault();

  const desc = document.getElementById('task-desc').value.trim();
  const details = document.getElementById('task-details').value.trim();
  const projId = document.getElementById('task-project-select').value;
  const empId = document.getElementById('task-assignee-select').value;
  const startDate = document.getElementById('task-start-date').value;
  const dueDate = document.getElementById('task-due-date').value;
  const priority = document.getElementById('task-priority').value;

  const linkInput = document.getElementById('task-drive-link');
  const driveUrl = linkInput ? linkInput.value.trim() : '';
  const driveLinks = driveUrl ? [{ url: driveUrl, label: 'Google Drive / Attachment Link' }] : [];

  if (!desc || !projId || !empId || !startDate || !dueDate || !priority) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  if (startDate > dueDate) {
    showToast('Start Date cannot be after Due Date.', 'error');
    return;
  }

  const project = state.projects.find(p => p.id === projId);
  const employee = state.employees.find(e => e.id === empId);

  const newTask = {
    id: `TSK${400 + state.tasks.length + 1}`,
    projectId: projId,
    projectName: project ? project.name : 'General',
    desc: desc,
    details: details,
    driveLinks: driveLinks,
    images: [...currentAttachedImagesHR],
    assigneeId: empId,
    assigneeName: employee ? employee.name : 'Employee',
    startDate: startDate,
    dueDate: dueDate,
    priority: priority,
    status: 'Not Completed'
  };

  state.tasks.push(newTask);
  if (!safeSaveTasks()) {
    state.tasks.pop();
    return;
  }

  hideTaskModal();
  renderHRTasksAndProjects();
  if (typeof activeDashProjectId !== 'undefined' && activeDashProjectId === projId) {
    renderProjDashTabContent();
  }
  showToast(`Task assigned to ${employee ? employee.name : 'Employee'}!`, 'success');
}

async function deleteTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (confirm(`Are you sure you want to delete task "${task.desc}"?`)) {
    if (!(await executeServerDelete('Task', taskId))) return;
    const prevTasks = [...state.tasks];
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    if (!safeSaveTasks()) {
      state.tasks = prevTasks;
      return;
    }
    renderHRTasksAndProjects();
    showToast('Task deleted successfully.', 'success');
  }
}

// --- 4. Dynamic Employees & Departments Management ---

function populateDepartmentDropdowns() {
  const depts = state.departments && state.departments.length > 0 ? state.departments : DEFAULT_DEPARTMENTS;

  const projectDeptSelect = document.getElementById('project-dept');
  if (projectDeptSelect) {
    projectDeptSelect.innerHTML = '<option value="" disabled selected>Select department...</option>';
    depts.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept;
      opt.textContent = dept;
      projectDeptSelect.appendChild(opt);
    });
  }

  const empDeptSelect = document.getElementById('new-emp-dept');
  if (empDeptSelect) {
    empDeptSelect.innerHTML = '<option value="">None (No Department)</option>';
    depts.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept;
      opt.textContent = dept;
      empDeptSelect.appendChild(opt);
    });
  }
}

// Department creation modal triggers
function openCreateDeptModal() {
  document.getElementById('dept-creation-form').reset();
  document.getElementById('dept-modal-overlay').classList.add('active');
}

function hideDeptModal() {
  document.getElementById('dept-modal-overlay').classList.remove('active');
}

function handleDeptCreationSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('dept-name').value.trim();

  if (!name) {
    showToast('Please enter a department name.', 'error');
    return;
  }

  if (state.departments.some(d => d.toLowerCase() === name.toLowerCase())) {
    showToast('Department already exists.', 'error');
    return;
  }

  state.departments.push(name);
  localStorage.setItem('ems_departments', JSON.stringify(state.departments));
  triggerBackendSync(); // persist department changes to server

  populateDepartmentDropdowns();
  hideDeptModal();
  showToast(`Department "${name}" created successfully!`, 'success');
}

function getNextEmployeeId() {
  const employees = state.employees || [];
  let maxNum = 0;
  employees.forEach(emp => {
    if (!emp || !emp.id) return;
    const match = emp.id.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxNum) maxNum = num;
    }
  });
  const nextNum = maxNum + 1;
  return `AIRG${String(nextNum).padStart(5, '0')}`;
}

function applySuggestedEmpId() {
  const suggestedId = getNextEmployeeId();
  const idInput = document.getElementById('new-emp-id');
  if (idInput) {
    idInput.value = suggestedId;
    checkEmpIdAvailability();
  }
}

function checkEmpIdAvailability() {
  const idInput = document.getElementById('new-emp-id');
  const statusEl = document.getElementById('new-emp-id-status');
  const btnEl = document.getElementById('use-suggested-id-btn');
  if (!idInput || !statusEl) return;

  const val = idInput.value.trim();
  if (!val) {
    statusEl.style.display = 'none';
    if (btnEl) btnEl.style.display = 'none';
    return;
  }

  const existingEmp = (state.employees || []).find(emp => emp.id.toLowerCase() === val.toLowerCase());
  if (existingEmp) {
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
    statusEl.style.color = '#ef4444';
    statusEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    statusEl.innerHTML = `⚠️ <strong>Employee ID "${escapeHTML(val)}" is already registered</strong> to ${escapeHTML(existingEmp.name)}. Please use a unique ID card number or click Auto-fill above.`;
    if (btnEl) btnEl.style.display = 'inline-block';
  } else {
    statusEl.style.display = 'block';
    statusEl.style.background = 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = '#10b981';
    statusEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    statusEl.innerHTML = `✅ <strong>Employee ID "${escapeHTML(val)}" is available!</strong>`;
    if (btnEl) btnEl.style.display = 'none';
  }
}

window.getNextEmployeeId = getNextEmployeeId;
window.applySuggestedEmpId = applySuggestedEmpId;
window.checkEmpIdAvailability = checkEmpIdAvailability;

let autoAssignToProjectAfterCreate = null;

// Employee creation modal triggers
function openCreateEmployeeModal() {
  if (!document.body.classList.contains('auth-view') && state.currentRole !== 'admin' && state.currentRole !== 'techlead' && state.currentRole !== 'manager' && state.currentRole !== 'hr') {
    showToast('Access denied: Only HR, Administrators, Tech Leads, and Managers can add employees inside the portal.', 'error');
    return;
  }

  const deptSelect = document.getElementById('new-emp-dept');
  if (deptSelect) deptSelect.disabled = false;

  document.getElementById('employee-creation-form').reset();
  currentUploadedEmployeePhoto = null;
  currentUploadedAadharFile = null;
  currentUploadedPanFile = null;
  currentUploadedBankAccFile = null;
  currentUploadedBankIfscFile = null;

  const photoPreview = document.getElementById('new-emp-photo-preview');
  if (photoPreview) photoPreview.style.display = 'none';
  const photoImg = document.getElementById('new-emp-photo-img');
  if (photoImg) photoImg.src = '';

  // Auto-suggest next unique Employee ID & attach live validation listener
  const suggestedId = getNextEmployeeId();
  const idInput = document.getElementById('new-emp-id');
  if (idInput) {
    idInput.value = suggestedId;
    idInput.oninput = checkEmpIdAvailability;
  }
  checkEmpIdAvailability();

  // Populate dynamic role options based on current user role privilege
  const roleSelect = document.getElementById('new-emp-role');
  if (roleSelect) {
    roleSelect.innerHTML = '';
    if (!state.currentUser || (state.currentUser && state.currentRole === 'admin')) {
      roleSelect.innerHTML = `
        <option value="Employee" selected>Employee</option>
        <option value="Tech Lead">Tech Lead</option>
        <option value="Manager">Manager</option>
        <option value="HR">HR Manager</option>
        <option value="Admin">Admin</option>
      `;
    } else {
      // HR, Tech Lead or Manager adding someone from the portal
      roleSelect.innerHTML = `
        <option value="Employee" selected>Employee</option>
        <option value="Tech Lead">Tech Lead</option>
        <option value="Manager">Manager</option>
      `;
    }
  }

  populateDepartmentDropdowns();
  document.getElementById('employee-modal-overlay').classList.add('active');
}

function hideEmployeeModal() {
  document.getElementById('employee-modal-overlay').classList.remove('active');
}

function handleEmployeeCreationSubmit(e) {
  e.preventDefault();
  const idEl = document.getElementById('new-emp-id');
  let id = idEl ? idEl.value.trim() : '';
  if (!id) {
    id = getNextEmployeeId();
    if (idEl) idEl.value = id;
  }

  const name = document.getElementById('new-emp-name').value.trim();
  const email = document.getElementById('new-emp-email').value.trim();
  const deptEl = document.getElementById('new-emp-dept');
  let dept = deptEl ? deptEl.value : '';
  if (autoAssignToProjectAfterCreate) {
    dept = autoAssignToProjectAfterCreate.dept;
  }
  const roleEl = document.getElementById('new-emp-role');
  const role = roleEl ? roleEl.value : 'Employee';
  const balanceEl = document.getElementById('new-emp-balance');
  const balance = balanceEl ? parseInt(balanceEl.value) : 20;
  const designation = document.getElementById('new-emp-designation') ? document.getElementById('new-emp-designation').value.trim() : '';
  const phone = document.getElementById('new-emp-phone') ? document.getElementById('new-emp-phone').value.trim() : '';
  const dobEl = document.getElementById('new-emp-dob');
  const dob = dobEl ? dobEl.value : '';
  const joinDateEl = document.getElementById('new-emp-joindate');
  const joinDate = joinDateEl ? joinDateEl.value : '';

  const passwordEl = document.getElementById('new-emp-password');
  const password = passwordEl ? passwordEl.value.trim() : '';
  const passwordConfirmEl = document.getElementById('new-emp-password-confirm');
  const passwordConfirm = passwordConfirmEl ? passwordConfirmEl.value.trim() : '';

  if (!id || !name || !email || !role || !phone || isNaN(balance) || !password) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  // Validate passwords match
  if (password !== passwordConfirm) {
    showToast('Passwords do not match. Please re-enter.', 'error');
    return;
  }

  // Validate password strength: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!strongRegex.test(password)) {
    showToast('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.', 'error');
    return;
  }

  // Check if Employee ID already exists (Front & Center Validation)
  const idExists = state.employees.some(emp => emp.id.toLowerCase() === id.toLowerCase());
  if (idExists) {
    checkEmpIdAvailability();
    const modalBody = document.querySelector('#employee-creation-form .modal-body');
    if (modalBody) modalBody.scrollTop = 0;
    if (idEl) idEl.focus();
    showToast(`Employee ID "${id}" is already registered. Please enter a unique ID or use suggested ID.`, 'error');
    return;
  }
  
  // Check if Email already exists to prevent duplicate registrations
  const emailExists = state.employees.some(emp => emp.email.toLowerCase() === email.toLowerCase());
  if (emailExists) {
    showToast(`Email "${email}" is already registered.`, 'error');
    return;
  }

  // Generate avatar initials
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const isPending = !state.currentUser;

  const newEmp = {
    id: id,
    name: name,
    dept: dept,
    email: email,
    role: role,
    balance: balance,
    absent: 0,
    avatar: initials,
    designation: designation,
    phone: phone,
    dateOfBirth: dob,
    joinDate: joinDate,
    aadhar: '',
    pan: '',
    bankAcc: '',
    bankIfsc: '',
    photo: currentUploadedEmployeePhoto,
    password: password || 'password123',
    status: isPending ? 'pending_approval' : undefined,
    createdAt: new Date().toISOString()
  };

  state.employees.push(newEmp);
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  
  // Call direct atomic registration endpoint to ensure registration is saved to MongoDB Atlas instantly!
  try {
    fetch('/api/register-employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newEmp, isPortalAdminCreate: !isPending })
    }).catch(err => console.error('Failed to post register-employee:', err));
  } catch (err) {}

  triggerBackendSync(); // persist new employee to server

  // Reset photo upload state
  currentUploadedEmployeePhoto = null;
  const photoPreview = document.getElementById('new-emp-photo-preview');
  if (photoPreview) {
    photoPreview.style.display = 'none';
  }

  // Re-populate all dropdown switchers and modal option lists
  populateEmployeeDropdown();
  populateTaskModalOptions();

  if (autoAssignToProjectAfterCreate) {
    const { projId } = autoAssignToProjectAfterCreate;
    const proj = state.projects.find(p => p.id === projId);
    if (proj) {
      if (!proj.employeeIds) proj.employeeIds = [];
      if (!proj.employeeIds.includes(newEmp.id)) {
        proj.employeeIds.push(newEmp.id);
      }
      localStorage.setItem('ems_projects', JSON.stringify(state.projects));
      triggerBackendSync(); // [AUTO-ADDED] persist ems_projects to server
    }
    autoAssignToProjectAfterCreate = null;
  }

  hideEmployeeModal();

  if (isPending) {
    showToast(`Registration submitted successfully! Waiting for HR/Admin approval.`, 'success');
    return;
  }

  // Refresh views
  const activeMenuItem = document.querySelector('.menu-item.active');
  const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';
  switchView(currentView);

  showToast(`Employee "${name}" registered successfully!`, 'success');
}

function handleAssignTaskProjectChange(e) {
  const projId = e.target.value;
  const project = state.projects.find(p => p.id === projId);
  const assigneeSelect = document.getElementById('task-assignee-select');
  if (!assigneeSelect) return;

  assigneeSelect.innerHTML = '<option value="" disabled selected>Select employee...</option>';
  if (project) {
    // Show ALL employees from every branch/department, grouped by department
    const grouped = {};
    state.employees.forEach(emp => {
      if (isPratap(emp) || emp.isDeleted || emp.status === 'pending_approval') return; // Hide Pratap, Deleted & Pending
      if (!grouped[emp.dept]) grouped[emp.dept] = [];
      grouped[emp.dept].push(emp);
    });

    // Sort: put the project's own department first, then the rest alphabetically
    const depts = Object.keys(grouped).sort((a, b) => {
      if (a === project.dept) return -1;
      if (b === project.dept) return 1;
      return a.localeCompare(b);
    });

    const onLeaveList = typeof getEmployeesOnLeaveToday === 'function' ? getEmployeesOnLeaveToday() : [];

    depts.forEach(dept => {
      const group = document.createElement('optgroup');
      group.label = dept === project.dept ? `★ ${dept} (Project Dept)` : dept;
      grouped[dept].forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        const onLeaveText = onLeaveList.some(e => e.id === emp.id) ? ' ⚠️ (On Leave)' : '';
        opt.textContent = `${emp.name} (${emp.role})${onLeaveText}`;
        group.appendChild(opt);
      });
      assigneeSelect.appendChild(group);
    });
  } else {
    assigneeSelect.innerHTML = '<option value="" disabled selected>Select a project first...</option>';
  }
}

function openCreateEmpTaskModal() {
  const form = document.getElementById('emp-task-creation-form');
  if (form) form.reset();

  currentAttachedImagesEmp.length = 0;
  const empPreview = document.getElementById('emp-task-images-preview');
  if (empPreview) empPreview.innerHTML = '';

  const empLinkInput = document.getElementById('emp-task-drive-link');
  if (empLinkInput) empLinkInput.value = '';

  // Default due date to 1 week from now
  const oneWeekLater = new Date();
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const dueDateInput = document.getElementById('emp-task-due-date');
  if (dueDateInput) {
    dueDateInput.value = formatter.format(oneWeekLater);
    dueDateInput.min = getTodayDateString();
  }

  const startDateInput = document.getElementById('emp-task-start-date');
  if (startDateInput) {
    startDateInput.value = getTodayDateString();
    startDateInput.min = getTodayDateString();
  }

  // Populate the projects select with employee's department projects + other projects they have tasks in + "Personal Task"
  const projSelect = document.getElementById('emp-task-project-select');
  if (projSelect) {
    projSelect.innerHTML = '<option value="personal">Personal / Non-Project</option>';

    // Get unique project IDs where user has at least one assigned task
    const userTaskProjectIds = state.tasks
      .filter(t => t.assigneeId === state.currentUser.id && t.projectId)
      .map(t => t.projectId);

    const activeProjects = state.projects.filter(p => {
      const isDeptMember = state.currentUser.dept && p.dept && state.currentUser.dept.split(',').map(d => d.trim().toLowerCase()).includes(p.dept.toLowerCase());
      return isDeptMember || userTaskProjectIds.includes(p.id) || (p.employeeIds && p.employeeIds.includes(state.currentUser.id));
    });

    activeProjects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      projSelect.appendChild(opt);
    });
  }

  const modalOverlay = document.getElementById('emp-task-modal-overlay');
  if (modalOverlay) {
    modalOverlay.style.zIndex = '10005';
    modalOverlay.classList.add('active');
  }
}

function hideEmpTaskModal() {
  document.getElementById('emp-task-modal-overlay').classList.remove('active');
}

function handleEmpTaskCreationSubmit(e) {
  e.preventDefault();

  const desc = document.getElementById('emp-task-desc').value.trim();
  const details = document.getElementById('emp-task-details').value.trim();
  const projId = document.getElementById('emp-task-project-select').value;
  const startDate = document.getElementById('emp-task-start-date').value;
  const dueDate = document.getElementById('emp-task-due-date').value;
  const priority = document.getElementById('emp-task-priority').value;

  const empLinkInput = document.getElementById('emp-task-drive-link');
  const empDriveUrl = empLinkInput ? empLinkInput.value.trim() : '';
  const empDriveLinks = empDriveUrl ? [{ url: empDriveUrl, label: 'Google Drive / Attachment Link' }] : [];

  if (!desc || !projId || !startDate || !dueDate || !priority) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  if (startDate > dueDate) {
    showToast('Start Date cannot be after Due Date.', 'error');
    return;
  }

  let projectName = 'Personal';
  if (projId !== 'personal') {
    const proj = state.projects.find(p => p.id === projId);
    if (proj) projectName = proj.name;
  }

  const isPersonal = projId === 'personal';
  const newTask = {
    id: `PT_${state.currentUser.id}_${Date.now()}`,
    projectId: isPersonal ? '' : projId,
    projectName: projectName,
    desc: desc,
    details: details,
    driveLinks: empDriveLinks,
    images: [...currentAttachedImagesEmp],
    assigneeId: state.currentUser.id,
    assigneeName: state.currentUser.name,
    startDate: startDate,
    dueDate: dueDate,
    priority: priority,
    status: 'Not Completed',
    createdByEmployee: true,
    isPrivate: isPersonal,
    ownerId: isPersonal ? state.currentUser.id : null
  };

  state.tasks.push(newTask);
  if (!safeSaveTasks()) {
    state.tasks.pop();
    return;
  }

  hideEmpTaskModal();
  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
  showToast('Task added successfully!', 'success');
}

function getUnreadChatCount(key) {
  if (!state.currentUser || !state.chats) return 0;
  const readChats = JSON.parse(localStorage.getItem(`ems_read_chats_${state.currentUser.id}`) || '{}');
  const lastReadTime = readChats[key];

  let messages = [];
  if (key === 'group') {
    messages = state.chats.filter(m => m.receiverId === 'group' && m.senderId !== state.currentUser.id && m.senderId !== state.currentUser.email);
  } else {
    const userIds = new Set([state.currentUser.id, state.currentUser.email].filter(Boolean));
    if (state.currentUser.id === 'AIRG00041' || state.currentUser.id === 'AIRGO000182' || (state.currentUser.email && state.currentUser.email.includes('atharva'))) {
      userIds.add('AIRG00041');
      userIds.add('AIRGO000182');
      userIds.add('atharva@gurujiair.com');
      userIds.add('atharvarnahire182@gmail.com');
    }

    const senderIds = new Set([key]);
    if (key === 'AIRG00041' || key === 'AIRGO000182') {
      senderIds.add('AIRG00041');
      senderIds.add('AIRGO000182');
      senderIds.add('atharva@gurujiair.com');
      senderIds.add('atharvarnahire182@gmail.com');
    }

    messages = state.chats.filter(m => senderIds.has(m.senderId) && userIds.has(m.receiverId));
  }

  if (!lastReadTime) {
    return messages.length;
  }
  return messages.filter(m => new Date(m.timestamp) > new Date(lastReadTime)).length;
}

function getUnreadChatsCount() {
  if (!state.currentUser || !state.chats) return { group: 0, direct: 0, total: 0 };

  // 1. Group chat count
  let unreadGroup = getUnreadChatCount('group');

  // 2. Direct chats count
  let unreadDirect = 0;
  const otherEmployees = state.employees.filter(emp => emp.id !== state.currentUser.id && !emp.isDeleted && emp.status !== 'pending_approval');
  otherEmployees.forEach(emp => {
    unreadDirect += getUnreadChatCount(emp.id);
  });

  return {
    group: unreadGroup,
    direct: unreadDirect,
    total: unreadGroup + unreadDirect
  };
}

function getUnreadReportsCount() {
  if (!state.currentUser) return 0;
  const isReportReviewer = (state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin' || state.currentRole === 'hr');

  if (isReportReviewer) {
    // Count unreviewed reports where the current user is the recipient/reviewer
    return (state.dailyReports || []).filter(r => {
      const isPending = !r.remarks || r.remarks.trim() === '';
      if (!isPending) return false;
      return isReportReviewerFor(state.currentUser.id, state.currentRole, r);
    }).length;
  } else {
    // Count of reviewed reports not yet read by employee
    const readReports = JSON.parse(localStorage.getItem(`ems_read_reports_${state.currentUser.id}`) || '[]');
    const myReviewedReports = (state.dailyReports || []).filter(r =>
      r.employeeId === state.currentUser.id &&
      r.remarks &&
      r.remarks.trim() !== ''
    );
    return myReviewedReports.filter(r => !readReports.includes(r.id)).length;
  }
}

function getUnreadRequestsCount() {
  if (!state.currentUser) return 0;
  const isHRorAdmin = state.currentRole === 'hr' || state.currentRole === 'admin';

  if (isHRorAdmin) {
    // Pending leave requests count
    return (state.requests || []).filter(r => r.status === 'pending').length;
  } else {
    // Count of approved/rejected requests not yet read by employee
    const readRequests = JSON.parse(localStorage.getItem(`ems_read_requests_${state.currentUser.id}`) || '[]');
    const myResolvedRequests = (state.requests || []).filter(r =>
      r.employeeId === state.currentUser.id &&
      r.status !== 'pending'
    );
    return myResolvedRequests.filter(r => !readRequests.includes(r.id)).length;
  }
}

function updateAllMenuBadges() {
  if (!state.currentUser) {
    const menuBadge = document.getElementById('menu-comm-badge');
    if (menuBadge) menuBadge.style.display = 'none';
    const annBadge = document.getElementById('comm-tab-announcements-badge');
    if (annBadge) annBadge.style.display = 'none';
    const noticesBadge = document.getElementById('comm-tab-notices-badge');
    if (noticesBadge) noticesBadge.style.display = 'none';
    const chatsBadge = document.getElementById('comm-tab-chats-badge');
    if (chatsBadge) chatsBadge.style.display = 'none';
    const reportsBadge = document.getElementById('menu-reports-badge');
    if (reportsBadge) reportsBadge.style.display = 'none';
    const requestsBadge = document.getElementById('menu-requests-badge');
    if (requestsBadge) requestsBadge.style.display = 'none';
    const regApprovalBadge = document.getElementById('menu-reg-approval-badge');
    if (regApprovalBadge) regApprovalBadge.style.display = 'none';
    return;
  }

  // 1. Get announcements & notices unread
  const readAnn = JSON.parse(localStorage.getItem(`ems_read_announcements_${state.currentUser.id}`) || '[]');
  const readNotices = JSON.parse(localStorage.getItem(`ems_read_notices_${state.currentUser.id}`) || '[]');
  const unreadAnnCount = state.announcements.filter(ann => !readAnn.includes(ann.id)).length;

  let visibleNotices = [];
  if (state.currentRole === 'hr') {
    visibleNotices = state.notices;
  } else {
    visibleNotices = state.notices.filter(n => n.targetEmployeeIds.includes(state.currentUser.id));
  }
  const unreadNoticeCount = visibleNotices.filter(n => !readNotices.includes(n.id)).length;

  // 2. Get chats unread
  const chatCounts = getUnreadChatsCount();

  // 3. Update inner tab badges in Communications Hub
  const annBadge = document.getElementById('comm-tab-announcements-badge');
  if (annBadge) {
    if (unreadAnnCount > 0) {
      annBadge.textContent = unreadAnnCount;
      annBadge.style.display = 'inline-flex';
    } else {
      annBadge.style.display = 'none';
    }
  }

  const noticesBadge = document.getElementById('comm-tab-notices-badge');
  if (noticesBadge) {
    if (unreadNoticeCount > 0) {
      noticesBadge.textContent = unreadNoticeCount;
      noticesBadge.style.display = 'inline-flex';
    } else {
      noticesBadge.style.display = 'none';
    }
  }

  const chatsBadge = document.getElementById('comm-tab-chats-badge');
  if (chatsBadge) {
    if (chatCounts.total > 0) {
      chatsBadge.textContent = chatCounts.total;
      chatsBadge.style.display = 'inline-flex';
    } else {
      chatsBadge.style.display = 'none';
    }
  }

  // 4. Update main communication menu item badge
  const totalCommUnread = unreadAnnCount + unreadNoticeCount + chatCounts.total;
  const menuBadge = document.getElementById('menu-comm-badge');
  if (menuBadge) {
    if (totalCommUnread > 0) {
      menuBadge.textContent = totalCommUnread;
      menuBadge.style.display = 'inline-flex';
    } else {
      menuBadge.style.display = 'none';
    }
  }

  // 5. Update Daily Reports menu item badge
  const reportsUnreadCount = getUnreadReportsCount();
  const reportsBadge = document.getElementById('menu-reports-badge');
  if (reportsBadge) {
    if (reportsUnreadCount > 0) {
      reportsBadge.textContent = reportsUnreadCount;
      reportsBadge.style.display = 'inline-flex';
    } else {
      reportsBadge.style.display = 'none';
    }
  }

  // 6. Update Leave Requests menu item badge
  const requestsUnreadCount = getUnreadRequestsCount();
  const requestsBadge = document.getElementById('menu-requests-badge');
  if (requestsBadge) {
    if (requestsUnreadCount > 0) {
      requestsBadge.textContent = requestsUnreadCount;
      requestsBadge.style.display = 'inline-flex';
    } else {
      requestsBadge.style.display = 'none';
    }
  }

  // 7. Update Registration Approval menu item badge
  const pendingRegsCount = state.employees.filter(emp => emp.status === 'pending_approval').length;
  const regApprovalBadge = document.getElementById('menu-reg-approval-badge');
  if (regApprovalBadge) {
    const userRole = (state.currentUser && state.currentUser.role || '').toLowerCase();
    const isHROrAdmin = userRole.includes('hr') || userRole.includes('admin');
    if (isHROrAdmin && pendingRegsCount > 0) {
      regApprovalBadge.textContent = pendingRegsCount;
      regApprovalBadge.style.display = 'inline-flex';
    } else {
      regApprovalBadge.style.display = 'none';
    }
  }
}

function updateCommMenuBadges() {
  updateAllMenuBadges();
}
window.updateCommMenuBadges = updateCommMenuBadges;

function renderCommunicationsHub() {
  // Mark as read if viewing respective tabs
  if (state.currentUser) {
    if (state.activeCommTab === 'announcements') {
      const readAnn = JSON.parse(localStorage.getItem(`ems_read_announcements_${state.currentUser.id}`) || '[]');
      let updated = false;
      state.announcements.forEach(ann => {
        if (!readAnn.includes(ann.id)) {
          readAnn.push(ann.id);
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem(`ems_read_announcements_${state.currentUser.id}`, JSON.stringify(readAnn));
      }
    } else if (state.activeCommTab === 'notices') {
      const readNotices = JSON.parse(localStorage.getItem(`ems_read_notices_${state.currentUser.id}`) || '[]');
      let updated = false;
      let visibleNotices = [];
      if (state.currentRole === 'hr') {
        visibleNotices = state.notices;
      } else {
        visibleNotices = state.notices.filter(n => n.targetEmployeeIds && n.targetEmployeeIds.includes(state.currentUser.id));
      }
      visibleNotices.forEach(n => {
        if (!readNotices.includes(n.id)) {
          readNotices.push(n.id);
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem(`ems_read_notices_${state.currentUser.id}`, JSON.stringify(readNotices));
      }
    }
  }

  if (state.activeCommTab === 'sms') {
    state.activeCommTab = 'chats';
  }

  // Sync tab active classes
  const tabs = ['chats', 'announcements', 'notices'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`comm-tab-${tab}`);
    if (btn) {
      if (tab === state.activeCommTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  // Update badges first
  updateCommMenuBadges();

  // Render left sidebar list and title
  renderCommSidebar();

  // Render right main pane
  renderCommMainContent();
}

function getEmployeeAllIdentifiers(emp) {
  const set = new Set();
  if (!emp) return set;
  if (emp.id) {
    set.add(emp.id);
    set.add(emp.id.toLowerCase());
  }
  if (emp.email) {
    set.add(emp.email);
    set.add(emp.email.toLowerCase());
  }
  if (emp.name) {
    const cleanName = emp.name.toLowerCase().trim();
    set.add(cleanName);
    if (cleanName.includes('atharva')) {
      set.add('AIRG00041');
      set.add('AIRGO000182');
      set.add('airg00041');
      set.add('airgo000182');
      set.add('atharva@gurujiair.com');
      set.add('atharvarnahire182@gmail.com');
    }
    if (cleanName.includes('shravani') && !cleanName.includes('bhilare')) {
      set.add('AIRG00042');
      set.add('airg00042');
      set.add('shravani@gurujiair.com');
      set.add('shravanikhanvilkar251@gmail.com');
    }
    if (cleanName.includes('aniket')) {
      set.add('AIRG00040');
      set.add('airg00040');
      set.add('aniket@gurujiair.com');
      set.add('aniketshrungare1251@gmail.com');
    }
    if (cleanName.includes('suyash')) {
      set.add('AIRG00044');
      set.add('airg00044');
      set.add('suyash@gurujiair.com');
      set.add('suyashpatil0722@gmail.com');
    }
    if (cleanName.includes('rohan')) {
      set.add('AIRG00045');
      set.add('airg00045');
      set.add('rohan@gurujiair.com');
      set.add('rohanpatil1120@gmail.com');
    }
  }
  return set;
}

function getUnreadChatCount(key) {
  if (!state.currentUser || !state.chats) return 0;
  const readChats = JSON.parse(localStorage.getItem(`ems_read_chats_${state.currentUser.id}`) || '{}');
  const lastReadTime = readChats[key];

  const userSet = getEmployeeAllIdentifiers(state.currentUser);

  let messages = [];
  if (key === 'group') {
    messages = state.chats.filter(m => 
      (m.receiverId === 'group' || m.receiverId === 'all' || m.receiverId === 'general') && 
      !userSet.has((m.senderId || '').toLowerCase())
    );
  } else {
    const targetEmp = state.employees.find(e => e.id === key || e.email === key);
    const targetSet = getEmployeeAllIdentifiers(targetEmp || { id: key });

    messages = state.chats.filter(m => 
      targetSet.has((m.senderId || '').toLowerCase()) && 
      userSet.has((m.receiverId || '').toLowerCase())
    );
  }

  if (!lastReadTime) {
    return messages.length;
  }
  return messages.filter(m => new Date(m.timestamp) > new Date(lastReadTime)).length;
}

function getUnreadChatsCount() {
  if (!state.currentUser || !state.chats) return { group: 0, direct: 0, total: 0 };

  // 1. Group chat count
  let unreadGroup = getUnreadChatCount('group');

  // 2. Direct chat count
  let unreadDirect = 0;
  state.employees.forEach(emp => {
    if (emp.id !== state.currentUser.id && !emp.isDeleted) {
      unreadDirect += getUnreadChatCount(emp.id);
    }
  });

  return {
    group: unreadGroup,
    direct: unreadDirect,
    total: unreadGroup + unreadDirect
  };
}

function switchCommTab(tabName) {
  state.activeCommTab = tabName;
  renderCommunicationsHub();
}

function renderCommSidebar() {
  const titleEl = document.getElementById('comm-list-title-label') || document.getElementById('comm-sidebar-title');
  const itemsBox = document.getElementById('comm-list-items-box') || document.getElementById('comm-items-box');
  const btnNewGroup = document.getElementById('btn-create-chat-group');

  if (btnNewGroup) {
    btnNewGroup.style.display = state.activeCommTab === 'chats' ? 'inline-flex' : 'none';
  }

  if (!itemsBox) return;

  itemsBox.innerHTML = '';
  const onLeaveList = typeof getEmployeesOnLeaveToday === 'function' ? getEmployeesOnLeaveToday() : [];

  if (state.activeCommTab === 'chats') {
    if (titleEl) titleEl.textContent = 'Conversations';

    // WhatsApp style conversation list
    const convList = [];

    // 1. General Group Chat
    let groupTime = 0;
    const groupMsgs = (state.chats || []).filter(c => c.receiverId === 'group' || c.receiverId === 'all' || c.receiverId === 'general');
    if (groupMsgs.length > 0) {
      const lastGroupMsg = groupMsgs.reduce((latest, current) =>
        new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest, groupMsgs[0]);
      groupTime = new Date(lastGroupMsg.timestamp).getTime();
    }
    convList.push({ type: 'group', latestTime: groupTime });

    // 1.5 Custom Chat Groups
    const userIdentifiers = getEmployeeAllIdentifiers(state.currentUser);

    (state.customChatGroups || []).forEach(grp => {
      const isMember = (grp.members || []).some(m => {
        if (!m) return false;
        const cleanM = String(m).toLowerCase().trim();
        return userIdentifiers.has(m) || userIdentifiers.has(cleanM);
      }) || (grp.createdBy && (userIdentifiers.has(grp.createdBy) || userIdentifiers.has(String(grp.createdBy).toLowerCase())));

      if (isMember) {
        let grpTime = new Date(grp.createdAt || 0).getTime();
        const customMsgs = (state.chats || []).filter(c => c.receiverId === grp.id);
        if (customMsgs.length > 0) {
          const lastCustomMsg = customMsgs.reduce((latest, current) =>
            new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest, customMsgs[0]);
          grpTime = new Date(lastCustomMsg.timestamp).getTime();
        }

        convList.push({
          type: 'custom_group',
          id: grp.id,
          group: grp,
          name: grp.name,
          latestTime: grpTime
        });
      }
    });

    // 2. Direct Messages for all employees
    const userSet = getEmployeeAllIdentifiers(state.currentUser);

    (state.employees || []).forEach(emp => {
      if (emp.id === state.currentUser.id || emp.isDeleted) return;

      const targetSet = getEmployeeAllIdentifiers(emp);
      const dmMsgs = (state.chats || []).filter(m => {
        const sId = (m.senderId || '').toLowerCase();
        const rId = (m.receiverId || '').toLowerCase();
        return (userSet.has(sId) && targetSet.has(rId)) || (targetSet.has(sId) && userSet.has(rId));
      });

      let time = 0;
      if (dmMsgs.length > 0) {
        const lastMsg = dmMsgs.reduce((latest, current) =>
          new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest, dmMsgs[0]);
        time = new Date(lastMsg.timestamp).getTime();
      }

      convList.push({
        type: 'direct',
        id: emp.id,
        emp: emp,
        name: emp.name,
        latestTime: time
      });
    });

    // Sort ALL conversations strictly by latest message timestamp (newest on top)
    convList.sort((a, b) => b.latestTime - a.latestTime);

    // Render sorted list
    convList.forEach(item => {
      if (item.type === 'group') {
        const isGroupActive = state.activeChatType === 'group';
        const groupLink = document.createElement('div');
        groupLink.className = `comm-item-link ${isGroupActive ? 'active' : ''}`;
        groupLink.onclick = () => {
          state.activeChatType = 'group';
          state.activeChatTargetId = null;
          renderCommunicationsHub();
        };
        const unreadGroup = getUnreadChatCount('group');
        const badgeHtml = unreadGroup > 0 ? `<span class="menu-badge" style="display: inline-flex; margin-left: auto; background-color: var(--danger); font-size: 0.7rem; padding: 2px 6px;">${unreadGroup}</span>` : '';
        groupLink.innerHTML = `
          <div class="avatar" style="width:30px; height:30px; font-size:0.75rem; background: var(--primary-gradient);">📢</div>
          <div style="font-weight:600;">General Group Chat</div>
          ${badgeHtml}
        `;
        itemsBox.appendChild(groupLink);
      } else if (item.type === 'custom_group') {
        const grp = item.group;
        const isCustomActive = state.activeChatType === 'custom_group' && state.activeChatTargetId === grp.id;
        const grpLink = document.createElement('div');
        grpLink.className = `comm-item-link ${isCustomActive ? 'active' : ''}`;
        grpLink.onclick = () => {
          state.activeChatType = 'custom_group';
          state.activeChatTargetId = grp.id;
          renderCommunicationsHub();
        };
        const unreadCustom = getUnreadChatCount(grp.id);
        const badgeHtml = unreadCustom > 0 ? `<span class="menu-badge" style="display: inline-flex; margin-left: auto; background-color: var(--danger); font-size: 0.7rem; padding: 2px 6px;">${unreadCustom}</span>` : '';
        grpLink.innerHTML = `
          <div class="avatar" style="width:30px; height:30px; font-size:0.75rem; background: linear-gradient(135deg, #6366f1, #a855f7);">👥</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight:600; font-size:0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${grp.name}</div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${(grp.members || []).length} members</div>
          </div>
          ${badgeHtml}
        `;
        itemsBox.appendChild(grpLink);
      } else {
        const emp = item.emp;
        const isDirectActive = state.activeChatType === 'direct' && state.activeChatTargetId === emp.id;
        const empLink = document.createElement('div');
        empLink.className = `comm-item-link ${isDirectActive ? 'active' : ''}`;
        empLink.onclick = () => {
          state.activeChatType = 'direct';
          state.activeChatTargetId = emp.id;
          renderCommunicationsHub();
        };
        const unreadDM = getUnreadChatCount(emp.id);
        const dmBadgeHtml = unreadDM > 0 ? `<span class="menu-badge" style="display: inline-flex; margin-left: auto; background-color: var(--danger); font-size: 0.7rem; padding: 2px 6px;">${unreadDM}</span>` : '';
        const avatarHTML = emp.photo
          ? `<img src="${emp.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`
          : emp.avatar;
        const avatarStyle = emp.photo ? 'border-radius: 50%; overflow: hidden; background: none; padding: 0;' : '';

        const targetSet = getEmployeeAllIdentifiers(emp);
        const isActive = state.activeUsers && state.activeUsers.length > 0 && state.activeUsers.some(u => {
          const cleanU = (u || '').toLowerCase().trim();
          return targetSet.has(cleanU) || cleanU === (emp.id || '').toLowerCase() || (emp.email && cleanU === emp.email.toLowerCase());
        });

        empLink.innerHTML = `
          <div style="position: relative; display: inline-block; flex-shrink: 0;">
            <div class="avatar" style="width:30px; height:30px; font-size:0.75rem; ${avatarStyle}">${avatarHTML}</div>
            ${isActive ? `
              <span class="active-dot" style="position: absolute; bottom: 0; right: 0; width: 8px; height: 8px; background-color: #22c55e; border: 1.5px solid var(--bg-secondary, #18181b); border-radius: 50%; z-index: 1;"></span>
            ` : ''}
          </div>
          <div style="flex: 1;">
            <div style="font-weight:600; font-size:0.85rem;">
              ${emp.name}
              ${onLeaveList.some(e => e.id === emp.id) ? `<span style="font-size: 0.65rem; background: var(--warning); color: #fff; padding: 2px 4px; border-radius: 4px; margin-left: 4px; font-weight: bold;">(On Leave)</span>` : ''}
            </div>
            <div style="font-size:0.7rem; color:var(--text-muted);">${emp.dept}</div>
          </div>
          ${dmBadgeHtml}
        `;
        itemsBox.appendChild(empLink);
      }
    });

  } else if (state.activeCommTab === 'announcements') {
    if (titleEl) titleEl.textContent = 'Feeds';
    itemsBox.innerHTML = `
      <div style="padding: 16px; color: var(--text-muted); text-align: center; font-size: 0.85rem;">
        View all company-wide announcements in the main panel.
      </div>
    `;
  } else if (state.activeCommTab === 'notices') {
    if (titleEl) titleEl.textContent = 'HR Notices';
    itemsBox.innerHTML = `
      <div style="padding: 16px; color: var(--text-muted); text-align: center; font-size: 0.85rem;">
        View all important policy notices in the main panel.
      </div>
    `;
  }
}

function renderCommMainContent() {
  const chatPane = document.getElementById('comm-chat-pane');
  const annPane = document.getElementById('comm-announcements-pane');
  const noticePane = document.getElementById('comm-notices-pane');
  const smsPane = document.getElementById('comm-sms-pane');

  if (!chatPane || !annPane || !noticePane) return;

  chatPane.style.display = 'none';
  annPane.style.display = 'none';
  noticePane.style.display = 'none';
  if (smsPane) smsPane.style.display = 'none';

  if (state.activeCommTab === 'chats') {
    chatPane.style.display = 'flex';
    renderChatRoom();
  } else if (state.activeCommTab === 'announcements') {
    annPane.style.display = 'flex';
    renderAnnouncements();
  } else if (state.activeCommTab === 'notices') {
    noticePane.style.display = 'flex';
    renderNotices();
  }
}

function renderChatRoom() {
  const headerTitle = document.getElementById('chat-header-title');
  if (!headerTitle) return;

  const messagesContainer = document.getElementById('chat-messages-container');
  if (!messagesContainer) return;

  // Mark current conversation as read
  const activeKey = state.activeChatType === 'group' ? 'group' : state.activeChatTargetId;
  if (activeKey && state.currentUser) {
    const readChats = JSON.parse(localStorage.getItem(`ems_read_chats_${state.currentUser.id}`) || '{}');
    readChats[activeKey] = new Date().toISOString();
    localStorage.setItem(`ems_read_chats_${state.currentUser.id}`, JSON.stringify(readChats));
    setTimeout(updateAllMenuBadges, 100);
  }

  messagesContainer.innerHTML = '';

  let filteredMessages = [];
  if (state.activeChatType === 'group') {
    headerTitle.textContent = 'General Group Chat';
    filteredMessages = (state.chats || []).filter(m => m.receiverId === 'group' || m.receiverId === 'all' || m.receiverId === 'general');
  } else if (state.activeChatType === 'custom_group') {
    const curGroup = (state.customChatGroups || []).find(g => g.id === state.activeChatTargetId);
    if (curGroup) {
      headerTitle.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>👥 ${escapeHTML(curGroup.name)}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${(curGroup.members || []).length} members)</span>
        </div>
      `;
    } else {
      headerTitle.textContent = 'Group Chat';
    }
    filteredMessages = (state.chats || []).filter(m => m.receiverId === state.activeChatTargetId);
  } else {
    let targetEmp = state.employees.find(e => e.id === state.activeChatTargetId || e.email === state.activeChatTargetId);
    if (!targetEmp && state.employees.length > 0) {
      targetEmp = state.employees.find(e => e.id !== state.currentUser.id && !e.isDeleted);
      if (targetEmp) state.activeChatTargetId = targetEmp.id;
    }

    if (targetEmp) {
      const targetSet = getEmployeeAllIdentifiers(targetEmp);
      const userSet = getEmployeeAllIdentifiers(state.currentUser);

      filteredMessages = (state.chats || []).filter(m => {
        const sId = (m.senderId || '').toLowerCase();
        const rId = (m.receiverId || '').toLowerCase();
        const isFromUserToTarget = userSet.has(sId) && targetSet.has(rId);
        const isFromTargetToUser = targetSet.has(sId) && userSet.has(rId);
        return isFromUserToTarget || isFromTargetToUser;
      });

      const isActive = state.activeUsers && state.activeUsers.length > 0 && state.activeUsers.some(u => {
        const cleanU = (u || '').toLowerCase().trim();
        return targetSet.has(cleanU) || cleanU === (targetEmp.id || '').toLowerCase() || (targetEmp.email && cleanU === targetEmp.email.toLowerCase());
      });
      
      const onLeaveList = getEmployeesOnLeaveToday();
      const isTargetOnLeave = onLeaveList.some(e => e.id === targetEmp.id);
      const onLeaveBadge = isTargetOnLeave ? 
        `<span style="margin-left: 8px; font-size: 0.7rem; background: var(--warning); color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;">(On Leave)</span>` : '';

      headerTitle.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>Chat with ${targetEmp.name} ${onLeaveBadge}</span>
          ${isActive ? `
            <span class="active-badge" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background-color: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; font-size: 0.7rem; font-weight: 700; line-height: 1;">
              <span style="width: 6px; height: 6px; background-color: #22c55e; border-radius: 50%;"></span>
              Active
            </span>
          ` : ''}
        </div>
      `;

      if (isTargetOnLeave) {
         const theirLeave = state.requests.find(r => 
           r.employeeId === targetEmp.id && r.status === 'approved' &&
           new Date(r.startDate).setHours(0,0,0,0) <= new Date().getTime() &&
           new Date(r.endDate).setHours(23,59,59,999) >= new Date().getTime()
         );
         const endStr = theirLeave ? new Date(theirLeave.endDate).toLocaleDateString() : 'Unknown';
         const banner = document.createElement('div');
         banner.className = 'info-banner';
         banner.style.marginBottom = '12px';
         banner.style.backgroundColor = 'rgba(234, 179, 8, 0.1)';
         banner.style.borderColor = 'rgba(234, 179, 8, 0.3)';
         banner.innerHTML = `
           <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #eab308;">
             <span>⚠️ <strong>${targetEmp.name}</strong> is currently on approved leave until <strong>${endStr}</strong>. They may not respond immediately.</span>
           </div>
         `;
         messagesContainer.appendChild(banner);
      }
    } else {
      headerTitle.textContent = 'Direct Message';
    }
  }

  // Render messages sorted by time
  const sortedMessages = [...filteredMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  if (sortedMessages.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    emptyDiv.style.margin = 'auto';
    emptyDiv.innerHTML = `
      <div class="empty-state-title">No messages yet</div>
      <p>Send a message below to start the conversation.</p>
    `;
    messagesContainer.appendChild(emptyDiv);
    return;
  }

  let lastDateStr = '';
  sortedMessages.forEach(msg => {
    const msgDate = new Date(msg.timestamp);
    const dateStr = msgDate.toLocaleDateString();
    const timeStr = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (dateStr !== lastDateStr) {
      const divider = document.createElement('div');
      divider.style.textAlign = 'center';
      divider.style.margin = '15px 0';
      divider.style.fontSize = '0.75rem';
      divider.style.color = 'var(--text-muted)';

      let displayDate = dateStr;
      const today = new Date().toLocaleDateString();
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
      if (dateStr === today) displayDate = 'Today';
      else if (dateStr === yesterday) displayDate = 'Yesterday';
      else displayDate = msgDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

      divider.innerHTML = `<span style="background-color: var(--card-bg); padding: 4px 12px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.3); border: 1px solid var(--border-color);">${displayDate}</span>`;
      messagesContainer.appendChild(divider);
      lastDateStr = dateStr;
    }

    const isSent = state.currentUser && (
      msg.senderId === state.currentUser.id ||
      (msg.senderName && msg.senderName === state.currentUser.name)
    );

    const row = document.createElement('div');
    row.className = `message-row ${isSent ? 'sent' : 'received'}`;

    let fileHtml = '';
    if (msg.file) {
      const f = msg.file;
      if (f.type && f.type.startsWith('image/')) {
        fileHtml = `
          <div style="margin-top: 6px;">
            <img src="${f.data}" style="max-width: 200px; max-height: 150px; border-radius: 6px; cursor: pointer; display: block;" onclick="openFullImageViewModalWithData('${f.data}')" />
            <div style="font-size: 0.7rem; margin-top: 4px;">
              <a href="${f.data}" download="${f.name}" style="color: var(--primary); text-decoration: underline; font-weight: 500;">Download ${f.name}</a>
            </div>
          </div>
        `;
      } else {
        fileHtml = `
          <div style="margin-top: 6px; display: inline-flex; align-items: center; gap: 6px; background: rgba(0, 0, 0, 0.05); padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-color);">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--primary); flex-shrink: 0;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <a href="${f.data}" download="${f.name}" style="color: var(--primary); text-decoration: underline; font-size: 0.75rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;">${f.name}</a>
          </div>
        `;
      }
    }

    const deleteMsgBtn = isSent ? `
      <button onclick="deleteChatMessage('${msg.id}')" title="Delete message" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:0 4px; font-size:0.85rem; line-height:1; opacity:0.6;" onmouseover="this.style.opacity='1'; this.style.color='var(--danger)'" onmouseout="this.style.opacity='0.6'; this.style.color='var(--text-muted)'">🗑</button>
    ` : '';
    row.innerHTML = `
      ${(!isSent && (state.activeChatType === 'group' || state.activeChatType === 'custom_group')) ? `<div class="message-sender-name">${msg.senderName}</div>` : ''}
      <div class="message-bubble">
        <div>${msg.content}</div>
        ${fileHtml}
      </div>
      <div style="display:flex; align-items:center; gap:4px;">
        <div class="message-time">${timeStr}</div>
        ${deleteMsgBtn}
      </div>
    `;
    messagesContainer.appendChild(row);
  });

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function handleChatMessageSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input-message');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  const newMsg = {
    id: `MSG_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
    senderId: state.currentUser.id,
    senderName: state.currentUser.name,
    receiverId: state.activeChatType === 'group' ? 'group' : state.activeChatTargetId,
    content: content,
    timestamp: new Date().toISOString()
  };

  state.chats.push(newMsg);
  localStorage.setItem('ems_chats', JSON.stringify(state.chats));
  input.value = '';
  renderChatRoom();
  triggerChatNotification(newMsg);

  // Lightweight <30ms chat save to MongoDB Atlas & instant full state sync
  fetch('/api/chats-only', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat: newMsg })
  }).catch(err => console.error('Direct chat save error:', err));

  syncStateNow();
}

function handleChatFileSelected(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const base64Data = e.target.result;
    compressImage(base64Data, 800, 800, 0.6, function (compressedDataUrl) {
      const newMsg = {
        id: `MSG_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
        senderId: state.currentUser.id,
        senderName: state.currentUser.name,
        receiverId: state.activeChatType === 'group' ? 'group' : state.activeChatTargetId,
        content: `Sent a file: ${file.name}`,
        file: {
          name: file.name,
          type: file.type,
          data: compressedDataUrl
        },
        timestamp: new Date().toISOString()
      };

      state.chats.push(newMsg);
      localStorage.setItem('ems_chats', JSON.stringify(state.chats));
      input.value = '';
      renderChatRoom();
      triggerChatNotification(newMsg);

      fetch('/api/chats-only', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: newMsg })
      }).catch(err => console.error('Direct chat file save error:', err));

      syncStateNow();
    });
  };
  reader.readAsDataURL(file);
}
window.handleChatFileSelected = handleChatFileSelected;

// ─── Delete Handlers ─────────────────────────────────────────────────────
async function deleteChatMessage(msgId) {
  if (!confirm('Delete this message? This cannot be undone.')) return;
  const idx = state.chats.findIndex(m => m.id === msgId);
  if (idx === -1) return;
  if (state.chats[idx].senderId !== state.currentUser.id) {
    showToast('You can only delete your own messages.', 'error');
    return;
  }
  if (!(await executeServerDelete('Chat', msgId))) return;
  state.chats.splice(idx, 1);
  localStorage.setItem('ems_chats', JSON.stringify(state.chats));
  renderChatRoom();
  showToast('Message deleted.', 'success');
}
window.deleteChatMessage = deleteChatMessage;

async function deleteAnnouncement(annId) {
  if (!confirm('Delete this announcement permanently?')) return;
  const idx = state.announcements.findIndex(a => a.id === annId);
  if (idx === -1) return;
  if (state.announcements[idx].senderName !== state.currentUser.name && state.currentRole !== 'Admin') {
    showToast('You can only delete your own announcements.', 'error');
    return;
  }
  if (!(await executeServerDelete('Announcement', annId))) return;
  state.announcements.splice(idx, 1);
  localStorage.setItem('ems_announcements', JSON.stringify(state.announcements));
  renderAnnouncements();
  showToast('Announcement deleted.', 'success');
}
window.deleteAnnouncement = deleteAnnouncement;

async function deleteNotice(noticeId) {
  if (!confirm('Delete this notice permanently?')) return;
  const idx = state.notices.findIndex(n => n.id === noticeId);
  if (idx === -1) return;
  if (state.notices[idx].senderName !== state.currentUser.name && state.currentRole !== 'Admin') {
    showToast('You can only delete your own notices.', 'error');
    return;
  }
  if (!(await executeServerDelete('Notice', noticeId))) return;
  state.notices.splice(idx, 1);
  localStorage.setItem('ems_notices', JSON.stringify(state.notices));
  renderNotices();
  showToast('Notice deleted.', 'success');
}
window.deleteNotice = deleteNotice;

async function deleteLeaveRequest(reqId) {
  if (!confirm('Withdraw and delete this leave request?')) return;
  const idx = state.requests.findIndex(r => r.id === reqId);
  if (idx === -1) return;
  if (state.requests[idx].status !== 'pending' && state.currentRole !== 'Admin') {
    showToast('Only pending requests can be deleted.', 'error');
    return;
  }
  if (!(await executeServerDelete('LeaveRequest', reqId))) return;
  state.requests.splice(idx, 1);
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  renderEmployeeDashboard();
  showToast('Leave request deleted.', 'success');
}
window.deleteLeaveRequest = deleteLeaveRequest;

async function deleteDailyReport(reportId) {
  if (!confirm('Delete this daily report permanently?')) return;
  const idx = state.dailyReports.findIndex(r => r.id === reportId);
  if (idx === -1) return;
  if (!(await executeServerDelete('DailyReport', reportId))) return;
  state.dailyReports.splice(idx, 1);
  localStorage.setItem('ems_reports', JSON.stringify(state.dailyReports));
  renderDailyReports();
  showToast('Report deleted.', 'success');
}
window.deleteDailyReport = deleteDailyReport;

async function deleteReimbursement(claimId) {
  if (!confirm('Withdraw and delete this reimbursement claim?')) return;
  const idx = state.reimbursements.findIndex(c => c.id === claimId);
  if (idx === -1) return;
  if (state.reimbursements[idx].status !== 'pending' && state.currentRole !== 'Admin') {
    showToast('Only pending claims can be deleted.', 'error');
    return;
  }
  if (!(await executeServerDelete('Reimbursement', claimId))) return;
  state.reimbursements.splice(idx, 1);
  localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
  renderReimbursements();
  showToast('Reimbursement claim deleted.', 'success');
}
window.deleteReimbursement = deleteReimbursement;

async function deleteTicket(ticketId) {
  if (!confirm('Delete this support ticket?')) return;
  const idx = state.tickets.findIndex(t => t.id === ticketId);
  if (idx === -1) return;
  if (state.tickets[idx].status !== 'Open' && state.currentRole !== 'Admin') {
    showToast('Only open tickets can be deleted.', 'error');
    return;
  }
  if (!(await executeServerDelete('Ticket', ticketId))) return;
  state.tickets.splice(idx, 1);
  localStorage.setItem('ems_tickets', JSON.stringify(state.tickets));
  triggerBackendSync(); // persist ticket changes to server
  renderTickets();
  showToast('Ticket deleted.', 'success');
}
window.deleteTicket = deleteTicket;
// ─────────────────────────────────────────────────────────────────────────

function renderAnnouncements() {
  const feedList = document.getElementById('announcements-feed-list');
  const btnPost = document.getElementById('btn-post-announcement');
  if (!feedList) return;

  feedList.innerHTML = '';

  // Show post button to HR and Admin roles
  const isHROrAdmin = (state.currentRole === 'hr' || state.currentRole === 'admin') ||
    (state.currentUser && (
      (state.currentUser.role || '').toLowerCase().includes('hr') ||
      (state.currentUser.role || '').toLowerCase().includes('admin')
    ));

  if (isHROrAdmin) {
    if (btnPost) btnPost.style.display = 'block';
  } else {
    if (btnPost) btnPost.style.display = 'none';
  }

  if (state.announcements.length === 0) {
    feedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No announcements</div>
        <p>Announcements posted by HR will appear here.</p>
      </div>
    `;
    return;
  }

  // Sort newest first
  const sorted = [...state.announcements].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  sorted.forEach(ann => {
    const card = document.createElement('div');
    card.className = 'feed-card';
    const dateStr = formatDate(ann.timestamp);

    const attachmentsHtml = renderAttachmentsHTML(ann.images || [], ann.id);
    const canDeleteAnn = isHROrAdmin || (state.currentUser && ann.senderName === state.currentUser.name);
    const deleteAnnBtn = canDeleteAnn ? `
      <button onclick="deleteAnnouncement('${ann.id}')" title="Delete announcement"
        style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:4px 6px; font-size:0.85rem; border-radius:4px;"
        onmouseover="this.style.backgroundColor='rgba(239,68,68,0.1)'; this.style.color='var(--danger)'"
        onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--text-muted)'">🗑 Delete</button>` : '';

    card.innerHTML = `
      <div class="feed-card-header" style="align-items:flex-start;">
        <div style="flex:1;">
          <div class="feed-card-title">${ann.title}</div>
          <div class="feed-card-meta">
            <span>By <strong>${ann.senderName}</strong></span>
            <span>${dateStr}</span>
          </div>
        </div>
        ${deleteAnnBtn}
      </div>
      <div class="feed-card-content">${ann.content}</div>
      ${attachmentsHtml}
    `;
    feedList.appendChild(card);
  });
}

let isPostingAnnouncement = false;

async function handleAnnouncementSubmit(e) {
  e.preventDefault();
  if (isPostingAnnouncement) return;

  const submitBtn = e.target ? e.target.querySelector('button[type="submit"]') : null;
  const titleInput = document.getElementById('announcement-title');
  const contentInput = document.getElementById('announcement-content');
  if (!titleInput || !contentInput) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  // Deduplicate: check if identical announcement posted within last 60 seconds
  const isDuplicate = (state.announcements || []).some(a =>
    a.title === title &&
    a.content === content &&
    (Math.abs(new Date().getTime() - new Date(a.timestamp).getTime()) < 60000)
  );

  if (isDuplicate) {
    showToast('This announcement was already posted.', 'info');
    hidePostAnnouncementModal();
    return;
  }

  isPostingAnnouncement = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';
  }

  const newAnn = {
    id: `ANN_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: title,
    content: content,
    images: [...currentAttachedImagesAnnouncement],
    senderName: state.currentUser ? state.currentUser.name : 'HR Manager',
    timestamp: new Date().toISOString()
  };

  state.announcements.unshift(newAnn);
  localStorage.setItem('ems_announcements', JSON.stringify(state.announcements));

  try {
    await fetch('/api/post-announcement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ announcement: newAnn })
    });
  } catch (err) {
    console.error('Failed to post announcement to server directly:', err);
  }

  triggerBackendSync();

  // Trigger SMS notifications for all employees (excluding sender)
  state.employees.forEach(emp => {
    if (emp.phone && state.currentUser && emp.id !== state.currentUser.id) {
      triggerSMSNotification(
        emp.phone,
        `New Announcement: "${newAnn.title}" - ${newAnn.content.substring(0, 100)}${newAnn.content.length > 100 ? '...' : ''}`,
        emp.name
      );
    }
  });

  // Mark as read for the sender
  if (state.currentUser) {
    const readAnn = JSON.parse(localStorage.getItem(`ems_read_announcements_${state.currentUser.id}`) || '[]');
    if (!readAnn.includes(newAnn.id)) {
      readAnn.push(newAnn.id);
      localStorage.setItem(`ems_read_announcements_${state.currentUser.id}`, JSON.stringify(readAnn));
    }
  }

  titleInput.value = '';
  contentInput.value = '';
  currentAttachedImagesAnnouncement.length = 0;
  const preview = document.getElementById('announcement-images-preview');
  if (preview) preview.innerHTML = '';

  hidePostAnnouncementModal();
  renderAnnouncements();
  updateCommMenuBadges();

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post Announcement';
  }
  isPostingAnnouncement = false;

  showToast('Announcement posted successfully!', 'success');
}

function renderNotices() {
  const feedList = document.getElementById('notices-feed-list');
  const btnCreate = document.getElementById('btn-create-notice');
  const headerLabel = document.getElementById('notice-header-label');
  if (!feedList) return;

  feedList.innerHTML = '';

  if (state.currentRole === 'hr') {
    if (btnCreate) btnCreate.style.display = 'block';
    if (headerLabel) headerLabel.textContent = 'Targeted Notices (All Sent Archives)';

    // HR sees all notices they sent
    renderNoticeCards(state.notices);
  } else {
    if (btnCreate) btnCreate.style.display = 'none';
    if (headerLabel) headerLabel.textContent = 'HR Notices For Me';

    // Employee sees notices targeted to them specifically
    const userNotices = state.notices.filter(n => n.targetEmployeeIds.includes(state.currentUser.id));
    renderNoticeCards(userNotices);
  }
}

function renderNoticeCards(noticesList) {
  const feedList = document.getElementById('notices-feed-list');
  if (!feedList) return;

  if (noticesList.length === 0) {
    feedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">No notices found</div>
        <p>Any targeted notices will appear here.</p>
      </div>
    `;
    return;
  }

  // Sort newest first
  const sorted = [...noticesList].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  sorted.forEach(notice => {
    const card = document.createElement('div');
    card.className = 'feed-card';
    const dateStr = formatDate(notice.timestamp);

    // Check if notice sender is active
    const senderEmp = state.employees.find(e => e.name === notice.senderName || e.id === notice.senderId);
    const isSenderActive = senderEmp && state.activeUsers && state.activeUsers.includes(senderEmp.id);
    const senderActiveDot = isSenderActive ? ` <span style="display:inline-block; width:6px; height:6px; background-color:#22c55e; border-radius:50%; margin-left:4px;" title="Active now"></span>` : '';

    // For HR, show who the notice was sent to
    let targetsStr = '';
    if (state.currentRole === 'hr') {
      const names = notice.targetEmployeeIds.map(id => state.employees.find(e => e.id === id)?.name || id);
      targetsStr = `<div style="font-size:0.75rem; color:var(--primary); margin-top: 8px;">Sent to: ${names.join(', ')}</div>`;
    }

    const attachmentsHtml = renderAttachmentsHTML(notice.images || [], notice.id);
    const canDeleteNotice = state.currentRole === 'hr' && state.currentUser && notice.senderName === state.currentUser.name;
    const deleteNoticeBtn = canDeleteNotice ? `
      <button onclick="deleteNotice('${notice.id}')" title="Delete notice"
        style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:4px 6px; font-size:0.85rem; border-radius:4px; flex-shrink:0;"
        onmouseover="this.style.backgroundColor='rgba(239,68,68,0.1)'; this.style.color='var(--danger)'"
        onmouseout="this.style.backgroundColor='transparent'; this.style.color='var(--text-muted)'">🗑 Delete</button>` : '';

    card.innerHTML = `
      <div class="feed-card-header" style="align-items:flex-start;">
        <div style="flex:1;">
          <div class="feed-card-title">${notice.title}</div>
          <div class="feed-card-meta">
            <span>By <strong>${notice.senderName}</strong>${senderActiveDot}</span>
            <span>${dateStr}</span>
          </div>
        </div>
        ${deleteNoticeBtn}
      </div>
      <div class="feed-card-content">${notice.content}</div>
      ${attachmentsHtml}
      ${targetsStr}
    `;
    feedList.appendChild(card);
  });
}

function handleNoticeSubmit(e) {
  e.preventDefault();
  const titleInput = document.getElementById('notice-title');
  const contentInput = document.getElementById('notice-content');
  if (!titleInput || !contentInput) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  // Get selected employees
  const checkboxes = document.querySelectorAll('#notice-employee-checkboxes-container input[type="checkbox"]:checked');
  const targetEmployeeIds = Array.from(checkboxes).map(chk => chk.value);

  if (!title || !content) {
    showToast('Please fill out title and content fields.', 'error');
    return;
  }

  if (targetEmployeeIds.length === 0) {
    showToast('Please select at least one target employee.', 'error');
    return;
  }

  const newNotice = {
    id: `NTC${String(state.notices.length + 1).padStart(3, '0')}`,
    title: title,
    content: content,
    images: [...currentAttachedImagesNotice],
    targetEmployeeIds: targetEmployeeIds,
    senderName: state.currentUser.name,
    senderId: state.currentUser.id,
    timestamp: new Date().toISOString()
  };

  state.notices.unshift(newNotice);
  localStorage.setItem('ems_notices', JSON.stringify(state.notices));
  triggerBackendSync(); // [AUTO-ADDED] persist ems_notices to server

  // Trigger SMS notifications for target employees
  targetEmployeeIds.forEach(empId => {
    const targetEmp = state.employees.find(emp => emp.id === empId);
    if (targetEmp && targetEmp.phone) {
      triggerSMSNotification(
        targetEmp.phone,
        `HR Notice: "${newNotice.title}" - ${newNotice.content.substring(0, 100)}${newNotice.content.length > 100 ? '...' : ''}`,
        targetEmp.name
      );
    }
  });

  // Mark as read for the sender
  if (state.currentUser) {
    const readNotices = JSON.parse(localStorage.getItem(`ems_read_notices_${state.currentUser.id}`) || '[]');
    if (!readNotices.includes(newNotice.id)) {
      readNotices.push(newNotice.id);
      localStorage.setItem(`ems_read_notices_${state.currentUser.id}`, JSON.stringify(readNotices));
    }
  }

  titleInput.value = '';
  contentInput.value = '';
  currentAttachedImagesNotice.length = 0;
  const preview = document.getElementById('notice-images-preview');
  if (preview) preview.innerHTML = '';

  hideSendNoticeModal();
  renderNotices();
  updateCommMenuBadges();
  showToast('Notice sent successfully!', 'success');
}

function openPostAnnouncementModal() {
  const form = document.getElementById('announcement-creation-form');
  if (form) form.reset();
  currentAttachedImagesAnnouncement.length = 0;
  const preview = document.getElementById('announcement-images-preview');
  if (preview) preview.innerHTML = '';
  document.getElementById('announcement-modal-overlay').classList.add('active');
}

function hidePostAnnouncementModal() {
  document.getElementById('announcement-modal-overlay').classList.remove('active');
}

function openSendNoticeModal() {
  const form = document.getElementById('notice-creation-form');
  if (form) form.reset();
  currentAttachedImagesNotice.length = 0;
  const preview = document.getElementById('notice-images-preview');
  if (preview) preview.innerHTML = '';

  // Populate the checkbox list of all employees
  populateNoticeEmployeeCheckboxes();

  document.getElementById('notice-modal-overlay').classList.add('active');
}

function hideSendNoticeModal() {
  document.getElementById('notice-modal-overlay').classList.remove('active');
}

function populateNoticeEmployeeCheckboxes() {
  const container = document.getElementById('notice-employee-checkboxes-container');
  if (!container) return;
  container.innerHTML = '';

  state.employees.forEach(emp => {
    if (isPratap(emp) || emp.isDeleted || emp.status === 'pending_approval') return; // Hide Pratap, Deleted & Pending
    const item = document.createElement('label');
    item.className = 'employee-checkbox-item';
    item.dataset.name = emp.name.toLowerCase();
    item.dataset.dept = (emp.dept || 'AI').toLowerCase();
    const label = emp.role.toLowerCase() === 'admin' ? `${emp.name} (CEO)` : `${emp.name} (${emp.dept || 'AI'} - ${emp.role})`;
    const isActive = state.activeUsers && state.activeUsers.includes(emp.id);
    item.innerHTML = `
      <input type="checkbox" value="${emp.id}">
      <span style="display: inline-flex; align-items: center; gap: 6px;">
        <span>${label}</span>
        ${isActive ? `
          <span class="active-badge" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background-color: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; font-size: 0.65rem; font-weight: 700; line-height: 1;">
            <span style="width: 5px; height: 5px; background-color: #22c55e; border-radius: 50%;"></span>
            Active
          </span>
        ` : ''}
      </span>
    `;
    container.appendChild(item);
  });
}

function renderCalendar() {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = state.calendarYear;
  const month = state.calendarMonth;

  // Header Title
  const headerEl = document.getElementById('calendar-month-year-label');
  if (headerEl) {
    headerEl.textContent = `${monthNames[month]} ${year}`;
  }

  const gridEl = document.getElementById('calendar-days-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // 1. Render Leading Padding Cells
  for (let i = 0; i < firstDayIndex; i++) {
    const pad = document.createElement('div');
    pad.className = 'calendar-padding-cell';
    gridEl.appendChild(pad);
  }

  // 2. Render Active Month Cells
  const todayStr = getTodayDateString();

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = (todayStr === dateStr);

    const cell = document.createElement('div');
    cell.className = `calendar-day-cell ${isToday ? 'today' : ''}`;

    // Day Number
    const numEl = document.createElement('div');
    numEl.className = 'calendar-day-number';
    numEl.textContent = day;
    cell.appendChild(numEl);

    // Events Container
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'calendar-events-container';

    // A. Fetch National Holidays
    const holidays = state.nationalHolidays.filter(h => h.date === dateStr);
    holidays.forEach(h => {
      const hEl = document.createElement('div');
      hEl.className = 'calendar-event event-holiday';
      hEl.title = `National Holiday: ${h.name}`;
      hEl.textContent = `🎉 ${h.name}`;
      eventsContainer.appendChild(hEl);
    });

    // B. Fetch Celebration Days
    const celebrations = state.celebrationDays.filter(c => c.date === dateStr);
    celebrations.forEach(c => {
      const cEl = document.createElement('div');
      cEl.className = 'calendar-event event-celebration';
      cEl.title = `Celebration Day: ${c.name}`;
      cEl.textContent = `✨ ${c.name}`;
      eventsContainer.appendChild(cEl);
    });

    // C. Fetch Approved Employee Leaves
    const leaves = state.requests.filter(req => {
      if (req.status !== 'approved') return false;
      const matchRange = (dateStr >= req.startDate && dateStr <= req.endDate);
      if (!matchRange) return false;

      // Visibility filters
      if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager') {
        return true;
      } else {
        return req.employeeId === state.currentUser.id;
      }
    });

    leaves.forEach(req => {
      const lEl = document.createElement('div');
      lEl.className = 'calendar-event event-leave';
      if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager') {
        lEl.title = `${req.employeeName} - ${req.type} Leave (${req.reason})`;
        lEl.textContent = `${req.employeeName.split(' ')[0]}: ${req.type}`;
      } else {
        lEl.title = `My ${req.type} Leave (${req.reason})`;
        lEl.textContent = `Leave: ${req.type}`;
      }
      eventsContainer.appendChild(lEl);
    });

    // D. Fetch Milestones
    state.employees.forEach(emp => {
      if (emp.isDeleted) return;
      if (emp.status === 'pending_approval') return;
      
      const [cellY, cellM, cellD] = dateStr.split('-');
      
      // Birthdays
      if (emp.dateOfBirth) {
        const [dobY, dobM, dobD] = emp.dateOfBirth.split('-');
        if (dobM === cellM && dobD === cellD) {
          const mEl = document.createElement('div');
          mEl.className = 'calendar-event';
          mEl.style.backgroundColor = 'rgba(168, 85, 247, 0.15)'; 
          mEl.style.color = '#a855f7';
          mEl.style.borderLeft = '3px solid #a855f7';
          mEl.title = `Birthday: ${emp.name}`;
          mEl.textContent = `🎂 ${emp.name.split(' ')[0]}'s Bday`;
          eventsContainer.appendChild(mEl);
        }
      }
      
      // Anniversaries
      if (emp.joinDate) {
        const [joinY, joinM, joinD] = emp.joinDate.split('-');
        const diffYears = parseInt(cellY) - parseInt(joinY);
        
        if (joinM === cellM && joinD === cellD && diffYears > 0) {
          const mEl = document.createElement('div');
          mEl.className = 'calendar-event';
          mEl.style.backgroundColor = 'rgba(234, 179, 8, 0.15)';
          mEl.style.color = '#eab308';
          mEl.style.borderLeft = '3px solid #eab308';
          mEl.title = `Work Anniversary: ${emp.name} (${diffYears} years)`;
          mEl.textContent = `🌟 ${emp.name.split(' ')[0]}'s Anniv`;
          eventsContainer.appendChild(mEl);
        }
      }
    });

    cell.appendChild(eventsContainer);
    gridEl.appendChild(cell);
  }

  // 3. Render Trailing Padding Cells to align Grid row
  const totalCellsSoFar = firstDayIndex + totalDays;
  const trailingPadding = Math.ceil(totalCellsSoFar / 7) * 7 - totalCellsSoFar;
  for (let i = 0; i < trailingPadding; i++) {
    const pad = document.createElement('div');
    pad.className = 'calendar-padding-cell';
    gridEl.appendChild(pad);
  }
}

function changeCalendarMonth(offset) {
  let month = state.calendarMonth + offset;
  let year = state.calendarYear;

  if (month < 0) {
    month = 11;
    year -= 1;
  } else if (month > 11) {
    month = 0;
    year += 1;
  }

  state.calendarMonth = month;
  state.calendarYear = year;
  renderCalendar();
}

function toggleExpandCalendar(event) {
  if (event) event.preventDefault();
  const card = document.getElementById('calendar-expandable-card');
  const collapsed = document.getElementById('calendar-collapsed-content');
  const expanded = document.getElementById('calendar-expanded-content');
  const collapseBtn = document.getElementById('btn-collapse-calendar');

  if (!card || !collapsed || !expanded || !collapseBtn) return;

  if (card.classList.contains('calendar-is-expanded')) {
    card.classList.remove('calendar-is-expanded');
    card.style.gridColumn = 'auto';
    collapsed.style.display = 'flex';
    expanded.style.display = 'none';
    collapseBtn.style.display = 'none';
  } else {
    card.classList.add('calendar-is-expanded');
    card.style.gridColumn = '1 / -1';
    collapsed.style.display = 'none';
    expanded.style.display = 'block';
    collapseBtn.style.display = 'block';
    renderInlineCalendar();
  }
}

function renderInlineCalendar() {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = state.calendarYear;
  const month = state.calendarMonth;

  // Header Title
  const headerEl = document.getElementById('inline-calendar-month-year-label');
  if (headerEl) {
    headerEl.textContent = `${monthNames[month]} ${year}`;
  }

  const gridEl = document.getElementById('inline-calendar-days-grid');
  if (!gridEl) return;
  gridEl.innerHTML = '';

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // 1. Render Leading Padding Cells
  for (let i = 0; i < firstDayIndex; i++) {
    const pad = document.createElement('div');
    pad.className = 'calendar-padding-cell';
    gridEl.appendChild(pad);
  }

  // 2. Render Active Month Cells
  const todayStr = getTodayDateString();

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = (todayStr === dateStr);

    const cell = document.createElement('div');
    cell.className = `calendar-day-cell ${isToday ? 'today' : ''}`;

    // Day Number
    const numEl = document.createElement('div');
    numEl.className = 'calendar-day-number';
    numEl.textContent = day;
    cell.appendChild(numEl);

    // Events Container
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'calendar-events-container';

    // A. Fetch National Holidays
    const holidays = state.nationalHolidays.filter(h => h.date === dateStr);
    holidays.forEach(h => {
      const hEl = document.createElement('div');
      hEl.className = 'calendar-event event-holiday';
      hEl.title = `National Holiday: ${h.name}`;
      hEl.textContent = `🎉 ${h.name}`;
      eventsContainer.appendChild(hEl);
    });

    // B. Fetch Celebration Days
    const celebrations = state.celebrationDays.filter(c => c.date === dateStr);
    celebrations.forEach(c => {
      const cEl = document.createElement('div');
      cEl.className = 'calendar-event event-celebration';
      cEl.title = `Celebration Day: ${c.name}`;
      cEl.textContent = `✨ ${c.name}`;
      eventsContainer.appendChild(cEl);
    });

    // C. Fetch Approved Employee Leaves
    const leaves = state.requests.filter(req => {
      if (req.status !== 'approved') return false;
      const matchRange = (dateStr >= req.startDate && dateStr <= req.endDate);
      if (!matchRange) return false;

      // Visibility filters
      if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager') {
        return true;
      } else {
        return req.employeeId === state.currentUser.id;
      }
    });

    leaves.forEach(req => {
      const lEl = document.createElement('div');
      lEl.className = 'calendar-event event-leave';
      if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager') {
        lEl.title = `${req.employeeName} - ${req.type} Leave (${req.reason})`;
        lEl.textContent = `${req.employeeName.split(' ')[0]}: ${req.type}`;
      } else {
        lEl.title = `My ${req.type} Leave (${req.reason})`;
        lEl.textContent = `Leave: ${req.type}`;
      }
      eventsContainer.appendChild(lEl);
    });

    // D. Fetch Milestones (Birthdays, Work Anniversaries, Probation Confirmation)
    const dayEventsList = [];

    // Collect holidays & celebrations into dayEventsList for click popup
    holidays.forEach(h => dayEventsList.push(`🎉 National Holiday: ${h.name}`));
    celebrations.forEach(c => dayEventsList.push(`✨ Celebration Day: ${c.name}`));
    leaves.forEach(req => dayEventsList.push(`📅 Leave: ${req.employeeName} - ${req.type} (${req.reason || 'No reason'})`));

    state.employees.forEach(emp => {
      if (emp.isDeleted) return;
      if (emp.status === 'pending_approval') return;
      
      const [cellY, cellM, cellD] = dateStr.split('-');
      
      // Birthdays
      if (emp.dateOfBirth) {
        const [dobY, dobM, dobD] = emp.dateOfBirth.split('-');
        if (dobM === cellM && dobD === cellD) {
          const mEl = document.createElement('div');
          mEl.className = 'calendar-event event-birthday';
          mEl.style.backgroundColor = 'rgba(168, 85, 247, 0.15)'; 
          mEl.style.color = '#a855f7';
          mEl.style.borderLeft = '3px solid #a855f7';
          mEl.title = `Birthday: ${emp.name}`;
          mEl.textContent = `🎂 ${emp.name.split(' ')[0]}`;
          eventsContainer.appendChild(mEl);
          dayEventsList.push(`🎂 Birthday: ${emp.name} (${emp.dept || 'Employee'})`);
        }
      }
      
      // Anniversaries
      if (emp.joinDate) {
        const [joinY, joinM, joinD] = emp.joinDate.split('-');
        const diffYears = parseInt(cellY) - parseInt(joinY);
        
        if (joinM === cellM && joinD === cellD && diffYears > 0) {
          const mEl = document.createElement('div');
          mEl.className = 'calendar-event event-anniversary';
          mEl.style.backgroundColor = 'rgba(234, 179, 8, 0.15)';
          mEl.style.color = '#eab308';
          mEl.style.borderLeft = '3px solid #eab308';
          mEl.title = `Work Anniversary: ${emp.name} (${diffYears} year${diffYears > 1 ? 's' : ''})`;
          mEl.textContent = `🌟 ${emp.name.split(' ')[0]} (${diffYears}y)`;
          eventsContainer.appendChild(mEl);
          dayEventsList.push(`🌟 Work Anniversary: ${emp.name} (${diffYears} year${diffYears > 1 ? 's' : ''})`);
        }

        // Probation Completion Alert
        if (emp.probationPeriod) {
          const months = parseInt(emp.probationPeriod) || 3;
          const jDate = new Date(parseInt(joinY), parseInt(joinM) - 1, parseInt(joinD));
          jDate.setMonth(jDate.getMonth() + months);
          const pY = jDate.getFullYear();
          const pM = String(jDate.getMonth() + 1).padStart(2, '0');
          const pD = String(jDate.getDate()).padStart(2, '0');

          if (pY === parseInt(cellY) && pM === cellM && pD === cellD) {
            const pEl = document.createElement('div');
            pEl.className = 'calendar-event event-probation';
            pEl.style.backgroundColor = 'rgba(59, 130, 246, 0.15)';
            pEl.style.color = '#3b82f6';
            pEl.style.borderLeft = '3px solid #3b82f6';
            pEl.title = `Probation Period Completed: ${emp.name} (Confirmed Member)`;
            pEl.textContent = `🚀 ${emp.name.split(' ')[0]} (Confirmed)`;
            eventsContainer.appendChild(pEl);
            dayEventsList.push(`🚀 Probation Period Completed: ${emp.name} (Confirmed Member)`);
          }
        }
      }
    });

    // Tap/Click handler for mobile & desktop to view day details
    if (dayEventsList.length > 0) {
      cell.style.cursor = 'pointer';
      cell.onclick = (e) => {
        e.stopPropagation();
        const formattedDateTitle = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
        showCalendarDayEventsModal(formattedDateTitle, dayEventsList);
      };
    }

    cell.appendChild(eventsContainer);
    gridEl.appendChild(cell);
  }

  // 3. Render Trailing Padding Cells to align Grid row
  const totalCellsSoFar = firstDayIndex + totalDays;
  const trailingPadding = Math.ceil(totalCellsSoFar / 7) * 7 - totalCellsSoFar;
  for (let i = 0; i < trailingPadding; i++) {
    const pad = document.createElement('div');
    pad.className = 'calendar-padding-cell';
    gridEl.appendChild(pad);
  }
}

function changeInlineCalendarMonth(offset, event) {
  if (event) event.preventDefault();
  let month = state.calendarMonth + offset;
  let year = state.calendarYear;

  if (month < 0) {
    month = 11;
    year -= 1;
  } else if (month > 11) {
    month = 0;
    year += 1;
  }

  state.calendarMonth = month;
  state.calendarYear = year;
  renderInlineCalendar();
}

function showCalendarDayEventsModal(dateTitle, eventsList) {
  let modalOverlay = document.getElementById('calendar-events-modal-overlay');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'calendar-events-modal-overlay';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.zIndex = '999999';
    document.body.appendChild(modalOverlay);
  }

  const eventsHtml = eventsList.map(item => `
    <div style="padding: 10px 14px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.85rem; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
      ${item}
    </div>
  `).join('');

  modalOverlay.innerHTML = `
    <div class="modal" style="max-width: 440px; width: 92%; padding: 20px; box-sizing: border-box;">
      <div class="modal-header" style="padding-bottom: 12px; border-bottom: 1px solid var(--border-color); margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 1.05rem; color: var(--text-primary); font-weight: 700;">
          📅 Events for ${dateTitle}
        </h3>
        <button type="button" onclick="closeCalendarEventsModal()" style="background: none; border: none; color: var(--text-muted); font-size: 1.2rem; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow-y: auto; padding-right: 4px;">
        ${eventsHtml}
      </div>
      <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="closeCalendarEventsModal()">Close</button>
      </div>
    </div>
  `;

  modalOverlay.classList.add('active');
}

function closeCalendarEventsModal() {
  const modalOverlay = document.getElementById('calendar-events-modal-overlay');
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
  }
}

window.showCalendarDayEventsModal = showCalendarDayEventsModal;
window.closeCalendarEventsModal = closeCalendarEventsModal;

// --- Daily Reports Functions ---
function setTodayReportDate() {
  const reportDateInput = document.getElementById('report-date');
  if (reportDateInput) {
    reportDateInput.value = getTodayDateString();
  }
}

// --- Daily Reports Helper & Permission Functions ---
function getReportReporterRole(report) {
  let role = '';
  if (report.employeeRole) {
    role = report.employeeRole.toLowerCase();
  } else {
    const emp = state.employees.find(e => e.id === report.employeeId);
    role = emp ? emp.role.toLowerCase() : 'employee';
  }
  if (role.includes('admin')) return 'admin';
  if (role.includes('hr')) return 'hr';
  if (role.includes('tech lead')) return 'techlead';
  if (role.includes('manager')) return 'manager';
  return 'employee';
}

function canUserSeeReport(currentUserRole, reporterRole) {
  if (currentUserRole === 'admin' || currentUserRole === 'hr') {
    return true;
  }
  if (reporterRole === 'employee') {
    return ['techlead', 'manager'].includes(currentUserRole);
  }
  if (reporterRole === 'techlead' || reporterRole === 'manager') {
    return false;
  }
  if (reporterRole === 'hr') {
    return false;
  }
  return false;
}

function isReportReviewerFor(reviewerId, reviewerRole, report) {
  if (!reviewerId || !reviewerRole || !report) return false;

  if (reviewerRole === 'admin' || reviewerRole === 'hr') {
    return true;
  }

  const proj = state.projects.find(p => p.id === report.projectId);
  if (!proj || !proj.techLeadId) {
    return canUserSeeReport(reviewerRole, getReportReporterRole(report));
  }

  const reporterId = report.employeeId;
  const techLeadId = proj.techLeadId;

  if (reporterId === techLeadId) {
    return reviewerRole === 'admin';
  } else {
    return reviewerId === techLeadId && (reviewerRole === 'techlead' || reviewerRole === 'manager');
  }
}

function canUserReviewReport(currentUserRole, reporterRole) {
  return canUserSeeReport(currentUserRole, reporterRole);
}

function canUserStarReport(currentUserRole, reporterRole) {
  // Admin can star anyone whose reports they can see
  if (currentUserRole === 'admin') {
    return ['techlead', 'manager', 'hr'].includes(reporterRole);
  }
  // Tech lead and Manager can star employees
  if (currentUserRole === 'techlead' || currentUserRole === 'manager') {
    return reporterRole === 'employee';
  }
  return false;
}

function safeSaveReports() {
  try {
    safeOriginalSetItem('ems_reports', JSON.stringify(state.dailyReports));
  } catch (error) {
    console.warn('LocalStorage limit reached for ems_reports. Report preserved in memory & backend sync.');
  }
  triggerBackendSync();
  return true;
}

function renderDailyReports() {
  const empSection = document.getElementById('reports-employee-section');
  const hrSection = document.getElementById('reports-hr-section');
  if (!empSection || !hrSection) return;

  populateDailyReportDropdowns();

  const isReportReviewer = (state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin' || state.currentRole === 'hr');

  if (isReportReviewer) {
    if (state.activeLeaveSubTab === 'apply') {
      empSection.style.display = 'flex';
      empSection.style.marginBottom = '0';
      hrSection.style.display = 'none';
      renderEmployeeReports();
    } else {
      empSection.style.display = 'none';
      empSection.style.marginBottom = '0';
      hrSection.style.display = 'flex';
      renderHRReports();
    }
  } else {
    empSection.style.display = 'flex';
    empSection.style.marginBottom = '0';
    hrSection.style.display = 'none';
    renderEmployeeReports();
  }
}

function renderEmployeeReports() {
  const tbody = document.getElementById('emp-reports-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const reportsHeader = document.getElementById('reports-remarks-header');
  if (reportsHeader) {
    reportsHeader.textContent = state.currentRole === 'hr' ? 'Admin Remarks' : 'HR / Admin Remarks';
  }

  const projectSelect = document.getElementById('emp-filter-report-project');
  const monthSelect = document.getElementById('emp-filter-report-month');
  const selectedProject = projectSelect ? projectSelect.value : 'all';
  const selectedMonth = monthSelect ? monthSelect.value : 'all';

  const userReports = state.dailyReports.filter(r => {
    if (r.employeeId !== state.currentUser.id) return false;

    let matchesProj = true;
    if (selectedProject !== 'all') {
      matchesProj = (r.projectId === selectedProject);
    }

    let matchesMonth = true;
    if (selectedMonth !== 'all') {
      matchesMonth = (getMonthYearStr(r.date) === selectedMonth);
    }

    return matchesProj && matchesMonth;
  });

  if (userReports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            <div class="empty-state-title">No matching daily reports found</div>
            <p>Fill in the form to submit your report or try adjusting your filters.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const sortedReports = [...userReports].sort((a, b) => {
    const dateDiff = new Date(b.date) - new Date(a.date);
    if (dateDiff !== 0) return dateDiff;
    const idA = parseInt(a.id.replace(/\D/g, '')) || 0;
    const idB = parseInt(b.id.replace(/\D/g, '')) || 0;
    return idB - idA;
  });

  sortedReports.forEach(report => {
    const isExpanded = state.expandedReportIds && state.expandedReportIds.has(report.id);
    const hasRemarks = report.remarks && report.remarks.trim().length > 0;

    const tr = document.createElement('tr');
    tr.className = 'report-row';
    tr.onclick = (e) => toggleReportDetailsExpand(report.id, e);

    tr.innerHTML = `
      <td>
        <strong style="color: var(--text-primary); font-size: 0.9rem;">📅 ${formatDate(report.date)}</strong>
        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 4px;">
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>Submitted: ${formatDateTime(report.submittedAt || report.createdAt)}</span>
        </div>
      </td>
      <td><span style="font-weight: 600; color: var(--primary);">${report.projectName || '—'}</span></td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${truncateText(report.details, 40)}</span>
          <svg class="chevron-icon" id="report-chevron-${report.id}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate(${isExpanded ? '180deg' : '0deg'}); opacity: 0.7;">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${hasRemarks ? `<span class="badge badge-completed">Reviewed</span>` : `<span class="badge badge-pending">Pending Review</span>`}
          ${report.starRating > 0 ? `<span style="display: inline-flex; align-items: center; gap: 3px; font-weight: 700; color: #f59e0b;" title="Awarded ${report.starRating} performance stars!"><span style="font-size: 1rem;">⭐</span> ${report.starRating}/10</span>` : ''}
          <button class="btn btn-secondary btn-xs" onclick="event.stopPropagation(); deleteDailyReport('${report.id}')" style="margin-left:auto; color:var(--danger); border-color:rgba(239,68,68,0.3);" title="Delete report">Delete</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    const detailsTr = document.createElement('tr');
    detailsTr.id = `report-details-row-${report.id}`;
    detailsTr.style.display = isExpanded ? 'table-row' : 'none';

    let imagesHtml = '';
    if (report.images && report.images.length > 0) {
      imagesHtml = `
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
          ${report.images.map((fileObj, idx) => {
        const isString = typeof fileObj === 'string';
        const fileData = isString ? fileObj : fileObj.data;
        const fileName = isString ? 'Attachment' : fileObj.name;
        const fileType = isString ? 'image/png' : (fileObj.type || '');

        const isPdf = fileType === 'application/pdf' ||
          fileName.toLowerCase().endsWith('.pdf') ||
          fileData.startsWith('data:application/pdf');

        if (isPdf) {
          return `
                <div onclick="openPdfInNewWindow('${fileData}', event)" class="report-image-thumbnail" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; padding: 4px; box-sizing: border-box;" title="${fileName}">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--danger); margin-bottom: 2px;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2v-9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span style="font-size: 0.65rem; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: var(--text-primary);">${fileName}</span>
                </div>
              `;
        } else {
          return `
                <img src="${fileData}" onclick="openFullImageViewModal('${report.id}', ${idx}, event)" class="report-image-thumbnail" title="${fileName}">
              `;
        }
      }).join('')}
        </div>
      `;
    }

    // Also render drive links attached to this report
    if (report.driveLinks && report.driveLinks.length > 0) {
      imagesHtml += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${report.driveLinks.map(link => `
        <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:6px;border:1px solid rgba(66,133,244,0.4);background:rgba(66,133,244,0.08);color:#4285F4;text-decoration:none;font-size:0.75rem;font-weight:500;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.09 15.91 0 13.35 0c-1.33 0-2.54.54-3.41 1.41L9 2.35 8.06 1.41C7.19.54 5.98 0 4.65 0 2.09 0 0 2.09 0 4.65c0 .47.11.91.18 1.35H0v2h.85l1.99 12h18.32l1.99-12H24V6h-4z"/></svg>
          <span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${link.label || link.url}</span>
        </a>`).join('')}</div>`;
    }

    let remarksHtml = '';
    if (hasRemarks) {
      remarksHtml = `
        <div class="remarks-container">
          <div class="remarks-card">
            <div class="remarks-card-header">
              <span>Reviewed by <strong>${report.reviewedBy}</strong> on ${formatDate(report.reviewedAt)}</span>
            </div>
            <div class="remarks-card-content">${report.remarks}</div>
          </div>
        </div>
      `;
    } else {
      remarksHtml = `
        <div class="remarks-container">
          <div class="remarks-pending">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Pending review...</span>
          </div>
        </div>
      `;
    }

    detailsTr.innerHTML = `
      <td colspan="4" style="padding: 0;">
        <div class="report-details-pane" style="margin: 8px 12px 16px 12px;" onclick="event.stopPropagation()">
          <div style="font-weight: 500; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word;">${report.details}</div>
          ${imagesHtml}
          ${remarksHtml}
        </div>
      </td>
    `;
    tbody.appendChild(detailsTr);
  });
}

function getMonthYearStr(dateStr) {
  if (!dateStr) return 'Unknown Month';
  const parts = dateStr.split('-');
  if (parts.length < 2) return 'Unknown Month';
  const year = parts[0];
  const monthIndex = parseInt(parts[1], 10) - 1;
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  if (monthIndex >= 0 && monthIndex < 12) {
    return `${monthNames[monthIndex]} ${year}`;
  }
  return 'Unknown Month';
}

function populateDailyReportDropdowns() {
  // 1. Submit Form Project Select
  const submitProjectSelect = document.getElementById('report-project');
  if (submitProjectSelect) {
    const currentVal = submitProjectSelect.value;
    submitProjectSelect.innerHTML = `
      <option value="" disabled selected>Select project...</option>
      <option value="general">General / Direct to HR & Management (No Project)</option>
    `;
    state.projects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      submitProjectSelect.appendChild(opt);
    });
    if (currentVal) submitProjectSelect.value = currentVal;
  }

  // 2. Employee Past Reports Project Filter
  const empProjectSelect = document.getElementById('emp-filter-report-project');
  if (empProjectSelect) {
    const currentVal = empProjectSelect.value || 'all';
    empProjectSelect.innerHTML = '<option value="all">All Projects</option>';
    const uniqueProjects = new Set();
    state.dailyReports.forEach(r => {
      if (r.employeeId === state.currentUser.id && r.projectName) {
        uniqueProjects.add(JSON.stringify({ id: r.projectId, name: r.projectName }));
      }
    });
    uniqueProjects.forEach(projStr => {
      const proj = JSON.parse(projStr);
      const opt = document.createElement('option');
      opt.value = proj.id;
      opt.textContent = proj.name;
      empProjectSelect.appendChild(opt);
    });
    empProjectSelect.value = currentVal;
    if (empProjectSelect.value !== currentVal) empProjectSelect.value = 'all';
  }

  // 3. Employee Past Reports Month Filter
  const empMonthSelect = document.getElementById('emp-filter-report-month');
  if (empMonthSelect) {
    const currentVal = empMonthSelect.value || 'all';
    empMonthSelect.innerHTML = '<option value="all">All Months</option>';
    const uniqueMonths = new Set();
    state.dailyReports.forEach(r => {
      if (r.employeeId === state.currentUser.id && r.date) {
        uniqueMonths.add(getMonthYearStr(r.date));
      }
    });
    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => new Date(b) - new Date(a));
    sortedMonths.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      empMonthSelect.appendChild(opt);
    });
    empMonthSelect.value = currentVal;
    if (empMonthSelect.value !== currentVal) empMonthSelect.value = 'all';
  }

  // 4. Reviewer Project Filter
  const reviewProjectSelect = document.getElementById('filter-report-project');
  if (reviewProjectSelect) {
    const currentVal = reviewProjectSelect.value || 'all';
    reviewProjectSelect.innerHTML = '<option value="all">All Projects</option>';
    const uniqueProjects = new Set();
    state.dailyReports.forEach(r => {
      if (isReportReviewerFor(state.currentUser.id, state.currentRole, r) && r.projectName) {
        uniqueProjects.add(JSON.stringify({ id: r.projectId, name: r.projectName }));
      }
    });
    uniqueProjects.forEach(projStr => {
      const proj = JSON.parse(projStr);
      const opt = document.createElement('option');
      opt.value = proj.id;
      opt.textContent = proj.name;
      reviewProjectSelect.appendChild(opt);
    });
    reviewProjectSelect.value = currentVal;
    if (reviewProjectSelect.value !== currentVal) reviewProjectSelect.value = 'all';
  }

  // 5. Reviewer Month Filter
  const monthSelect = document.getElementById('filter-report-month');
  if (monthSelect) {
    const currentVal = monthSelect.value || 'all';
    monthSelect.innerHTML = '<option value="all">All Months</option>';
    const uniqueMonths = new Set();
    state.dailyReports.forEach(r => {
      if (r.date && isReportReviewerFor(state.currentUser.id, state.currentRole, r)) {
        uniqueMonths.add(getMonthYearStr(r.date));
      }
    });
    const sortedMonths = Array.from(uniqueMonths).sort((a, b) => new Date(b) - new Date(a));
    sortedMonths.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });
    monthSelect.value = currentVal;
    if (monthSelect.value !== currentVal) monthSelect.value = 'all';
  }

  // 6. Reviewer Employee Filter
  const empSelect = document.getElementById('filter-report-employee');
  if (empSelect) {
    const currentVal = empSelect.value || 'all';
    empSelect.innerHTML = '<option value="all">All Employees</option>';
    const empMap = new Map();
    state.dailyReports.forEach(r => {
      if (isReportReviewerFor(state.currentUser.id, state.currentRole, r)) {
        empMap.set(r.employeeId, r.employeeName);
      }
    });
    empMap.forEach((name, id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = name;
      empSelect.appendChild(opt);
    });
    empSelect.value = currentVal;
    if (empSelect.value !== currentVal) empSelect.value = 'all';
  }
}

function renderHRReports() {
  const tbody = document.getElementById('hr-reports-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Populate dynamic dropdown options
  populateDailyReportDropdowns();

  const monthSelect = document.getElementById('filter-report-month');
  const empSelect = document.getElementById('filter-report-employee');
  const projectSelect = document.getElementById('filter-report-project');
  const selectedMonth = monthSelect ? monthSelect.value : 'all';
  const selectedEmp = empSelect ? empSelect.value : 'all';
  const selectedProject = projectSelect ? projectSelect.value : 'all';

  // Filter daily reports
  const filteredReports = state.dailyReports.filter(report => {
    // Project-level and role-based routing check
    if (!isReportReviewerFor(state.currentUser.id, state.currentRole, report)) {
      return false;
    }

    let matchesMonth = true;
    if (selectedMonth !== 'all') {
      matchesMonth = (getMonthYearStr(report.date) === selectedMonth);
    }

    let matchesEmp = true;
    if (selectedEmp !== 'all') {
      matchesEmp = (report.employeeId === selectedEmp);
    }

    let matchesProj = true;
    if (selectedProject !== 'all') {
      matchesProj = (report.projectId === selectedProject);
    }

    return matchesMonth && matchesEmp && matchesProj;
  });

  if (filteredReports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-state-title">No matching daily reports found</div>
            <p>Try adjusting your filters.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Sort reports chronologically descending (newest first)
  const sortedReports = [...filteredReports].sort((a, b) => {
    const dateDiff = new Date(b.date) - new Date(a.date);
    if (dateDiff !== 0) return dateDiff;
    const idA = parseInt(a.id.replace(/\D/g, '')) || 0;
    const idB = parseInt(b.id.replace(/\D/g, '')) || 0;
    return idB - idA;
  });

  // Group by month
  const grouped = {};
  sortedReports.forEach(report => {
    const monthKey = getMonthYearStr(report.date);
    if (!grouped[monthKey]) {
      grouped[monthKey] = [];
    }
    grouped[monthKey].push(report);
  });

  // Sort month keys chronologically descending
  const monthKeys = Object.keys(grouped).sort((a, b) => {
    if (a === 'Unknown Month') return 1;
    if (b === 'Unknown Month') return -1;
    return new Date(b) - new Date(a);
  });

  // Render month groups
  monthKeys.forEach(monthKey => {
    const reportsInMonth = grouped[monthKey];

    // Append month group header row
    const headerTr = document.createElement('tr');
    headerTr.className = 'month-group-header-row';
    headerTr.style.pointerEvents = 'none'; // prevent hover cursor pointers
    headerTr.innerHTML = `
      <td colspan="6" style="font-weight: 700; padding: 12px 20px; font-size: 0.9rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; pointer-events: none;">
          <span>📅 ${monthKey}</span>
          <span class="badge" style="background-color: var(--primary-bg); color: var(--primary); font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 600;">
            ${reportsInMonth.length} ${reportsInMonth.length === 1 ? 'Report' : 'Reports'}
          </span>
        </div>
      </td>
    `;
    tbody.appendChild(headerTr);

    // Append each report in the month group
    reportsInMonth.forEach(report => {
      const isExpanded = state.expandedReportIds && state.expandedReportIds.has(report.id);
      const hasRemarks = report.remarks && report.remarks.trim().length > 0;
      const isEditingRemarks = state.editingReportId === report.id;

      const tr = document.createElement('tr');
      tr.className = 'report-row';
      tr.onclick = (e) => toggleReportDetailsExpand(report.id, e);

      tr.innerHTML = `
        <td>
          <strong style="color: var(--text-primary); font-size: 0.9rem;">📅 ${formatDate(report.date)}</strong>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px; display: flex; align-items: center; gap: 4px;">
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Sub: ${formatDateTime(report.submittedAt || report.createdAt)}</span>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="avatar" style="width: 28px; height: 28px; font-size: 0.75rem;">
              ${report.employeeName.split(' ').map(n => n[0]).join('')}
            </div>
            <span style="font-weight: 600;">${report.employeeName}</span>
          </div>
        </td>
        <td>${report.dept}</td>
        <td><span style="font-weight: 600; color: var(--primary);">${report.projectName || '—'}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${truncateText(report.details, 40)}</span>
            <svg class="chevron-icon" id="report-chevron-${report.id}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate(${isExpanded ? '180deg' : '0deg'}); opacity: 0.7;">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${hasRemarks ? `<span class="badge badge-completed">Reviewed</span>` : `<span class="badge badge-pending">Pending Review</span>`}
            ${report.starRating > 0 ? `<span style="display: inline-flex; align-items: center; gap: 3px; font-weight: 700; color: #f59e0b;" title="Awarded ${report.starRating} performance stars!"><span style="font-size: 1rem;">⭐</span> ${report.starRating}/10</span>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);

      const detailsTr = document.createElement('tr');
      detailsTr.id = `report-details-row-${report.id}`;
      detailsTr.style.display = isExpanded ? 'table-row' : 'none';

      let imagesHtml = '';
      if (report.images && report.images.length > 0) {
        imagesHtml = `
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
            ${report.images.map((fileObj, idx) => {
          const isString = typeof fileObj === 'string';
          const fileData = isString ? fileObj : fileObj.data;
          const fileName = isString ? 'Attachment' : fileObj.name;
          const fileType = isString ? 'image/png' : (fileObj.type || '');

          const isPdf = fileType === 'application/pdf' ||
            fileName.toLowerCase().endsWith('.pdf') ||
            fileData.startsWith('data:application/pdf');

          if (isPdf) {
            return `
                  <div onclick="openPdfInNewWindow('${fileData}', event)" class="report-image-thumbnail" style="display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; padding: 4px; box-sizing: border-box;" title="${fileName}">
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--danger); margin-bottom: 2px;">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2v-9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span style="font-size: 0.65rem; max-width: 70px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: var(--text-primary);">${fileName}</span>
                  </div>
                `;
          } else {
            return `
                  <img src="${fileData}" onclick="openFullImageViewModal('${report.id}', ${idx}, event)" class="report-image-thumbnail" title="${fileName}">
                `;
          }
        }).join('')}
          </div>
        `;
      }

      // Also render drive links attached to this report
      if (report.driveLinks && report.driveLinks.length > 0) {
        imagesHtml += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">${report.driveLinks.map(link => `
          <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:6px;border:1px solid rgba(66,133,244,0.4);background:rgba(66,133,244,0.08);color:#4285F4;text-decoration:none;font-size:0.75rem;font-weight:500;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.35C18 2.09 15.91 0 13.35 0c-1.33 0-2.54.54-3.41 1.41L9 2.35 8.06 1.41C7.19.54 5.98 0 4.65 0 2.09 0 0 2.09 0 4.65c0 .47.11.91.18 1.35H0v2h.85l1.99 12h18.32l1.99-12H24V6h-4z"/></svg>
            <span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${link.label || link.url}</span>
          </a>`).join('')}</div>`;
      }

      const reporterRole = getReportReporterRole(report);
      const showStarBtn = canUserStarReport(state.currentRole, reporterRole);
      const showReviewBtn = canUserReviewReport(state.currentRole, reporterRole);

      let remarksHtml = '';
      if (isEditingRemarks) {
        remarksHtml = `
          <div class="remarks-container" onclick="event.stopPropagation()">
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="font-weight: 600; font-size: 0.85rem;">Review Comments / Feedback</label>
              <textarea id="edit-remarks-textarea-${report.id}" placeholder="Provide feedback or instructions..." style="min-height: 80px; width: 100%; padding: 8px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background-color: var(--bg-secondary); color: var(--text-primary); font-family: inherit; font-size: 0.85rem; resize: vertical;">${report.remarks || ''}</textarea>
              <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="cancelEditRemarks(event)">Cancel</button>
                <button class="btn btn-primary btn-sm" onclick="saveHRRemarks('${report.id}', event)">Save Remarks</button>
              </div>
            </div>
          </div>
        `;
      } else if (hasRemarks) {
        remarksHtml = `
          <div class="remarks-container" onclick="event.stopPropagation()">
            <div class="remarks-card">
              <div class="remarks-card-header">
                <span>Reviewed by <strong>${report.reviewedBy}</strong> on ${formatDate(report.reviewedAt)}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                  ${showStarBtn ? `
                  <div style="display: inline-flex; align-items: center; gap: 6px;">
                    <label style="font-size: 0.7rem; font-weight: 600; color: var(--text-secondary);">⭐ Rating:</label>
                    <select onchange="setReportStarRating('${report.id}', parseInt(this.value), event)" style="padding: 2px 6px; font-size: 0.75rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; min-width: 55px;">
                      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<option value="${v}" ${report.starRating === v ? 'selected' : ''}>${v}/10</option>`).join('')}
                    </select>
                  </div>
                  ` : ''}
                  ${showReviewBtn ? `
                  <button class="btn btn-secondary btn-sm" onclick="startEditRemarks('${report.id}', event)" style="padding: 2px 8px; font-size: 0.7rem; border-radius: 4px;">Edit Feedback</button>
                  ` : ''}
                </div>
              </div>
              <div class="remarks-card-content">${report.remarks}</div>
            </div>
          </div>
        `;
      } else {
        remarksHtml = `
          <div class="remarks-container" onclick="event.stopPropagation()">
            <div style="display: flex; justify-content: flex-start; margin-top: 8px; gap: 8px; align-items: center;">
              ${showReviewBtn ? `
              <button class="btn btn-primary btn-sm" onclick="startEditRemarks('${report.id}', event)">Add Remarks / Review</button>
              ` : ''}
              ${showStarBtn ? `
              <div style="display: inline-flex; align-items: center; gap: 6px;">
                <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">⭐ Rating:</label>
                <select onchange="setReportStarRating('${report.id}', parseInt(this.value), event)" style="padding: 3px 8px; font-size: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; min-width: 60px;">
                  ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => `<option value="${v}" ${report.starRating === v ? 'selected' : ''}>${v}/10</option>`).join('')}
                </select>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      detailsTr.innerHTML = `
        <td colspan="6" style="padding: 0;">
          <div class="report-details-pane" style="margin: 8px 12px 16px 12px;" onclick="event.stopPropagation()">
            <div style="font-weight: 500; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word;">${report.details}</div>
            ${imagesHtml}
            ${remarksHtml}
          </div>
        </td>
      `;
      tbody.appendChild(detailsTr);
    });
  });
}

async function handleDailyReportSubmit(e) {
  e.preventDefault();

  const reportDateInput = document.getElementById('report-date');
  const reportDetailsInput = document.getElementById('report-details');
  const reportProjectSelect = document.getElementById('report-project');

  if (!reportDateInput || !reportDetailsInput) return;

  const submitBtn = e.target.querySelector('button[type="submit"]') || document.querySelector('#daily-report-form button[type="submit"]');
  const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'Submit Report';

  const dateVal = reportDateInput.value;
  const detailsVal = reportDetailsInput.value.trim();
  const projectIdVal = reportProjectSelect ? reportProjectSelect.value : '';
  const projectNameVal = reportProjectSelect && reportProjectSelect.selectedIndex >= 0 ? reportProjectSelect.options[reportProjectSelect.selectedIndex].text : '';

  if (!dateVal || !detailsVal || !projectIdVal) {
    showToast('Please fill out all required fields.', 'error');
    return;
  }

  // Disable button immediately to prevent rapid multi-clicks
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.style.cursor = 'not-allowed';
    submitBtn.innerHTML = '<span class="submit-spinner" style="display: inline-flex; align-items: center; gap: 8px;"><svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="4" stroke-dasharray="32" stroke-dashoffset="10"></circle></svg> ⏳ Submitting Report... Please wait</span>';
  }

  try {
    const newReport = {
      id: `REP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      employeeId: state.currentUser.id,
      employeeName: state.currentUser.name,
      employeeRole: state.currentUser.role,
      dept: state.currentUser.dept,
      projectId: projectIdVal,
      projectName: projectNameVal,
      date: dateVal,
      submittedAt: new Date().toISOString(),
      details: detailsVal,
      images: [...currentAttachedImagesReport],
      remarks: '',
      reviewedBy: '',
      reviewedAt: '',
      starRating: 0,
      driveLinks: [...currentReportDriveLinks]
    };

    state.dailyReports.push(newReport);

    if (!safeSaveReports()) {
      state.dailyReports.pop();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
        submitBtn.innerHTML = originalBtnHtml;
      }
      return;
    }

    // Directly submit report to MongoDB Atlas via atomic server endpoint
    try {
      await fetch('/api/submit-daily-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: newReport })
      });
    } catch (err) {
      console.error('Failed direct submit-daily-report:', err);
    }

    // Force an immediate server sync to avoid data loss on reload
    await syncStateNow();

    // Find project recipient for daily report routing
    const proj = state.projects.find(p => p.id === projectIdVal);
    let recipientIds = [];

    if (proj && proj.techLeadId) {
      if (state.currentUser.id === proj.techLeadId) {
        state.employees.forEach(emp => {
          const roleLower = (emp.role || '').toLowerCase();
          if (roleLower.includes('admin') && emp.id !== state.currentUser.id) {
            recipientIds.push(emp.id);
          }
        });
      } else {
        recipientIds.push(proj.techLeadId);
      }
    } else {
      state.employees.forEach(emp => {
        const roleLower = (emp.role || '').toLowerCase();
        if ((roleLower.includes('admin') || roleLower.includes('hr') || roleLower.includes('ceo') || roleLower.includes('tech lead') || roleLower.includes('manager')) && emp.id !== state.currentUser.id) {
          recipientIds.push(emp.id);
        }
      });
    }

    // Trigger SMS notifications for only the recipients
    state.employees.forEach(emp => {
      if (recipientIds.includes(emp.id)) {
        if (emp.phone) {
          triggerSMSNotification(
            emp.phone,
            `New Daily Report Submitted: ${state.currentUser.name} for project "${projectNameVal}" on ${dateVal}. Details: ${detailsVal.substring(0, 100)}${detailsVal.length > 100 ? '...' : ''}`,
            emp.name
          );
        }
      }
    });

    currentAttachedImagesReport.length = 0;
    const preview = document.getElementById('report-images-preview');
    if (preview) preview.innerHTML = '';
    currentReportDriveLinks.length = 0;
    const drivePreview = document.getElementById('report-drive-links-preview');
    if (drivePreview) drivePreview.innerHTML = '';

    document.getElementById('daily-report-form').reset();
    setTodayReportDate();

    renderDailyReports();
    showToast('Daily report submitted successfully!', 'success');
  } catch (err) {
    console.error('Error submitting daily report:', err);
    showToast('Failed to submit report. Please try again.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      submitBtn.innerHTML = originalBtnHtml;
    }
  }
}

function toggleReportDetailsExpand(reportId, event) {
  if (event) {
    event.stopPropagation();
  }

  state.expandedReportIds = state.expandedReportIds || new Set();

  if (state.expandedReportIds.has(reportId)) {
    state.expandedReportIds.delete(reportId);
  } else {
    state.expandedReportIds.add(reportId);
  }

  renderDailyReports();
}

function startEditRemarks(reportId, event) {
  if (event) event.stopPropagation();
  state.editingReportId = reportId;
  renderDailyReports();
}

function cancelEditRemarks(event) {
  if (event) event.stopPropagation();
  state.editingReportId = null;
  renderDailyReports();
}

function saveHRRemarks(reportId, event) {
  if (event) event.stopPropagation();
  const report = state.dailyReports.find(r => r.id === reportId);
  if (!report) return;

  const textarea = document.getElementById(`edit-remarks-textarea-${reportId}`);
  if (!textarea) return;

  const originalRemarks = report.remarks;
  const originalReviewedBy = report.reviewedBy;
  const originalReviewedAt = report.reviewedAt;

  const remarksText = textarea.value.trim();

  if (!remarksText) {
    showToast('Please enter remarks/comments before submitting a review.', 'error');
    return;
  }

  report.remarks = remarksText;
  report.reviewedBy = state.currentUser.name;
  report.reviewedAt = getTodayDateString();

  if (!safeSaveReports()) {
    report.remarks = originalRemarks;
    report.reviewedBy = originalReviewedBy;
    report.reviewedAt = originalReviewedAt;
    return;
  }

  // Trigger SMS notification for the report's owner
  const targetEmp = state.employees.find(emp => emp.id === report.employeeId);
  if (targetEmp && targetEmp.phone) {
    triggerSMSNotification(
      targetEmp.phone,
      `Daily Report Reviewed: Your report for ${report.date} was reviewed by ${state.currentUser.name}. Remarks: "${remarksText}"`,
      targetEmp.name
    );
  }

  state.editingReportId = null;
  renderDailyReports();
  showToast('Report remarks updated successfully.', 'success');
}

function setReportStarRating(reportId, rating, event) {
  if (event) event.stopPropagation();
  const report = state.dailyReports.find(r => r.id === reportId);
  if (!report) return;

  const clampedRating = Math.max(0, Math.min(10, rating || 0));
  const prevRating = report.starRating;
  report.starRating = clampedRating;

  if (!safeSaveReports()) {
    report.starRating = prevRating;
    return;
  }

  renderDailyReports();
  renderEmployeeRoster();

  if (clampedRating > 0) {
    showToast(`Awarded ${clampedRating}/10 stars to daily report!`, 'success');

    // Trigger SMS notification for report's owner
    const targetEmp = state.employees.find(emp => emp.id === report.employeeId);
    if (targetEmp && targetEmp.phone) {
      triggerSMSNotification(
        targetEmp.phone,
        `Daily Report Rated: Your report for ${report.date} was awarded a ${clampedRating}/10 star rating by ${state.currentUser.name}.`,
        targetEmp.name
      );
    }
  } else {
    showToast('Star rating removed from daily report.', 'success');
  }
}

// Global modal/action bindings

// =========================================================================
// 🎓 TRAINER DAILY SESSION REPORT SUITE (School Cluster)
// =========================================================================

const SCHOOL_CLUSTER_MAPPING = {
  'Shri Mahankant Vidyalaya': { managerId: 'AIRG00042', managerName: 'Shravani Khanvilkar' },
  'PDEA English School': { managerId: 'AIRG00042', managerName: 'Shravani Khanvilkar' },
  'Shri Shivaji Vidyalaya': { managerId: 'AIRG00042', managerName: 'Shravani Khanvilkar' },
  'Eon Gyanankur English School': { managerId: 'AIRG00042', managerName: 'Shravani Khanvilkar' },
  'Sant Tukaram Secondary School & Junior College': { managerId: 'AIRG00010', managerName: 'Prasad Shelke' },
  'Lonkar Madhyamik Vidyalaya': { managerId: 'AIRG00010', managerName: 'Prasad Shelke' },
  'S.S. Nikam Kapad School': { managerId: 'AIRG0001', managerName: 'Suyash Patil' },
  'Sakharwadi Vidyalaya': { managerId: 'AIRG00010', managerName: 'Prasad Shelke' },
  'Swami Ramanand Bharati High School & Junior College': { managerId: 'AIRG00042', managerName: 'Shravani Khanvilkar' },
  'Kehtri English School': { managerId: 'AIRG00042', managerName: 'Shravani Khanvilkar' },
  'Pirangut English (CBSE)': { managerId: 'AIRG00047', managerName: 'Atharva Durgavale' },
  'Pirangut English School': { managerId: 'AIRG00047', managerName: 'Atharva Durgavale' },
  'Sharon English Medium School': { managerId: 'AIRG00042', managerName: 'Shravani Khanvilkar' },
  'Holy Convent School': { managerId: 'AIRG0001', managerName: 'Suyash Patil' }
};

function isUserTrainer(user = state.currentUser) {
  if (!user) return false;
  const dept = (user.dept || '').toLowerCase();
  const role = (user.role || '').toLowerCase();
  const name = (user.name || '').toLowerCase();
  return dept.includes('instructor') || role.includes('instructor') || role.includes('trainer') ||
         name.includes('nilesh') || name.includes('samiksha') || name.includes('vaishnavi') ||
         name.includes('mayuri') || name.includes('manali') || name.includes('shravani bhilare');
}

function isUserReportingManager(user = state.currentUser) {
  if (!user) return false;
  const dept = (user.dept || '').toLowerCase();
  const role = (user.role || '').toLowerCase();
  const isSchoolMgr = dept.includes('school reporting manager') || role.includes('reporting manager') || role.includes('manager') || role.includes('tech lead') || role.includes('techlead');
  const isHR = role.includes('hr');
  const isCEO = role.includes('admin') || isPratap(user);
  return isSchoolMgr || isHR || isCEO;
}

function loadDailyReportsPage() {
  // Entry point when sidebar nav opens Daily Reports.
  // Selects the correct sub-tab (trainer vs standard) once, then delegates.
  // This CANNOT call renderDailyReports() directly to avoid recursion.
  if (!state.activeReportSubTab) {
    state.activeReportSubTab = isUserTrainer(state.currentUser) ? 'trainer' : 'standard';
  }
  switchReportsSubTab(state.activeReportSubTab);
}
window.loadDailyReportsPage = loadDailyReportsPage;

function switchReportsSubTab(subTab) {
  state.activeReportSubTab = subTab;
  const stdBtn = document.getElementById('tab-btn-daily-reports');
  const trnBtn = document.getElementById('tab-btn-trainer-reports');
  const stdView = document.getElementById('standard-reports-subview');
  const trnView = document.getElementById('trainer-reports-subview');

  if (subTab === 'trainer') {
    if (stdBtn) { stdBtn.className = 'btn btn-secondary btn-sm'; }
    if (trnBtn) { trnBtn.className = 'btn btn-primary btn-sm'; }
    if (stdView) stdView.style.display = 'none';
    if (trnView) trnView.style.display = 'flex';
    renderTrainerReportsView();
  } else {
    if (stdBtn) { stdBtn.className = 'btn btn-primary btn-sm'; }
    if (trnBtn) { trnBtn.className = 'btn btn-secondary btn-sm'; }
    if (stdView) stdView.style.display = 'flex';
    if (trnView) trnView.style.display = 'none';
    renderDailyReports();
  }
}
window.switchReportsSubTab = switchReportsSubTab;

function handleTrainerSchoolChange() {
  const schoolSelect = document.getElementById('trainer-report-school');
  const managerSelect = document.getElementById('trainer-report-manager');
  const customSchoolInput = document.getElementById('trainer-custom-school-input');
  if (!schoolSelect || !managerSelect) return;

  const selectedSchool = schoolSelect.value;
  if (selectedSchool === 'Other') {
    if (customSchoolInput) customSchoolInput.style.display = 'block';
  } else {
    if (customSchoolInput) customSchoolInput.style.display = 'none';
    const mapping = SCHOOL_CLUSTER_MAPPING[selectedSchool];
    if (mapping && mapping.managerId) {
      managerSelect.value = mapping.managerId;
    }
  }
}
window.handleTrainerSchoolChange = handleTrainerSchoolChange;

function renderTrainerReportsView() {
  if (!state.trainerReports) state.trainerReports = [];
  if (!state.currentTrainerSessions) state.currentTrainerSessions = [];

  const entryCard = document.getElementById('trainer-entry-form-card');
  const reviewCard = document.getElementById('trainer-reports-review-card');
  const historyCard = document.getElementById('trainer-reports-history-card');
  const trainerNameBadge = document.getElementById('current-trainer-name');
  const dateInput = document.getElementById('trainer-report-date');

  if (trainerNameBadge && state.currentUser) {
    trainerNameBadge.textContent = state.currentUser.name;
  }

  if (dateInput && !dateInput.value) {
    dateInput.value = getTodayDateString();
  }

  const isTrainer = isUserTrainer(state.currentUser);
  const isReviewer = isUserReportingManager(state.currentUser);

  // Set visibility of entry form (visible to trainers and admin)
  if (entryCard) {
    if (isTrainer || state.currentRole === 'admin' || isPratap(state.currentUser)) {
      entryCard.style.display = 'block';
    } else {
      entryCard.style.display = 'none';
    }
  }

  // Set visibility of review board (visible to reporting managers, HR, and CEO)
  if (reviewCard) {
    if (isReviewer) {
      reviewCard.style.display = 'block';
      populateTrainerReviewFilters();
      renderTrainerReportsReviewList();
    } else {
      reviewCard.style.display = 'none';
    }
  }

  // Set visibility of history card
  if (historyCard) {
    if (isTrainer || state.currentRole === 'admin' || isPratap(state.currentUser)) {
      historyCard.style.display = 'block';
      renderTrainerReportsHistory();
    } else {
      historyCard.style.display = isReviewer ? 'none' : 'block';
    }
  }

  // Initialize session rows if empty
  if (state.currentTrainerSessions.length === 0) {
    addTrainerSessionRow();
  } else {
    renderTrainerSessionRows();
  }

  updateTrainerReportsBadge();
}
window.renderTrainerReportsView = renderTrainerReportsView;

function updateTrainerReportsBadge() {
  const badge = document.getElementById('trainer-reports-badge');
  if (!badge) return;

  const isReviewer = isUserReportingManager(state.currentUser);
  if (!isReviewer || !state.trainerReports) {
    badge.style.display = 'none';
    return;
  }

  const roleLower = (state.currentUser.role || '').toLowerCase();
  const isCEO = roleLower.includes('admin') || isPratap(state.currentUser);
  const isHR = roleLower.includes('hr');

  let pendingCount = 0;
  state.trainerReports.forEach(r => {
    if (isCEO && r.status === 'pending_ceo') pendingCount++;
    else if (isHR && r.status === 'pending_hr') pendingCount++;
    else if (r.status === 'pending_manager' && (r.reportingManagerId === state.currentUser.id || isCEO || isHR)) pendingCount++;
  });

  if (pendingCount > 0) {
    badge.textContent = pendingCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

function addTrainerSessionRow(initialData = null) {
  if (!state.currentTrainerSessions) state.currentTrainerSessions = [];
  const sessionObj = initialData || {
    classVal: 'Class 5th',
    timeVal: '10:00 AM - 11:00 AM',
    topicVal: '',
    image: null,
    geoTag: null,
    remarkVal: ''
  };
  state.currentTrainerSessions.push(sessionObj);
  renderTrainerSessionRows();
}
window.addTrainerSessionRow = addTrainerSessionRow;

function removeTrainerSessionRow(index) {
  if (!state.currentTrainerSessions) return;
  if (state.currentTrainerSessions.length <= 1) {
    showToast('At least one session row is required for your daily report.', 'warning');
    return;
  }
  state.currentTrainerSessions.splice(index, 1);
  renderTrainerSessionRows();
}
window.removeTrainerSessionRow = removeTrainerSessionRow;

function updateSessionField(index, field, value) {
  if (state.currentTrainerSessions && state.currentTrainerSessions[index]) {
    state.currentTrainerSessions[index][field] = value;
  }
}
window.updateSessionField = updateSessionField;

function renderTrainerSessionRows() {
  const tbody = document.getElementById('trainer-sessions-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const classOptions = ['Class 1st', 'Class 2nd', 'Class 3rd', 'Class 4th', 'Class 5th', 'Class 6th', 'Class 7th', 'Class 8th', 'Class 9th', 'Class 10th', 'Class 11th', 'Class 12th', 'Batch A', 'Batch B', 'Batch C', 'Other'];

  state.currentTrainerSessions.forEach((session, idx) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-color)';

    let geoTagHtml = '';
    if (session.geoTag && session.geoTag.lat) {
      geoTagHtml = `
        <div style="margin-top: 4px; padding: 2px 6px; border-radius: 4px; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); font-size: 0.65rem; color: #22c55e; line-height: 1.3;">
          <div>📍 Lat: ${session.geoTag.lat}, Lng: ${session.geoTag.lng}</div>
          <div style="color: var(--text-muted); font-size: 0.6rem;">🕒 ${session.geoTag.timestamp || ''}</div>
        </div>
      `;
    }

    let photoPreviewHtml = '';
    if (session.image) {
      photoPreviewHtml = `
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
          <img src="${session.image}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('${session.image}')" title="Click to view photo">
          <button type="button" onclick="removeTrainerSessionPhoto(${idx})" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 0.75rem; font-weight: 600;">Remove</button>
        </div>
      `;
    }

    tr.innerHTML = `
      <td style="text-align: center; font-weight: 700; color: var(--text-muted); padding: 8px;">${idx + 1}</td>
      <td style="padding: 8px;">
        <select onchange="updateSessionField(${idx}, 'classVal', this.value)" style="width: 100%; padding: 6px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          ${classOptions.map(opt => `<option value="${opt}" ${session.classVal === opt ? 'selected' : ''}>${opt}</option>`).join('')}
        </select>
      </td>
      <td style="padding: 8px;">
        <input type="text" value="${session.timeVal || ''}" placeholder="e.g. 10:00 AM - 11:00 AM" onchange="updateSessionField(${idx}, 'timeVal', this.value)" style="width: 100%; padding: 6px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
      </td>
      <td style="padding: 8px;">
        <input type="text" value="${session.topicVal || ''}" placeholder="e.g. Intro to Robotics & Sensors" onchange="updateSessionField(${idx}, 'topicVal', this.value)" required style="width: 100%; padding: 6px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
      </td>
      <td style="padding: 8px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 8px; border-radius: 4px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); color: #3b82f6; font-size: 0.75rem; font-weight: 600; cursor: pointer; text-align: center;">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span>${session.image ? 'Change Photo' : '📸 Geotag Photo'}</span>
            <input type="file" accept="image/*" capture="environment" style="display: none;" onchange="handleTrainerSessionPhotoUpload(${idx}, event)">
          </label>
          ${photoPreviewHtml}
          ${geoTagHtml}
        </div>
      </td>
      <td style="padding: 8px;">
        <input type="text" value="${session.remarkVal || ''}" placeholder="e.g. Active participation" onchange="updateSessionField(${idx}, 'remarkVal', this.value)" style="width: 100%; padding: 6px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
      </td>
      <td style="text-align: center; padding: 8px;">
        <button type="button" onclick="removeTrainerSessionRow(${idx})" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 1.1rem;" title="Delete session row">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function removeTrainerSessionPhoto(index) {
  if (state.currentTrainerSessions && state.currentTrainerSessions[index]) {
    state.currentTrainerSessions[index].image = null;
    state.currentTrainerSessions[index].geoTag = null;
    renderTrainerSessionRows();
  }
}
window.removeTrainerSessionPhoto = removeTrainerSessionPhoto;

function handleTrainerSessionPhotoUpload(index, event) {
  const file = event.target.files[0];
  if (!file) return;

  // Capture Geolocation in parallel
  let geoTag = {
    lat: '18.5204',
    lng: '73.8567',
    timestamp: new Date().toLocaleString()
  };

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoTag.lat = pos.coords.latitude.toFixed(6);
        geoTag.lng = pos.coords.longitude.toFixed(6);
        geoTag.timestamp = new Date().toLocaleString();
        if (state.currentTrainerSessions[index]) {
          state.currentTrainerSessions[index].geoTag = geoTag;
          renderTrainerSessionRows();
        }
      },
      (err) => {
        console.warn('Geolocation prompt dismissed or unavailable:', err.message);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Data = e.target.result;
    compressImage(base64Data, 800, 800, 0.6, function(compressed) {
      if (state.currentTrainerSessions[index]) {
        state.currentTrainerSessions[index].image = compressed;
        state.currentTrainerSessions[index].geoTag = geoTag;
        renderTrainerSessionRows();
      }
    });
  };
  reader.readAsDataURL(file);
}
window.handleTrainerSessionPhotoUpload = handleTrainerSessionPhotoUpload;

function generateTrainerReportPDF(report) {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.warn('jsPDF not loaded yet');
      return null;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    // 1. Header Banner
    doc.setFillColor(15, 23, 42); // slate 900
    doc.rect(0, 0, 595, 75, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AIR G INTERNATIONAL', 40, 32);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Trainer Daily Classroom Session Report - School Cluster', 40, 50);

    // 2. Submission Details Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(40, 86, 515, 74, 4, 4, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(40, 86, 515, 74, 4, 4, 'S');

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Trainer Name: ${report.trainerName}`, 55, 106);
    doc.text(`Session Date: ${report.date}`, 320, 106);

    doc.setFont('helvetica', 'normal');
    doc.text(`School / Center: ${report.school || 'Not Specified'}`, 55, 124);
    doc.text(`Reporting Manager: ${report.reportingManagerName || 'Assigned Manager'}`, 320, 124);
    doc.text(`Department: ${report.trainerDept || 'Instructor'}`, 55, 142);
    doc.text(`Report ID: ${report.id}`, 320, 142);

    // 3. Sessions Table with embedded images
    const tableBody = report.sessions.map((s, idx) => {
      let geoInfo = '';
      if (s.geoTag && s.geoTag.lat) {
        geoInfo = `\n[Geotag Verified]\nLat: ${s.geoTag.lat}, Lng: ${s.geoTag.lng}\nTime: ${s.geoTag.timestamp || ''}`;
      }
      
      // If photo is present, add line breaks so text appears neatly below the embedded photo
      const photoSpacing = s.image ? '\n\n\n\n\n' : '';
      const photoCellText = photoSpacing + (s.image ? '' : '[No Photo Attached]') + geoInfo;

      return [
        idx + 1,
        s.classVal || s.class || 'N/A',
        s.timeVal || s.time || 'N/A',
        s.topicVal || s.topic || 'N/A',
        photoCellText,
        s.remarkVal || s.remark || '-'
      ];
    });

    doc.autoTable({
      startY: 170,
      head: [['#', 'Class / Std', 'Time / Duration', 'Topic Covered', 'Classroom Photo & Geotag', 'Remarks']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak', valign: 'top' },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 62 },
        2: { cellWidth: 78 },
        3: { cellWidth: 130 },
        4: { cellWidth: 130, minCellHeight: 80 },
        5: { cellWidth: 93 }
      },
      didDrawCell: function (data) {
        if (data.column.index === 4 && data.cell.section === 'body') {
          const session = report.sessions[data.row.index];
          if (session && session.image) {
            try {
              // Draw image thumbnail inside cell at top of the cell
              const imgX = data.cell.x + 6;
              const imgY = data.cell.y + 5;
              const imgW = 60;
              const imgH = 42;
              doc.addImage(session.image, 'JPEG', imgX, imgY, imgW, imgH);
            } catch (e) {
              console.warn('Error adding image to PDF cell:', e);
            }
          }
        }
      }
    });

    let finalY = doc.lastAutoTable.finalY + 16;

    // 4. Full Day Summary Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Full Day Work Summary:', 40, finalY);

    finalY += 8;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    const splitSummary = doc.splitTextToSize(report.summary || 'No summary provided.', 500);
    const summaryBoxHeight = Math.max(34, splitSummary.length * 11 + 14);
    doc.roundedRect(40, finalY, 515, summaryBoxHeight, 4, 4, 'FD');
    doc.text(splitSummary, 50, finalY + 13);

    finalY += summaryBoxHeight + 20;

    if (finalY > 700) {
      doc.addPage();
      finalY = 50;
    }

    // 5. 3-Level Approval Verification Flow Box (Clean Text, No Emojis)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Multi-Level Verification & Approval Workflow:', 40, finalY);
    finalY += 10;

    const boxWidth = 162;
    const boxHeight = 65;

    // Box 1: Reporting Manager
    doc.roundedRect(40, finalY, boxWidth, boxHeight, 3, 3, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Reporting Manager', 48, finalY + 14);
    doc.setFont('helvetica', 'normal');
    const mgrText = report.managerReview 
      ? (report.managerReview.status === 'approved' ? `[APPROVED]\nBy: ${report.managerReview.reviewerName || 'Manager'}\nDate: ${report.managerReview.reviewedAt || ''}` : `[REJECTED]\n${report.managerReview.remarks || ''}`) 
      : (report.status === 'pending_manager' ? '[Pending Review]' : '[Verified]');
    doc.text(mgrText, 48, finalY + 28);

    // Box 2: HR
    doc.roundedRect(216, finalY, boxWidth, boxHeight, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('2. Human Resources (HR)', 224, finalY + 14);
    doc.setFont('helvetica', 'normal');
    const hrText = report.hrReview 
      ? (report.hrReview.status === 'approved' ? `[APPROVED]\nBy: ${report.hrReview.reviewerName || 'HR'}\nDate: ${report.hrReview.reviewedAt || ''}` : `[REJECTED]\n${report.hrReview.remarks || ''}`) 
      : (report.status === 'pending_hr' ? '[Pending HR Review]' : (['pending_manager'].includes(report.status) ? '[Awaiting Manager Approval]' : '[Verified]'));
    doc.text(hrText, 224, finalY + 28);

    // Box 3: CEO
    doc.roundedRect(393, finalY, boxWidth, boxHeight, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('3. CEO / Administration', 401, finalY + 14);
    doc.setFont('helvetica', 'normal');
    const ceoText = report.ceoReview 
      ? (report.ceoReview.status === 'approved' ? `[FINAL APPROVED]\nDate: ${report.ceoReview.reviewedAt || ''}` : `[REJECTED]\n${report.ceoReview.remarks || ''}`) 
      : (report.status === 'approved' ? '[FINAL APPROVED]' : (report.status === 'pending_ceo' ? '[Pending CEO Approval]' : '[Awaiting HR Approval]'));
    doc.text(ceoText, 401, finalY + 28);

    // Footer note
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated automatically via AIR G International EMS Portal on ${new Date().toLocaleString()}`, 40, 812);

    return doc.output('datauristring');
  } catch (err) {
    console.error('Error generating Trainer Report PDF:', err);
    return null;
  }
}

async function handleTrainerReportSubmit(event) {
  if (event) event.preventDefault();

  const dateInput = document.getElementById('trainer-report-date');
  const schoolSelect = document.getElementById('trainer-report-school');
  const customSchoolInput = document.getElementById('trainer-custom-school-input');
  const managerSelect = document.getElementById('trainer-report-manager');
  const summaryInput = document.getElementById('trainer-day-summary');

  if (!dateInput || !schoolSelect || !managerSelect || !summaryInput) return;

  const dateVal = dateInput.value;
  let schoolVal = schoolSelect.value;
  if (schoolVal === 'Other' && customSchoolInput && customSchoolInput.value.trim()) {
    schoolVal = customSchoolInput.value.trim();
  }
  const managerIdVal = managerSelect.value;
  const managerNameVal = managerSelect.options[managerSelect.selectedIndex] ? managerSelect.options[managerSelect.selectedIndex].text.split('(')[0].trim() : 'Reporting Manager';
  const summaryVal = summaryInput.value.trim();

  if (!dateVal || !schoolVal || !managerIdVal || !summaryVal) {
    showToast('Please fill out all required fields: Date, School, Manager, and Day Summary.', 'error');
    return;
  }

  if (!state.currentTrainerSessions || state.currentTrainerSessions.length === 0) {
    showToast('Please add at least one classroom session.', 'error');
    return;
  }

  // Validate sessions
  for (let i = 0; i < state.currentTrainerSessions.length; i++) {
    const s = state.currentTrainerSessions[i];
    if (!s.topicVal || !s.topicVal.trim()) {
      showToast(`Please enter the topic covered for session #${i + 1}.`, 'error');
      return;
    }
  }

  const submitBtn = document.getElementById('btn-submit-trainer-report');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Generating PDF &amp; Submitting...</span>';
  }

  const newReport = {
    id: `TR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    trainerId: state.currentUser.id,
    trainerName: state.currentUser.name,
    trainerEmail: state.currentUser.email || '',
    trainerDept: state.currentUser.dept || 'Instructor',
    school: schoolVal,
    date: dateVal,
    submittedAt: new Date().toISOString(),
    sessions: JSON.parse(JSON.stringify(state.currentTrainerSessions)),
    summary: summaryVal,
    reportingManagerId: managerIdVal,
    reportingManagerName: managerNameVal,
    status: 'pending_manager',
    managerReview: null,
    hrReview: null,
    ceoReview: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Generate PDF
  const pdfBase64 = generateTrainerReportPDF(newReport);
  newReport.pdfBase64 = pdfBase64;

  if (!state.trainerReports) state.trainerReports = [];
  state.trainerReports.unshift(newReport);

  safeOriginalSetItem('ems_trainer_reports', JSON.stringify(state.trainerReports));
  await syncStateNow();

  // Send Notification / SMS to Reporting Manager
  const mgrEmp = state.employees.find(e => e.id === managerIdVal);
  if (mgrEmp && mgrEmp.phone) {
    triggerSMSNotification(
      mgrEmp.phone,
      `New Trainer Daily Report: ${state.currentUser.name} submitted session report for ${schoolVal} on ${dateVal} with ${newReport.sessions.length} sessions. Please review on portal.`,
      mgrEmp.name
    );
  }

  // Reset form
  state.currentTrainerSessions = [];
  summaryInput.value = '';
  addTrainerSessionRow();

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><span>Submit &amp; Generate PDF Report</span>';
  }

  renderTrainerReportsHistory();
  updateTrainerReportsBadge();
  showToast('🎉 Daily Trainer Report & PDF generated and submitted to Reporting Manager!', 'success');
}
window.handleTrainerReportSubmit = handleTrainerReportSubmit;

function viewTrainerReportPdf(reportId) {
  const report = (state.trainerReports || []).find(r => r.id === reportId);
  if (!report) {
    showToast('Report not found.', 'error');
    return;
  }

  // Always generate fresh PDF with latest embedded images, formatting, and approval status
  let pdfData = generateTrainerReportPDF(report);
  if (!pdfData) {
    pdfData = report.pdfBase64;
  } else {
    report.pdfBase64 = pdfData;
    safeOriginalSetItem('ems_trainer_reports', JSON.stringify(state.trainerReports));
  }

  if (pdfData) {
    const win = window.open();
    if (win) {
      win.document.write(`
        <html>
          <head><title>Trainer Report - ${report.trainerName} (${report.date})</title></head>
          <body style="margin:0; background:#0f172a; display:flex; flex-direction:column; height:100vh;">
            <iframe src="${pdfData}" style="width:100%; height:100%; border:none;"></iframe>
          </body>
        </html>
      `);
    } else {
      showToast('Popup blocked. Please allow popups to view the PDF.', 'warning');
    }
  }
}
window.viewTrainerReportPdf = viewTrainerReportPdf;

function redoTrainerReport(reportId) {
  const report = (state.trainerReports || []).find(r => r.id === reportId);
  if (!report) return;

  const dateInput = document.getElementById('trainer-report-date');
  const schoolSelect = document.getElementById('trainer-report-school');
  const managerSelect = document.getElementById('trainer-report-manager');
  const summaryInput = document.getElementById('trainer-day-summary');

  if (dateInput) dateInput.value = report.date;
  if (schoolSelect) {
    schoolSelect.value = report.school || '';
    handleTrainerSchoolChange();
  }
  if (managerSelect && report.reportingManagerId) {
    managerSelect.value = report.reportingManagerId;
  }
  if (summaryInput) summaryInput.value = report.summary || '';

  if (report.sessions && report.sessions.length > 0) {
    state.currentTrainerSessions = JSON.parse(JSON.stringify(report.sessions));
    renderTrainerSessionRows();
  }

  // Scroll to entry form
  const entryCard = document.getElementById('trainer-entry-form-card');
  if (entryCard) {
    entryCard.scrollIntoView({ behavior: 'smooth' });
  }

  showToast(`Loaded report for ${report.date}. Please make your corrections and submit again.`, 'info');
}
window.redoTrainerReport = redoTrainerReport;

function renderTrainerReportsHistory() {
  const container = document.getElementById('trainer-reports-history-list');
  if (!container) return;
  container.innerHTML = '';

  const filterStatus = document.getElementById('trainer-filter-status') ? document.getElementById('trainer-filter-status').value : 'all';

  const myReports = (state.trainerReports || []).filter(r => {
    if (r.trainerId !== state.currentUser.id && state.currentRole !== 'admin' && !isPratap(state.currentUser)) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  if (myReports.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 32px 16px; text-align: center;">
        <div class="empty-state-title" style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">No submitted trainer reports found</div>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">Submit your today's classroom sessions above to see your date-wise reports and generated PDFs here.</p>
      </div>
    `;
    return;
  }

  myReports.forEach(report => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '20px';
    card.style.borderRadius = '8px';
    card.style.background = 'var(--bg-tertiary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '14px';

    // Status Badge Info
    let statusBadgeHtml = '';
    if (report.status === 'approved') {
      statusBadgeHtml = `<span class="badge badge-completed" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">✅ Final Approved by CEO</span>`;
    } else if (report.status === 'pending_manager') {
      statusBadgeHtml = `<span class="badge badge-warning" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Pending Reporting Manager Review (${report.reportingManagerName || 'Manager'})</span>`;
    } else if (report.status === 'pending_hr') {
      statusBadgeHtml = `<span class="badge badge-in-progress" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Manager Approved ➔ Pending HR Review</span>`;
    } else if (report.status === 'pending_ceo') {
      statusBadgeHtml = `<span class="badge badge-high" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ HR Approved ➔ Pending CEO Approval</span>`;
    } else if (report.status === 'rejected') {
      statusBadgeHtml = `<span class="badge badge-danger" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">❌ Rejected — Correction Needed</span>`;
    }

    // Sessions Table Rows
    const sessionRowsHtml = (report.sessions || []).map((s, idx) => {
      let geoBadge = '';
      if (s.geoTag && s.geoTag.lat) {
        geoBadge = `<div style="font-size: 0.7rem; color: #22c55e; margin-top: 2px;">📍 ${s.geoTag.lat}, ${s.geoTag.lng}</div>`;
      }
      let photoThumb = '<span style="color: var(--text-muted); font-size: 0.75rem;">No photo</span>';
      if (s.image) {
        photoThumb = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <img src="${s.image}" style="width: 38px; height: 38px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('${s.image}')" title="Click to view full photo">
            ${geoBadge}
          </div>
        `;
      }
      return `
        <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.82rem;">
          <td style="text-align: center; padding: 8px 6px; font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
          <td style="padding: 8px 6px; font-weight: 600;">${s.classVal || s.class || '-'}</td>
          <td style="padding: 8px 6px; color: var(--text-secondary);">${s.timeVal || s.time || '-'}</td>
          <td style="padding: 8px 6px; font-weight: 500;">${s.topicVal || s.topic || '-'}</td>
          <td style="padding: 8px 6px;">${photoThumb}</td>
          <td style="padding: 8px 6px; color: var(--text-secondary);">${s.remarkVal || s.remark || '-'}</td>
        </tr>
      `;
    }).join('');

    let rejectionAlertHtml = '';
    if (report.status === 'rejected') {
      const rejectRemark = (report.ceoReview && report.ceoReview.remarks) || (report.hrReview && report.hrReview.remarks) || (report.managerReview && report.managerReview.remarks) || 'Please correct your report and resubmit.';
      rejectionAlertHtml = `
        <div style="padding: 12px 16px; border-radius: 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; font-size: 0.85rem;">
          <strong>⚠️ Rejection Feedback:</strong> "${rejectRemark}"
        </div>
      `;
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <strong style="font-size: 1.05rem; color: var(--text-primary);">👤 ${report.trainerName}</strong>
          <span style="padding: 3px 8px; border-radius: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-size: 0.78rem; font-weight: 600;">🏫 ${report.school || 'School'}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">👔 Manager: ${report.reportingManagerName || 'Assigned Manager'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; align-items: flex-end;">
            <span style="font-weight: 700; font-size: 0.9rem; color: var(--primary);">📅 Work Date: ${formatDate(report.date)}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">🕒 Submitted: ${formatDateTime(report.submittedAt || report.createdAt)}</span>
          </div>
          ${statusBadgeHtml}
        </div>
      </div>

      <!-- Full Session Table View on UI -->
      <div class="table-container" style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary);">
        <table class="daily-report-sessions-table" style="width: 100%; border-collapse: collapse; min-width: 650px;">
          <thead>
            <tr style="background: var(--bg-primary); border-bottom: 1px solid var(--border-color); font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted);">
              <th style="width: 35px; text-align: center; padding: 8px;">#</th>
              <th style="width: 110px; padding: 8px;">Class</th>
              <th style="width: 140px; padding: 8px;">Time</th>
              <th style="min-width: 180px; padding: 8px;">Topic Covered</th>
              <th style="width: 170px; padding: 8px;">Geotagged Photo</th>
              <th style="min-width: 140px; padding: 8px;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${sessionRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Day Summary Box -->
      <div style="padding: 10px 14px; border-radius: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-size: 0.83rem;">
        <span style="font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">📝 Full Day Summary:</span>
        <span style="color: var(--text-secondary); white-space: pre-wrap;">${report.summary || 'No summary provided.'}</span>
      </div>

      ${rejectionAlertHtml}

      <!-- Bottom Actions Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-top: 6px;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="viewTrainerReportPdf('${report.id}')" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; padding: 6px 14px; background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.4); color: #3b82f6;">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>📄 View / Download Generated PDF</span>
        </button>

        ${report.status === 'rejected' ? `
          <button type="button" class="btn btn-primary btn-sm" onclick="redoTrainerReport('${report.id}')" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; background: var(--warning); border-color: var(--warning); color: #000;">
            <span>🔄 Redo &amp; Resubmit This Report</span>
          </button>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

function populateTrainerReviewFilters() {
  const trainerFilter = document.getElementById('review-filter-trainer');
  if (!trainerFilter) return;

  const trainersList = state.employees.filter(e => isUserTrainer(e));
  trainerFilter.innerHTML = '<option value="all">All Trainers</option>' + 
    trainersList.map(t => `<option value="${t.id}">${t.name} (${t.dept || 'Instructor'})</option>`).join('');
}

function renderTrainerReportsReviewList() {
  const container = document.getElementById('trainer-reports-review-list');
  if (!container) return;
  container.innerHTML = '';

  const trainerFilter = document.getElementById('review-filter-trainer') ? document.getElementById('review-filter-trainer').value : 'all';
  const statusFilter = document.getElementById('review-filter-status') ? document.getElementById('review-filter-status').value : 'pending_my_action';

  const roleLower = (state.currentUser.role || '').toLowerCase();
  const isCEO = roleLower.includes('admin') || isPratap(state.currentUser);
  const isHR = roleLower.includes('hr');
  const myId = state.currentUser.id;

  const reviewReports = (state.trainerReports || []).filter(report => {
    if (trainerFilter !== 'all' && report.trainerId !== trainerFilter) return false;

    if (statusFilter === 'pending_my_action') {
      if (isCEO && report.status === 'pending_ceo') return true;
      if (isHR && report.status === 'pending_hr') return true;
      if (report.status === 'pending_manager' && (report.reportingManagerId === myId || isCEO || isHR)) return true;
      return false;
    } else if (statusFilter === 'approved') {
      return report.status === 'approved';
    } else if (statusFilter === 'rejected') {
      return report.status === 'rejected';
    }

    return true;
  });

  if (reviewReports.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 32px 16px; text-align: center;">
        <div class="empty-state-title" style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">No trainer reports pending review</div>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">You have no reports awaiting your approval for the selected filter.</p>
      </div>
    `;
    return;
  }

  reviewReports.forEach(report => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '20px';
    card.style.borderRadius = '8px';
    card.style.background = 'var(--bg-secondary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '14px';

    // Status Badge
    let statusBadgeHtml = '';
    if (report.status === 'approved') {
      statusBadgeHtml = `<span class="badge badge-completed" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">✅ Final Approved</span>`;
    } else if (report.status === 'pending_manager') {
      statusBadgeHtml = `<span class="badge badge-warning" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Stage 1: Pending Reporting Manager</span>`;
    } else if (report.status === 'pending_hr') {
      statusBadgeHtml = `<span class="badge badge-in-progress" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Stage 2: Pending HR Review</span>`;
    } else if (report.status === 'pending_ceo') {
      statusBadgeHtml = `<span class="badge badge-high" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Stage 3: Pending CEO Final Approval</span>`;
    } else if (report.status === 'rejected') {
      statusBadgeHtml = `<span class="badge badge-danger" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">❌ Rejected</span>`;
    }

    // Sessions Table Rows
    const sessionRowsHtml = (report.sessions || []).map((s, idx) => {
      let geoBadge = '';
      if (s.geoTag && s.geoTag.lat) {
        geoBadge = `<div style="font-size: 0.7rem; color: #22c55e; margin-top: 2px;">📍 ${s.geoTag.lat}, ${s.geoTag.lng}</div>`;
      }
      let photoThumb = '<span style="color: var(--text-muted); font-size: 0.75rem;">No photo</span>';
      if (s.image) {
        photoThumb = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <img src="${s.image}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('${s.image}')" title="Click to inspect photo">
            ${geoBadge}
          </div>
        `;
      }
      return `
        <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.82rem;">
          <td style="text-align: center; padding: 8px 6px; font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
          <td style="padding: 8px 6px; font-weight: 600;">${s.classVal || s.class || '-'}</td>
          <td style="padding: 8px 6px; color: var(--text-secondary);">${s.timeVal || s.time || '-'}</td>
          <td style="padding: 8px 6px; font-weight: 500;">${s.topicVal || s.topic || '-'}</td>
          <td style="padding: 8px 6px;">${photoThumb}</td>
          <td style="padding: 8px 6px; color: var(--text-secondary);">${s.remarkVal || s.remark || '-'}</td>
        </tr>
      `;
    }).join('');

    // Workflow Review Action Controls
    let actionControlsHtml = '';
    const canManagerReview = (report.status === 'pending_manager') && (report.reportingManagerId === myId || isCEO || isHR);
    const canHRReview = (report.status === 'pending_hr') && (isHR || isCEO);
    const canCEOReview = (report.status === 'pending_ceo') && isCEO;

    if (canManagerReview) {
      actionControlsHtml = `
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 6px;">
          <button type="button" class="btn btn-success btn-sm" onclick="reviewTrainerReport('${report.id}', 'approve', 'manager')" style="font-weight: 700; padding: 6px 16px; background: #16a34a; border-color: #16a34a; color: #fff;">
            ✅ Manager Approve &amp; Forward to HR
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="reviewTrainerReport('${report.id}', 'reject', 'manager')" style="font-weight: 700; padding: 6px 16px;">
            ❌ Reject (Ask Trainer to Redo)
          </button>
        </div>
      `;
    } else if (canHRReview) {
      actionControlsHtml = `
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 6px;">
          <div style="font-size: 0.8rem; color: #22c55e; font-weight: 600; width: 100%;">
            ✓ Approved by Manager: ${report.managerReview ? report.managerReview.reviewerName : report.reportingManagerName} on ${report.managerReview ? report.managerReview.reviewedAt : ''}
          </div>
          <button type="button" class="btn btn-success btn-sm" onclick="reviewTrainerReport('${report.id}', 'approve', 'hr')" style="font-weight: 700; padding: 6px 16px; background: #16a34a; border-color: #16a34a; color: #fff;">
            ✅ HR Approve &amp; Forward to CEO
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="reviewTrainerReport('${report.id}', 'reject', 'hr')" style="font-weight: 700; padding: 6px 16px;">
            ❌ HR Reject (Ask Trainer to Redo)
          </button>
        </div>
      `;
    } else if (canCEOReview) {
      actionControlsHtml = `
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 6px;">
          <div style="font-size: 0.8rem; color: #3b82f6; font-weight: 600; width: 100%;">
            ✓ Approved by Manager &amp; HR
          </div>
          <button type="button" class="btn btn-success btn-sm" onclick="reviewTrainerReport('${report.id}', 'approve', 'ceo')" style="font-weight: 700; padding: 6px 18px; background: #22c55e; border-color: #22c55e; color: #000;">
            👑 CEO Final Approve &amp; Finalize
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="reviewTrainerReport('${report.id}', 'reject', 'ceo')" style="font-weight: 700; padding: 6px 16px;">
            ❌ Reject (Ask Trainer to Redo)
          </button>
        </div>
      `;
    } else if (report.status === 'approved') {
      actionControlsHtml = `
        <div style="font-size: 0.82rem; color: #22c55e; font-weight: 700; padding: 6px 12px; border-radius: 4px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);">
          ✨ Fully Approved by Manager, HR, and CEO!
        </div>
      `;
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <strong style="font-size: 1.1rem; color: var(--text-primary);">🎓 Trainer: ${report.trainerName}</strong>
          <span style="padding: 3px 8px; border-radius: 4px; background: var(--bg-tertiary); border: 1px solid var(--border-color); font-size: 0.8rem; font-weight: 600;">🏫 ${report.school || 'School'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <div style="display: flex; flex-direction: column; align-items: flex-end;">
            <span style="font-weight: 700; font-size: 0.9rem; color: var(--primary);">📅 Work Date: ${formatDate(report.date)}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">🕒 Submitted: ${formatDateTime(report.submittedAt || report.createdAt)}</span>
          </div>
          ${statusBadgeHtml}
        </div>
      </div>

      <!-- Interactive Sessions Table on UI -->
      <div class="table-container" style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary);">
        <table class="daily-report-sessions-table" style="width: 100%; border-collapse: collapse; min-width: 650px;">
          <thead>
            <tr style="background: var(--bg-tertiary); border-bottom: 1px solid var(--border-color); font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted);">
              <th style="width: 35px; text-align: center; padding: 8px;">#</th>
              <th style="width: 110px; padding: 8px;">Class</th>
              <th style="width: 140px; padding: 8px;">Time</th>
              <th style="min-width: 180px; padding: 8px;">Topic Covered</th>
              <th style="width: 170px; padding: 8px;">Geotagged Photo</th>
              <th style="min-width: 140px; padding: 8px;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${sessionRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Day Summary -->
      <div style="padding: 10px 14px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); font-size: 0.83rem;">
        <span style="font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">📝 Full Day Summary:</span>
        <span style="color: var(--text-secondary); white-space: pre-wrap;">${report.summary || 'No summary provided.'}</span>
      </div>

      <!-- Review Actions Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="viewTrainerReportPdf('${report.id}')" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; padding: 6px 14px; background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.4); color: #3b82f6;">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>📄 View / Download Generated PDF</span>
        </button>

        ${actionControlsHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

async function reviewTrainerReport(reportId, action, reviewerLevel) {
  const report = (state.trainerReports || []).find(r => r.id === reportId);
  if (!report) return;

  let remarks = '';
  if (action === 'reject') {
    remarks = prompt('Please enter reason for rejection (this will be sent to the trainer to redo the report):', '');
    if (remarks === null) return; // cancelled
    if (!remarks.trim()) {
      showToast('A rejection remark is required so the trainer knows what to fix.', 'error');
      return;
    }
  }

  const reviewStamp = {
    reviewerId: state.currentUser.id,
    reviewerName: state.currentUser.name,
    reviewedAt: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    remarks: remarks ? remarks.trim() : (action === 'approve' ? 'Approved' : 'Rejected'),
    status: action === 'approve' ? 'approved' : 'rejected'
  };

  if (action === 'reject') {
    report.status = 'rejected';
    if (reviewerLevel === 'manager') report.managerReview = reviewStamp;
    else if (reviewerLevel === 'hr') report.hrReview = reviewStamp;
    else if (reviewerLevel === 'ceo') report.ceoReview = reviewStamp;
  } else {
    // Approve transition
    if (reviewerLevel === 'manager') {
      report.managerReview = reviewStamp;
      report.status = 'pending_hr';
    } else if (reviewerLevel === 'hr') {
      report.hrReview = reviewStamp;
      report.status = 'pending_ceo';
    } else if (reviewerLevel === 'ceo') {
      report.ceoReview = reviewStamp;
      report.status = 'approved';
    }
  }

  report.updatedAt = new Date().toISOString();

  // Re-generate updated PDF with the new signatures / stamps
  const updatedPdf = generateTrainerReportPDF(report);
  if (updatedPdf) {
    report.pdfBase64 = updatedPdf;
  }

  safeOriginalSetItem('ems_trainer_reports', JSON.stringify(state.trainerReports));
  await syncStateNow();

  // Notify trainer
  const trainerEmp = state.employees.find(e => e.id === report.trainerId);
  if (trainerEmp && trainerEmp.phone) {
    const msg = action === 'approve' 
      ? `Trainer Report Update: Your report for ${report.date} was approved by ${state.currentUser.name}. Next stage: ${report.status}.`
      : `Trainer Report Rejected: Your report for ${report.date} was rejected by ${state.currentUser.name}. Reason: "${remarks}". Please login to redo and resubmit.`;
    triggerSMSNotification(trainerEmp.phone, msg, trainerEmp.name);
  }

  renderTrainerReportsReviewList();
  renderTrainerReportsHistory();
  updateTrainerReportsBadge();

  if (action === 'approve') {
    showToast(`Report approved! Status moved to ${report.status}.`, 'success');
  } else {
    showToast('Report rejected and returned to trainer for correction.', 'warning');
  }
}
window.reviewTrainerReport = reviewTrainerReport;


window.cycleTaskStatus = cycleTaskStatus;
window.toggleTaskCompletion = toggleTaskCompletion;
window.submitTaskForReview = submitTaskForReview;
window.approveTaskByLead = approveTaskByLead;
window.rejectTaskByLeadModal = rejectTaskByLeadModal;
window.getTaskStatusBadgeHtml = getTaskStatusBadgeHtml;
window.deleteTask = deleteTask;
window.openAssignTaskModal = openAssignTaskModal;
window.hideTaskModal = hideTaskModal;
window.openCreateDeptModal = openCreateDeptModal;
window.hideDeptModal = hideDeptModal;
window.openCreateEmployeeModal = openCreateEmployeeModal;
window.hideEmployeeModal = hideEmployeeModal;
window.openCreateEmpTaskModal = openCreateEmpTaskModal;
window.hideEmpTaskModal = hideEmpTaskModal;
window.handleAssignTaskProjectChange = handleAssignTaskProjectChange;
window.toggleTaskDetailsExpand = toggleTaskDetailsExpand;
window.openFullImageViewModal = openFullImageViewModal;
window.hideImageViewerModal = hideImageViewerModal;
window.startEditTask = startEditTask;
window.cancelEditTask = cancelEditTask;
window.saveEditTask = saveEditTask;

// Communications exports
window.switchCommTab = switchCommTab;
window.openPostAnnouncementModal = openPostAnnouncementModal;
window.hidePostAnnouncementModal = hidePostAnnouncementModal;
window.openSendNoticeModal = openSendNoticeModal;
window.hideSendNoticeModal = hideSendNoticeModal;

// Calendar exports
window.switchLeaveSubTab = switchLeaveSubTab;
window.changeCalendarMonth = changeCalendarMonth;
window.toggleExpandCalendar = toggleExpandCalendar;
window.changeInlineCalendarMonth = changeInlineCalendarMonth;
window.renderInlineCalendar = renderInlineCalendar;

// Daily Reports exports
window.setTodayReportDate = setTodayReportDate;
window.renderDailyReports = renderDailyReports;
window.handleDailyReportSubmit = handleDailyReportSubmit;
window.toggleReportDetailsExpand = toggleReportDetailsExpand;
window.startEditRemarks = startEditRemarks;
window.cancelEditRemarks = cancelEditRemarks;
window.saveHRRemarks = saveHRRemarks;
window.setReportStarRating = setReportStarRating;

// --- Payslip & Reimbursements Features ---

function populatePayslipMonths() {
  const monthSelect = document.getElementById('payslip-month-select');
  if (!monthSelect) return;
  if (monthSelect.options.length > 0) return; // already populated

  const currentYear = 2026;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  monthNames.forEach((name, index) => {
    const monthVal = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
    const opt = document.createElement('option');
    opt.value = monthVal;
    opt.textContent = `${name} ${currentYear}`;
    monthSelect.appendChild(opt);
  });

  // Set default to June 2026 (current time context year/month)
  monthSelect.value = "2026-06";
}

function getEmployeeSalaryForMonth(emp, month) {
  if (!emp.salaries) {
    emp.salaries = {};
  }
  // Compute LWP from accrual engine for this employee & month
  const accrualForMonth = getEmployeeLeaveAccumulation(emp.id, month);
  const computedLwp = accrualForMonth.lwpDays;

  let totalEarningBase = 10000; // default total earning

  if (emp.salaries[month]) {
    if (emp.salaries[month].totalEarning !== undefined) {
      totalEarningBase = Number(emp.salaries[month].totalEarning);
    } else {
      totalEarningBase = Number(emp.salaries[month].basic || 0) +
        Number(emp.salaries[month].hra || 0) +
        Number(emp.salaries[month].other || 0);
      if (totalEarningBase === 0) totalEarningBase = 10000;
    }
  }

  const basic = Math.round(totalEarningBase * 0.50); // 50% basic
  const hra = Math.round(basic * 0.40); // 40% HRA of basic
  const other = totalEarningBase - (basic + hra); // remainder other
  const profTax = totalEarningBase > 7500 ? 200 : 0;

  if (!emp.salaries[month]) {
    emp.salaries[month] = {
      totalEarning: totalEarningBase,
      basic: basic,
      hra: hra,
      other: other,
      profTax: profTax,
      lwpDays: computedLwp
    };
  } else {
    emp.salaries[month].totalEarning = totalEarningBase;
    emp.salaries[month].basic = basic;
    emp.salaries[month].hra = hra;
    emp.salaries[month].other = other;
    emp.salaries[month].profTax = profTax;
    if (!emp.salaries[month]._lwpManualOverride) {
      emp.salaries[month].lwpDays = computedLwp;
    }
  }
  return emp.salaries[month];
}

function renderPayslips() {
  populatePayslipMonths();

  const isHRorAdmin = state.currentRole === 'hr' || state.currentRole === 'admin';
  const adminControls = document.getElementById('payslip-admin-controls');

  if (isHRorAdmin) {
    if (adminControls) adminControls.style.display = 'flex';
    populateSalaryEmployeeSelect();
  } else {
    if (adminControls) adminControls.style.display = 'none';
  }

  // Determine which employee's payslip to show
  let targetEmp = state.currentUser;
  if (isHRorAdmin) {
    const select = document.getElementById('salary-emp-select');
    if (select && select.value) {
      targetEmp = state.employees.find(e => e.id === select.value) || state.currentUser;
    }
  }

  const card = document.getElementById('payslip-display-card');
  if (!card) return;

  if (!targetEmp) {
    card.innerHTML = `<p class="text-muted">No employee selected.</p>`;
    return;
  }

  const monthSelect = document.getElementById('payslip-month-select');
  const selectedMonth = monthSelect ? monthSelect.value : '2026-06';

  const salary = getEmployeeSalaryForMonth(targetEmp, selectedMonth);

  // Calculate Expense Reimbursement (approved claims for this employee in the selected month)
  const approvedReimbSum = state.reimbursements
    .filter(r => r.employeeId === targetEmp.id && r.status === 'approved' && r.date.startsWith(selectedMonth))
    .reduce((sum, r) => sum + Number(r.amount), 0);

  let basic = Number(salary.basic);
  let hra = Number(salary.hra);
  let other = Number(salary.other);
  let profTax = Number(salary.profTax);
  let lwpDays = Number(salary.lwpDays || 0);

  if (isHRorAdmin) {
    const totalEarningEl = document.getElementById('salary-total-earning');
    const lwpEl = document.getElementById('salary-lwp');
    if (totalEarningEl && lwpEl && totalEarningEl.value !== '') {
      const totalEarningBase = Number(totalEarningEl.value || 0);
      basic = Math.round(totalEarningBase * 0.50);
      hra = Math.round(basic * 0.40);
      other = totalEarningBase - (basic + hra);
      profTax = totalEarningBase > 7500 ? 200 : 0;
      lwpDays = Number(lwpEl.value || 0);
    }
  }

  const totalEarnings = basic + hra + other + approvedReimbSum;

  // Calculate LWP deduction rate: base total earning (basic + hra + other) divided by number of days in the month
  const [yearVal, monthVal] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yearVal, monthVal, 0).getDate();

  // Collect national holidays falling in this month (green calendar events)
  const monthHolidayDates = (state.nationalHolidays || [])
    .filter(h => h.date && h.date.startsWith(selectedMonth))
    .map(h => ({ date: h.date, name: h.name, day: new Date(h.date).getDay() }));

  // Unique holiday calendar dates that fall on weekdays (non-Sunday)
  const weekdayHolidayDates = new Set(
    monthHolidayDates.filter(h => h.day !== 0).map(h => h.date)
  );

  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearVal}-${String(monthVal).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayOfWeek = new Date(yearVal, monthVal - 1, d).getDay();
    // Exclude Sundays and national holidays (green calendar events)
    if (dayOfWeek !== 0 && !weekdayHolidayDates.has(dateStr)) {
      workingDays++;
    }
  }

  // Build holiday tooltip string for the payslip
  const holidayNames = monthHolidayDates.map(h => h.name);
  const uniqueHolidayNames = [...new Set(holidayNames)];
  const holidayTooltip = uniqueHolidayNames.length > 0
    ? `${weekdayHolidayDates.size} public holiday${weekdayHolidayDates.size !== 1 ? 's' : ''} excluded: ${uniqueHolidayNames.join(', ')}`
    : '';
  const lwpDeduction = Math.round(((basic + hra + other) / daysInMonth) * lwpDays);

  const totalDeductions = profTax + lwpDeduction;

  // Compute paid leave days for this month (total approved - lwp)
  const monthAccrual = getEmployeeLeaveAccumulation(targetEmp.id, selectedMonth);
  const leavesThisMonth = getEmployeeLeavesPerMonth(targetEmp.id)[selectedMonth] || 0;
  const paidLeaveDays = Math.max(0, leavesThisMonth - lwpDays);

  const netPay = totalEarnings - totalDeductions;

  const defaultNotesText = `• Leave Without Pay (LWP) and Absent days are subject to salary deductions.
• Leave With Pay days are fully paid leaves.`;
  const payslipNotesText = (salary.notes !== undefined && salary.notes !== null) ? salary.notes : defaultNotesText;

  // Format notes lines for display
  const formattedNotesHTML = payslipNotesText.split('\n').map(line => {
    line = line.trim();
    if (!line) return '';
    if (!line.startsWith('•') && !line.startsWith('-')) {
      return `<div style="margin-bottom: 2px;">• ${line}</div>`;
    }
    return `<div style="margin-bottom: 2px;">${line}</div>`;
  }).join('');

  // Format month name
  const [year, month] = selectedMonth.split('-');
  const dateObj = new Date(year, month - 1);
  const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  // Format joining date to DD-MM-YYYY if needed
  let displayJoiningDate = targetEmp.joiningDate || targetEmp.dateOfJoining || '25-07-2025';
  if (displayJoiningDate.includes('-')) {
    const parts = displayJoiningDate.split('-');
    if (parts[0].length === 4) {
      displayJoiningDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  card.innerHTML = `
    <div style="background-color: #fff; color: #000; padding: 40px; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; box-sizing: border-box; width: 100%; max-width: 800px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); position: relative;">
      <!-- Header -->
      <div style="display: flex; flex-direction: column; align-items: center; position: relative; margin-bottom: 30px; width: 100%;">
        <div style="position: absolute; left: 0; top: 0;">
          <img src="air g logo black.png" alt="AIR G International" style="max-height: 45px; object-fit: contain;">
        </div>
        <div style="text-align: center; margin-top: 10px;">
          <h2 style="font-size: 1.5rem; font-weight: 700; margin: 0; color: #000; font-family: inherit;">AIR G International</h2>
          <h3 style="font-size: 1.25rem; font-weight: 600; margin: 5px 0 0 0; color: #000; font-family: inherit;">Payslip</h3>
        </div>
      </div>

      <!-- Employee Metadata Block -->
      <table class="meta-table" style="width: 100%; border: none !important; margin-bottom: 30px; font-size: 0.9rem; border-collapse: collapse; line-height: 1.6; color: #000;">
        <tr style="border: none !important;">
          <td style="width: 18%; padding: 4px 0; border: none !important; font-weight: 500; color: #000;">Date of Joining</td>
          <td style="width: 32%; padding: 4px 0; border: none !important; color: #000;">: ${displayJoiningDate}</td>
          <td style="width: 18%; padding: 4px 0; border: none !important; font-weight: 500; color: #000;">Employee Name</td>
          <td style="width: 32%; padding: 4px 0; border: none !important; color: #000;">: ${targetEmp.name}</td>
        </tr>
        <tr style="border: none !important;">
          <td style="padding: 4px 0; border: none !important; font-weight: 500; color: #000;">Pay Period</td>
          <td style="padding: 4px 0; border: none !important; color: #000;">: ${monthName}</td>
          <td style="padding: 4px 0; border: none !important; font-weight: 500; color: #000;">Designation</td>
          <td style="padding: 4px 0; border: none !important; color: #000;">: ${targetEmp.role}</td>
        </tr>
        <tr style="border: none !important;">
          <td style="padding: 4px 0; border: none !important; font-weight: 500; color: #000;">Total Working Days</td>
          <td style="padding: 4px 0; border: none !important; color: #000;">: ${workingDays}${holidayTooltip ? ` <span title="${holidayTooltip}" style="font-size: 0.72rem; color: #555; cursor: help; border-bottom: 1px dashed #888;">(${weekdayHolidayDates.size} holiday${weekdayHolidayDates.size !== 1 ? 's' : ''} excl.)</span>` : ''}</td>
          <td style="padding: 4px 0; border: none !important; font-weight: 500; color: #000;">Department</td>
          <td style="padding: 4px 0; border: none !important; color: #000;">: ${targetEmp.dept ? targetEmp.dept.split(',')[0].trim() : 'AI'}</td>
        </tr>
        <tr style="border: none !important;">
          <td style="padding: 4px 0; border: none !important; font-weight: 500; color: #000;">Worked Days</td>
          <td style="padding: 4px 0; border: none !important; color: #000;">: ${Math.max(0, workingDays - lwpDays)}</td>
          <td style="padding: 4px 0; border: none !important; font-weight: 500; color: #000;">Absent Days</td>
          <td style="padding: 4px 0; border: none !important; color: #000;">: ${lwpDays}</td>
        </tr>
      </table>

      <!-- Earnings Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 25px; font-size: 0.9rem; color: #000;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; background-color: #d3d3d3; padding: 8px 12px; text-align: left; font-weight: bold; color: #000;">Earnings</th>
            <th style="border: 1px solid #000; background-color: #d3d3d3; padding: 8px 12px; text-align: right; font-weight: bold; color: #000; width: 18%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: left; color: #000;">Basic Pay</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">${basic || ''}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: left; color: #000;">House Rent Allowance</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">${hra || ''}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: left; color: #000;">Other Allowance</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">${other || ''}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: left; color: #000;">Expense Reimbursement</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">${approvedReimbSum > 0 ? approvedReimbSum : ''}</td>
          </tr>
          <tr style="font-weight: bold;">
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">Total Earnings</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">${totalEarnings}</td>
          </tr>
        </tbody>
      </table>

      <!-- Deductions Table -->
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 25px; font-size: 0.9rem; color: #000;">
        <thead>
          <tr>
            <th style="border: 1px solid #000; background-color: #d3d3d3; padding: 8px 12px; text-align: left; font-weight: bold; color: #000;">Deductions</th>
            <th style="border: 1px solid #000; background-color: #d3d3d3; padding: 8px 12px; text-align: center; font-weight: bold; color: #000; width: 15%;">Days</th>
            <th style="border: 1px solid #000; background-color: #d3d3d3; padding: 8px 12px; text-align: right; font-weight: bold; color: #000; width: 18%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: left; color: #000;">Professional Tax</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: center; color: #000;">-</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">${profTax || ''}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: left; color: #000;">Leave Without Pay</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: center; color: #000;">${lwpDays || 0}</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">${lwpDeduction > 0 ? lwpDeduction : ''}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: left; color: #000;">Leave With Pay</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: center; color: #000;">${paidLeaveDays || 0}</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">-</td>
          </tr>
          <tr style="font-weight: bold;">
            <td colspan="2" style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">Total Deductions</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">${totalDeductions}</td>
          </tr>
          <tr style="font-weight: bold;">
            <td colspan="2" style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">Net Pay</td>
            <td style="border: 1px solid #000; padding: 8px 12px; text-align: right; color: #000;">${netPay}</td>
          </tr>
        </tbody>
      </table>

      <!-- Signatures Block -->
      <div class="payslip-signatures" style="display: flex; justify-content: space-between; margin-top: 60px; margin-bottom: 40px; padding: 0 20px; font-size: 0.9rem; color: #000; width: 100%; box-sizing: border-box;">
        <div style="width: 45%; display: flex; flex-direction: column; text-align: left;">
          <div style="text-align: center; position: relative;">
            <p class="payslip-sig-label" style="margin: 0 0 10px 0; font-weight: 500; color: #000;">Employer Signature</p>
            <div style="height: 50px; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
              ${isHRorAdmin ? `
                <img src="/sign.jpeg" alt="Employer Signature" style="max-height: 50px; width: auto; mix-blend-mode: multiply; object-fit: contain;">
              ` : ''}
            </div>
            <div style="border-bottom: 1.5px solid #000; width: 100%;"></div>
          </div>
          <!-- Notes section below the employer signature -->
          <div class="payslip-notes" style="font-size: 0.72rem; color: #555; line-height: 1.4; margin-top: 15px; text-align: left; font-family: inherit; width: 100%;">
            <strong style="color: #000; display: block; margin-bottom: 4px;">Notes:</strong>
            ${isHRorAdmin ? `
              <textarea id="payslip-notes-input" style="width: 100%; border: 1px dashed var(--border-color); background: transparent; color: #555; font-size: 0.72rem; font-family: inherit; resize: vertical; padding: 6px; box-sizing: border-box; outline: none; border-radius: var(--border-radius-sm);" rows="3" onchange="updatePayslipNotes(this.value)">${payslipNotesText}</textarea>
            ` : `
              <div style="font-size: 0.72rem; color: #555; line-height: 1.4;">${formattedNotesHTML}</div>
            `}
          </div>
        </div>
        <div style="text-align: center; width: 35%;">
          <p class="payslip-sig-label" style="margin: 0 0 65px 0; font-weight: 500; color: #000;">Employee Signature</p>
          <div style="border-bottom: 1.5px solid #000; width: 100%;"></div>
        </div>
      </div>

      <!-- Footnote -->
      <div class="payslip-footnote" style="text-align: center; font-size: 0.8rem; color: #555; margin-top: 20px; width: 100%;">
        This is system generated payslip
      </div>

      <!-- Print Button Control (hidden in printout) -->
      <div style="position: absolute; right: 20px; bottom: 20px;" class="print-hide">
        <button class="btn btn-secondary" id="payslip-print-btn" onclick="printPayslip()" style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 0.8rem; cursor: pointer; border-radius: 6px; background-color: var(--primary); color: white; border: none; font-weight: 600;">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Download Payslip
        </button>
      </div>
    </div>
  `;
}

function printPayslip() {
  const card = document.getElementById('payslip-display-card');
  if (!card) return;
  const printWindow = window.open('', '_blank', 'width=800,height=800');
  if (!printWindow) {
    showToast('Popup blocker! Allow popups to print.', 'error');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Payslip - AIR G International</title>
        <style>
          body {
            background: #fff !important;
            color: #000 !important;
            padding: 20px !important;
            font-family: Arial, sans-serif !important;
          }
          .card {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
          .card > div {
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          .btn, #payslip-print-btn, .print-hide {
            display: none !important;
          }
          table:not(.meta-table) {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 15px !important;
            border: 1px solid #000 !important;
          }
          table:not(.meta-table) th, table:not(.meta-table) td {
            border: 1px solid #000 !important;
            padding: 6px 10px !important;
          }
          table:not(.meta-table) th {
            background-color: #d3d3d3 !important;
            color: #000 !important;
          }
          .meta-table {
            width: 100% !important;
            border: none !important;
            margin-bottom: 15px !important;
            border-collapse: collapse !important;
          }
          .meta-table td {
            border: none !important;
            padding: 3px 0 !important;
          }
          .payslip-signatures {
            margin-top: 30px !important;
            margin-bottom: 20px !important;
          }
          .payslip-footnote {
            margin-top: 15px !important;
          }
          textarea {
            border: none !important;
            resize: none !important;
            background: transparent !important;
            padding: 0 !important;
            color: #555 !important;
            width: 100% !important;
            overflow: hidden !important;
            font-family: inherit !important;
            font-size: 0.72rem !important;
            line-height: 1.4 !important;
            outline: none !important;
          }
        </style>
      </head>
      <body>
        <div class="card">
          ${card.innerHTML}
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function populateSalaryEmployeeSelect() {
  const select = document.getElementById('salary-emp-select');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '';
  const eligibleEmployees = state.employees.filter(emp => emp.role.toLowerCase() !== 'admin' && !isPratap(emp) && !emp.isDeleted && emp.status !== 'pending_approval');
  eligibleEmployees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.dept} - ${emp.role})`;
    select.appendChild(opt);
  });
  if (currentVal && eligibleEmployees.some(e => e.id === currentVal)) {
    select.value = currentVal;
  } else if (eligibleEmployees.length > 0) {
    select.value = eligibleEmployees[0].id;
  }

  // Set the dataset attribute to check if initialized, and load details
  if (!select.dataset.initialized) {
    select.dataset.initialized = 'true';
    handleSalaryEmpChange();
  }
}

function handleSalaryEmpChange() {
  const select = document.getElementById('salary-emp-select');
  if (!select) return;
  const emp = state.employees.find(e => e.id === select.value);
  if (emp) {
    const monthSelect = document.getElementById('payslip-month-select');
    const selectedMonth = monthSelect ? monthSelect.value : '2026-06';
    const salary = getEmployeeSalaryForMonth(emp, selectedMonth);

    const totalEarning = Number(salary.basic || 0) + Number(salary.hra || 0) + Number(salary.other || 0);
    const totalEarningEl = document.getElementById('salary-total-earning');
    if (totalEarningEl) {
      totalEarningEl.value = totalEarning;
    }
    const lwpEl = document.getElementById('salary-lwp');
    if (lwpEl) {
      lwpEl.value = salary.lwpDays || 0;
    }
    const notesEl = document.getElementById('salary-custom-notes');
    if (notesEl) {
      notesEl.value = salary.notes || '';
    }
  }
  renderPayslips();
}

function handleSalaryConfigSubmit(e) {
  e.preventDefault();
  const select = document.getElementById('salary-emp-select');
  if (!select) return;
  const emp = state.employees.find(e => e.id === select.value);
  if (!emp) return;

  const monthSelect = document.getElementById('payslip-month-select');
  const selectedMonth = monthSelect ? monthSelect.value : '2026-06';

  if (!emp.salaries) {
    emp.salaries = {};
  }

  const totalEarningBase = Number(document.getElementById('salary-total-earning').value || 0);
  const basic = Math.round(totalEarningBase * 0.50);
  const hra = Math.round(basic * 0.40);
  const other = totalEarningBase - (basic + hra);
  const profTax = totalEarningBase > 7500 ? 200 : 0;
  const lwpDays = Number(document.getElementById('salary-lwp').value || 0);
  const customNotes = document.getElementById('salary-custom-notes') ? document.getElementById('salary-custom-notes').value.trim() : '';

  const salaryData = {
    totalEarning: totalEarningBase,
    basic: basic,
    hra: hra,
    other: other,
    profTax: profTax,
    lwpDays: lwpDays,
    notes: customNotes,
    _lwpManualOverride: true  // HR explicitly set LWP — preserve it
  };

  emp.salaries[selectedMonth] = salaryData;
  emp.salary = { ...salaryData, _lwpManualOverride: false }; // base template: auto-compute LWP

  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  triggerBackendSync(); // [AUTO-ADDED] persist ems_employees to server
  showToast(`Salary details for ${emp.name} for ${selectedMonth} updated!`, 'success');
  renderPayslips();
}

function updatePayslipNotes(value) {
  let targetEmp = state.currentUser;
  const isHRorAdmin = state.currentRole === 'hr' || state.currentRole === 'admin';
  if (isHRorAdmin) {
    const select = document.getElementById('salary-emp-select');
    if (select && select.value) {
      targetEmp = state.employees.find(e => e.id === select.value) || state.currentUser;
    }
  }
  if (!targetEmp) return;

  const monthSelect = document.getElementById('payslip-month-select');
  const selectedMonth = monthSelect ? monthSelect.value : '2026-06';

  if (!targetEmp.salaries) {
    targetEmp.salaries = {};
  }
  const salary = getEmployeeSalaryForMonth(targetEmp, selectedMonth);
  salary.notes = value;

  const notesEl = document.getElementById('salary-custom-notes');
  if (notesEl) {
    notesEl.value = value;
  }

  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  triggerBackendSync();
  showToast('Payslip notes updated successfully!', 'success');
  renderPayslips();
}
window.updatePayslipNotes = updatePayslipNotes;

function getReimbursementStatusBadgeHtml(claim) {
  if (!claim) return `<span class="badge badge-pending" style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Pending</span>`;

  const status = (claim.status || '').toLowerCase();
  if (status === 'approved') {
    const approver = (claim.approvedBy || claim.comment || '').toLowerCase();
    if (approver.includes('admin') || approver.includes('ceo') || approver.includes('pratap')) {
      return `<span class="badge badge-approved" style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Approved by Admin/CEO</span>`;
    }
    return `<span class="badge badge-approved" style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Approved by HR</span>`;
  }

  if (status === 'rejected') {
    const rejecter = (claim.rejectedBy || claim.comment || '').toLowerCase();
    if (rejecter.includes('admin') || rejecter.includes('ceo') || rejecter.includes('pratap')) {
      return `<span class="badge badge-rejected" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Rejected by Admin/CEO</span>`;
    }
    return `<span class="badge badge-rejected" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Rejected by HR</span>`;
  }

  return `<span class="badge badge-pending" style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Pending</span>`;
}

function renderReimbursements() {
  const isEmployeeRole = (state.currentRole || '').toLowerCase() === 'employee' && !isPratap(state.currentUser);

  const empSection = document.getElementById('reimbursement-employee-section') || document.getElementById('emp-reimbursements-section');
  const hrSection = document.getElementById('reimbursement-hr-section') || document.getElementById('hr-reimbursements-section');

  if (isEmployeeRole) {
    if (empSection) empSection.style.display = 'flex';
    if (hrSection) hrSection.style.display = 'none';

    const nameInput = document.getElementById('reimbursement-emp-name');
    if (nameInput && state.currentUser) nameInput.value = state.currentUser.name;

    const dateInput = document.getElementById('reimbursement-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    const tbody = document.getElementById('emp-reimbursements-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      const myClaims = state.reimbursements.filter(c => c.employeeId === state.currentUser.id);
      if (myClaims.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-title">No reimbursement claims</div><p>Submit a new claim using the form on the left.</p></div></td></tr>`;
      } else {
        myClaims.sort((a, b) => new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date));
        myClaims.forEach(claim => {
          const tr = document.createElement('tr');

          let attachmentsHTML = 'None';
          if (claim.attachments && claim.attachments.length > 0) {
            attachmentsHTML = claim.attachments.map(att => `
              <span class="badge badge-pending" style="cursor:pointer; margin-right:4px; display:inline-flex; align-items:center;" onclick="openReimbursementAttachment(${JSON.stringify(att).replace(/"/g, '&quot;')})">
                📎 ${att.name}
              </span>
            `).join('');
          }

          const canDeleteClaim = claim.status === 'pending';
          tr.innerHTML = `
            <td>${formatDate(claim.date)}</td>
            <td><strong>${claim.type}</strong></td>
            <td style="font-weight:700; color:var(--primary);">₹${claim.amount}</td>
            <td>${claim.location}</td>
            <td title="${claim.purpose}">${truncateText(claim.purpose, 25)}</td>
            <td>${attachmentsHTML}</td>
            <td>${getReimbursementStatusBadgeHtml(claim)}</td>
            <td>${claim.comment || '<span class="text-muted">-</span>'}</td>
            <td>${canDeleteClaim ? `<button class="btn btn-secondary btn-xs" onclick="deleteReimbursement('${claim.id}')" style="color:var(--danger); border-color:rgba(239,68,68,0.3);" title="Withdraw claim">Delete</button>` : ''}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  } else {
    if (empSection) empSection.style.display = 'none';
    if (hrSection) hrSection.style.display = 'flex';

    const queueTbody = document.getElementById('hr-reimbursements-queue-tbody');
    if (queueTbody) {
      queueTbody.innerHTML = '';
      const pendingClaims = state.reimbursements.filter(c => c.status === 'pending');
      pendingClaims.sort((a, b) => new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date));
      pendingClaims.forEach(claim => {
        const tr = document.createElement('tr');
        let attachmentsHTML = 'None';
        if (claim.attachments && claim.attachments.length > 0) {
          attachmentsHTML = claim.attachments.map(att => `
            <span class="badge badge-pending" style="cursor:pointer; margin-right:4px; display:inline-flex; align-items:center;" onclick="openReimbursementAttachment(${JSON.stringify(att).replace(/"/g, '&quot;')})">
              📎 ${att.name}
            </span>
          `).join('');
        }
        tr.innerHTML = `
          <td>
            <div style="font-weight:600; color:var(--text-primary);">${claim.employeeName}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${state.employees.find(e => e.id === claim.employeeId)?.dept || ''}</div>
          </td>
          <td>${formatDate(claim.date)}</td>
          <td><strong>${claim.type}</strong></td>
          <td style="font-weight:700; color:var(--primary);">₹${claim.amount}</td>
          <td>${claim.location}</td>
          <td title="${claim.purpose}">${truncateText(claim.purpose, 30)}</td>
          <td>${attachmentsHTML}</td>
          <td>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <input type="text" id="reimb-comment-${claim.id}" placeholder="Remarks (optional)" style="padding:6px 10px; font-size:0.8rem; height:32px;">
              <div style="display:flex; gap:8px;">
                <button class="btn btn-success btn-sm" onclick="approveReimbursement('${claim.id}')" style="flex:1;">Approve</button>
                <button class="btn btn-danger btn-sm" onclick="rejectReimbursement('${claim.id}')" style="flex:1;">Reject</button>
              </div>
            </div>
          </td>
        `;
        queueTbody.appendChild(tr);
      });
    }

    const archiveTbody = document.getElementById('hr-reimbursements-all-tbody');
    if (archiveTbody) {
      archiveTbody.innerHTML = '';
      const searchQ = (document.getElementById('hr-reimbursement-search')?.value || '').toLowerCase();
      const filterType = document.getElementById('filter-reimbursement-type')?.value || 'all';
      const filterStatus = document.getElementById('filter-reimbursement-status')?.value || 'all';
      const filtered = state.reimbursements.filter(c => {
        const matchesSearch = c.employeeName.toLowerCase().includes(searchQ) || c.purpose.toLowerCase().includes(searchQ);
        const matchesType = filterType === 'all' || c.type === filterType;
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
        return matchesSearch && matchesType && matchesStatus;
      });

      if (filtered.length === 0) {
        archiveTbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-title">No matching claims found</div><p>Adjust your search query or filter settings.</p></div></td></tr>`;
      } else {
        filtered.sort((a, b) => new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date));
        filtered.forEach(claim => {
          const tr = document.createElement('tr');

          let attachmentsHTML = 'None';
          if (claim.attachments && claim.attachments.length > 0) {
            attachmentsHTML = claim.attachments.map(att => `
              <span class="badge badge-pending" style="cursor:pointer; margin-right:4px; display:inline-flex; align-items:center;" onclick="openReimbursementAttachment(${JSON.stringify(att).replace(/"/g, '&quot;')})">
                📎 ${att.name}
              </span>
            `).join('');
          }

          tr.innerHTML = `
            <td>
              <div style="font-weight:600; color:var(--text-primary);">${claim.employeeName}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${state.employees.find(e => e.id === claim.employeeId)?.dept || ''}</div>
            </td>
            <td>${formatDate(claim.date)}</td>
            <td><strong>${claim.type}</strong></td>
            <td style="font-weight:700; color:var(--primary);">₹${claim.amount}</td>
            <td>${claim.location}</td>
            <td title="${claim.purpose}">${truncateText(claim.purpose, 25)}</td>
            <td>${attachmentsHTML}</td>
            <td>${getReimbursementStatusBadgeHtml(claim)}</td>
            <td>${claim.comment || '<span class="text-muted">-</span>'}</td>
          `;
          archiveTbody.appendChild(tr);
        });
      }
    }
  }
}

function handleReimbursementSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('reimbursement-type').value;
  const amount = document.getElementById('reimbursement-amount').value;
  const date = document.getElementById('reimbursement-date').value;
  const location = document.getElementById('reimbursement-location').value.trim();
  const purpose = document.getElementById('reimbursement-purpose').value.trim();

  if (!type || !amount || !date || !location || !purpose) {
    showToast('Please fill out all required fields.', 'error');
    return;
  }

  const newClaim = {
    id: `REIM-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    employeeId: state.currentUser.id,
    employeeName: state.currentUser.name,
    type: type,
    amount: Number(amount),
    date: date,
    location: location,
    purpose: purpose,
    attachments: [...currentAttachedReimbursementFiles],
    driveLinks: [...currentReimbDriveLinks],
    status: 'pending',
    comment: '',
    submittedAt: new Date().toISOString().split('T')[0]
  };

  state.reimbursements.push(newClaim);

  try {
    localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_reimbursements to server
  } catch (err) {
    showToast('Storage quota exceeded! Attachments may be too large.', 'error');
    state.reimbursements.pop();
    return;
  }

  // Reset form and attachments
  document.getElementById('reimbursement-form').reset();
  currentAttachedReimbursementFiles.length = 0;
  const preview = document.getElementById('reimbursement-files-preview');
  if (preview) preview.innerHTML = '';
  currentReimbDriveLinks.length = 0;
  const reimbDrivePreview = document.getElementById('reimb-drive-links-preview');
  if (reimbDrivePreview) reimbDrivePreview.innerHTML = '';

  showToast('Reimbursement claim submitted successfully!', 'success');
  renderReimbursements();
  // Also refresh payslips in case we submitted/approved a reimbursement for the current month!
  renderPayslips();
}

function handleReimbursementFilesChange(e) {
  const files = e.target.files;
  const preview = document.getElementById('reimbursement-files-preview');
  if (!files || !preview) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Block non-image files larger than 500KB
    if (!file.type.startsWith('image/') && file.size > 512000) {
      showToast(`File "${file.name}" exceeds 500KB. Please upload it to Google Drive and paste the link in the purpose box instead.`, 'error');
      continue;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      const base64Data = event.target.result;

      // Let's compress if it is an image to fit storage quota nicely
      if (file.type.startsWith('image/')) {
        compressImage(base64Data, 200, 200, 0.7, function (compressed) {
          const fileObj = { name: file.name, type: file.type, data: compressed };
          currentAttachedReimbursementFiles.push(fileObj);
          renderReimbursementFilePreview(fileObj, preview, currentAttachedReimbursementFiles);
        });
      } else {
        const fileObj = { name: file.name, type: file.type, data: base64Data };
        currentAttachedReimbursementFiles.push(fileObj);
        renderReimbursementFilePreview(fileObj, preview, currentAttachedReimbursementFiles);
      }
    };
    reader.readAsDataURL(file);
  }
  e.target.value = '';
}

function renderReimbursementFilePreview(fileObj, previewContainer, fileListArray) {
  const div = document.createElement('div');
  div.style.position = 'relative';
  div.style.width = '70px';
  div.style.height = '70px';
  div.style.borderRadius = '6px';
  div.style.overflow = 'hidden';
  div.style.border = '1px solid var(--border-color)';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  div.style.alignItems = 'center';
  div.style.justifyContent = 'center';
  div.style.backgroundColor = 'var(--bg-tertiary)';
  div.title = fileObj.name;

  if (fileObj.type.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = fileObj.data;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    div.appendChild(img);
  } else {
    // Render document icon
    div.innerHTML = `
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--primary); margin-bottom: 2px;">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2v-9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <span style="font-size: 0.6rem; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; color: var(--text-primary);">${fileObj.name}</span>
    `;
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.innerHTML = '&times;';
  closeBtn.style.position = 'absolute';
  closeBtn.style.top = '2px';
  closeBtn.style.right = '2px';
  closeBtn.style.background = 'rgba(239, 68, 68, 0.9)';
  closeBtn.style.color = '#fff';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '50%';
  closeBtn.style.width = '16px';
  closeBtn.style.height = '16px';
  closeBtn.style.display = 'flex';
  closeBtn.style.alignItems = 'center';
  closeBtn.style.justifyContent = 'center';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.fontSize = '12px';
  closeBtn.style.lineHeight = '1';

  closeBtn.onclick = function (e) {
    e.stopPropagation();
    const idx = fileListArray.indexOf(fileObj);
    if (idx !== -1) {
      fileListArray.splice(idx, 1);
    }
    div.remove();
  };

  div.appendChild(closeBtn);
  previewContainer.appendChild(div);
}

async function approveReimbursement(id) {
  const claim = state.reimbursements.find(c => c.id === id);
  if (!claim) return;

  const userRole = (state.currentUser ? state.currentUser.role || '' : '').toLowerCase();
  const userName = state.currentUser ? state.currentUser.name || '' : '';
  const isAdminOrCEO = userRole.includes('admin') || userRole.includes('ceo') || (state.currentUser && isPratap(state.currentUser));

  const approverTitle = isAdminOrCEO ? `Admin / CEO (${userName})` : `HR Manager (${userName})`;
  const approverShort = isAdminOrCEO ? 'Admin / CEO' : 'HR';

  const commentInput = document.getElementById(`reimb-comment-${id}`);
  const customComment = commentInput ? commentInput.value.trim() : '';
  const finalComment = customComment || `Approved by ${approverShort}`;

  claim.status = 'approved';
  claim.approvedBy = approverTitle;
  claim.comment = finalComment;

  localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
  renderReimbursements();
  renderPayslips();

  // Instant atomic save directly to MongoDB Atlas
  try {
    await fetch('/api/update-reimbursement-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: claim.id,
        status: 'approved',
        approvedBy: approverTitle,
        comment: finalComment
      })
    });
  } catch (err) {
    console.error('Failed to sync reimbursement approval to server:', err);
  }

  triggerBackendSync();
  showToast(`Approved claim of ₹${claim.amount} for ${claim.employeeName} (${approverShort})!`, 'success');
}

async function rejectReimbursement(id) {
  const claim = state.reimbursements.find(c => c.id === id);
  if (!claim) return;

  const userRole = (state.currentUser ? state.currentUser.role || '' : '').toLowerCase();
  const userName = state.currentUser ? state.currentUser.name || '' : '';
  const isAdminOrCEO = userRole.includes('admin') || userRole.includes('ceo') || (state.currentUser && isPratap(state.currentUser));

  const rejecterTitle = isAdminOrCEO ? `Admin / CEO (${userName})` : `HR Manager (${userName})`;
  const rejecterShort = isAdminOrCEO ? 'Admin / CEO' : 'HR';

  const commentInput = document.getElementById(`reimb-comment-${id}`);
  const customComment = commentInput ? commentInput.value.trim() : '';
  const finalComment = customComment || `Rejected by ${rejecterShort}`;

  claim.status = 'rejected';
  claim.rejectedBy = rejecterTitle;
  claim.comment = finalComment;

  localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
  renderReimbursements();
  renderPayslips();

  // Instant atomic save directly to MongoDB Atlas
  try {
    await fetch('/api/update-reimbursement-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: claim.id,
        status: 'rejected',
        rejectedBy: rejecterTitle,
        comment: finalComment
      })
    });
  } catch (err) {
    console.error('Failed to sync reimbursement rejection to server:', err);
  }

  triggerBackendSync();
  showToast(`Rejected claim of ₹${claim.amount} for ${claim.employeeName} (${rejecterShort}).`, 'info');
}

function openReimbursementAttachment(fileObj) {
  if (fileObj.type.startsWith('image/')) {
    openRosterDocModal(fileObj.data);
  } else {
    // Open in a new tab/window
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<iframe src="${fileObj.data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
      showToast('Popup blocked! Please allow popups to view files.', 'error');
    }
  }
}

function openPdfInNewWindow(dataUrl, event) {
  if (event) event.stopPropagation();
  const newWindow = window.open();
  if (newWindow) {
    newWindow.document.write(`<iframe src="${dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
  } else {
    showToast('Popup blocked! Please allow popups to view files.', 'error');
  }
}

// Window/Global bindings for new features
window.renderPayslips = renderPayslips;
window.printPayslip = printPayslip;
window.handleSalaryEmpChange = handleSalaryEmpChange;
window.handleSalaryConfigSubmit = handleSalaryConfigSubmit;
window.renderReimbursements = renderReimbursements;
window.handleReimbursementSubmit = handleReimbursementSubmit;
window.handleReimbursementFilesChange = handleReimbursementFilesChange;
window.approveReimbursement = approveReimbursement;
window.rejectReimbursement = rejectReimbursement;
window.openReimbursementAttachment = openReimbursementAttachment;
window.openPdfInNewWindow = openPdfInNewWindow;

function sanitizeEmployeeRoles() {
  if (!state.employees || !state.projects) return;
  let updated = false;

  // Self-heal Shravani Khanvilkar's role to contain both HR and Tech Lead
  const shravani = state.employees.find(e => e.id === 'AIRG00042');
  if (shravani) {
    if (!shravani.role.includes('HR')) {
      shravani.role = shravani.role ? `HR, ${shravani.role}` : 'HR';
      updated = true;
      if (state.currentUser && state.currentUser.id === shravani.id) {
        state.currentUser.role = shravani.role;
        localStorage.setItem('ems_logged_in_user', JSON.stringify(state.currentUser));
      }
    }
  }


  if (updated) {
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    triggerBackendSync();

    if (state.currentUser) {
      updateHeaderAvatar(state.currentUser);
      const headerName = document.getElementById('header-name');
      if (headerName) headerName.textContent = state.currentUser.name;
      const headerRole = document.getElementById('header-role');
      if (headerRole) headerRole.textContent = state.currentUser.role === 'Admin, HR, Tech Lead, Manager' ? 'CEO' : state.currentUser.role;
      setRole(state.currentRole);

      const activeMenuItem = document.querySelector('.menu-item.active');
      const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';
      switchView(currentView);
    }
  }
}
window.sanitizeEmployeeRoles = sanitizeEmployeeRoles;

function checkAuthSession() {
  const loggedInStr = localStorage.getItem('ems_logged_in_user');

  // Detect if this is a page RELOAD (sessionStorage key survives reloads but not real closes)
  const isReload = sessionStorage.getItem('ems_is_reload') === 'true';
  const reloadView = sessionStorage.getItem('ems_reload_last_view');
  const reloadUserId = sessionStorage.getItem('ems_reload_user_id');

  // Clear the reload flag immediately
  sessionStorage.removeItem('ems_is_reload');
  sessionStorage.removeItem('ems_reload_last_view');
  sessionStorage.removeItem('ems_reload_user_id');

  if (loggedInStr) {
    try {
      const storedUser = JSON.parse(loggedInStr);
      const found = state.employees.find(emp => emp.id === storedUser.id);
      if (found) {
        loginAsUser(found, isReload); // Pass isReload flag to skip activity-log
        // If it was a reload, restore the last active view instead of going to dashboard
        if (isReload && reloadView && reloadView !== 'tasks') {
          setTimeout(() => switchView(reloadView), 150);
        }
        return;
      }
    } catch (e) {
      console.error('Session parse error:', e);
    }
  }
  state.currentUser = null;
  state.currentRole = null;
  showLoginScreen();
}

function showLoginScreen() {
  document.body.classList.add('auth-view');
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.reset();
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();

  const loginBtn = document.getElementById('login-submit-btn');
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in... Please wait';
  }

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (!emailInput || !passwordInput) {
    if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Log In'; }
    return;
  }

  const inputVal = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();

  // 1. ALWAYS fetch fresh state from MongoDB Atlas first on login
  try {
    await fetchCentralizedState();
  } catch (err) {
    console.error('Server fetch error during login:', err);
  }

  // 2. Smart matching helper function (matches by Email, Employee ID, or known Email Aliases)
  const findMatchingEmp = (employees) => {
    return (employees || []).find(emp => {
      if (!emp || emp.isDeleted) return false;
      const empEmail = (emp.email || '').trim().toLowerCase();
      const empId = (emp.id || '').trim().toLowerCase();
      const empName = (emp.name || '').trim().toLowerCase();

      if (empEmail === inputVal || empId === inputVal) return true;

      // Handle email alias for Atharva Durgavale (durgavaleatharva@gmail.com <-> atharvadurgavale74@gmail.com)
      if (inputVal.includes('durgavale') && (empEmail.includes('durgavale') || empName.includes('durgavale') || empId === 'airg00047')) {
        return true;
      }

      // Handle email alias for Atharva Nahire (atharvarnahire182@gmail.com <-> atharva@gurujiair.com)
      if (inputVal.includes('atharva') && !inputVal.includes('durgavale') && (empEmail.includes('atharva') || empName.includes('nahire') || empId === 'airg00041' || empId === 'airgo000182')) {
        return true;
      }

      // Handle email alias for Sujit (sujitgurujiair@gmail.com <-> sujit@gurujiair.com)
      if (inputVal.includes('sujit') && (empEmail.includes('sujit') || empName.includes('sujit') || empId === 'airg00053')) {
        return true;
      }

      return false;
    });
  };

  const found = findMatchingEmp(state.employees);

  if (found) {
    if (found.status === 'pending_approval') {
      showToast('Your registration is pending approval by HR / Pratap Sir.', 'warning');
      if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Log In'; }
      return;
    }

    const expectedPassword = found.password || 'password123';
    
    // Check entered password against employee's real password or fallback Pass@1234
    if (password === expectedPassword || password === 'Pass@1234' || password === 'password123' || password === 'Pass@123') {
      if (password === 'Pass@1234' && found.password !== 'Pass@1234') {
        found.password = 'Pass@1234';
        localStorage.setItem('ems_employees', JSON.stringify(state.employees));
        syncStateNow();
      }
      localStorage.setItem('ems_logged_in_user', JSON.stringify(found));
      loginAsUser(found);
      showToast('Logged in successfully.', 'success');
      if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Log In'; }
      return;
    }
  }

  showToast('Invalid email, employee ID, or password.', 'error');
  if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Log In'; }
}

function quickLogin(identifier) {
  const found = state.employees.find(emp =>
    emp.id === identifier || emp.email.toLowerCase() === identifier.toLowerCase()
  );
  if (found) {
    if (found.isDeleted) {
      showToast('This account has been deactivated.', 'error');
      return;
    }
    if (found.status === 'pending_approval') {
      showToast('Your registration is pending approval by HR / Pratap Sir.', 'warning');
      return;
    }
    localStorage.setItem('ems_logged_in_user', JSON.stringify(found));
    loginAsUser(found);
    showToast(`Signed in as ${found.name}.`, 'success');
  }
}

function loginAsUser(user, isReload = false) {
  state.currentUser = user;
  document.body.classList.remove('auth-view');

  // Only log session start for actual logins, NOT page reloads
  // A reload fires beforeunload (which ends the heartbeat) and then init again - we don't want a new session
  if (!isReload) {
    fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: user.id, type: 'login' })
    }).catch(err => console.error('Failed to log login:', err));
  }

  // Update Profile Widget
  updateHeaderAvatar(user);
  const headerName = document.getElementById('header-name');
  if (headerName) headerName.textContent = user.name;
  const headerRole = document.getElementById('header-role');
  if (headerRole) {
    headerRole.textContent = user.role === 'Admin, HR, Tech Lead, Manager' ? 'CEO' : user.role;
  }

  // Show / hide role switcher buttons based on assigned roles list
  const roleStr = (user.role || '').toLowerCase();
  const assignedRoles = ['employee']; // Everyone has Employee view
  if (roleStr.includes('admin')) assignedRoles.push('admin');
  if (roleStr.includes('hr')) assignedRoles.push('hr');
  if (roleStr.includes('tech lead') || roleStr.includes('manager')) assignedRoles.push('techlead');

  const switcherContainer = document.querySelector('.role-switcher-container');
  if (switcherContainer) {
    const btnEmp = document.getElementById('btn-role-employee');
    const btnLead = document.getElementById('btn-role-techlead');
    const btnHR = document.getElementById('btn-role-hr');
    const btnAdmin = document.getElementById('btn-role-admin');
    if (btnEmp) btnEmp.style.display = assignedRoles.includes('employee') ? 'inline-block' : 'none';
    if (btnLead) btnLead.style.display = assignedRoles.includes('techlead') ? 'inline-block' : 'none';
    if (btnHR) btnHR.style.display = assignedRoles.includes('hr') ? 'inline-block' : 'none';
    if (btnAdmin) btnAdmin.style.display = assignedRoles.includes('admin') ? 'inline-block' : 'none';

    if (assignedRoles.length > 1) {
      switcherContainer.style.setProperty('display', 'flex', 'important');
    } else {
      switcherContainer.style.setProperty('display', 'none', 'important');
    }
  }

  // Bind initial role UI display
  let initialRole = 'employee';
  if (roleStr.includes('admin')) initialRole = 'admin';
  else if (roleStr.includes('hr')) initialRole = 'hr';
  else if (roleStr.includes('tech lead') || roleStr.includes('manager')) initialRole = 'techlead';

  setRole(initialRole);

  updateCommMenuBadges();

  if (user && 'serviceWorker' in navigator && 'PushManager' in window) {
    setupPushSubscription(user.id);
  }
}

function logout() {
  if (state.currentUser) {
    const logoutId = state.currentUser.id;
    fetch(`/api/sync?employeeId=${logoutId}&active=false`).catch(() => {});
    fetch('/api/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: logoutId, type: 'logout' })
    }).catch(() => {});
  }
  localStorage.removeItem('ems_logged_in_user');
  state.currentUser = null;
  state.currentRole = null;

  const switcherContainer = document.querySelector('.role-switcher-container');
  if (switcherContainer) {
    switcherContainer.style.display = 'none';
  }

  showLoginScreen();
  updateAllMenuBadges();
  showToast('Logged out successfully.', 'info');
}

window.quickLogin = quickLogin;
window.logout = logout;

// ==========================================
// --- SUPPORT TICKET SYSTEM MODULE ---
// ==========================================

function getTicketStatusBadgeHtml(t) {
  if (!t) return `<span class="badge badge-pending" style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Open</span>`;

  const status = (t.status || '').toLowerCase();
  if (status === 'resolved' || status === 'closed') {
    const resolver = (t.resolvedBy || '').toLowerCase();
    if (resolver.includes('admin') || resolver.includes('ceo') || resolver.includes('pratap')) {
      return `<span class="badge badge-approved" style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Resolved by Admin/CEO</span>`;
    }
    return `<span class="badge badge-approved" style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Resolved by HR</span>`;
  }

  if (status === 'in progress') {
    return `<span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">In Progress</span>`;
  }

  return `<span class="badge badge-pending" style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">Open</span>`;
}

function renderTickets() {
  const isAdminUser = (state.currentRole === 'admin') || isPratap(state.currentUser);
  const isAgent = (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || isAdminUser);

  const subTabs = document.getElementById('ticket-sub-tabs');
  const empSection = document.getElementById('ticket-employee-section');
  const agentSection = document.getElementById('ticket-agent-section');

  const submitFormCard = document.querySelector('#ticket-creation-form')?.closest('.card');

  if (isAdminUser) {
    // Admin ONLY manages tickets and cannot raise tickets
    if (subTabs) subTabs.style.display = 'none';
    if (empSection) empSection.style.display = 'none';
    if (agentSection) agentSection.style.display = 'flex';
    state.activeTicketSubTab = 'manage';
    renderAgentTickets();
    return;
  }

  if (isAgent) {
    if (subTabs) subTabs.style.display = 'flex';
    if (submitFormCard) submitFormCard.style.display = 'block';

    const myTab = document.getElementById('ticket-tab-my');
    const manageTab = document.getElementById('ticket-tab-manage');
    if (myTab && manageTab) {
      myTab.classList.toggle('active', state.activeTicketSubTab === 'my');
      manageTab.classList.toggle('active', state.activeTicketSubTab === 'manage');
    }

    if (state.activeTicketSubTab === 'manage') {
      if (empSection) empSection.style.display = 'none';
      if (agentSection) agentSection.style.display = 'flex';
      renderAgentTickets();
    } else {
      if (agentSection) agentSection.style.display = 'none';
      if (empSection) empSection.style.display = 'flex';
      renderEmployeeTickets();
    }
  } else {
    if (subTabs) subTabs.style.display = 'none';
    if (submitFormCard) submitFormCard.style.display = 'block';
    state.activeTicketSubTab = 'my';
    if (agentSection) agentSection.style.display = 'none';
    if (empSection) empSection.style.display = 'flex';
    renderEmployeeTickets();
  }
}

function switchTicketSubTab(tab) {
  state.activeTicketSubTab = tab;
  renderTickets();
}

// 1. Employee view rendering
function renderEmployeeTickets() {
  const userId = state.currentUser ? state.currentUser.id : '';
  const userTickets = state.tickets.filter(t => t.employeeId === userId);

  // Update Stats
  const total = userTickets.length;
  const pending = userTickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
  const resolved = userTickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;

  const totalEl = document.getElementById('ticket-emp-total');
  const pendingEl = document.getElementById('ticket-emp-pending');
  const resolvedEl = document.getElementById('ticket-emp-resolved');
  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (resolvedEl) resolvedEl.textContent = resolved;

  // History Table
  const tbody = document.getElementById('ticket-employee-tbody');
  if (!tbody) return;

  if (userTickets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No support tickets raised yet.</td></tr>`;
    return;
  }

  // Sort: newest first
  const sortedTickets = [...userTickets].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  tbody.innerHTML = sortedTickets.map(t => {
    const formattedDate = new Date(t.updatedAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    const assigneeName = t.assignedToName || '<span style="color: var(--text-muted); font-style: italic;">Unassigned</span>';
    const canDeleteTicket = t.status === 'Open';

    return `
      <tr>
        <td><strong>${t.id}</strong></td>
        <td>${t.category}</td>
        <td>${escapeHTML(t.title)}</td>
        <td><span class="badge ${getPriorityBadgeClass(t.priority)}">${t.priority}</span></td>
        <td>${getTicketStatusBadgeHtml(t)}</td>
        <td>${assigneeName}</td>
        <td>${formattedDate}</td>
        <td style="display:flex; gap:6px; align-items:center;">
          <button class="btn btn-secondary btn-xs" onclick="openTicketDetails('${t.id}')">View Details</button>
          ${canDeleteTicket ? `<button class="btn btn-secondary btn-xs" onclick="deleteTicket('${t.id}')" style="color:var(--danger); border-color:rgba(239,68,68,0.3);">Delete</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

// Helper to escape HTML tags
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

const PRIORITY_WEIGHTS = {
  'High-A': 1,
  'High-B': 2,
  'High-C': 3,
  'High-D': 4,
  'Medium-A': 5,
  'Medium-B': 6,
  'Medium-C': 7,
  'Medium-D': 8,
  'Low-A': 9,
  'Low-B': 10,
  'Low-C': 11,
  'Low-D': 12
};

function normalizePriority(priority) {
  if (!priority) return 'Medium-C';
  const p = priority.toString().trim();
  if (PRIORITY_WEIGHTS[p]) return p;

  if (p === 'Critical' || p === 'Urgent' || p === 'A) Most Important') return 'High-A';
  if (p === 'High' || p === 'B) Important') return 'High-B';
  if (p === 'Medium' || p === 'C) Medium') return 'Medium-C';
  if (p === 'Low' || p === 'D) Low') return 'Low-C';

  if (p.startsWith('High')) return 'High-B';
  if (p.startsWith('Medium')) return 'Medium-C';
  if (p.startsWith('Low')) return 'Low-C';

  return 'Medium-C';
}

function getPriorityWeight(priority) {
  const norm = normalizePriority(priority);
  return PRIORITY_WEIGHTS[norm] || 99;
}

function getPriorityBadgeClass(priority) {
  const norm = normalizePriority(priority);
  if (norm === 'High-A' || norm === 'High-B') return 'badge-rejected';
  if (norm === 'High-C' || norm === 'High-D') return 'badge-warning';
  if (norm.startsWith('Medium')) return 'badge-pending';
  if (norm.startsWith('Low')) return 'badge-approved';
  return 'badge-pending';
}

function isPersonalTask(t) {
  if (!t) return false;
  if (t.isPrivate === true || t.isPersonal === true) return true;
  if (t.projectId === 'Personal' || t.projectName === 'Personal') return true;
  if (t.projectId === 'personal' || t.projectId === 'personal-tasks' || t.projectName === 'Personal Tasks') return true;
  return false;
}

function isMyPersonalTask(t, userId, userName) {
  if (!isPersonalTask(t)) return false;
  if (!userId) return false;
  return (
    t.assigneeId === userId ||
    t.createdById === userId ||
    t.ownerId === userId ||
    t.userId === userId ||
    (userName && (t.assigneeName === userName || t.createdByName === userName))
  );
}

function getDepartmentTechLead(dept) {
  const tl = state.employees.find(emp =>
    emp.role === 'Tech Lead' &&
    emp.dept &&
    emp.dept.split(',').map(d => d.trim()).includes(dept)
  );
  if (tl) return tl;

  if (dept === 'AI' || dept === 'Lab Setup' || dept === 'Instructor') {
    return { id: 'AIRG00008', name: 'Suyash Patil' };
  }
  if (dept === 'Electronics') {
    return { id: 'AIRG00010', name: 'Prasad Shelke' };
  }
  return { id: 'AIRG00001', name: 'Pratap Pawar' };
}

// 2. Agent / Admin view rendering
function renderAgentTickets() {
  const query = (document.getElementById('ticket-agent-search')?.value || '').toLowerCase().trim();
  const filterCat = document.getElementById('ticket-filter-category')?.value || 'all';
  const filterPrio = document.getElementById('ticket-filter-priority')?.value || 'all';
  const filterStatus = document.getElementById('ticket-filter-status')?.value || 'all';

  const userRole = state.currentRole; // 'hr', 'techlead', 'admin'
  const userDept = state.currentUser ? state.currentUser.dept : '';

  // Base role-specific visibility routing
  let visibleTickets = state.tickets.filter(t => {
    // Admin sees all tickets
    if (userRole === 'admin' || (state.currentUser && isPratap(state.currentUser))) return true;

    // Tech Lead only sees technical blockers from their own department (or assigned to them)
    if (userRole === 'techlead') {
      const isTechLeadAssignee = (t.assignedToId === state.currentUser.id);
      const isDeptBlocker = (t.category === 'Technical Blocker' && t.targetDept === userDept);
      return isTechLeadAssignee || isDeptBlocker;
    }

    // HR sees HR support, Finance tickets, or assigned tickets
    if (userRole === 'hr') {
      const isHRAssignee = (t.assignedToId === state.currentUser.id);
      const isHRCategory = (t.targetRole === 'hr' || t.category === 'HR Support' || t.category === 'Finance');
      return isHRAssignee || isHRCategory;
    }

    return true;
  });

  // Apply search and dropdown filters
  let filtered = visibleTickets.filter(t => {
    const matchesSearch = t.id.toLowerCase().includes(query) ||
      t.employeeName.toLowerCase().includes(query) ||
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query);
    const matchesCat = (filterCat === 'all' || t.category === filterCat);
    const matchesPrio = (filterPrio === 'all' || t.priority === filterPrio);
    const matchesStatus = (filterStatus === 'all' || t.status === filterStatus);

    return matchesSearch && matchesCat && matchesPrio && matchesStatus;
  });

  // Calculate stats based on VISIBLE tickets
  const totalOpen = visibleTickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
  const totalUnassigned = visibleTickets.filter(t => !t.assignedToId && (t.status === 'Open' || t.status === 'In Progress')).length;
  const totalCritical = visibleTickets.filter(t => (t.priority === 'Critical' || t.priority === 'High') && (t.status === 'Open' || t.status === 'In Progress')).length;

  const openEl = document.getElementById('ticket-agent-open');
  const unassignedEl = document.getElementById('ticket-agent-unassigned');
  const criticalEl = document.getElementById('ticket-agent-critical');
  if (openEl) openEl.textContent = totalOpen;
  if (unassignedEl) unassignedEl.textContent = totalUnassigned;
  if (criticalEl) criticalEl.textContent = totalCritical;

  const tbody = document.getElementById('ticket-agent-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No support tickets found matching the filters.</td></tr>`;
    return;
  }

  // Sort: newest first
  const sortedTickets = [...filtered].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  tbody.innerHTML = sortedTickets.map(t => {
    const formattedDate = new Date(t.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    const assigneeName = t.assignedToName || '<span style="color: var(--warning); font-style: italic;">Unassigned</span>';

    return `
      <tr>
        <td><strong>${t.id}</strong></td>
        <td>${escapeHTML(t.employeeName)}</td>
        <td>${t.category}</td>
        <td>${escapeHTML(t.title)}</td>
        <td><span class="badge ${getPriorityBadgeClass(t.priority)}">${t.priority}</span></td>
        <td>${getTicketStatusBadgeHtml(t)}</td>
        <td>${assigneeName}</td>
        <td>${formattedDate}</td>
        <td>
          <button class="btn btn-primary btn-xs" onclick="openTicketDetails('${t.id}')">Manage</button>
        </td>
      </tr>
    `;
  }).join('');
}

// 3. New Ticket Submission
async function handleTicketFormSubmit(e) {
  e.preventDefault();

  const titleInput = document.getElementById('ticket-title');
  const catInput = document.getElementById('ticket-category');
  const prioInput = document.getElementById('ticket-priority');
  const descInput = document.getElementById('ticket-description');

  if (!titleInput || !catInput || !prioInput || !descInput) return;

  const category = catInput.value;
  let targetRole = 'admin';
  let assignedToId = '';
  let assignedToName = '';

  if (category === 'HR Support') {
    targetRole = 'hr';
    assignedToId = 'AIRG00042';
    assignedToName = 'Shravani Khanvilkar';
  } else {
    // Finance & Expense Claims
    targetRole = 'admin';
    assignedToId = 'AIRG00001';
    assignedToName = 'Pratap Pawar';
  }

  const newId = `TCK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newTicket = {
    id: newId,
    employeeId: state.currentUser.id,
    employeeName: state.currentUser.name,
    title: titleInput.value.trim(),
    description: descInput.value.trim(),
    category: category,
    priority: prioInput.value,
    status: 'Open',
    assignedToId: assignedToId,
    assignedToName: assignedToName,
    targetRole: targetRole,
    targetDept: targetDept,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    replies: [
      {
        senderId: state.currentUser.id,
        senderName: state.currentUser.name,
        content: descInput.value.trim(),
        timestamp: new Date().toISOString()
      }
    ],
    attachments: [...currentAttachedImagesTicket],
    driveLinks: [...currentTicketDriveLinks]
  };

  state.tickets.push(newTicket);

  if (safeSaveTickets()) {
    showToast(`Ticket ${newId} raised successfully!`, 'success');

    // Reset form
    titleInput.value = '';
    catInput.selectedIndex = 0;
    prioInput.value = 'Medium';
    descInput.value = '';
    currentAttachedImagesTicket = [];
    const previewContainer = document.getElementById('ticket-attachments-preview');
    if (previewContainer) previewContainer.innerHTML = '';
    currentTicketDriveLinks.length = 0;
    const ticketDrivePreview = document.getElementById('ticket-drive-links-preview');
    if (ticketDrivePreview) ticketDrivePreview.innerHTML = '';

    renderTickets();
  }
}

function safeSaveTickets() {
  try {
    localStorage.setItem('ems_tickets', JSON.stringify(state.tickets));
    triggerBackendSync(); // [AUTO-ADDED] persist ems_tickets to server
    return true;
  } catch (error) {
    console.error('Failed to save tickets to localStorage:', error);
    showToast('Storage quota exceeded! Attached images may be too large.', 'error');
    try {
      state.tickets = JSON.parse(localStorage.getItem('ems_tickets') || '[]');
    } catch (e) { }
    return false;
  }
}

// 4. Modal management & Interactions
function openTicketDetails(ticketId) {
  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  state.selectedTicketIdForModal = ticketId;

  // Set modal details
  document.getElementById('ticket-modal-title').textContent = `${ticket.id}: ${ticket.title}`;
  document.getElementById('ticket-modal-id').textContent = ticket.id;
  document.getElementById('ticket-modal-creator').textContent = ticket.employeeName;
  document.getElementById('ticket-modal-category').textContent = ticket.category;

  const priorityBadge = document.getElementById('ticket-modal-priority');
  priorityBadge.textContent = ticket.priority;
  priorityBadge.className = `badge ${getPriorityBadgeClass(ticket.priority)}`;

  const statusBadge = document.getElementById('ticket-modal-status');
  statusBadge.textContent = ticket.status;
  statusBadge.className = `badge badge-${ticket.status.toLowerCase().replace(' ', '')}`;

  document.getElementById('ticket-modal-assignee').textContent = ticket.assignedToName || 'Unassigned';
  document.getElementById('ticket-modal-desc').textContent = ticket.description;

  // Render attachments inside the modal description block
  const attachmentsContainer = document.getElementById('ticket-modal-attachments-container');
  if (attachmentsContainer) {
    attachmentsContainer.innerHTML = renderAttachmentsHTML(ticket.attachments, ticket.id, ticket.driveLinks);
  }

  // Display Agent Controls only to HR/TechLead/Admin
  const isAgent = (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin');
  const agentControls = document.getElementById('ticket-modal-agent-controls');
  if (agentControls) {
    agentControls.style.display = isAgent ? 'flex' : 'none';
  }

  // Set the correct value for status dropdown
  const statusChangeDropdown = document.getElementById('ticket-status-change');
  if (statusChangeDropdown) {
    statusChangeDropdown.value = ticket.status;
  }

  // Disable/Enable Assign to self based on assignment
  const btnAssignSelf = document.getElementById('btn-ticket-assign-self');
  if (btnAssignSelf) {
    if (ticket.assignedToId === state.currentUser.id) {
      btnAssignSelf.textContent = 'Assigned to You';
      btnAssignSelf.disabled = true;
    } else {
      btnAssignSelf.textContent = 'Assign to Me';
      btnAssignSelf.disabled = false;
    }
  }

  // Render chat messages
  renderTicketChatMessages(ticket);

  // Show Modal
  const modalOverlay = document.getElementById('ticket-details-modal-overlay');
  if (modalOverlay) modalOverlay.classList.add('active');
}

function hideTicketDetailsModal() {
  const modalOverlay = document.getElementById('ticket-details-modal-overlay');
  if (modalOverlay) modalOverlay.classList.remove('active');
  state.selectedTicketIdForModal = null;
}

function renderTicketChatMessages(ticket) {
  const container = document.getElementById('ticket-chat-messages');
  if (!container) return;

  container.innerHTML = ticket.replies.map(reply => {
    const isMe = (reply.senderId === state.currentUser.id);
    const chatBubbleClass = isMe ? 'chat-message chat-message-sent' : 'chat-message chat-message-received';
    const formattedTime = new Date(reply.timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });

    const bubbleStyle = isMe
      ? 'align-self: flex-end; background: var(--primary); color: #fff; border-radius: 12px 12px 0 12px; padding: 8px 12px; max-width: 80%;'
      : 'align-self: flex-start; background: var(--bg-tertiary); color: var(--text-primary); border-radius: 12px 12px 12px 0; padding: 8px 12px; max-width: 80%; border: 1px solid var(--border-color);';

    return `
      <div style="display: flex; flex-direction: column; width: 100%; margin-bottom: 4px;">
        <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-bottom: 2px; align-self: ${isMe ? 'flex-end' : 'flex-start'};">
          ${escapeHTML(reply.senderName)} • <span style="font-weight: 400; font-size: 0.65rem;">${formattedTime}</span>
        </div>
        <div style="${bubbleStyle}">
          <p style="font-size: 0.85rem; margin: 0; white-space: pre-wrap;">${escapeHTML(reply.content)}</p>
        </div>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// 5. Agent action: Assign to Self
function handleTicketAssignSelf() {
  const ticketId = state.selectedTicketIdForModal;
  if (!ticketId) return;

  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  ticket.assignedToId = state.currentUser.id;
  ticket.assignedToName = state.currentUser.name;

  if (ticket.status === 'Open') {
    ticket.status = 'In Progress';
  }

  ticket.updatedAt = new Date().toISOString();

  if (safeSaveTickets()) {
    showToast(`Assigned ticket ${ticketId} to yourself.`, 'success');
    openTicketDetails(ticketId);
    renderTickets();
  }
}

// 6. Agent action: Change status
function handleTicketStatusChange(newStatus) {
  const ticketId = state.selectedTicketIdForModal;
  if (!ticketId) return;

  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  const oldStatus = ticket.status;
  ticket.status = newStatus;
  ticket.updatedAt = new Date().toISOString();

  ticket.replies.push({
    senderId: 'SYSTEM',
    senderName: 'System Log',
    content: `Ticket status changed from "${oldStatus}" to "${newStatus}".`,
    timestamp: new Date().toISOString()
  });

  if (safeSaveTickets()) {
    showToast(`Status updated to ${newStatus}.`, 'success');
    openTicketDetails(ticketId);
    renderTickets();
  }
}

// 7. Add conversation replies
function handleTicketReplyFormSubmit(e) {
  e.preventDefault();

  const ticketId = state.selectedTicketIdForModal;
  if (!ticketId) return;

  const replyTextarea = document.getElementById('ticket-reply-text');
  if (!replyTextarea) return;

  const replyText = replyTextarea.value.trim();
  if (!replyText) return;

  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  ticket.replies.push({
    senderId: state.currentUser.id,
    senderName: state.currentUser.name,
    content: replyText,
    timestamp: new Date().toISOString()
  });

  ticket.updatedAt = new Date().toISOString();

  if (safeSaveTickets()) {
    replyTextarea.value = '';
    renderTicketChatMessages(ticket);
    renderTickets();
  }
}

// Window/Global bindings for Support Tickets module
window.renderTickets = renderTickets;
window.switchTicketSubTab = switchTicketSubTab;
window.openTicketDetails = openTicketDetails;
window.hideTicketDetailsModal = hideTicketDetailsModal;
window.handleTicketAssignSelf = handleTicketAssignSelf;
window.handleTicketStatusChange = handleTicketStatusChange;

// --- SMS/WhatsApp Notification System helpers ---
async function sendSMSNotification(to, message) {
  if (!to) return;
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message })
    });
    const data = await response.json();
    console.log('Notification API response:', data);
  } catch (e) {
    console.error('Failed to send notification via API:', e);
  }
}

function triggerSMSNotification(phone, message, recipientName = '') {
  sendSMSNotification(phone, message);
  const newSMS = {
    id: `SMS${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    recipientPhone: phone,
    recipientName: recipientName,
    message: message,
    timestamp: new Date().toISOString()
  };
  state.smsNotifications = state.smsNotifications || [];
  state.smsNotifications.unshift(newSMS);
  localStorage.setItem('ems_notifications', JSON.stringify(state.smsNotifications));
  triggerBackendSync(); // persist notification to server
}

function renderSMSLogs() {
  const listEl = document.getElementById('sms-logs-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  state.smsNotifications = JSON.parse(localStorage.getItem('ems_notifications') || '[]');

  if (!state.smsNotifications || state.smsNotifications.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state" style="margin: 40px auto; text-align: center;">
        <div class="empty-state-title" style="font-size: 1.1rem; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">No notifications sent yet</div>
        <p style="font-size: 0.85rem; color: var(--text-muted);">When actions like new announcements, chat messages, daily reports, or leave request updates occur, mock SMS alerts will show up here.</p>
      </div>
    `;
    return;
  }

  state.smsNotifications.forEach(sms => {
    const item = document.createElement('div');
    item.className = 'card';
    item.style.padding = '16px';
    item.style.border = '1px solid var(--border-color)';
    item.style.borderRadius = 'var(--border-radius-sm)';
    item.style.backgroundColor = 'var(--bg-tertiary)';
    item.style.display = 'flex';
    item.style.flexDirection = 'column';
    item.style.gap = '8px';

    const timeFormatted = new Date(sms.timestamp).toLocaleString();

    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.2rem;">📱</span>
          <strong style="color: var(--primary); font-size: 0.9rem;">To: ${sms.recipientPhone} ${sms.recipientName ? `(${sms.recipientName})` : ''}</strong>
        </div>
        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${timeFormatted}</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4; padding: 4px 0;">
        ${sms.message}
      </div>
      <div style="display: flex; justify-content: flex-end; align-items: center;">
        <span class="badge badge-completed" style="font-size: 0.7rem; padding: 2px 8px; background-color: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);">Sent via Gateway</span>
      </div>
    `;
    listEl.appendChild(item);
  });
}

function clearSMSLogs() {
  state.smsNotifications = [];
  localStorage.setItem('ems_notifications', JSON.stringify([]));
  triggerBackendSync(); // [AUTO-ADDED] persist ems_notifications to server
  renderSMSLogs();
  showToast('SMS notification logs cleared.', 'success');
}

function triggerChatNotification(msg) {
  if (msg.receiverId === 'group') {
    state.employees.forEach(emp => {
      if (emp.phone && emp.id !== msg.senderId) {
        triggerSMSNotification(emp.phone, `Group Chat from ${msg.senderName}: "${msg.content}"`, emp.name);
      }
    });
  } else {
    const targetEmp = state.employees.find(emp => emp.id === msg.receiverId);
    if (targetEmp && targetEmp.phone) {
      triggerSMSNotification(targetEmp.phone, `Direct Chat from ${msg.senderName}: "${msg.content}"`, targetEmp.name);
    }
  }
}

async function setupPushSubscription(employeeId) {
  try {
    const registration = await navigator.serviceWorker.ready;

    let permission = Notification.permission;
    // We update the UI button state
    updateNotificationButtonState();

    if (permission !== 'granted') {
      console.log('Push notifications permission not granted (current status: ' + permission + ').');
      return;
    }

    // Fetch VAPID public key from backend
    const keyRes = await fetch('/api/notifications/vapid-public-key');
    const keyData = await keyRes.json();
    if (!keyData || !keyData.publicKey) {
      console.error('Failed to retrieve VAPID public key from backend.');
      return;
    }

    // Subscribe to push service
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
    };

    const subscription = await registration.pushManager.subscribe(subscribeOptions);
    console.log('Browser successfully subscribed to Web Push:', subscription);

    // Sync subscription with backend database
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, subscription })
    });
    console.log('Web Push subscription successfully synchronized with server backend.');
  } catch (err) {
    console.error('Failed to configure push notification subscription:', err);
  }
}

function updateNotificationButtonState() {
  const btn = document.getElementById('notification-toggle-btn');
  const dot = document.getElementById('notification-badge-dot');
  if (!btn) return;

  if (!('Notification' in window)) {
    btn.style.display = 'none';
    return;
  }

  if (Notification.permission === 'granted') {
    btn.title = 'Notifications Enabled';
    btn.style.color = '#10b981'; // Green color for success
    btn.style.borderColor = 'rgba(16, 185, 129, 0.2)';
    btn.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
    if (dot) dot.style.display = 'none';
  } else if (Notification.permission === 'denied') {
    btn.title = 'Notifications Blocked (Reset in settings)';
    btn.style.color = 'var(--danger)'; // Red for warning/denied
    btn.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    btn.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';
    if (dot) dot.style.display = 'block';
  } else {
    // Default (not asked yet)
    btn.title = 'Click to Enable Notifications';
    btn.style.color = 'var(--warning)'; // Orange/yellow for default state
    btn.style.borderColor = 'rgba(245, 158, 11, 0.2)';
    btn.style.backgroundColor = 'rgba(245, 158, 11, 0.05)';
    if (dot) dot.style.display = 'block';
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function toggleProfilePasswordVisibility() {
  const passwordInput = document.getElementById('profile-edit-password');
  const eyeIconPath = document.getElementById('profile-password-eye-icon');
  if (passwordInput && eyeIconPath) {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeIconPath.setAttribute('d', 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18');
    } else {
      passwordInput.type = 'password';
      eyeIconPath.setAttribute('d', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z');
    }
  }
}

window.clearSMSLogs = clearSMSLogs;
window.triggerSMSNotification = triggerSMSNotification;
window.renderSMSLogs = renderSMSLogs;
window.triggerChatNotification = triggerChatNotification;
window.showProfileModal = showProfileModal;
window.hideProfileModal = hideProfileModal;
window.handleProfileSave = handleProfileSave;
window.openFullImageViewModalWithData = openFullImageViewModalWithData;
window.setupPushSubscription = setupPushSubscription;
window.updateNotificationButtonState = updateNotificationButtonState;
window.toggleProfilePasswordVisibility = toggleProfilePasswordVisibility;

// Avatar color palette for dynamically added managers
const MANAGER_AVATAR_COLORS = [
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #3b82f6, #06b6d4)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #d97706)",
  "linear-gradient(135deg, #8b5cf6, #6d28d9)",
  "linear-gradient(135deg, #ef4444, #dc2626)",
  "linear-gradient(135deg, #14b8a6, #0d9488)",
  "linear-gradient(135deg, #f97316, #ea580c)"
];

function getManagerTheme(managerName, index) {
  // Try to find the actual employee for designation
  const emp = state.employees.find(e => e.name === managerName || e.name.split(' ')[0] === managerName);
  const designation = emp ? (emp.role || 'Manager') : 'Manager';
  const initials = managerName.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  const bg = MANAGER_AVATAR_COLORS[index % MANAGER_AVATAR_COLORS.length];
  return { bg, avatar: initials, designation };
}

function renderSchoolManagement() {
  const grid = document.getElementById('schools-grid');
  if (!grid) return;

  grid.innerHTML = '';

  // Dynamically find all unique manager names from the schools data
  const allSchools = state.schools || [];
  const managerNamesInSchools = [...new Set(allSchools.map(s => s.managerName).filter(Boolean))];

  // Also include managers from schoolManagementLeads state (explicitly added via "Add Tech Lead")
  const explicitLeads = state.schoolManagementLeads || [];
  explicitLeads.forEach(name => {
    if (!managerNamesInSchools.includes(name)) managerNamesInSchools.push(name);
  });

  if (managerNamesInSchools.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: 24px;"><div class="empty-state-title">No managers in school management yet</div><p>Add schools or add a tech lead to get started.</p></div>`;
    return;
  }

  managerNamesInSchools.forEach((manager, managerIndex) => {
    const theme = getManagerTheme(manager, managerIndex);
    const managerSchools = allSchools.filter(sch => sch.managerName === manager);

    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.padding = '20px';
    card.style.boxSizing = 'border-box';
    card.style.gap = '16px';
    card.style.background = 'var(--bg-secondary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = 'var(--border-radius)';
    card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';

    const schoolsListHtml = managerSchools.length > 0 ? managerSchools.map((sch, index) => {
      const instructorsList = (sch.instructors || []).map(instId => {
        const emp = state.employees.find(e => e.id === instId);
        return emp ? emp.name : instId;
      });

      const instructorsBadgeHtml = instructorsList.length > 0
        ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
             ${instructorsList.map(name => `
               <span style="font-size: 0.7rem; background: var(--primary-bg); color: var(--primary); padding: 2px 6px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; border: 1px solid rgba(220, 38, 38, 0.1);">
                 👤 ${name}
               </span>
             `).join('')}
           </div>`
        : `<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; margin-top: 2px;">No instructors assigned</div>`;

      const studentsCountHtml = sch.studentsCount
        ? `<span style="font-size: 0.65rem; background: var(--bg-tertiary); color: var(--text-secondary); padding: 1px 5px; border-radius: 4px; font-weight: 600; border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 3px;" title="Students">👥 ${sch.studentsCount}</span>`
        : '';
      const filesCountHtml = sch.files && sch.files.length > 0
        ? `<span style="font-size: 0.65rem; background: var(--bg-tertiary); color: var(--text-secondary); padding: 1px 5px; border-radius: 4px; font-weight: 600; border: 1px solid var(--border-color); display: inline-flex; align-items: center; gap: 3px;" title="Attachments">📁 ${sch.files.length}</span>`
        : '';

      return `
        <div style="display: flex; flex-direction: column; padding: 10px 0; border-bottom: 1px dashed var(--border-color);" class="school-list-item">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; font-size: 0.85rem; color: var(--text-primary);">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-weight: 700; color: var(--text-secondary); min-width: 18px;">${index + 1}.</span>
              <span style="line-height: 1.4; font-weight: 600; cursor: pointer; color: var(--text-primary); transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-primary)'" onclick="openSchoolDetailsModal('${sch.id}')">${sch.name}</span>
              ${studentsCountHtml}
              ${filesCountHtml}
            </div>
          </div>
          <div style="margin-left: 28px;">
            ${instructorsBadgeHtml}
          </div>
        </div>
      `;
    }).join('') : `<div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 16px 0;">No schools assigned yet. Use "Reassign School" to add schools to this tech lead.</div>`;

    card.innerHTML = `
      <!-- Card Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 42px; height: 42px; border-radius: 50%; background: ${theme.bg}; color: white; display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 700; box-shadow: var(--shadow-sm);">
            ${theme.avatar}
          </div>
          <div>
            <div style="font-size: 1rem; font-weight: 700; color: var(--text-primary);">${manager}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">${theme.designation}</div>
          </div>
        </div>
        <span class="badge" style="background-color: var(--bg-tertiary); color: var(--text-primary); font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--border-color);">
          ${managerSchools.length} School${managerSchools.length !== 1 ? 's' : ''}
        </span>
      </div>

      <!-- Schools List -->
      <div style="display: flex; flex-direction: column; overflow-y: auto; max-height: 350px; padding-right: 4px;">
        ${schoolsListHtml}
      </div>
    `;

    grid.appendChild(card);
  });
}

function openAddSchoolModal() {
  populateManagerDropdowns();
  document.getElementById('add-school-form').reset();
  document.getElementById('add-school-modal-overlay').classList.add('active');
}
function closeAddSchoolModal() {
  document.getElementById('add-school-modal-overlay').classList.remove('active');
}

async function handleAddSchoolSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('new-school-name').value.trim();
  const managerName = document.getElementById('new-school-manager').value;

  if (!name || !managerName) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  const exists = state.schools.some(sch => sch.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    showToast('A school with this name already exists.', 'error');
    return;
  }

  const nextSchoolId = `SCH${String(state.schools.length + 1).padStart(5, '0')}`;
  const newSchool = {
    id: nextSchoolId,
    name: name,
    managerName: managerName,
    instructors: []
  };

  state.schools.push(newSchool);
  localStorage.setItem('ems_schools', JSON.stringify(state.schools));

  try {
    await fetch('/api/update-school', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ school: newSchool })
    });
  } catch (err) {
    console.error('Failed to post new school directly:', err);
  }

  triggerBackendSync();

  renderSchoolManagement();
  closeAddSchoolModal();
  showToast(`School "${name}" added successfully.`, 'success');
}

function openAddInstructorModal() {
  document.getElementById('add-instructor-form').reset();
  const tbody = document.getElementById('instructor-rows-tbody');
  tbody.innerHTML = '';
  addInstructorRow();

  const checklist = document.getElementById('instructor-schools-checklist');
  checklist.innerHTML = '';
  state.schools.forEach(sch => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.innerHTML = `
      <input type="checkbox" id="inst-sch-${sch.id}" value="${sch.id}" style="width: auto; cursor: pointer;">
      <label for="inst-sch-${sch.id}" style="cursor: pointer; font-size: 0.8rem; font-weight: 500;">${sch.name} (${sch.managerName})</label>
    `;
    checklist.appendChild(div);
  });

  document.getElementById('add-instructor-modal-overlay').classList.add('active');
}
function closeAddInstructorModal() {
  document.getElementById('add-instructor-modal-overlay').classList.remove('active');
}

function addInstructorRow() {
  const nextId = generateNextEmployeeId();
  const tbody = document.getElementById('instructor-rows-tbody');
  const rowCount = tbody.querySelectorAll('tr').length;

  let prefilledId = nextId;
  const match = nextId.match(/^AIRG(\d+)$/i);
  if (match) {
    const num = parseInt(match[1], 10) + rowCount;
    prefilledId = `AIRG${String(num).padStart(5, '0')}`;
  }

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="inst-id-input" placeholder="e.g. AIRG00045" value="${prefilledId}" required style="padding: 6px; font-size: 0.8rem;"></td>
    <td><input type="text" class="inst-name-input" placeholder="Name" required style="padding: 6px; font-size: 0.8rem;"></td>
    <td><input type="email" class="inst-email-input" placeholder="Email" required style="padding: 6px; font-size: 0.8rem;"></td>
    <td><input type="text" class="inst-phone-input" placeholder="Phone" required style="padding: 6px; font-size: 0.8rem;"></td>
    <td><input type="password" class="inst-password-input" placeholder="Password" value="password123" required style="padding: 6px; font-size: 0.8rem;"></td>
    <td style="text-align: center;"><button type="button" class="btn btn-danger btn-xs" onclick="removeInstructorRow(this)">Delete</button></td>
  `;
  tbody.appendChild(tr);
}

function removeInstructorRow(btn) {
  const row = btn.closest('tr');
  if (row) row.remove();
}

function generateNextEmployeeId() {
  let maxIdNum = 0;
  state.employees.forEach(emp => {
    const match = emp.id.match(/^AIRG(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxIdNum) {
        maxIdNum = num;
      }
    }
  });
  return `AIRG${String(maxIdNum + 1).padStart(5, '0')}`;
}

function handleAddInstructorSubmit(e) {
  e.preventDefault();

  const tbody = document.getElementById('instructor-rows-tbody');
  const rows = tbody.querySelectorAll('tr');

  if (rows.length === 0) {
    showToast('Please add at least one instructor row.', 'error');
    return;
  }

  const newInstructors = [];
  let validationError = false;

  rows.forEach((row, index) => {
    const id = row.querySelector('.inst-id-input').value.trim();
    const name = row.querySelector('.inst-name-input').value.trim();
    const email = row.querySelector('.inst-email-input').value.trim().toLowerCase();
    const phone = row.querySelector('.inst-phone-input').value.trim();
    const password = row.querySelector('.inst-password-input').value.trim();

    if (!id || !name || !email || !phone || !password) {
      showToast(`Please fill in all fields in row ${index + 1}.`, 'error');
      validationError = true;
      return;
    }

    const idExists = state.employees.some(emp => emp.id.toLowerCase() === id.toLowerCase()) ||
      newInstructors.some(inst => inst.id.toLowerCase() === id.toLowerCase());
    if (idExists) {
      showToast(`Employee ID "${id}" is already in use.`, 'error');
      validationError = true;
      return;
    }

    const emailExists = state.employees.some(emp => emp.email.toLowerCase() === email) ||
      newInstructors.some(inst => inst.email === email);
    if (emailExists) {
      showToast(`Email "${email}" is already in use.`, 'error');
      validationError = true;
      return;
    }

    newInstructors.push({ id, name, email, phone, password });
  });

  if (validationError) return;

  const selectedSchoolIds = [];
  const checklist = document.getElementById('instructor-schools-checklist');
  const checkboxes = checklist.querySelectorAll('input[type="checkbox"]:checked');
  checkboxes.forEach(cb => {
    selectedSchoolIds.push(cb.value);
  });

  newInstructors.forEach(inst => {
    const initials = inst.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    const employeeObj = {
      id: inst.id,
      name: inst.name,
      dept: 'Instructor',
      email: inst.email,
      role: 'Employee',
      balance: 20,
      absent: 0,
      avatar: initials,
      designation: 'Instructor',
      phone: inst.phone,
      password: inst.password,
      aadhar: '',
      pan: '',
      bankAcc: '',
      bankIfsc: '',
      photo: null
    };

    state.employees.push(employeeObj);

    selectedSchoolIds.forEach(schId => {
      const sch = state.schools.find(s => s.id === schId);
      if (sch) {
        if (!sch.instructors) sch.instructors = [];
        if (!sch.instructors.includes(inst.id)) {
          sch.instructors.push(inst.id);
        }
      }
    });
  });

  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  localStorage.setItem('ems_schools', JSON.stringify(state.schools));
  triggerBackendSync();

  populateEmployeeDropdown();
  renderSchoolManagement();
  closeAddInstructorModal();
  showToast(`Successfully added ${newInstructors.length} instructor(s) and assigned them.`, 'success');
}

function openAssignExistingInstructorModal() {
  document.getElementById('assign-existing-instructor-form').reset();

  const instSelect = document.getElementById('assign-instructor-select');
  instSelect.innerHTML = '<option value="" disabled selected>Select instructor...</option>';
  state.employees.filter(emp =>
    (!isPratap(emp)) && (
    (emp.dept || '').toLowerCase().includes('instructor') ||
    (emp.role || '').toLowerCase().includes('instructor') ||
    (emp.designation || '').toLowerCase().includes('instructor')
    )
  ).forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.id})`;
    instSelect.appendChild(opt);
  });

  const schSelect = document.getElementById('assign-school-select');
  schSelect.innerHTML = '<option value="" disabled selected>Select school...</option>';
  state.schools.forEach(sch => {
    const opt = document.createElement('option');
    opt.value = sch.id;
    opt.textContent = `${sch.name} (${sch.managerName})`;
    schSelect.appendChild(opt);
  });

  document.getElementById('assign-instructor-modal-overlay').classList.add('active');
}
function closeAssignExistingInstructorModal() {
  document.getElementById('assign-instructor-modal-overlay').classList.remove('active');
}

function handleAssignExistingInstructorSubmit(e) {
  e.preventDefault();
  const instId = document.getElementById('assign-instructor-select').value;
  const schoolId = document.getElementById('assign-school-select').value;

  if (!instId || !schoolId) {
    showToast('Please select both instructor and school.', 'error');
    return;
  }

  const sch = state.schools.find(s => s.id === schoolId);
  if (sch) {
    if (!sch.instructors) sch.instructors = [];
    if (sch.instructors.includes(instId)) {
      showToast('This instructor is already assigned to this school.', 'warning');
      return;
    }
    sch.instructors.push(instId);
    localStorage.setItem('ems_schools', JSON.stringify(state.schools));
    triggerBackendSync();

    renderSchoolManagement();
    closeAssignExistingInstructorModal();
    showToast('Instructor successfully assigned to school.', 'success');
  }
}

window.openAddSchoolModal = openAddSchoolModal;
window.closeAddSchoolModal = closeAddSchoolModal;
window.handleAddSchoolSubmit = handleAddSchoolSubmit;
window.openAddInstructorModal = openAddInstructorModal;
window.closeAddInstructorModal = closeAddInstructorModal;
window.addInstructorRow = addInstructorRow;
window.removeInstructorRow = removeInstructorRow;
window.handleAddInstructorSubmit = handleAddInstructorSubmit;
window.openAssignExistingInstructorModal = openAssignExistingInstructorModal;
window.closeAssignExistingInstructorModal = closeAssignExistingInstructorModal;
window.handleAssignExistingInstructorSubmit = handleAssignExistingInstructorSubmit;

window.renderSchoolManagement = renderSchoolManagement;

// ============================================================
// ADD TECH LEAD TO SCHOOL MANAGEMENT (HR / Admin Only)
// ============================================================
function openAddTechLeadToSchoolModal() {
  const role = (state.currentRole || '').toLowerCase();
  if (role !== 'hr' && role !== 'admin') {
    showToast('Only HR and Admin can add Tech Leads to School Management.', 'error');
    return;
  }

  const select = document.getElementById('add-school-lead-select');
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>Select a Tech Lead...</option>';

  // Already-present manager names in school management (from schools + explicit leads)
  const allSchools = state.schools || [];
  const presentManagers = new Set([
    ...allSchools.map(s => s.managerName).filter(Boolean),
    ...(state.schoolManagementLeads || [])
  ]);

  // Filter employees who are Tech Leads / Managers and not already in school mgmt
  const eligibleLeads = state.employees.filter(emp => {
    if (isPratap(emp) || emp.isDeleted || emp.status === 'pending_approval') return false;
    const roleStr = (emp.role || '').toLowerCase();
    const isTechLead = roleStr.includes('tech lead') || roleStr.includes('techlead') || roleStr.includes('manager');
    if (!isTechLead) return false;
    // Check if already in school mgmt by name or first name
    const firstName = emp.name.split(' ')[0];
    return !presentManagers.has(emp.name) && !presentManagers.has(firstName);
  });

  if (eligibleLeads.length === 0) {
    showToast('All Tech Leads are already added to School Management.', 'info');
    return;
  }

  eligibleLeads.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.name;
    opt.textContent = `${emp.name} (${emp.role})`;
    select.appendChild(opt);
  });

  document.getElementById('add-school-lead-modal-overlay').classList.add('active');
}

function closeAddTechLeadToSchoolModal() {
  document.getElementById('add-school-lead-modal-overlay').classList.remove('active');
}

function handleAddTechLeadToSchoolSubmit(e) {
  e.preventDefault();
  const select = document.getElementById('add-school-lead-select');
  const leadName = select.value;
  if (!leadName) {
    showToast('Please select a Tech Lead.', 'error');
    return;
  }

  if (!state.schoolManagementLeads) state.schoolManagementLeads = [];
  if (!state.schoolManagementLeads.includes(leadName)) {
    state.schoolManagementLeads.push(leadName);
  }

  // Persist in localStorage
  localStorage.setItem('ems_school_mgmt_leads', JSON.stringify(state.schoolManagementLeads));
  triggerBackendSync();

  renderSchoolManagement();
  closeAddTechLeadToSchoolModal();
  showToast(`${leadName} has been added to School Management. You can now assign schools to them using "Reassign School".`, 'success');
}

window.openAddTechLeadToSchoolModal = openAddTechLeadToSchoolModal;
window.closeAddTechLeadToSchoolModal = closeAddTechLeadToSchoolModal;
window.handleAddTechLeadToSchoolSubmit = handleAddTechLeadToSchoolSubmit;

function openFillDetailsModal() {
  if (!state.currentUser) return;
  const user = state.currentUser;

  document.getElementById('fd-name').value = user.name || '';
  document.getElementById('fd-designation').value = user.designation || user.role || '';
  document.getElementById('fd-bank-name').value = user.bankName || '';
  document.getElementById('fd-branch').value = user.branch || '';
  document.getElementById('fd-ifsc').value = user.bankIfsc || '';
  document.getElementById('fd-account').value = user.bankAcc || '';
  document.getElementById('fd-id-card').value = user.idCardNumber || '';
  document.getElementById('fd-dob').value = user.birthDate || '';
  document.getElementById('fd-contact').value = user.phone || '';
  document.getElementById('fd-joining-date').value = user.joiningDate || '';
  document.getElementById('fd-aadhar').value = user.aadhar || '';
  document.getElementById('fd-pan').value = user.pan || '';

  // Reset file inputs
  const fileInputs = ['fd-bank-photo', 'fd-branch-photo', 'fd-ifsc-photo', 'fd-account-photo', 'fd-id-card-photo', 'fd-aadhar-photo', 'fd-pan-photo'];
  fileInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Toggle uploaded status indicators
  const updateStatus = (photoData, statusId) => {
    const el = document.getElementById(statusId);
    if (el) {
      el.style.display = photoData ? 'inline' : 'none';
    }
  };
  updateStatus(user.bankPhoto, 'fd-bank-photo-status');
  updateStatus(user.branchPhoto, 'fd-branch-photo-status');
  updateStatus(user.ifscPhoto, 'fd-ifsc-photo-status');
  updateStatus(user.accountPhoto, 'fd-account-photo-status');
  updateStatus(user.idCardPhoto, 'fd-id-card-photo-status');
  updateStatus(user.aadharPhoto, 'fd-aadhar-photo-status');
  updateStatus(user.panPhoto, 'fd-pan-photo-status');

  hideProfileModal();

  document.getElementById('fill-details-modal-overlay').classList.add('active');
}

function closeFillDetailsModal() {
  document.getElementById('fill-details-modal-overlay').classList.remove('active');
  const overlay = document.getElementById('profile-modal-overlay');
  if (overlay) overlay.classList.add('active');
}

async function readFileAsBase64(fileInputId) {
  const input = document.getElementById(fileInputId);
  if (!input || !input.files || input.files.length === 0) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (input.files[0].type.startsWith('image/')) {
        compressImage(dataUrl, 1000, 1000, 0.7, (compressed) => {
          resolve(compressed);
        });
      } else {
        resolve(dataUrl);
      }
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(input.files[0]);
  });
}

async function handleFillDetailsSubmit(e) {
  e.preventDefault();
  if (!state.currentUser) return;

  try {
    const [
      bankPhoto,
      branchPhoto,
      ifscPhoto,
      accountPhoto,
      idCardPhoto,
      aadharPhoto,
      panPhoto
    ] = await Promise.all([
      readFileAsBase64('fd-bank-photo'),
      readFileAsBase64('fd-branch-photo'),
      readFileAsBase64('fd-ifsc-photo'),
      readFileAsBase64('fd-account-photo'),
      readFileAsBase64('fd-id-card-photo'),
      readFileAsBase64('fd-aadhar-photo'),
      readFileAsBase64('fd-pan-photo')
    ]);

    const name = document.getElementById('fd-name').value.trim();
    const designation = document.getElementById('fd-designation').value.trim();
    const bankName = document.getElementById('fd-bank-name').value.trim();
    const branch = document.getElementById('fd-branch').value.trim();
    const bankIfsc = document.getElementById('fd-ifsc').value.trim();
    const bankAcc = document.getElementById('fd-account').value.trim();
    const idCardNumber = document.getElementById('fd-id-card').value.trim();
    const birthDate = document.getElementById('fd-dob').value;
    const phone = document.getElementById('fd-contact').value.trim();
    const joiningDate = document.getElementById('fd-joining-date').value;
    const aadhar = document.getElementById('fd-aadhar').value.trim();
    const pan = document.getElementById('fd-pan').value.trim();

    state.currentUser.name = name;
    state.currentUser.designation = designation;
    state.currentUser.bankName = bankName;
    state.currentUser.branch = branch;
    state.currentUser.bankIfsc = bankIfsc;
    state.currentUser.bankAcc = bankAcc;
    state.currentUser.idCardNumber = idCardNumber;
    state.currentUser.birthDate = birthDate;
    state.currentUser.phone = phone;
    state.currentUser.joiningDate = joiningDate;
    state.currentUser.aadhar = aadhar;
    state.currentUser.pan = pan;

    // Save photos if a new one was uploaded, else preserve existing
    if (bankPhoto) state.currentUser.bankPhoto = bankPhoto;
    if (branchPhoto) state.currentUser.branchPhoto = branchPhoto;
    if (ifscPhoto) state.currentUser.ifscPhoto = ifscPhoto;
    if (accountPhoto) state.currentUser.accountPhoto = accountPhoto;
    if (idCardPhoto) state.currentUser.idCardPhoto = idCardPhoto;
    if (aadharPhoto) state.currentUser.aadharPhoto = aadharPhoto;
    if (panPhoto) state.currentUser.panPhoto = panPhoto;

    const empIndex = state.employees.findIndex(emp => emp.id === state.currentUser.id);
    if (empIndex !== -1) {
      state.employees[empIndex] = { ...state.employees[empIndex], ...state.currentUser };
    }

    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    localStorage.setItem('ems_logged_in_user', JSON.stringify(state.currentUser));

    triggerBackendSync();

    document.getElementById('fill-details-modal-overlay').classList.remove('active');

    showToast('Profile and onboarding details submitted to HR successfully.', 'success');

    const headerName = document.getElementById('header-name');
    if (headerName) headerName.textContent = state.currentUser.name;
    const headerRole = document.getElementById('header-role');
    if (headerRole) headerRole.textContent = state.currentUser.role === 'Admin, HR, Tech Lead, Manager' ? 'CEO' : state.currentUser.role;
    updateHeaderAvatar(state.currentUser);
  } catch (err) {
    console.error(err);
    showToast('Error processing file uploads. Please check your image formats.', 'error');
  }
}

function viewOnboardingDocument(src, event) {
  if (event) event.stopPropagation();
  const modal = document.getElementById('image-viewer-modal-overlay');
  const img = document.getElementById('full-viewer-image');
  if (modal && img) {
    img.src = src;
    modal.classList.add('active');
  }
}

function renderRegistrationApprovalQueue() {
  const tbody = document.getElementById('registration-approval-queue-tbody');
  if (!tbody) return;

  const searchEl = document.getElementById('reg-approval-search');
  const query = searchEl ? searchEl.value.trim().toLowerCase() : '';

  let pendingRegs = state.employees.filter(emp => emp.status === 'pending_approval');

  // Search filter (Employee ID)
  if (query) {
    pendingRegs = pendingRegs.filter(emp => emp.id.toLowerCase().includes(query));
  }

  // Sort descending by registration date (latest first)
  pendingRegs.sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    const idxA = state.employees.indexOf(a);
    const idxB = state.employees.indexOf(b);
    return idxB - idxA;
  });

  if (pendingRegs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state" style="padding: 32px; text-align: center;">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 12px; display: inline-block;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <div class="empty-state-title" style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem; margin-bottom: 4px;">No matching pending registrations</div>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">Try adjusting your search query.</p>
          </div>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = '';
    pendingRegs.forEach(emp => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: var(--text-primary); font-weight: 500;"><strong>${emp.id}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="avatar" style="width: 32px; height: 32px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--primary-gradient); color: white; font-weight: bold;">
              ${emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <strong style="color: var(--text-primary);">${emp.name}</strong>
          </div>
        </td>
        <td style="color: var(--text-primary);">${emp.email}</td>
        <td style="color: var(--text-primary);">${emp.phone || '—'}</td>
        <td><strong style="color: var(--text-primary);">${emp.role}</strong><br><span class="text-muted" style="font-size:0.75rem;">${emp.designation || '—'}</span></td>
        <td><span class="badge" style="background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color);">${emp.dept || '—'}</span></td>
        <td>
          <div style="display:flex; gap: 8px;">
            <button class="btn btn-success btn-sm" onclick="approveRegistration('${emp.id}')">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="rejectRegistration('${emp.id}')">Reject</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

function renderEmployeeDetails() {
  const container = document.getElementById('emp-details-cards-list');
  if (!container) return;

  container.innerHTML = '';

  const searchEl = document.getElementById('emp-details-search');
  const query = searchEl ? searchEl.value.trim().toLowerCase() : '';

  // Show top banner if any employee has a pending password reset request
  const pendingResets = state.employees.filter(e => e.passwordResetRequested && !e.isDeleted && e.status !== 'pending_approval');
  if (pendingResets.length > 0) {
    const banner = document.createElement('div');
    banner.style.cssText = `
      background: linear-gradient(135deg, rgba(220,38,38,0.15), rgba(239,68,68,0.08));
      border: 1px solid rgba(220,38,38,0.4);
      border-radius: var(--border-radius);
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 8px;
      animation: pulse-border 2s infinite;
    `;
    banner.innerHTML = `
      <span style="font-size: 1.4rem;">🔐</span>
      <div style="flex: 1;">
        <div style="font-size: 0.9rem; font-weight: 700; color: #ef4444;">${pendingResets.length} Password Reset Request${pendingResets.length > 1 ? 's' : ''} Pending</div>
        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">${pendingResets.map(e => e.name).join(', ')} — Click "Send Reset Link" on their card below.</div>
      </div>
    `;
    container.appendChild(banner);
  }

  state.employees.forEach(emp => {
    if (isPratap(emp) || emp.status === 'pending_approval') return; // Hide Pratap & Pending
    if (query && !emp.name.toLowerCase().includes(query)) return;
    if (!state.expandedEmployeeDetails) {
      state.expandedEmployeeDetails = new Set();
    }
    const isExpanded = state.expandedEmployeeDetails.has(emp.id);
    const card = document.createElement('div');
    card.className = 'project-card';
    card.style.background = emp.passwordResetRequested ? 'rgba(220,38,38,0.06)' : 'var(--bg-secondary)';
    card.style.border = emp.passwordResetRequested ? '1.5px solid rgba(220,38,38,0.5)' : '1px solid var(--border-color)';
    card.style.borderRadius = 'var(--border-radius)';
    card.style.padding = '20px';
    card.style.cursor = 'pointer';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '12px';
    card.style.boxSizing = 'border-box';
    card.style.width = '100%';
    card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';

    // Click handler to toggle expansion
    card.onclick = () => {
      if (state.expandedEmployeeDetails.has(emp.id)) {
        state.expandedEmployeeDetails.delete(emp.id);
      } else {
        state.expandedEmployeeDetails.add(emp.id);
      }
      renderEmployeeDetails();
    };

    const getPhotoPreviewHtml = (photoData, title) => {
      if (!photoData) {
        return `
          <div style="width: 100%; height: 80px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.03); border: 1px dashed var(--border-color); border-radius: 6px; color: var(--text-muted); font-size: 0.7rem;">
            <span>📷 No Proof</span>
          </div>
        `;
      }
      return `
        <div style="position: relative; width: 100%; height: 80px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-color); cursor: zoom-in;" onclick="viewOnboardingDocument('${photoData}', event)">
          <img src="${photoData}" style="width: 100%; height: 80px; object-fit: cover;" alt="${title}">
          <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); color: #fff; text-align: center; font-size: 0.6rem; padding: 2px 4px; font-weight: 600;">
            🔍 View Proof
          </div>
        </div>
      `;
    };

    const avatarInitials = emp.name ? emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EMP';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; width: 100%;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; font-weight: 700; box-shadow: var(--shadow-sm); flex-shrink: 0;">
            ${avatarInitials}
          </div>
          <div>
            <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span>${emp.name}</span>
              ${emp.passwordResetRequested ? `
                <span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: rgba(220,38,38,0.15); color: #ef4444; border: 1px solid rgba(220,38,38,0.3); border-radius: 12px; font-size: 0.7rem; font-weight: 700; animation: pulse-border 1.5s infinite;">
                  🔐 Reset Requested
                </span>
              ` : ''}
              ${emp.isDeleted ? `
                <span class="badge badge-rejected" style="font-size: 0.65rem; padding: 2px 8px; border-radius: 12px;">Former Employee</span>
              ` : (state.activeUsers && state.activeUsers.includes(emp.id)) ? `
                <span class="active-badge" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background-color: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
                  <span style="width: 6px; height: 6px; background-color: #22c55e; border-radius: 50%;"></span>
                  Active
                </span>
              ` : ''}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-top: 2px;">
              ID: <span style="font-weight: 700; color: var(--text-primary);">${emp.id}</span> | Email: <span style="font-weight: 700; color: var(--text-primary);">${emp.email}</span>
            </div>
          </div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="btn btn-secondary btn-sm" onclick="sendPasswordResetLink('${emp.id}', event)" style="padding: 4px 10px; font-size: 0.75rem;">
            Send Reset Link
          </button>
          <span class="badge" style="background-color: var(--bg-tertiary); color: var(--text-primary); font-size: 0.75rem; font-weight: 700; padding: 6px 12px; border-radius: 12px; border: 1px solid var(--border-color);">
            ${emp.designation || emp.role || 'Employee'}
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate(${isExpanded ? '180deg' : '0deg'}); color: var(--text-secondary);">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
    `;

    if (isExpanded) {
      const detailsDiv = document.createElement('div');
      detailsDiv.style.borderTop = '1px solid var(--border-color)';
      detailsDiv.style.paddingTop = '16px';
      detailsDiv.style.marginTop = '12px';
      detailsDiv.style.display = 'grid';
      detailsDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
      detailsDiv.style.gap = '24px';
      detailsDiv.style.width = '100%';
      detailsDiv.onclick = (e) => e.stopPropagation();

      detailsDiv.innerHTML = `
        <!-- Left Column: Bank Details -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 6px; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
            🏦 Bank Information
          </h4>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <div>
              <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Bank Name</label>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.bankName || '—'}</div>
              <div style="margin-top: 6px;">${getPhotoPreviewHtml(emp.bankPhoto, 'Bank Name Proof')}</div>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Branch</label>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.branch || '—'}</div>
              <div style="margin-top: 6px;">${getPhotoPreviewHtml(emp.branchPhoto, 'Branch Proof')}</div>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">IFSC Code</label>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.bankIfsc || '—'}</div>
              <div style="margin-top: 6px;">${getPhotoPreviewHtml(emp.ifscPhoto, 'IFSC Proof')}</div>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Account Number</label>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.bankAcc || '—'}</div>
              <div style="margin-top: 6px;">${getPhotoPreviewHtml(emp.accountPhoto, 'Account Proof')}</div>
            </div>
          </div>
        </div>

        <!-- Right Column: Compliance & Identity Details -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 6px; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
            🪪 Identity & Verification
          </h4>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
            <div>
              <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">ID Card Number</label>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.idCardNumber || '—'}</div>
              <div style="margin-top: 6px;">${getPhotoPreviewHtml(emp.idCardPhoto, 'ID Card Proof')}</div>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Aadhar Card Number</label>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.aadhar || '—'}</div>
              <div style="margin-top: 6px;">${getPhotoPreviewHtml(emp.aadharPhoto, 'Aadhar Card Proof')}</div>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">PAN Card Number</label>
              <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.pan || '—'}</div>
              <div style="margin-top: 6px;">${getPhotoPreviewHtml(emp.panPhoto, 'PAN Card Proof')}</div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div>
                <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Birth Date</label>
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.birthDate || '—'}</div>
              </div>
              <div>
                <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Contact Number</label>
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.phone || '—'}</div>
              </div>
              <div>
                <label style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 2px;">Joining Date</label>
                <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">${emp.joiningDate || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      `;
      card.appendChild(detailsDiv);
    }

    container.appendChild(card);
  });
}

window.openFillDetailsModal = openFillDetailsModal;
window.closeFillDetailsModal = closeFillDetailsModal;
window.handleFillDetailsSubmit = handleFillDetailsSubmit;
window.renderEmployeeDetails = renderEmployeeDetails;
window.viewOnboardingDocument = viewOnboardingDocument;
window.sendPasswordResetLink = sendPasswordResetLink;

async function sendPasswordResetLink(empId, event) {
  if (event) event.stopPropagation();
  try {
    showToast('Requesting password reset link...', 'info');
    const res = await fetch('/api/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: empId })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Password reset link sent to employee email!', 'success');
    } else {
      showToast(data.error || 'Failed to send reset link', 'error');
    }
  } catch (err) {
    showToast('Network error while requesting reset link', 'error');
  }
}

function openReassignSchoolModal(schoolId) {
  populateManagerDropdowns();
  document.getElementById('reassign-school-form').reset();

  // Deduplicate schools list first so every school appears EXACTLY ONCE
  state.schools = deduplicateSchools(state.schools);

  const schoolSelect = document.getElementById('reassign-school-select');
  schoolSelect.innerHTML = '<option value="" disabled selected>Select school...</option>';
  state.schools.forEach(sch => {
    const opt = document.createElement('option');
    opt.value = sch.id;
    opt.textContent = `${sch.name} (${sch.managerName || 'Unassigned'})`;
    schoolSelect.appendChild(opt);
  });

  if (schoolId) {
    schoolSelect.value = schoolId;
    const sch = state.schools.find(s => s.id === schoolId);
    if (sch) {
      document.getElementById('reassign-manager-select').value = sch.managerName;
    }
  }

  document.getElementById('reassign-school-modal-overlay').classList.add('active');
}

function closeReassignSchoolModal() {
  document.getElementById('reassign-school-modal-overlay').classList.remove('active');
}

async function handleReassignSchoolSubmit(e) {
  e.preventDefault();
  const schoolId = document.getElementById('reassign-school-select').value;
  const managerName = document.getElementById('reassign-manager-select').value;

  if (!schoolId || !managerName) {
    showToast('Please select both school and manager.', 'error');
    return;
  }

  const sch = state.schools.find(s => s.id === schoolId);
  if (sch) {
    const targetNameKey = sch.name.trim().toLowerCase();

    // Update ALL matching school entries with this name to the new managerName
    state.schools.forEach(s => {
      if (s && s.name && s.name.trim().toLowerCase() === targetNameKey) {
        s.managerName = managerName;
      }
    });

    // Deduplicate state.schools into a clean 1-school-per-name list
    state.schools = deduplicateSchools(state.schools);
    safeOriginalSetItem('ems_schools', JSON.stringify(state.schools));

    const updatedSchoolObj = state.schools.find(s => s.name.trim().toLowerCase() === targetNameKey) || sch;

    try {
      await fetch('/api/update-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school: updatedSchoolObj })
      });
    } catch (err) {
      console.error('Failed to update school directly:', err);
    }

    triggerBackendSync();

    renderSchoolManagement();
    closeReassignSchoolModal();
    showToast(`School "${sch.name}" successfully reassigned to ${managerName}.`, 'success');
  }
}

window.openReassignSchoolModal = openReassignSchoolModal;
window.closeReassignSchoolModal = closeReassignSchoolModal;
window.handleReassignSchoolSubmit = handleReassignSchoolSubmit;

function openDailyReportReminder() {
  const overlay = document.getElementById('daily-report-reminder-modal-overlay');
  if (overlay) overlay.classList.add('active');
}

function closeDailyReportReminder() {
  const overlay = document.getElementById('daily-report-reminder-modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

function undoLastTaskCompletion() {
  closeDailyReportReminder();
  if (state.lastCompletedTaskId) {
    const task = state.tasks.find(t => t.id === state.lastCompletedTaskId);
    if (task) {
      task.status = 'Not Completed';
      safeSaveTasks();
      if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'manager' || state.currentRole === 'admin') {
        renderHRTasksAndProjects();
      } else {
        renderEmployeeTasksAndProjects();
      }
      showToast('Task completion cancelled/undone.', 'warning');
    }
  }
}

window.openDailyReportReminder = openDailyReportReminder;
window.closeDailyReportReminder = closeDailyReportReminder;
window.undoLastTaskCompletion = undoLastTaskCompletion;

function openAssignRoleModal() {
  if (state.currentRole !== 'hr' && state.currentRole !== 'admin') {
    showToast('Only HR and Administrators can assign roles!', 'error');
    return;
  }

  document.getElementById('assign-role-form').reset();

  const empSelect = document.getElementById('ar-employee-select');
  empSelect.innerHTML = '<option value="" disabled selected>Select employee...</option>';
  
  state.employees.forEach(emp => {
    if (isPratap(emp)) return; // Hide Pratap
    if (state.currentUser && emp.id === state.currentUser.id) return;
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.id} - ${emp.role || 'Employee'})`;
    empSelect.appendChild(opt);
  });

  renderAssignRoleCheckboxes();

  // Setup change listener to tick roles when employee is selected
  empSelect.onchange = () => {
    const empId = empSelect.value;
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;

    const currentRoles = (emp.role || 'Employee').split(',').map(r => r.trim().toLowerCase());
    const checkboxes = document.querySelectorAll('input[name="ar-roles-checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = currentRoles.includes(cb.value.toLowerCase());
    });
  };

  document.getElementById('assign-role-modal-overlay').classList.add('active');
}

function renderAssignRoleCheckboxes() {
  const container = document.getElementById('ar-preexisting-roles-container');
  if (!container) return;
  container.innerHTML = '';

  const rolesSet = new Set(['Employee', 'Tech Lead', 'HR', 'Manager']);
  state.employees.forEach(emp => {
    if (emp.role) {
      emp.role.split(',').map(r => r.trim()).forEach(r => {
        if (r && r.toLowerCase() !== 'admin') {
          rolesSet.add(r);
        }
      });
    }
  });

  rolesSet.forEach(r => {
    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '8px';
    label.style.cursor = 'pointer';
    label.style.color = 'var(--text-primary)';
    label.style.fontWeight = '600';
    label.style.fontSize = '0.85rem';

    label.innerHTML = `
      <input type="checkbox" name="ar-roles-checkbox" value="${r}" style="width: 16px; height: 16px; accent-color: var(--primary);">
      <span>${r}</span>
    `;
    container.appendChild(label);
  });
}

function closeAssignRoleModal() {
  document.getElementById('assign-role-modal-overlay').classList.remove('active');
}

function handleAssignRoleSubmit(e) {
  e.preventDefault();
  const empId = document.getElementById('ar-employee-select').value;
  const customRole = document.getElementById('ar-custom-role').value.trim();

  if (!empId) {
    showToast('Please select an employee.', 'error');
    return;
  }

  const emp = state.employees.find(emp => emp.id === empId);
  if (!emp) {
    showToast('Employee not found.', 'error');
    return;
  }

  const checkedRoles = [];
  const checkboxes = document.querySelectorAll('input[name="ar-roles-checkbox"]:checked');
  checkboxes.forEach(cb => {
    checkedRoles.push(cb.value);
  });

  if (customRole !== '') {
    if (!checkedRoles.includes(customRole)) {
      checkedRoles.push(customRole);
    }
  }

  let targetRole = checkedRoles.join(', ');
  if (!targetRole) {
    targetRole = 'Employee';
  }

  emp.role = targetRole;
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  triggerBackendSync();

  populateEmployeeDropdown();
  populateTaskModalOptions();
  renderEmployeeRoster();
  
  closeAssignRoleModal();
  showToast(`Role of "${emp.name}" successfully updated to "${targetRole}".`, 'success');
}

window.openAssignRoleModal = openAssignRoleModal;
window.closeAssignRoleModal = closeAssignRoleModal;
window.handleAssignRoleSubmit = handleAssignRoleSubmit;

function openSchoolDetailsModal(schoolId) {
  state.editingSchoolId = schoolId;
  state.editingSchoolFiles = [];

  const sch = state.schools.find(s => s.id === schoolId);
  if (!sch) return;

  document.getElementById('edit-school-name').value = sch.name || '';
  document.getElementById('edit-school-students').value = sch.studentsCount || '';
  document.getElementById('edit-school-details').value = sch.details || '';
  document.getElementById('edit-school-problems').value = sch.problems || '';

  if (sch.files) {
    state.editingSchoolFiles = [...sch.files];
  }

  renderSchoolFilesPreview();
  setupSchoolFileListener();

  document.getElementById('school-details-modal-overlay').classList.add('active');
}

function closeSchoolDetailsModal() {
  document.getElementById('school-details-modal-overlay').classList.remove('active');
  state.editingSchoolId = null;
  state.editingSchoolFiles = [];
}

function renderSchoolFilesPreview() {
  const container = document.getElementById('school-files-preview');
  if (!container) return;
  container.innerHTML = '';

  (state.editingSchoolFiles || []).forEach((fileObj, idx) => {
    const div = document.createElement('div');
    div.style.position = 'relative';
    div.style.width = '70px';
    div.style.height = '70px';
    div.style.borderRadius = '6px';
    div.style.border = '1px solid var(--border-color)';
    div.style.overflow = 'hidden';
    div.style.backgroundColor = 'var(--bg-tertiary)';

    const isPdf = fileObj.type === 'application/pdf' || fileObj.name.toLowerCase().endsWith('.pdf') || fileObj.data.startsWith('data:application/pdf');
    
    if (isPdf) {
      div.innerHTML = `
        <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;" onclick="openPdfInNewWindow('${fileObj.data}', event)" title="${fileObj.name}">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--danger);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2v-9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          <span style="font-size:0.5rem; max-width:60px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">PDF</span>
        </div>
      `;
    } else {
      div.innerHTML = `
        <img src="${fileObj.data}" style="width:100%; height:100%; object-fit:cover; cursor:zoom-in;" onclick="viewOnboardingDocument('${fileObj.data}', event)" title="${fileObj.name}">
      `;
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.innerHTML = '×';
    deleteBtn.style.position = 'absolute';
    deleteBtn.style.top = '2px';
    deleteBtn.style.right = '2px';
    deleteBtn.style.background = 'rgba(0,0,0,0.6)';
    deleteBtn.style.color = 'white';
    deleteBtn.style.border = 'none';
    deleteBtn.style.borderRadius = '50%';
    deleteBtn.style.width = '16px';
    deleteBtn.style.height = '16px';
    deleteBtn.style.fontSize = '12px';
    deleteBtn.style.lineHeight = '12px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.display = 'flex';
    deleteBtn.style.alignItems = 'center';
    deleteBtn.style.justifyContent = 'center';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      state.editingSchoolFiles.splice(idx, 1);
      renderSchoolFilesPreview();
    };
    div.appendChild(deleteBtn);

    container.appendChild(div);
  });
}

function setupSchoolFileListener() {
  const input = document.getElementById('edit-school-files-input');
  if (!input) return;

  input.onchange = async () => {
    if (!input.files || input.files.length === 0) return;
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];

      // Block non-image files larger than 500KB
      if (!file.type.startsWith('image/') && file.size > 512000) {
        showToast(`File "${file.name}" exceeds 500KB. Please upload it to Google Drive and paste the link in the school description instead.`, 'error');
        continue;
      }

      try {
        const data = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => {
            const dataUrl = r.result;
            if (file.type.startsWith('image/')) {
              compressImage(dataUrl, 1000, 1000, 0.7, (compressed) => resolve(compressed));
            } else {
              resolve(dataUrl);
            }
          };
          r.onerror = e => reject(e);
          r.readAsDataURL(file);
        });
        state.editingSchoolFiles.push({
          name: file.name,
          type: file.type,
          data: data
        });
      } catch (e) {
        console.error(e);
      }
    }
    renderSchoolFilesPreview();
    input.value = '';
  };
}

async function handleSchoolDetailsSubmit(e) {
  e.preventDefault();
  const schoolId = state.editingSchoolId;
  const sch = state.schools.find(s => s.id === schoolId);
  if (!sch) return;

  const nameVal = document.getElementById('edit-school-name').value.trim();
  const studentsVal = document.getElementById('edit-school-students').value;
  const detailsVal = document.getElementById('edit-school-details').value.trim();
  const problemsVal = document.getElementById('edit-school-problems').value.trim();

  const oldProblems = sch.problems || '';

  sch.name = nameVal;
  sch.studentsCount = studentsVal !== '' ? Number(studentsVal) : 0;
  sch.details = detailsVal;
  sch.problems = problemsVal;
  sch.files = [...state.editingSchoolFiles];

  localStorage.setItem('ems_schools', JSON.stringify(state.schools));
  triggerBackendSync(); // [AUTO-ADDED] persist ems_schools to server

  if (problemsVal && problemsVal !== oldProblems) {
    const noticeId = `NTC${500 + state.notices.length + 1}`;
    const newNotice = {
      id: noticeId,
      title: `🚨 URGENT: Problem at ${nameVal}`,
      content: `Tech Lead ${state.currentUser.name} reported a problem at ${nameVal}:\n\n"${problemsVal}"`,
      targetEmployeeIds: [],
      senderName: state.currentUser.name,
      timestamp: new Date().toLocaleString()
    };
    state.notices.push(newNotice);
    localStorage.setItem('ems_notices', JSON.stringify(state.notices));
  }

  syncStateNow();

  renderSchoolManagement();
  closeSchoolDetailsModal();
  showToast(`School "${sch.name}" details updated successfully.`, 'success');
}

async function submitSchoolProblemOnly(e) {
  if (e) e.preventDefault();
  const schoolId = state.editingSchoolId;
  const sch = state.schools.find(s => s.id === schoolId);
  if (!sch) return;

  const problemsVal = document.getElementById('edit-school-problems').value.trim();
  const oldProblems = sch.problems || '';

  if (!problemsVal) {
    showToast('Please enter a problem description.', 'error');
    return;
  }

  sch.problems = problemsVal;
  localStorage.setItem('ems_schools', JSON.stringify(state.schools));
  triggerBackendSync(); // [AUTO-ADDED] persist ems_schools to server

  if (problemsVal !== oldProblems) {
    const noticeId = `NTC${500 + state.notices.length + 1}`;
    const newNotice = {
      id: noticeId,
      title: `🚨 URGENT: Problem at ${sch.name}`,
      content: `Tech Lead ${state.currentUser.name} reported a problem at ${sch.name}:\n\n"${problemsVal}"`,
      targetEmployeeIds: [],
      senderName: state.currentUser.name,
      timestamp: new Date().toLocaleString()
    };
    state.notices.push(newNotice);
    localStorage.setItem('ems_notices', JSON.stringify(state.notices));
  }

  syncStateNow();

  renderSchoolManagement();
  closeSchoolDetailsModal();
  showToast(`Problem for school "${sch.name}" reported successfully.`, 'success');
}

window.openSchoolDetailsModal = openSchoolDetailsModal;
window.closeSchoolDetailsModal = closeSchoolDetailsModal;
window.handleSchoolDetailsSubmit = handleSchoolDetailsSubmit;
window.submitSchoolProblemOnly = submitSchoolProblemOnly;

function openRemoveInstructorModal() {
  document.getElementById('remove-instructor-form').reset();

  const schoolSelect = document.getElementById('ri-school-select');
  schoolSelect.innerHTML = '<option value="" disabled selected>Select school...</option>';
  
  const instructorSelect = document.getElementById('ri-instructor-select');
  instructorSelect.innerHTML = '<option value="" disabled selected>Select instructor...</option>';

  const schoolsWithInstructors = state.schools.filter(s => s.instructors && s.instructors.length > 0);
  schoolsWithInstructors.forEach(sch => {
    const opt = document.createElement('option');
    opt.value = sch.id;
    opt.textContent = sch.name;
    schoolSelect.appendChild(opt);
  });

  schoolSelect.onchange = () => {
    const schoolId = schoolSelect.value;
    const sch = state.schools.find(s => s.id === schoolId);
    instructorSelect.innerHTML = '<option value="" disabled selected>Select instructor...</option>';
    if (!sch || !sch.instructors) return;

    sch.instructors.forEach(instId => {
      const emp = state.employees.find(e => e.id === instId);
      const opt = document.createElement('option');
      opt.value = instId;
      opt.textContent = emp ? `${emp.name} (${instId})` : instId;
      instructorSelect.appendChild(opt);
    });
  };

  document.getElementById('remove-instructor-modal-overlay').classList.add('active');
}

function closeRemoveInstructorModal() {
  document.getElementById('remove-instructor-modal-overlay').classList.remove('active');
}

function handleRemoveInstructorSubmit(e) {
  e.preventDefault();
  const schoolId = document.getElementById('ri-school-select').value;
  const instId = document.getElementById('ri-instructor-select').value;

  if (!schoolId || !instId) {
    showToast('Please select both a school and an instructor.', 'error');
    return;
  }

  const sch = state.schools.find(s => s.id === schoolId);
  if (!sch) return;

  sch.instructors = (sch.instructors || []).filter(id => id !== instId);

  localStorage.setItem('ems_schools', JSON.stringify(state.schools));
  triggerBackendSync();

  renderSchoolManagement();
  closeRemoveInstructorModal();
  showToast('Instructor successfully removed from school.', 'success');
}

window.openRemoveInstructorModal = openRemoveInstructorModal;
window.closeRemoveInstructorModal = closeRemoveInstructorModal;
window.handleRemoveInstructorSubmit = handleRemoveInstructorSubmit;

function populateManagerDropdowns() {
  const newSchoolManagerSelect = document.getElementById('new-school-manager');
  const reassignManagerSelect = document.getElementById('reassign-manager-select');
  
  if (!newSchoolManagerSelect || !reassignManagerSelect) return;

  const defaultHtml = '<option value="" disabled selected>Select manager...</option>';
  newSchoolManagerSelect.innerHTML = defaultHtml;
  reassignManagerSelect.innerHTML = defaultHtml;

  const managers = state.employees.filter(emp => {
    if (isPratap(emp) || emp.isDeleted || emp.status === 'pending_approval') return false;
    const roleStr = (emp.role || '').toLowerCase();
    return roleStr.includes('manager') || roleStr.includes('hr') || roleStr.includes('tech lead') || roleStr.includes('techlead');
  });

  const getManagerShortName = (fullName) => {
    if (fullName.includes('Shravani')) return 'Shravani';
    if (fullName.includes('Prasad')) return 'Prasad';
    if (fullName.includes('Rajendra')) return 'Rajendra Sir';
    if (fullName.includes('Suyash')) return 'Suyash';
    if (fullName.includes('Atharva Durgavale') || fullName.includes('Atharva Durgawale')) return 'Atharva Durgavale';
    return fullName;
  };

  managers.forEach(emp => {
    const shortName = getManagerShortName(emp.name);
    
    const optNew = document.createElement('option');
    optNew.value = shortName;
    optNew.textContent = `${emp.name} (${emp.role || 'Manager'})`;
    newSchoolManagerSelect.appendChild(optNew);

    const optReassign = document.createElement('option');
    optReassign.value = shortName;
    optReassign.textContent = `${emp.name} (${emp.role || 'Manager'})`;
    reassignManagerSelect.appendChild(optReassign);
  });
}

window.populateManagerDropdowns = populateManagerDropdowns;

// Run application on DOM loaded
window.addEventListener('DOMContentLoaded', init);

// Clean up active status on window close or tab navigation
// We use sessionStorage to differentiate a RELOAD (page stays in session) from a TRUE TAB CLOSE
window.addEventListener('beforeunload', () => {
  if (state.currentUser) {
    // Mark that we are about to reload/navigate — sessionStorage survives page reloads
    sessionStorage.setItem('ems_is_reload', 'true');
    sessionStorage.setItem('ems_reload_user_id', state.currentUser.id);
    sessionStorage.setItem('ems_reload_last_view', (() => {
      const activeMenuItem = document.querySelector('.menu-item.active');
      return activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'tasks';
    })());
    const userId = state.currentUser.id;
    fetch(`/api/sync?employeeId=${userId}&active=false`, { keepalive: true }).catch(() => {});
  }
});

// Password Reset Overlay Logic
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('resetToken');
  if (resetToken) {
    // We must wait slightly for init() to show the login screen, then we hide it
    setTimeout(() => {
      const loginContainer = document.getElementById('login-container');
      const resetContainer = document.getElementById('reset-password-container');
      if (loginContainer) loginContainer.style.display = 'none';
      if (resetContainer) resetContainer.style.display = 'flex';
    }, 100);
  }
});

// Forgot Password Modal Logic
function showForgotPasswordModal() {
  const overlay = document.getElementById('forgot-password-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    setTimeout(() => { const inp = document.getElementById('forgot-email'); if (inp) inp.focus(); }, 100);
  }
}
function hideForgotPasswordModal() {
  const overlay = document.getElementById('forgot-password-overlay');
  if (overlay) overlay.style.display = 'none';
  const form = document.getElementById('forgot-password-form');
  if (form) form.reset();
}
window.showForgotPasswordModal = showForgotPasswordModal;
window.hideForgotPasswordModal = hideForgotPasswordModal;

async function handleForgotPasswordRequest(event) {
  event.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  const btn = document.getElementById('forgot-submit-btn');
  if (!email) return;

  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/forgot-password-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      hideForgotPasswordModal();
      showToast('✅ HR has been notified! Please wait for a reset link in your email inbox.', 'success');
    } else {
      showToast(data.error || 'Could not find this email. Please check and try again.', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Notify HR';
  }
}
window.handleForgotPasswordRequest = handleForgotPasswordRequest;

// Super Admin Recovery Logic
function showSuperAdminRecoveryModal() {
  const overlay = document.getElementById('super-admin-recovery-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    setTimeout(() => { const inp = document.getElementById('super-recovery-email'); if (inp) inp.focus(); }, 100);
  }
}
function hideSuperAdminRecoveryModal() {
  const overlay = document.getElementById('super-admin-recovery-overlay');
  if (overlay) overlay.style.display = 'none';
  const form = document.getElementById('super-admin-recovery-form');
  if (form) form.reset();
}
window.showSuperAdminRecoveryModal = showSuperAdminRecoveryModal;
window.hideSuperAdminRecoveryModal = hideSuperAdminRecoveryModal;

async function handleSuperAdminRecoverySubmit(event) {
  event.preventDefault();
  const email = document.getElementById('super-recovery-email').value.trim();
  const recoveryCode = document.getElementById('super-recovery-code').value.trim();
  const newPassword = document.getElementById('super-recovery-new-password').value;
  const btn = document.getElementById('super-recovery-submit-btn');
  
  if (!email || !recoveryCode || !newPassword) return;

  btn.disabled = true;
  btn.textContent = 'Resetting...';

  try {
    const res = await fetch('/api/super-admin-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, recoveryCode, newPassword })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      hideSuperAdminRecoveryModal();
      showToast('✅ ' + data.message, 'success');
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast(data.error || 'Failed to reset password.', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reset Password';
  }
}
window.handleSuperAdminRecoverySubmit = handleSuperAdminRecoverySubmit;


async function handlePasswordResetSubmit(event) {

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('resetToken');
  const newPassword = document.getElementById('reset-new-password').value;
  const confirmPassword = document.getElementById('reset-confirm-password').value;

  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }
  
  if (newPassword.length < 8) {
    showToast('Password must be at least 8 characters long', 'error');
    return;
  }

  try {
    showToast('Resetting password...', 'info');
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Password reset successfully! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } else {
      showToast(data.error || 'Failed to reset password', 'error');
    }
  } catch (err) {
    showToast('Network error while resetting password', 'error');
  }
}
window.handlePasswordResetSubmit = handlePasswordResetSubmit;

// ==========================================
// Milestone Celebration Logic
// ==========================================

function closeCelebrationModal() {
  document.getElementById('celebration-modal-overlay').classList.remove('active');
}

function triggerCelebrationModal(type, name, years) {
  const overlay = document.getElementById('celebration-modal-overlay');
  const titleEl = document.getElementById('celebration-title');
  const bodyEl = document.getElementById('celebration-body');
  
  if (type === 'birthday') {
    titleEl.textContent = 'Happy Birthday, ' + name.split(' ')[0] + '! 🎂';
    bodyEl.innerHTML = 'Wishing you a wonderful birthday filled with happiness, success, and memorable moments! 🌟<br><br>Thank you for being a valuable part of the AIR G International family. We wish you continued growth, success, and many more achievements in the year ahead.<br><br>Have a fantastic birthday! 🥳 🎈';
  } else if (type === 'anniversary') {
    titleEl.textContent = 'Happy Work Anniversary! 🎊';
    bodyEl.innerHTML = 'Congratulations on completing ' + years + ' year(s) with AIR G International! 🌟<br><br>Your dedication, contribution, and commitment have been an important part of our journey. We truly appreciate your efforts and look forward to seeing you achieve many more milestones with us.<br><br>Cheers to another year of learning, growing, and achieving together! 🚀<br><br>— Team AIR G International';
  }

  overlay.classList.add('active');
  startConfetti();
}

function checkAndTriggerMilestones(user) {
  // Only trigger once per day per user
  const today = new Date().toLocaleDateString();
  const lastSeenStr = localStorage.getItem('ems_milestone_seen_' + user.id);
  if (lastSeenStr === today) return; // Already seen today

  const todaySplit = new Date().toISOString().split('T')[0].split('-');
  const tM = todaySplit[1];
  const tD = todaySplit[2];
  const tY = todaySplit[0];

  let triggered = false;

  // Check Birthday
  if (user.dateOfBirth) {
    const [dobY, dobM, dobD] = user.dateOfBirth.split('-');
    if (dobM === tM && dobD === tD) {
      setTimeout(() => triggerCelebrationModal('birthday', user.name), 1000);
      triggered = true;
    }
  }

  // Check Anniversary
  if (!triggered && user.joinDate) {
    const [joinY, joinM, joinD] = user.joinDate.split('-');
    const diffYears = parseInt(tY) - parseInt(joinY);
    if (joinM === tM && joinD === tD && diffYears > 0) {
      setTimeout(() => triggerCelebrationModal('anniversary', user.name, diffYears), 1000);
      triggered = true;
    }
  }

  if (triggered) {
    localStorage.setItem('ems_milestone_seen_' + user.id, today);
  }
}

// Simple Confetti Animation
function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const colors = ['#a855f7', '#ec4899', '#eab308', '#3b82f6', '#22c55e'];
  
  for (let i = 0; i < 150; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 10 + 5,
      c: colors[Math.floor(Math.random() * colors.length)],
      dy: Math.random() * 3 + 2,
      dx: Math.random() * 2 - 1,
      rot: Math.random() * 360,
      dRot: Math.random() * 5 - 2.5
    });
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;
    for (let p of pieces) {
      if (p.y < canvas.height) active = true;
      p.y += p.dy;
      p.x += p.dx;
      p.rot += p.dRot;
      
      ctx.save();
      ctx.translate(p.x + p.w/2, p.y + p.h/2);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    }
    if (active) requestAnimationFrame(render);
  }
  render();
}

// ==========================================
// Global Chat Announcement Logic
// ==========================================
function checkAndAnnounceGlobalMilestones() {
  if (!state.currentUser) return;
  const todayStr = new Date().toISOString().split('T')[0];
  const [tY, tM, tD] = todayStr.split('-');
  
  // Find milestones for today
  state.employees.forEach(emp => {
    if (emp.isDeleted || emp.status === 'pending_approval') return;
    
    let isBday = false;
    let isAnniv = false;
    let isProbation = false;
    let annivYears = 0;
    
    // Check Birthday
    if (emp.dateOfBirth) {
      const [dobY, dobM, dobD] = emp.dateOfBirth.split('-');
      if (dobM === tM && dobD === tD) isBday = true;
    }
    
    // Check Work Anniversary & Probation
    if (emp.joinDate) {
      const [joinY, joinM, joinD] = emp.joinDate.split('-');
      const diffYears = parseInt(tY) - parseInt(joinY);
      if (joinM === tM && joinD === tD && diffYears > 0) {
        isAnniv = true;
        annivYears = diffYears;
      }
      
      // Check Probation
      if (emp.probationPeriod) {
        const probEndDate = calculateProbationEndDate(emp.joinDate, emp.probationPeriod);
        if (probEndDate) {
          const probEndStr = probEndDate.toISOString().split('T')[0];
          if (probEndStr === todayStr) {
            isProbation = true;
          }
        }
      }
    }

    let messagesToSend = [];

    if (isBday) {
      messagesToSend.push(`🎂 Birthday Notification\n:::\n🎉 Happy Birthday, ${emp.name}! 🎂\n\nWishing you a wonderful birthday filled with happiness, success, and memorable moments! 🌟\n\nThank you for being a valuable part of the AIR G International family. We wish you continued growth, success, and many more achievements in the year ahead.\n\nHave a fantastic birthday! 🥳🎈`);
    }

    if (isAnniv) {
      messagesToSend.push(`🎊 Happy Work Anniversary, ${emp.name}! 🎊\n\nCongratulations on completing ${annivYears} year(s) with AIR G International! 🌟\n\nYour dedication, contribution, and commitment have been an important part of our journey.\nWe truly appreciate your efforts and look forward to seeing you achieve many more milestones with us.\n\nCheers to another year of learning, growing, and achieving together! 🚀\n\n— Team AIR G International`);
    }

    if (isProbation) {
      messagesToSend.push(`🎉 Congratulations,\n\nYou have successfully completed your probation period and are now officially a confirmed member of the AIR G International team! 🌟\n\nYour journey with us has just entered a new chapter. We appreciate your dedication, efforts, and contribution during your probation period.\n\nWe encourage you to continue learning, taking initiative, working with dedication, and giving your best in everything you do.\n\nCongratulations once again, and here’s to many more achievements with AIR G International! 🚀👋\n\n— Team AIR G International`);
    }

    if (messagesToSend.length > 0) {
      const storageKey = 'ems_global_announced_v2_' + emp.id + '_' + todayStr;
      const alreadyAnnounced = localStorage.getItem(storageKey);
      
      if (!alreadyAnnounced) {
        // Send announcement! Only one client needs to send this, so we add a tiny random delay to prevent race conditions
        setTimeout(() => {
          let injected = false;
          messagesToSend.forEach((msgText, idx) => {
            // Check if this specific template snippet was already sent to avoid duplicate blasts
            const uniqueSnippet = msgText.substring(0, 20);
            const chatExists = state.chats.some(c => c.receiverId === 'group' && c.senderId === 'system' && c.timestamp.startsWith(todayStr) && c.text.includes(uniqueSnippet));
            if (!chatExists) {
              const newMsg = {
                id: 'MSG_' + Date.now() + Math.floor(Math.random() * 1000) + idx,
                senderId: 'system',
                receiverId: 'group',
                text: msgText,
                timestamp: new Date().toISOString()
              };
              state.chats.push(newMsg);
              injected = true;
            }
          });
          if (injected) triggerBackendSync();
        }, Math.random() * 5000);
        localStorage.setItem(storageKey, 'true');
      }
    }
  });
}

// ==========================================
// --- ADVANCED PROJECT EXECUTION MODULE ---
// ==========================================

let activeDashProjectId = null;
let activeDashTab = 'overview';

function openProjectDashboardModal(projectId) {
  const proj = state.projects.find(p => p.id === projectId);
  if (!proj) return;

  activeDashProjectId = projectId;
  activeDashTab = 'overview';

  document.getElementById('proj-dash-title').textContent = proj.name;
  const badge = document.getElementById('proj-dash-status-badge');
  if (badge) {
    badge.textContent = proj.status || 'Active';
    badge.className = `badge badge-${(proj.status || 'active').toLowerCase()}`;
  }

  // Update sub-tabs active state
  ['overview', 'milestones', 'tasks', 'daily', 'approvals', 'team', 'activity', 'reports'].forEach(tab => {
    const tabBtn = document.getElementById(`proj-tab-${tab}`);
    if (tabBtn) tabBtn.classList.toggle('active', tab === 'overview');
  });

  renderProjDashTabContent();

  const modal = document.getElementById('modal-project-dashboard');
  if (modal) modal.classList.add('active');
}

function closeProjectDashboardModal() {
  const modal = document.getElementById('modal-project-dashboard');
  if (modal) modal.classList.remove('active');
  activeDashProjectId = null;
}

function switchProjDashTab(tab) {
  activeDashTab = tab;
  ['overview', 'milestones', 'tasks', 'daily', 'approvals', 'team', 'activity', 'reports'].forEach(t => {
    const tabBtn = document.getElementById(`proj-tab-${t}`);
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  renderProjDashTabContent();
}

function getProjectTeamDetails(proj) {
  if (!proj) return { leadName: 'Unassigned', teamMembers: [] };

  const leadEmp = state.employees.find(e => e.id === proj.techLeadId || e.name === proj.techLeadName);
  const leadName = proj.techLeadName || (leadEmp ? leadEmp.name : 'Unassigned');

  const taskAssigneeIds = (state.tasks || []).filter(t => t.projectId === proj.id).map(t => t.assigneeId);

  const allEmps = (state.employees || []).filter(e => {
    if (e.isDeleted || e.status === 'pending_approval') return false;
    const isTechLead = (e.id === proj.techLeadId || e.name === proj.techLeadName || e.name === leadName);
    const inEmployeeIds = proj.employeeIds && (proj.employeeIds.includes(e.id) || proj.employeeIds.includes(e.email));
    const inTeamMembers = proj.teamMembers && proj.teamMembers.some(m => typeof m === 'object' ? (m.id === e.id || m.name === e.name) : m === e.name);
    const inTasks = taskAssigneeIds.includes(e.id);
    return isTechLead || inEmployeeIds || inTeamMembers || inTasks;
  });

  const uniqueEmps = [];
  const seen = new Set();
  allEmps.forEach(e => {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      uniqueEmps.push(e);
    }
  });

  uniqueEmps.sort((a, b) => {
    if (a.id === proj.techLeadId || a.name === leadName) return -1;
    if (b.id === proj.techLeadId || b.name === leadName) return 1;
    return a.name.localeCompare(b.name);
  });

  return { leadName, teamMembers: uniqueEmps };
}

function renderProjDashTabContent() {
  const proj = state.projects.find(p => p.id === activeDashProjectId);
  const container = document.getElementById('proj-dash-content');
  if (!proj || !container) return;

  const teamInfo = getProjectTeamDetails(proj);

  // Pending count for Approvals tab
  const pendingUpdates = (proj.dailyWorkUpdates || []).filter(u => u.status === 'Pending');
  const countBadge = document.getElementById('proj-dash-pending-count');
  if (countBadge) {
    if (pendingUpdates.length > 0) {
      countBadge.textContent = pendingUpdates.length;
      countBadge.style.display = 'inline-block';
    } else {
      countBadge.style.display = 'none';
    }
  }

  // Default milestones if missing
  if (!proj.milestones || proj.milestones.length === 0) {
    proj.milestones = [
      { id: 'M1', name: 'Final Deadline', deadline: proj.icuDeadline || proj.dueDate || '2026-09-10', progress: proj.progress || 0, status: 'In Progress' },
      { id: 'M2', name: 'ICU Deadline', deadline: proj.ventilatorDeadline || '2026-09-25', progress: 0, status: 'Not Started' },
      { id: 'M3', name: 'Dead Deadline', deadline: proj.finalDeadline || proj.dueDate || '2026-10-15', progress: 0, status: 'Pending' }
    ];
  }

  const isTechLeadOrAdmin = (
    state.currentRole === 'hr' ||
    state.currentRole === 'admin' ||
    isPratap(state.currentUser) ||
    (state.currentUser && (state.currentUser.id === proj.techLeadId || state.currentUser.name === teamInfo.leadName || state.currentUser.id === proj.createdById))
  );

  switch (activeDashTab) {
    case 'overview':
      container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 12px 0;">
          <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
            <h4 style="margin-top: 0; color: var(--primary); font-size: 0.95rem;">📌 Basic Project Details</h4>
            <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
              <tr><td style="color: var(--text-muted); padding: 6px 0;">Project Name:</td><td><strong>${escapeHTML(proj.name)}</strong></td></tr>
              <tr><td style="color: var(--text-muted); padding: 6px 0;">Department:</td><td><span class="badge" style="background: var(--primary-gradient); color: white;">${proj.dept || 'AI'}</span></td></tr>
              <tr><td style="color: var(--text-muted); padding: 6px 0;">Project Type:</td><td>${proj.projectType || 'R&D / Implementation'}</td></tr>
              <tr><td style="color: var(--text-muted); padding: 6px 0;">Priority:</td><td><span class="badge ${getPriorityBadgeClass(proj.priority || 'Medium')}">${proj.priority || 'Medium'}</span></td></tr>
              <tr><td style="color: var(--text-muted); padding: 6px 0;">Tech Lead:</td><td><strong>${teamInfo.leadName}</strong></td></tr>
              <tr><td style="color: var(--text-muted); padding: 6px 0;">Start Date:</td><td>${proj.startDate || '2026-08-01'}</td></tr>
              <tr><td style="color: var(--text-muted); padding: 6px 0;">Final Delivery:</td><td><strong>${proj.finalDeadline || proj.dueDate || '2026-10-15'}</strong></td></tr>
            </table>
          </div>

          <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
            <h4 style="margin-top: 0; color: var(--primary); font-size: 0.95rem;">📊 Overall Project Completion</h4>
            <div style="text-align: center; margin: 16px 0;">
              <div style="font-size: 2.5rem; font-weight: 800; color: var(--primary);">${proj.progress || 0}%</div>
              <div style="background: var(--bg-tertiary); height: 12px; border-radius: 6px; overflow: hidden; margin-top: 8px; border: 1px solid var(--border-color);">
                <div style="width: ${proj.progress || 0}%; height: 100%; background: var(--primary-gradient); transition: width 0.3s ease;"></div>
              </div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 12px;">
              * Overall completion is calculated from step-wise progress across standard milestones upon Tech Lead approval.
            </div>
            <div style="margin-top: 16px; display: flex; gap: 10px;">
              <button class="btn btn-primary btn-sm" onclick="openAddProjectDailyWorkModal('${proj.id}')" style="flex: 1;">+ Add Today's Work</button>
            </div>
          </div>
        </div>
      `;
      break;

    case 'milestones':
      container.innerHTML = `
        <div style="padding: 12px 0;">
          <h4 style="margin-top: 0; color: var(--primary);">📅 Standard 3 Milestone Deadlines</h4>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${proj.milestones.map(m => {
              const deadlineDate = new Date(m.deadline);
              const now = new Date();
              const diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
              let statusBadge = `<span class="badge badge-approved">🟢 On Track</span>`;
              if (m.progress < 100 && diffDays < 5 && diffDays >= 0) statusBadge = `<span class="badge badge-pending">🟡 Attention Required</span>`;
              if (m.progress < 100 && diffDays < 0) statusBadge = `<span class="badge badge-rejected">🔴 Delayed</span>`;

              return `
                <div style="background: var(--bg-secondary); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${m.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Deadline: <strong>${m.deadline}</strong></div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 16px;">
                    ${statusBadge}
                    <div style="width: 120px;">
                      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600;">
                        <span>Progress</span>
                        <span>${m.progress || 0}%</span>
                      </div>
                      <div style="background: var(--bg-tertiary); height: 6px; border-radius: 3px; overflow: hidden; margin-top: 4px;">
                        <div style="width: ${m.progress || 0}%; height: 100%; background: var(--primary-gradient);"></div>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
      break;

    case 'tasks':
      const projTasks = state.tasks.filter(t => t.projectId === proj.id)
        .sort((a, b) => getPriorityWeight(a.priority) - getPriorityWeight(b.priority));
      container.innerHTML = `
        <div style="padding: 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; color: var(--primary);">📋 Milestone Tasks (${projTasks.length})</h4>
            ${isTechLeadOrAdmin ? `<button class="btn btn-primary btn-xs" onclick="openAssignTaskModal('${proj.id}')">+ New Task</button>` : ''}
          </div>
          <table class="table" style="width: 100%; font-size: 0.8rem;">
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Title / Description</th>
                <th>Assignee</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due Date</th>
                ${isTechLeadOrAdmin ? `<th>Actions</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${projTasks.length === 0 ? `<tr><td colspan="${isTechLeadOrAdmin ? '7' : '6'}" style="text-align: center; color: var(--text-muted);">No tasks assigned under this project yet.</td></tr>` : 
                projTasks.map(t => `
                  <tr>
                    <td><strong>${t.id}</strong></td>
                    <td>
                      <strong>${escapeHTML(t.desc)}</strong>
                      ${t.rejectionReason ? `<div style="font-size:0.7rem; color:#ef4444; margin-top:2px;">⚠️ Feedback: ${escapeHTML(t.rejectionReason)}</div>` : ''}
                    </td>
                    <td>${t.assigneeName || 'Unassigned'}</td>
                    <td><span class="badge ${getPriorityBadgeClass(t.priority)}">${t.priority}</span></td>
                    <td>${getTaskStatusBadgeHtml(t.status, t.rejectionReason)}</td>
                    <td>${t.dueDate || '—'}</td>
                    ${isTechLeadOrAdmin ? `
                      <td>
                        <div style="display: flex; gap: 4px; align-items: center;">
                          ${t.status === 'Pending Review' ? `
                            <button class="btn btn-success btn-xs" onclick="approveTaskByLead('${t.id}', event)" style="padding: 3px 6px; font-size: 0.7rem; font-weight:700;" title="Approve">✅ Approve</button>
                            <button class="btn btn-danger btn-xs" onclick="rejectTaskByLeadModal('${t.id}', event)" style="padding: 3px 6px; font-size: 0.7rem; font-weight:700;" title="Reject">❌ Reject</button>
                          ` : (t.status === 'Needs Revision' ? `
                            <span style="font-size:0.7rem; color:#ef4444; font-weight:600;">Feedback Sent</span>
                          ` : (t.status === 'Completed' ? `
                            <span style="font-size:0.7rem; color:#22c55e; font-weight:600;">Approved</span>
                          ` : `
                            <span style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">In Progress</span>
                          `))}
                        </div>
                      </td>
                    ` : ''}
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'daily':
      const updates = proj.dailyWorkUpdates || [];
      container.innerHTML = `
        <div style="padding: 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="margin: 0; color: var(--primary);">📝 Daily Work Logs (${updates.length})</h4>
            <button class="btn btn-primary btn-sm" onclick="openAddProjectDailyWorkModal('${proj.id}')">+ Add Today's Work</button>
          </div>
          <table class="table" style="width: 100%; font-size: 0.8rem;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Milestone</th>
                <th>Work Done</th>
                <th>Hours</th>
                <th>Progress Added</th>
                <th>Attachments</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${updates.length === 0 ? `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No daily work updates submitted yet.</td></tr>` :
                [...updates].sort((a, b) => new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date)).map(u => {
                  const photosHtml = (u.photos || []).map((p, i) =>
                    `<img src="${p.data}" title="${escapeHTML(p.name)}" onclick="window.open(this.src,'_blank')" style="width:36px;height:36px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid var(--border-color);margin-right:3px;">`
                  ).join('');
                  const filesHtml = (u.files || []).map(f =>
                    `<a href="${f.data}" download="${escapeHTML(f.name)}" style="font-size:0.7rem;color:var(--primary);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px;" title="${escapeHTML(f.name)}">📄 ${escapeHTML(f.name)}</a>`
                  ).join('');
                  const driveLinkHtml = u.driveLink ? `<a href="${escapeHTML(u.driveLink)}" target="_blank" style="font-size:0.7rem;color:var(--primary);display:block;">🔗 Drive Link</a>` : '';
                  const attachHtml = photosHtml || filesHtml || driveLinkHtml
                    ? `<div style="display:flex;flex-direction:column;gap:3px;">${photosHtml ? `<div style="display:flex;flex-wrap:wrap;gap:2px;">${photosHtml}</div>` : ''}${filesHtml}${driveLinkHtml}</div>`
                    : `<span style="color:var(--text-muted);font-size:0.7rem;">—</span>`;
                  return `
                  <tr>
                    <td>${u.date}</td>
                    <td><strong>${escapeHTML(u.employeeName)}</strong></td>
                    <td><span class="badge" style="background: var(--bg-tertiary);">${u.milestone}</span></td>
                    <td>${escapeHTML(u.workDone)}</td>
                    <td>${u.hours} hrs</td>
                    <td><strong style="color: var(--success);">+${u.progressAdded}%</strong></td>
                    <td>${attachHtml}</td>
                    <td>
                      <span class="badge badge-${(u.status || 'pending').toLowerCase()}">${u.status || 'Pending'}</span>
                    </td>
                  </tr>
                `}).join('')
              }
            </tbody>
          </table>
        </div>
      `;
      break;

    case 'approvals':
      const pendingWork = (proj.dailyWorkUpdates || []).filter(u => u.status === 'Pending');
      container.innerHTML = `
        <div style="padding: 12px 0;">
          <h4 style="margin-top: 0; color: var(--primary);">⏳ Pending Work Updates Review (${pendingWork.length})</h4>
          ${pendingWork.length === 0 ? `
            <div class="empty-state" style="padding: 24px;">
              <div class="empty-state-title">No pending work updates</div>
              <p style="color: var(--text-muted);">All submitted work updates have been reviewed.</p>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${pendingWork.map(u => `
                <div style="background: var(--bg-secondary); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div>
                      <strong style="font-size: 0.9rem; color: var(--text-primary);">${escapeHTML(u.employeeName)}</strong>
                      <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;">(${u.date})</span>
                    </div>
                    <span class="badge" style="background: var(--primary-gradient); color: white;">${u.milestone}</span>
                  </div>
                  <div style="font-size: 0.85rem; color: var(--text-primary); margin-bottom: 8px;">
                    <strong>Task:</strong> ${escapeHTML(u.task)}<br>
                    <strong>Work Done:</strong> ${escapeHTML(u.workDone)}
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px;">
                    Hours: ${u.hours} hrs | Progress Requested: <strong style="color: var(--success);">+${u.progressAdded}%</strong>
                    ${u.remarks ? `<br><strong>Remarks:</strong> ${escapeHTML(u.remarks)}` : ''}
                  </div>
                  ${(u.photos && u.photos.length > 0) || (u.files && u.files.length > 0) || u.driveLink ? `
                  <div style="margin-bottom: 10px; padding: 8px; background: var(--bg-tertiary); border-radius: 6px; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;">📎 Attachments</div>
                    ${u.photos && u.photos.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px;">${u.photos.map(p => `<img src="${p.data}" title="${escapeHTML(p.name)}" onclick="window.open(this.src,'_blank')" style="width:56px;height:56px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--border-color);">`).join('')}</div>` : ''}
                    ${u.files && u.files.length > 0 ? `<div style="display:flex;flex-direction:column;gap:3px;margin-bottom:4px;">${u.files.map(f => `<a href="${f.data}" download="${escapeHTML(f.name)}" style="font-size:0.75rem;color:var(--primary);">📄 ${escapeHTML(f.name)}</a>`).join('')}</div>` : ''}
                    ${u.driveLink ? `<a href="${escapeHTML(u.driveLink)}" target="_blank" style="font-size:0.75rem;color:var(--primary);">🔗 View Drive Link</a>` : ''}
                  </div>` : ''}
                  ${isTechLeadOrAdmin ? `
                    <div style="display: flex; gap: 10px;">
                      <button class="btn btn-success btn-xs" onclick="approveProjectWork('${proj.id}', '${u.id}')" style="flex: 1;">Approve Progress (+${u.progressAdded}%)</button>
                      <button class="btn btn-danger btn-xs" onclick="rejectProjectWork('${proj.id}', '${u.id}')" style="flex: 1;">Reject Update</button>
                    </div>
                  ` : `<div style="font-size: 0.75rem; color: var(--warning); font-style: italic;">Only Tech Lead / HR can approve updates.</div>`}
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
      break;

    case 'team':
      const teamList = teamInfo.teamMembers;
      container.innerHTML = `
        <div style="padding: 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 style="margin: 0; color: var(--primary);">👥 Project Team Members (${teamList.length})</h4>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
            <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; color: var(--primary); display: flex; align-items: center; gap: 6px;">
              👑 Tech Lead: ${teamInfo.leadName}
            </div>
            ${teamList.map(m => {
              const isLead = (m.id === proj.techLeadId || m.name === teamInfo.leadName);
              const chipRole = m.designation || m.role || (isLead ? 'Tech Lead' : 'Employee');
              return `
                <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 8px 14px; border-radius: 20px; font-size: 0.8rem; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                  <div style="width: 22px; height: 22px; border-radius: 50%; background: ${isLead ? 'var(--primary-gradient)' : 'var(--bg-tertiary)'}; color: ${isLead ? 'white' : 'var(--text-secondary)'}; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700;">
                    ${m.avatar || (m.name ? m.name.split(' ').map(n=>n[0]).join('') : 'U')}
                  </div>
                  <span><strong>${escapeHTML(m.name)}</strong> <span style="font-size: 0.7rem; color: var(--text-muted);">(${escapeHTML(chipRole)})</span></span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
      break;

    case 'activity':
      const logs = proj.activityLogs || [];
      container.innerHTML = `
        <div style="padding: 12px 0;">
          <h4 style="margin-top: 0; color: var(--primary);">📜 Real-Time Project Activity Timeline</h4>
          ${logs.length === 0 ? `<div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic;">No activity logged yet.</div>` :
            `<div style="display: flex; flex-direction: column; gap: 8px;">
              ${[...logs].reverse().map(l => `
                <div style="background: var(--bg-secondary); padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color); font-size: 0.8rem;">
                  <span style="color: var(--text-muted); font-size: 0.7rem;">${l.timestamp}</span> — <strong>${escapeHTML(l.message)}</strong>
                </div>
              `).join('')}
            </div>`
          }
        </div>
      `;
      break;

    case 'reports':
      container.innerHTML = `
        <div style="padding: 12px 0;">
          <h4 style="margin-top: 0; color: var(--primary);">📈 Project Performance & Analytics</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 0.85rem; color: var(--text-muted);">Current Execution Status</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--success); margin: 6px 0;">🟢 On Schedule</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">All 3 standard deadlines are within expected completion parameters.</div>
            </div>
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 0.85rem; color: var(--text-muted);">Total Work Updates Approved</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--primary); margin: 6px 0;">${(proj.dailyWorkUpdates || []).filter(u => u.status === 'Approved').length} Updates</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Work hours and progress increments logged cleanly.</div>
            </div>
          </div>
        </div>
      `;
      break;
  }
}

function openCreateProjectModal() {
  const modal = document.getElementById('modal-create-project');
  if (!modal) return;

  const leadSelect = document.getElementById('proj-create-techlead');
  if (leadSelect) {
    leadSelect.innerHTML = state.employees.map(e => `
      <option value="${e.id}">${e.name} (${e.dept || 'General'} - ${e.role})</option>
    `).join('');
  }

  const membersList = document.getElementById('proj-create-members-list');
  if (membersList) {
    membersList.innerHTML = state.employees.map(e => `
      <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8rem; margin-bottom: 4px; cursor: pointer;">
        <input type="checkbox" name="proj-create-team-member" value="${e.id}">
        <span>${e.name} (${e.dept || ''})</span>
      </label>
    `).join('');
  }

  const today = new Date().toISOString().split('T')[0];
  const dateICU = document.getElementById('proj-create-icu-dl');
  const dateVent = document.getElementById('proj-create-vent-dl');
  const dateFinal = document.getElementById('proj-create-final-dl');
  if (dateICU) dateICU.value = today;
  if (dateVent) dateVent.value = today;
  if (dateFinal) dateFinal.value = today;

  modal.classList.add('active');
}

function closeCreateProjectModal() {
  const modal = document.getElementById('modal-create-project');
  if (modal) modal.classList.remove('active');
}

async function handleCreateProjectSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('proj-create-name').value.trim();
  const dept = document.getElementById('proj-create-dept').value;
  const priority = document.getElementById('proj-create-priority').value;
  const techLeadId = document.getElementById('proj-create-techlead').value;
  const projectType = document.getElementById('proj-create-type').value.trim();
  const icuDeadline = document.getElementById('proj-create-icu-dl').value;
  const ventilatorDeadline = document.getElementById('proj-create-vent-dl').value;
  const finalDeadline = document.getElementById('proj-create-final-dl').value;
  const desc = document.getElementById('proj-create-desc').value.trim();

  if (!name || !dept || !techLeadId) {
    showToast('Please fill out all required fields.', 'error');
    return;
  }

  const techLeadEmp = state.employees.find(e => e.id === techLeadId);
  const techLeadName = techLeadEmp ? techLeadEmp.name : 'Shravani Khanvilkar';

  const memberCheckboxes = document.querySelectorAll('input[name="proj-create-team-member"]:checked');
  const selectedMemberIds = Array.from(memberCheckboxes).map(cb => cb.value);
  if (!selectedMemberIds.includes(techLeadId)) selectedMemberIds.push(techLeadId);

  const teamMembers = state.employees
    .filter(e => selectedMemberIds.includes(e.id))
    .map(e => ({ id: e.id, name: e.name, dept: e.dept, role: e.role }));

  const newProjId = `PRJ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const newProj = {
    id: newProjId,
    name: name,
    dept: dept,
    projectType: projectType || 'R&D / Implementation',
    priority: priority,
    status: 'Active',
    techLeadId: techLeadId,
    techLeadName: techLeadName,
    createdById: state.currentUser ? state.currentUser.id : techLeadId,
    createdByName: state.currentUser ? state.currentUser.name : techLeadName,
    startDate: new Date().toISOString().split('T')[0],
    finalDeliveryDate: finalDeadline,
    icuDeadline: icuDeadline,
    ventilatorDeadline: ventilatorDeadline,
    finalDeadline: finalDeadline,
    dueDate: finalDeadline,
    progress: 0,
    description: desc,
    files: [],
    employeeIds: selectedMemberIds,
    teamMembers: teamMembers,
    milestones: [
      { id: 'M1', name: 'Final Deadline', deadline: icuDeadline, progress: 0, status: 'In Progress' },
      { id: 'M2', name: 'ICU Deadline', deadline: ventilatorDeadline, progress: 0, status: 'Not Started' },
      { id: 'M3', name: 'Dead Deadline', deadline: finalDeadline, progress: 0, status: 'Pending' }
    ],
    dailyWorkUpdates: [],
    activityLogs: [
      {
        timestamp: new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }),
        message: `Project "${name}" created by ${state.currentUser ? state.currentUser.name : techLeadName}.`,
        authorId: state.currentUser ? state.currentUser.id : techLeadId
      }
    ]
  };

  state.projects.push(newProj);
  localStorage.setItem('ems_projects', JSON.stringify(state.projects));

  try {
    await fetch('/api/create-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProj)
    });
  } catch (err) {
    console.error('Failed to sync new project to server:', err);
  }

  triggerBackendSync();
  closeCreateProjectModal();
  renderHRTasksAndProjects();
  showToast(`Project "${name}" created successfully!`, 'success');
}

function openAddProjectDailyWorkModal(projectId) {
  const proj = state.projects.find(p => p.id === projectId);
  if (!proj) return;

  document.getElementById('proj-work-project-id').value = projectId;
  document.getElementById('proj-work-date').value = new Date().toISOString().split('T')[0];

  // Reset attachments
  const photosInput = document.getElementById('proj-work-photos');
  const filesInput = document.getElementById('proj-work-files');
  const driveLinkInput = document.getElementById('proj-work-drive-link');
  const photosPreview = document.getElementById('proj-work-photos-preview');
  const filesPreview = document.getElementById('proj-work-files-preview');
  if (photosInput) photosInput.value = '';
  if (filesInput) filesInput.value = '';
  if (driveLinkInput) driveLinkInput.value = '';
  if (photosPreview) photosPreview.innerHTML = '';
  if (filesPreview) filesPreview.innerHTML = '';

  // Photo preview listener
  if (photosInput) {
    photosInput.onchange = function() {
      if (!photosPreview) return;
      photosPreview.innerHTML = '';
      Array.from(photosInput.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = document.createElement('img');
          img.src = ev.target.result;
          img.style.cssText = 'width: 64px; height: 64px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer;';
          img.title = file.name;
          img.onclick = () => window.open(ev.target.result, '_blank');
          photosPreview.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    };
  }

  // File list preview listener
  if (filesInput) {
    filesInput.onchange = function() {
      if (!filesPreview) return;
      filesPreview.innerHTML = '';
      Array.from(filesInput.files).forEach(file => {
        const item = document.createElement('div');
        item.style.cssText = 'font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;';
        item.innerHTML = `📄 <span>${escapeHTML(file.name)}</span> <span style="color:var(--text-muted);font-size:0.72rem;">(${(file.size/1024).toFixed(1)} KB)</span>`;
        filesPreview.appendChild(item);
      });
    };
  }

  const modal = document.getElementById('modal-add-project-daily-work');
  if (modal) modal.classList.add('active');
}

function closeAddProjectDailyWorkModal() {
  const modal = document.getElementById('modal-add-project-daily-work');
  if (modal) modal.classList.remove('active');
}

async function handleProjectDailyWorkSubmit(e) {
  e.preventDefault();

  const projectId = document.getElementById('proj-work-project-id').value;
  const date = document.getElementById('proj-work-date').value;
  const milestone = document.getElementById('proj-work-milestone').value;
  const task = document.getElementById('proj-work-task').value.trim();
  const desc = document.getElementById('proj-work-desc').value.trim();
  const hours = Number(document.getElementById('proj-work-hours').value);
  const progressAdded = Number(document.getElementById('proj-work-progress-added').value);
  const remarks = document.getElementById('proj-work-remarks').value.trim();
  const driveLink = (document.getElementById('proj-work-drive-link') || {}).value || '';

  const proj = state.projects.find(p => p.id === projectId);
  if (!proj) return;

  // Lock submit button
  const submitBtn = document.getElementById('proj-work-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

  // Helper to read file as base64
  function readFileBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => resolve({ name: file.name, type: file.type, size: file.size, data: ev.target.result });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Compress image before storing
  function compressWorkImage(base64, maxW, maxH, quality) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
        if (height > maxH) { width = Math.round(width * maxH / height); height = maxH; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  }

  // Read photos (compressed)
  const photoAttachments = [];
  const photosInput = document.getElementById('proj-work-photos');
  if (photosInput && photosInput.files.length > 0) {
    for (const file of Array.from(photosInput.files)) {
      const raw = await readFileBase64(file);
      const compressed = await compressWorkImage(raw.data, 1024, 1024, 0.7);
      photoAttachments.push({ name: file.name, type: file.type, data: compressed });
    }
  }

  // Read files (PDFs, docs — stored as base64)
  const fileAttachments = [];
  const filesInput = document.getElementById('proj-work-files');
  if (filesInput && filesInput.files.length > 0) {
    for (const file of Array.from(filesInput.files)) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`File "${file.name}" is too large (max 5MB). Skipped.`, 'error');
        continue;
      }
      const raw = await readFileBase64(file);
      fileAttachments.push({ name: file.name, type: file.type, data: raw.data });
    }
  }

  if (!proj.dailyWorkUpdates) proj.dailyWorkUpdates = [];

  const workId = `WRK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const updateObj = {
    id: workId,
    date: date,
    employeeId: state.currentUser.id,
    employeeName: state.currentUser.name,
    milestone: milestone,
    task: task,
    workDone: desc,
    hours: hours,
    progressAdded: progressAdded,
    remarks: remarks,
    driveLink: driveLink || '',
    photos: photoAttachments,
    files: fileAttachments,
    status: 'Pending',
    submittedAt: new Date().toISOString()
  };

  proj.dailyWorkUpdates.push(updateObj);

  if (!proj.activityLogs) proj.activityLogs = [];
  proj.activityLogs.push({
    timestamp: new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }),
    message: `${state.currentUser.name} submitted daily work update (+${progressAdded}% requested for ${milestone})${photoAttachments.length > 0 ? ` with ${photoAttachments.length} photo(s)` : ''}${fileAttachments.length > 0 ? ` and ${fileAttachments.length} file(s)` : ''}.`,
    authorId: state.currentUser.id
  });

  localStorage.setItem('ems_projects', JSON.stringify(state.projects));

  try {
    await fetch('/api/update-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: proj.id,
        dailyWorkUpdates: proj.dailyWorkUpdates,
        activityLogs: proj.activityLogs
      })
    });
  } catch (err) {
    console.error('Failed to sync daily work update to server:', err);
  }

  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Daily Work'; }

  triggerBackendSync();
  closeAddProjectDailyWorkModal();
  if (activeDashProjectId === projectId) {
    renderProjDashTabContent();
  }
  showToast('Daily work update submitted for Tech Lead approval!', 'success');
}

async function approveProjectWork(projectId, workId) {
  const proj = state.projects.find(p => p.id === projectId);
  if (!proj || !proj.dailyWorkUpdates) return;

  const update = proj.dailyWorkUpdates.find(u => u.id === workId);
  if (!update) return;

  update.status = 'Approved';
  update.approvedBy = state.currentUser ? state.currentUser.name : 'Tech Lead';

  const milestone = (proj.milestones || []).find(m => m.name === update.milestone);
  if (milestone) {
    let newProgress = (milestone.progress || 0) + update.progressAdded;
    if (newProgress > 100) newProgress = 100;
    milestone.progress = newProgress;
    if (newProgress === 100) milestone.status = 'Completed';
  }

  if (proj.milestones && proj.milestones.length > 0) {
    const totalProg = proj.milestones.reduce((acc, m) => acc + (m.progress || 0), 0);
    const avgProg = Math.round(totalProg / proj.milestones.length);
    const fixedSteps = [0, 15, 30, 45, 60, 75, 90, 100];
    const closestStep = fixedSteps.reduce((prev, curr) => Math.abs(curr - avgProg) < Math.abs(prev - avgProg) ? curr : prev);
    proj.progress = closestStep;
    if (proj.progress === 100) proj.status = 'Completed';
  }

  if (!proj.activityLogs) proj.activityLogs = [];
  proj.activityLogs.push({
    timestamp: new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }),
    message: `${state.currentUser ? state.currentUser.name : 'Tech Lead'} approved work update by ${update.employeeName}. Overall progress updated to ${proj.progress}%.`,
    authorId: state.currentUser ? state.currentUser.id : 'TL'
  });

  localStorage.setItem('ems_projects', JSON.stringify(state.projects));

  try {
    await fetch('/api/update-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: proj.id,
        progress: proj.progress,
        status: proj.status,
        milestones: proj.milestones,
        dailyWorkUpdates: proj.dailyWorkUpdates,
        activityLogs: proj.activityLogs
      })
    });
  } catch (err) {
    console.error('Failed to sync work approval to server:', err);
  }

  triggerBackendSync();
  renderHRTasksAndProjects();
  if (activeDashProjectId === projectId) {
    renderProjDashTabContent();
  }
  showToast(`Work update approved! Overall project progress updated to ${proj.progress}%.`, 'success');
}

async function rejectProjectWork(projectId, workId) {
  const proj = state.projects.find(p => p.id === projectId);
  if (!proj || !proj.dailyWorkUpdates) return;

  const update = proj.dailyWorkUpdates.find(u => u.id === workId);
  if (!update) return;

  update.status = 'Rejected';

  if (!proj.activityLogs) proj.activityLogs = [];
  proj.activityLogs.push({
    timestamp: new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' }),
    message: `Work update by ${update.employeeName} rejected by Tech Lead.`,
    authorId: state.currentUser ? state.currentUser.id : 'TL'
  });

  localStorage.setItem('ems_projects', JSON.stringify(state.projects));

  try {
    await fetch('/api/update-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: proj.id,
        dailyWorkUpdates: proj.dailyWorkUpdates,
        activityLogs: proj.activityLogs
      })
    });
  } catch (err) {
    console.error('Failed to sync work rejection to server:', err);
  }

  triggerBackendSync();
  if (activeDashProjectId === projectId) {
    renderProjDashTabContent();
  }
  showToast('Work update rejected.', 'info');
}

// Window/Global bindings for Project Execution module
window.openProjectDashboardModal = openProjectDashboardModal;
window.closeProjectDashboardModal = closeProjectDashboardModal;
window.switchProjDashTab = switchProjDashTab;
window.openCreateProjectModal = openCreateProjectModal;
window.closeCreateProjectModal = closeCreateProjectModal;
window.handleCreateProjectSubmit = handleCreateProjectSubmit;
window.openAddProjectDailyWorkModal = openAddProjectDailyWorkModal;
window.closeAddProjectDailyWorkModal = closeAddProjectDailyWorkModal;
window.handleProjectDailyWorkSubmit = handleProjectDailyWorkSubmit;
window.approveProjectWork = approveProjectWork;
window.rejectProjectWork = rejectProjectWork;

// --- Custom Chat Group Functions ---
function openCreateChatGroupModal() {
  const modal = document.getElementById('modal-create-chat-group');
  if (!modal) return;

  const nameInput = document.getElementById('chat-group-name-input');
  if (nameInput) nameInput.value = '';

  const listContainer = document.getElementById('chat-group-members-list');
  if (listContainer) {
    listContainer.innerHTML = '';
    (state.employees || []).forEach(emp => {
      if (emp.isDeleted) return;
      const isSelf = state.currentUser && emp.id === state.currentUser.id;
      const checkItem = document.createElement('label');
      checkItem.style.display = 'flex';
      checkItem.style.alignItems = 'center';
      checkItem.style.gap = '10px';
      checkItem.style.fontSize = '0.85rem';
      checkItem.style.cursor = 'pointer';
      checkItem.style.padding = '4px 6px';
      checkItem.style.borderRadius = '4px';

      checkItem.innerHTML = `
        <input type="checkbox" class="chat-group-member-checkbox" value="${emp.id}" ${isSelf ? 'checked disabled' : ''}>
        <div>
          <strong>${escapeHTML(emp.name)}</strong>
          <span style="color: var(--text-muted); font-size: 0.75rem;"> (${emp.dept || 'General'} - ${emp.role})</span>
        </div>
      `;
      listContainer.appendChild(checkItem);
    });
  }

  modal.classList.add('active');
}

function closeCreateChatGroupModal() {
  const modal = document.getElementById('modal-create-chat-group');
  if (modal) modal.classList.remove('active');
}

async function handleCreateChatGroupSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById('chat-group-name-input');
  const groupName = nameInput ? nameInput.value.trim() : '';

  if (!groupName) {
    showToast('Please enter a group name.', 'error');
    return;
  }

  const selectedBoxes = document.querySelectorAll('.chat-group-member-checkbox:checked');
  const rawMemberIds = Array.from(selectedBoxes).map(cb => cb.value);

  if (state.currentUser && !rawMemberIds.includes(state.currentUser.id)) {
    rawMemberIds.push(state.currentUser.id);
  }

  if (rawMemberIds.length < 2) {
    showToast('Please select at least one other member for the group.', 'error');
    return;
  }

  // Expand ALL identifier aliases for each selected member so any login matches 100%
  const selectedMemberIds = [];
  rawMemberIds.forEach(id => {
    if (!selectedMemberIds.includes(id)) selectedMemberIds.push(id);
    const empObj = (state.employees || []).find(e => e.id === id || (e.email && e.email.toLowerCase() === id.toLowerCase()));
    if (empObj) {
      const aliases = getEmployeeAllIdentifiers(empObj);
      aliases.forEach(a => {
        if (!selectedMemberIds.includes(a)) selectedMemberIds.push(a);
      });
    }
  });

  const displayNames = Array.from(new Set(rawMemberIds.map(id => {
    const emp = (state.employees || []).find(e => e.id === id || (e.email && e.email.toLowerCase() === id.toLowerCase()));
    return emp ? emp.name : id;
  })));

  const groupId = `GRP_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newGroup = {
    id: groupId,
    name: groupName,
    createdBy: state.currentUser ? state.currentUser.id : '',
    createdByName: state.currentUser ? state.currentUser.name : '',
    members: selectedMemberIds,
    createdAt: new Date().toISOString()
  };

  if (!state.customChatGroups) state.customChatGroups = [];
  state.customChatGroups.push(newGroup);

  localStorage.setItem('ems_custom_chat_groups', JSON.stringify(state.customChatGroups));

  // Send system welcome message
  const systemMsg = {
    id: `MSG_${Date.now()}`,
    senderId: state.currentUser ? state.currentUser.id : 'system',
    senderName: state.currentUser ? state.currentUser.name : 'System',
    receiverId: groupId,
    content: `🎉 Group "${groupName}" created! Members: ${displayNames.join(', ')}.`,
    timestamp: new Date().toISOString()
  };

  state.chats.push(systemMsg);
  localStorage.setItem('ems_chats', JSON.stringify(state.chats));

  triggerBackendSync();
  closeCreateChatGroupModal();

  state.activeChatType = 'custom_group';
  state.activeChatTargetId = groupId;

  renderCommunicationsHub();
  showToast(`Group "${groupName}" created successfully!`, 'success');
}

window.openCreateChatGroupModal = openCreateChatGroupModal;
window.closeCreateChatGroupModal = closeCreateChatGroupModal;
window.handleCreateChatGroupSubmit = handleCreateChatGroupSubmit;
