// EMS Leave Portal - Application Logic

window.onerror = function(message, source, lineno, colno, error) {
  // Try using showToast, fallback to alert
  try {
    showToast(`Runtime Error: ${message} at line ${lineno}`, 'error');
  } catch (e) {
    alert(`Runtime Error: ${message} at line ${lineno}`);
  }
  return false;
};

// --- Central Database Sync Layer ---
const originalSetItem = localStorage.setItem;
let isSyncingToServer = false;
let syncTimeout = null;

localStorage.setItem = function(key, value) {
  originalSetItem.call(localStorage, key, value);
  if (key.startsWith('ems_') && key !== 'ems_logged_in_user' && key !== 'ems_theme' && !key.startsWith('ems_read_')) {
    triggerBackendSync();
  }
};

function triggerBackendSync() {
  if (isSyncingToServer) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  
  syncTimeout = setTimeout(() => {
    const cleanState = {
      employees: JSON.parse(localStorage.getItem('ems_employees') || '[]'),
      requests: JSON.parse(localStorage.getItem('ems_requests') || '[]'),
      projects: JSON.parse(localStorage.getItem('ems_projects') || '[]'),
      tasks: JSON.parse(localStorage.getItem('ems_tasks') || '[]'),
      departments: JSON.parse(localStorage.getItem('ems_departments') || '[]'),
      chats: JSON.parse(localStorage.getItem('ems_chats') || '[]'),
      dailyReports: JSON.parse(localStorage.getItem('ems_reports') || '[]'),
      announcements: JSON.parse(localStorage.getItem('ems_announcements') || '[]'),
      notices: JSON.parse(localStorage.getItem('ems_notices') || '[]'),
      reimbursements: JSON.parse(localStorage.getItem('ems_reimbursements') || '[]'),
      tickets: JSON.parse(localStorage.getItem('ems_tickets') || '[]'),
      nationalHolidays: JSON.parse(localStorage.getItem('ems_national_holidays') || '[]'),
      celebrationDays: JSON.parse(localStorage.getItem('ems_celebration_days') || '[]'),
      smsNotifications: JSON.parse(localStorage.getItem('ems_notifications') || '[]')
    };

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanState)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        state.lastSyncedTimestamp = data.timestamp;
      }
    })
    .catch(err => {
      console.error('Failed to sync to database server:', err);
    });
  }, 300);
}

async function fetchCentralizedState() {
  try {
    const res = await fetch('/api/sync');
    const data = await res.json();
    
    if (data && data.state && !data.empty) {
      isSyncingToServer = true;
      const s = data.state;
      if (s.employees) originalSetItem.call(localStorage, 'ems_employees', JSON.stringify(s.employees));
      if (s.requests) originalSetItem.call(localStorage, 'ems_requests', JSON.stringify(s.requests));
      if (s.projects) originalSetItem.call(localStorage, 'ems_projects', JSON.stringify(s.projects));
      if (s.tasks) originalSetItem.call(localStorage, 'ems_tasks', JSON.stringify(s.tasks));
      if (s.departments) originalSetItem.call(localStorage, 'ems_departments', JSON.stringify(s.departments));
      if (s.chats) originalSetItem.call(localStorage, 'ems_chats', JSON.stringify(s.chats));
      if (s.dailyReports) originalSetItem.call(localStorage, 'ems_reports', JSON.stringify(s.dailyReports));
      if (s.announcements) originalSetItem.call(localStorage, 'ems_announcements', JSON.stringify(s.announcements));
      if (s.notices) originalSetItem.call(localStorage, 'ems_notices', JSON.stringify(s.notices));
      if (s.reimbursements) originalSetItem.call(localStorage, 'ems_reimbursements', JSON.stringify(s.reimbursements));
      if (s.tickets) originalSetItem.call(localStorage, 'ems_tickets', JSON.stringify(s.tickets));
      if (s.nationalHolidays) originalSetItem.call(localStorage, 'ems_national_holidays', JSON.stringify(s.nationalHolidays));
      if (s.celebrationDays) originalSetItem.call(localStorage, 'ems_celebration_days', JSON.stringify(s.celebrationDays));
      if (s.smsNotifications) originalSetItem.call(localStorage, 'ems_notifications', JSON.stringify(s.smsNotifications));
      
      state.lastSyncedTimestamp = data.timestamp;
      isSyncingToServer = false;
    }
  } catch (err) {
    console.error('Failed to load state from database server:', err);
  }
}

function initSyncPolling() {
  setInterval(async () => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }
    const openModals = document.querySelectorAll('.modal-overlay.active');
    if (openModals.length > 0) {
      return;
    }

    try {
      const res = await fetch('/api/sync');
      const data = await res.json();
      
      if (data && data.state && !data.empty && data.timestamp !== state.lastSyncedTimestamp) {
        isSyncingToServer = true;
        const s = data.state;
        state.employees = s.employees || state.employees;
        state.requests = s.requests || state.requests;
        state.projects = s.projects || state.projects;
        state.tasks = s.tasks || state.tasks;
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
        
        state.lastSyncedTimestamp = data.timestamp;
        
        if (s.employees) originalSetItem.call(localStorage, 'ems_employees', JSON.stringify(s.employees));
        if (s.requests) originalSetItem.call(localStorage, 'ems_requests', JSON.stringify(s.requests));
        if (s.projects) originalSetItem.call(localStorage, 'ems_projects', JSON.stringify(s.projects));
        if (s.tasks) originalSetItem.call(localStorage, 'ems_tasks', JSON.stringify(s.tasks));
        if (s.departments) originalSetItem.call(localStorage, 'ems_departments', JSON.stringify(s.departments));
        if (s.chats) originalSetItem.call(localStorage, 'ems_chats', JSON.stringify(s.chats));
        if (s.dailyReports) originalSetItem.call(localStorage, 'ems_reports', JSON.stringify(s.dailyReports));
        if (s.announcements) originalSetItem.call(localStorage, 'ems_announcements', JSON.stringify(s.announcements));
        if (s.notices) originalSetItem.call(localStorage, 'ems_notices', JSON.stringify(s.notices));
        if (s.reimbursements) originalSetItem.call(localStorage, 'ems_reimbursements', JSON.stringify(s.reimbursements));
        if (s.tickets) originalSetItem.call(localStorage, 'ems_tickets', JSON.stringify(s.tickets));
        if (s.nationalHolidays) originalSetItem.call(localStorage, 'ems_national_holidays', JSON.stringify(s.nationalHolidays));
        if (s.celebrationDays) originalSetItem.call(localStorage, 'ems_celebration_days', JSON.stringify(s.celebrationDays));
        if (s.smsNotifications) originalSetItem.call(localStorage, 'ems_notifications', JSON.stringify(s.smsNotifications));
        
        isSyncingToServer = false;
        
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
          renderDailyReports();
        } else {
          renderEmployeeDashboard(currentView);
        }
        updateCommMenuBadges();
      }
    } catch (err) {
      console.error('Polling sync failed:', err);
    }
  }, 5000);
}


// --- Constants & Seed Data ---
const DEFAULT_EMPLOYEES = [
  { id: 'EMP011', name: 'Richard Boss', dept: 'Administration', email: 'admin@company.com', role: 'Admin', balance: 20, absent: 0, avatar: 'RB', aadhar: '1111 2222 3333', pan: 'ADMIR1111B', bankAcc: '1234567890', bankIfsc: 'ICIC0000456 (ICICI)', password: 'password123', phone: '+91 87654 01235' }
];

const DEFAULT_REQUESTS = [];

const DEFAULT_PROJECTS = [];

const DEFAULT_TASKS = [];
const DEFAULT_DEPARTMENTS = ['Administration'];

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
let currentUploadedEmployeePhoto = null;
let currentUploadedAadharFile = null;
let currentUploadedPanFile = null;
let currentUploadedBankAccFile = null;
let currentUploadedBankIfscFile = null;

const DEFAULT_REPORTS = [];

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
  announcements: [],
  notices: [],
  activeCommTab: 'chats', // 'chats', 'announcements', 'notices'
  activeChatType: 'group', // 'group' or 'direct'
  activeChatTargetId: null, // employeeId for direct messages

  // Calendar State
  nationalHolidays: [],
  celebrationDays: [],
  calendarYear: 2026,
  calendarMonth: 5, // June (0-indexed)
  expandedTaskIds: new Set(),
  editingTaskId: null,
  editingTaskImages: [],
  dailyReports: [],
  expandedReportIds: new Set(),
  editingReportId: null,
  expandedEmployeeIds: new Set()
};

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
        const reader = new FileReader();
        reader.onload = function (event) {
          const base64Data = event.target.result;
          const fileObj = {
            name: blob.name || 'Pasted File',
            type: blob.type,
            data: base64Data
          };
          fileListArray.push(fileObj);
          renderAttachmentPreview(fileObj, previewContainer, fileListArray);
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
      const reader = new FileReader();
      reader.onload = function (event) {
        const base64Data = event.target.result;
        const fileObj = {
          name: file.name,
          type: file.type,
          data: base64Data
        };
        fileListArray.push(fileObj);
        renderAttachmentPreview(fileObj, previewContainer, fileListArray);
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

function renderAttachmentsHTML(attachments, itemId) {
  if (!attachments || attachments.length === 0) return '';
  
  return `
    <div class="attachment-list" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px;">
      ${attachments.map((file, idx) => {
        const isString = typeof file === 'string';
        const data = isString ? file : file.data;
        const name = isString ? 'Image' : file.name;
        const type = isString ? 'image/png' : (file.type || '');
        
        if (type.startsWith('image/')) {
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

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
}

function cancelEditTask(event) {
  if (event) event.stopPropagation();
  state.editingTaskId = null;
  state.editingTaskImages = [];

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin') {
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

  const textarea = document.getElementById(`edit-details-textarea-${taskId}`);
  if (textarea) {
    task.details = textarea.value.trim();
  }
  task.images = [...state.editingTaskImages];

  if (!safeSaveTasks()) {
    task.details = prevDetails;
    task.images = prevImages;
    return;
  }

  state.editingTaskId = null;
  state.editingTaskImages = [];

  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
  showToast('Task details updated successfully.', 'success');
}

function setupEditTaskListeners(taskId) {
  const textarea = document.getElementById(`edit-details-textarea-${taskId}`);
  const fileInput = document.getElementById(`edit-images-input-${taskId}`);
  const previewContainer = document.getElementById(`edit-images-preview-${taskId}`);

  if (!textarea || !fileInput || !previewContainer) return;

  renderEditPreviews(taskId);

  textarea.addEventListener('paste', function (e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let index in items) {
      const item = items[index];
      if (item.kind === 'file' && item.type.indexOf('image/') !== -1) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = function (event) {
          const base64Data = event.target.result;
          state.editingTaskImages.push(base64Data);
          renderEditPreviews(taskId);
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
          state.editingTaskImages.push(base64Data);
          renderEditPreviews(taskId);
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
    img.src = imgBase64;
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


// --- Storage & Image Compression Utilities ---
function cleanBloatedEmployees(employees) {
  if (!Array.isArray(employees)) return { employees: [], changed: false };
  let changed = false;
  employees.forEach(emp => {
    // If photo is a base64 string longer than 25KB, remove it
    if (emp.photo && emp.photo.length > 25000) {
      emp.photo = null;
      changed = true;
    }
    // If Aadhar is a base64 string longer than 25KB, remove it
    if (emp.aadhar && emp.aadhar.length > 25000) {
      emp.aadhar = '';
      changed = true;
    }
    // If PAN is a base64 string longer than 25KB, remove it
    if (emp.pan && emp.pan.length > 25000) {
      emp.pan = '';
      changed = true;
    }
  });
  return { employees, changed };
}

function compressImage(dataUrl, maxWidth, maxHeight, quality, callback) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    callback(dataUrl);
    return;
  }

  const img = new Image();
  img.onload = function() {
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
  img.onerror = function() {
    callback(dataUrl);
  };
  img.src = dataUrl;
}


// --- Initialization ---
async function init() {
  await fetchCentralizedState();
  // Load or seed data
  if (!localStorage.getItem('ems_employees')) {
    localStorage.setItem('ems_employees', JSON.stringify(DEFAULT_EMPLOYEES));
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

    if (!stored || stored.length === 0 || !stored[0].aadhar || !stored[0].password) {
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
    }

    if (updated) {
      localStorage.setItem('ems_employees', JSON.stringify(stored));
    }
  }
  if (!localStorage.getItem('ems_requests')) {
    localStorage.setItem('ems_requests', JSON.stringify(DEFAULT_REQUESTS));
  }
  if (!localStorage.getItem('ems_projects')) {
    localStorage.setItem('ems_projects', JSON.stringify(DEFAULT_PROJECTS));
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
          if (p.dept === 'Engineering') p.techLeadId = 'EMP007'; // Elena Rostova
          else if (p.dept === 'Design') p.techLeadId = 'EMP012'; // Liam Carter
          else if (p.dept === 'Sales') p.techLeadId = 'EMP013'; // Sophia Vance
          else if (p.dept === 'Marketing') p.techLeadId = 'EMP014'; // Oliver Brooks
          else if (p.dept === 'Human Resources') p.techLeadId = 'EMP015'; // Emma Stone
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
    }
  }
  if (!localStorage.getItem('ems_tasks')) {
    localStorage.setItem('ems_tasks', JSON.stringify(DEFAULT_TASKS));
  }
  if (!localStorage.getItem('ems_departments')) {
    localStorage.setItem('ems_departments', JSON.stringify(DEFAULT_DEPARTMENTS));
  }
  if (!localStorage.getItem('ems_chats')) {
    localStorage.setItem('ems_chats', JSON.stringify(DEFAULT_CHATS));
  }
  if (!localStorage.getItem('ems_reports')) {
    localStorage.setItem('ems_reports', JSON.stringify(DEFAULT_REPORTS));
  }
  if (!localStorage.getItem('ems_announcements')) {
    localStorage.setItem('ems_announcements', JSON.stringify(DEFAULT_ANNOUNCEMENTS));
  }
  if (!localStorage.getItem('ems_notices')) {
    localStorage.setItem('ems_notices', JSON.stringify(DEFAULT_NOTICES));
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

  state.employees = JSON.parse(localStorage.getItem('ems_employees'));
  state.requests = JSON.parse(localStorage.getItem('ems_requests'));
  state.projects = JSON.parse(localStorage.getItem('ems_projects'));
  state.tasks = JSON.parse(localStorage.getItem('ems_tasks')) || [];
  let tasksUpdated = false;
  state.tasks.forEach(t => {
    if (t.status !== 'Completed' && t.status !== 'Not Completed') {
      t.status = 'Not Completed';
      tasksUpdated = true;
    }
  });
  if (tasksUpdated) {
    localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
  }
  state.departments = JSON.parse(localStorage.getItem('ems_departments'));
  state.chats = JSON.parse(localStorage.getItem('ems_chats'));
  state.announcements = JSON.parse(localStorage.getItem('ems_announcements'));
  state.notices = JSON.parse(localStorage.getItem('ems_notices'));
  state.smsNotifications = JSON.parse(localStorage.getItem('ems_notifications') || '[]');
  state.nationalHolidays = JSON.parse(localStorage.getItem('ems_national_holidays'));
  state.celebrationDays = JSON.parse(localStorage.getItem('ems_celebration_days'));

  // Load and seed Reimbursements
  try {
    state.reimbursements = JSON.parse(localStorage.getItem('ems_reimbursements') || '[]');
  } catch (e) {
    state.reimbursements = [];
  }
  if (state.reimbursements.length === 0) {
    state.reimbursements = [
      {
        id: 'REIM001',
        employeeId: 'EMP002',
        employeeName: 'Alex Rivera',
        type: 'Food',
        amount: 1200,
        date: '2026-05-20',
        purpose: 'Team dinner following the successful launch of core modules.',
        location: 'Mainland China, Mumbai',
        attachments: [],
        status: 'approved',
        comment: 'Approved. Valid receipt.',
        submittedAt: '2026-05-20'
      },
      {
        id: 'REIM002',
        employeeId: 'EMP007',
        employeeName: 'Elena Rostova',
        type: 'Travel',
        amount: 3500,
        date: '2026-06-02',
        purpose: 'Travel tickets for client briefing meeting.',
        location: 'New Delhi Office',
        attachments: [],
        status: 'pending',
        comment: '',
        submittedAt: '2026-06-02'
      }
    ];
    localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
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
  }

  state.dailyReports = JSON.parse(localStorage.getItem('ems_reports')) || [];
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
  }

  // Load and seed Support Tickets
  try {
    state.tickets = JSON.parse(localStorage.getItem('ems_tickets') || '[]');
  } catch (e) {
    state.tickets = [];
  }
  if (state.tickets.length === 0) {
    state.tickets = DEFAULT_TICKETS;
    localStorage.setItem('ems_tickets', JSON.stringify(state.tickets));
  }

  // Bind role toggles
  document.getElementById('btn-role-employee').addEventListener('click', () => setRole('employee'));
  document.getElementById('btn-role-techlead').addEventListener('click', () => setRole('techlead'));
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
          compressImage(event.target.result, 150, 150, 0.7, function(compressed) {
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

  // Set up Aadhar card upload listener
  const aadharInput = document.getElementById('new-emp-aadhar');
  const aadharPreview = document.getElementById('new-emp-aadhar-preview');
  const aadharImg = document.getElementById('new-emp-aadhar-img');
  if (aadharInput && aadharPreview && aadharImg) {
    aadharInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (event) {
          compressImage(event.target.result, 150, 150, 0.7, function(compressed) {
            currentUploadedAadharFile = compressed;
            aadharImg.src = compressed;
            aadharPreview.style.display = 'block';
          });
        };
        reader.readAsDataURL(file);
      } else {
        currentUploadedAadharFile = null;
        aadharImg.src = '';
        aadharPreview.style.display = 'none';
      }
    });
  }

  // Set up PAN card upload listener
  const panInput = document.getElementById('new-emp-pan');
  const panPreview = document.getElementById('new-emp-pan-preview');
  const panImg = document.getElementById('new-emp-pan-img');
  if (panInput && panPreview && panImg) {
    panInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (event) {
          compressImage(event.target.result, 150, 150, 0.7, function(compressed) {
            currentUploadedPanFile = compressed;
            panImg.src = compressed;
            panPreview.style.display = 'block';
          });
        };
        reader.readAsDataURL(file);
      } else {
        currentUploadedPanFile = null;
        panImg.src = '';
        panPreview.style.display = 'none';
      }
    });
  }

  // Set up Bank Account Document upload listener
  const bankAccInput = document.getElementById('new-emp-bank-acc');
  const bankAccPreview = document.getElementById('new-emp-bank-acc-preview');
  const bankAccImg = document.getElementById('new-emp-bank-acc-img');
  if (bankAccInput && bankAccPreview && bankAccImg) {
    bankAccInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (event) {
          compressImage(event.target.result, 150, 150, 0.7, function(compressed) {
            currentUploadedBankAccFile = compressed;
            bankAccImg.src = compressed;
            bankAccPreview.style.display = 'block';
          });
        };
        reader.readAsDataURL(file);
      } else {
        currentUploadedBankAccFile = null;
        bankAccImg.src = '';
        bankAccPreview.style.display = 'none';
      }
    });
  }

  // Set up IFSC Code & Bank Name Doc upload listener
  const bankIfscInput = document.getElementById('new-emp-bank-ifsc');
  const bankIfscPreview = document.getElementById('new-emp-bank-ifsc-preview');
  const bankIfscImg = document.getElementById('new-emp-bank-ifsc-img');
  if (bankIfscInput && bankIfscPreview && bankIfscImg) {
    bankIfscInput.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (event) {
          compressImage(event.target.result, 150, 150, 0.7, function(compressed) {
            currentUploadedBankIfscFile = compressed;
            bankIfscImg.src = compressed;
            bankIfscPreview.style.display = 'block';
          });
        };
        reader.readAsDataURL(file);
      } else {
        currentUploadedBankIfscFile = null;
        bankIfscImg.src = '';
        bankIfscPreview.style.display = 'none';
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

  // Set Theme Toggle
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('ems_theme', newTheme);
    updateThemeIcon(newTheme);
  });

  // Load Saved Theme
  const savedTheme = localStorage.getItem('ems_theme') || 'light';
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
        document.getElementById('header-role').textContent = selectedEmp.dept;
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
}

function updateThemeIcon(theme) {
  const moonPath = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />`;
  const sunPath = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828-9.9a5 5 0 11-7.07 7.07 5 5 0 017.07-7.07z" />`;
  document.getElementById('theme-toggle').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">${theme === 'dark' ? sunPath : moonPath}</svg>`;
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
// Returns a map of { 'YYYY-MM': daysUsed } for all approved leaves of an employee
function getEmployeeLeavesPerMonth(employeeId) {
  const approvedRequests = (state.requests || []).filter(
    r => r.employeeId === employeeId && r.status === 'approved'
  );
  const perMonth = {};
  approvedRequests.forEach(req => {
    // Split multi-month spans day by day
    const start = new Date(req.startDate + 'T00:00:00');
    const end   = new Date(req.endDate   + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      perMonth[ym] = (perMonth[ym] || 0) + 1;
    }
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

  const leavesPerMonth = getEmployeeLeavesPerMonth(employeeId);

  let accruedBalance = 0;
  let totalAccrued = 0;
  let totalApprovedDays = 0;
  let lwpInTarget = 0;

  for (let m = 1; m <= targetMonth; m++) {
    // Accrue this month (cap at yearly max)
    accruedBalance = Math.min(accruedBalance + ACCRUAL_PER_MONTH, MAX_YEARLY);
    totalAccrued = Math.min(totalAccrued + ACCRUAL_PER_MONTH, MAX_YEARLY);

    const ym = `${targetYear}-${String(m).padStart(2, '0')}`;
    const leaveDays = leavesPerMonth[ym] || 0;
    totalApprovedDays += leaveDays;

    // Paid leave = max 1.5 days/month (hard cap), deducted from accrued balance
    // Any leave beyond the 1.5/month paid cap is LWP regardless of accrued balance size
    const paidLeave = Math.min(leaveDays, ACCRUAL_PER_MONTH, accruedBalance);
    const unpaidLeave = leaveDays - paidLeave;

    accruedBalance = Math.max(0, accruedBalance - paidLeave);

    if (m === targetMonth) {
      lwpInTarget = unpaidLeave;
    }
  }

  return {
    balance: Math.round(accruedBalance * 10) / 10,       // remaining paid leave balance
    totalAccrued: Math.round(totalAccrued * 10) / 10,    // total accrued so far this year
    totalApproved: totalApprovedDays,
    lwpDays: Math.round(lwpInTarget * 10) / 10
  };
}

function setupDateLimits() {
  const today = new Date().toISOString().split('T')[0];
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
      avatarEl.innerHTML = user.avatar;
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
  const hrBtn = document.getElementById('btn-role-hr');
  if (hrBtn) hrBtn.classList.remove('active');
  const adminBtn = document.getElementById('btn-role-admin');
  if (adminBtn) adminBtn.classList.remove('active');

  const matchesTargetRole = (user, target) => {
    if (!user) return false;
    const norm = user.role.toLowerCase() === 'tech lead' ? 'techlead' : user.role.toLowerCase() === 'hr' ? 'hr' : user.role.toLowerCase() === 'admin' ? 'admin' : 'employee';
    return norm === target;
  };

  if (role === 'employee') {
    document.getElementById('btn-role-employee').classList.add('active');

    // Only switch current user if not already matching the target employee role
    if (!matchesTargetRole(state.currentUser, 'employee')) {
      if (empSelect && empSelect.value) {
        state.currentUser = state.employees.find(emp => emp.id === empSelect.value);
      } else {
        state.currentUser = state.employees.find(emp => emp.role === 'Employee'); // Default employee
      }
    }

    if (empSelectorWrapper) {
      empSelectorWrapper.style.display = 'flex';
    }
  } else if (role === 'techlead') {
    if (leadBtn) leadBtn.classList.add('active');

    // Only switch current user if not already matching the techlead role
    if (!matchesTargetRole(state.currentUser, 'techlead')) {
      let leadEmp = state.employees.find(emp => emp.role === 'Tech Lead');
      if (!leadEmp) {
        leadEmp = { id: 'EMP007', name: 'Elena Rostova', dept: 'Engineering', email: 'elena.r@company.com', role: 'Tech Lead', balance: 18, absent: 2, avatar: 'ER' };
        state.employees.push(leadEmp);
        localStorage.setItem('ems_employees', JSON.stringify(state.employees));
        populateEmployeeDropdown();
      }
      state.currentUser = leadEmp;
    }

    if (empSelectorWrapper) {
      empSelectorWrapper.style.display = 'none';
    }
  } else if (role === 'admin') {
    if (adminBtn) adminBtn.classList.add('active');

    // Only switch current user if not already matching the admin role
    if (!matchesTargetRole(state.currentUser, 'admin')) {
      let adminEmp = state.employees.find(emp => emp.role === 'Admin');
      if (!adminEmp) {
        adminEmp = { id: 'EMP011', name: 'Richard Boss', dept: 'Administration', email: 'admin@company.com', role: 'Admin', balance: 20, absent: 0, avatar: 'RB', aadhar: '1111 2222 3333', pan: 'ADMIR1111B', bankAcc: '1234567890', bankIfsc: 'ICIC0000456 (ICICI)', password: 'password123' };
        state.employees.push(adminEmp);
        localStorage.setItem('ems_employees', JSON.stringify(state.employees));
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
      state.currentUser = state.employees.find(emp => emp.role === 'HR'); // Default HR (Sarah)
    }

    if (empSelectorWrapper) {
      empSelectorWrapper.style.display = 'none';
    }
  }

  // Update Profile Widget
  updateHeaderAvatar(state.currentUser);
  document.getElementById('header-name').textContent = state.currentUser.name;
  document.getElementById('header-role').textContent = state.currentUser.dept || state.currentUser.role;

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
  state.employees.filter(emp => emp.role === 'Employee' || emp.role === 'Tech Lead').forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = `${emp.name} (${emp.dept} - ${emp.role})`;
    empSelect.appendChild(option);
  });
}

function updateSidebarMenu() {
  const rosterMenu = document.getElementById('menu-item-roster');
  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin') {
    rosterMenu.style.display = 'flex';
  } else {
    rosterMenu.style.display = 'none';
  }
}

function switchLeaveSubTab(tab) {
  state.activeLeaveSubTab = tab;
  const activeMenuItem = document.querySelector('.sidebar-menu .menu-item.active');
  const view = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'requests';
  switchView(view);
}

function switchView(viewName) {
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

    renderDailyReports();
  } else if (viewName === 'payslips') {
    if (empContainer) empContainer.style.display = 'none';
    if (hrContainer) hrContainer.style.display = 'none';
    if (commContainer) commContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'block';

    // Update Page Header Label
    const titleLabel = document.getElementById('page-title-label');
    if (titleLabel) titleLabel.textContent = 'Payslips';

    renderPayslips();
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
  } else {
    if (commContainer) commContainer.style.display = 'none';
    if (calendarContainer) calendarContainer.style.display = 'none';
    if (reportsContainer) reportsContainer.style.display = 'none';
    if (payslipsContainer) payslipsContainer.style.display = 'none';
    if (reimbursementsContainer) reimbursementsContainer.style.display = 'none';
    if (ticketsContainer) ticketsContainer.style.display = 'none';
    
    const isLeadOrHR = (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin');
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
function renderEmployeeDashboard(viewName = 'tasks') {
  const userId = state.currentUser.id;
  const userRequests = state.requests.filter(req => req.employeeId === userId);
  const employeeData = state.employees.find(emp => emp.id === userId);

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

  if (userRequests.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
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
    tr.innerHTML = `
      <td><strong>${req.type}</strong></td>
      <td>${formatDate(req.startDate)} - ${formatDate(req.endDate)}</td>
      <td><strong>${req.duration} day${req.duration > 1 ? 's' : ''}</strong></td>
      <td><span class="badge badge-${req.status}">${req.status}</span></td>
      <td><span class="text-muted" title="${req.reason}">${truncateText(req.reason, 30)}</span></td>
      <td><span class="text-muted" title="${req.comment || 'No comment'}">${truncateText(req.comment || '-', 25)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Render HR Dashboard ---
function renderHRDashboard(viewName = 'dashboard') {
  // Inputs/Filters
  const searchQuery = (document.getElementById('hr-search').value || '').toLowerCase();
  const filterStatus = document.getElementById('filter-status').value;
  const filterType = document.getElementById('filter-type').value;

  // Filter requests (History Archive)
  let filteredRequests = state.requests.filter(req => {
    // Role based visibility filtering
    if (state.currentRole === 'techlead') {
      const applicant = state.employees.find(e => e.id === req.employeeId);
      const applicantRole = applicant ? (applicant.role.toLowerCase() === 'tech lead' ? 'techlead' : applicant.role.toLowerCase() === 'hr' ? 'hr' : applicant.role.toLowerCase() === 'admin' ? 'admin' : 'employee') : 'employee';
      // Tech Lead only views history of their own department employees (no other leads/HR, except themselves)
      if (req.employeeId !== state.currentUser.id) {
        if (req.dept !== state.currentUser.dept || applicantRole !== 'employee') return false;
      }
    } else if (state.currentRole === 'hr') {
      // HR views history of employees and techleads (no other HR for privacy unless admin, except their own)
      const applicant = state.employees.find(e => e.id === req.employeeId);
      const isHR = applicant && (applicant.role === 'HR' || applicant.role.toLowerCase() === 'hr');
      if (isHR && req.employeeId !== state.currentUser.id) return false;
    }

    const matchesSearch = req.employeeName.toLowerCase().includes(searchQuery) || req.dept.toLowerCase().includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    const matchesType = filterType === 'all' || req.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate HR stats cards (clamped by department for Tech Leads)
  const deptEmployees = state.currentRole === 'techlead'
    ? state.employees.filter(emp => emp.dept === state.currentUser.dept)
    : state.employees;

  const totalEmployeesCount = deptEmployees.length;
  const totalAbsentDays = deptEmployees.reduce((sum, emp) => sum + emp.absent, 0);

  const pendingApprovalsCount = state.requests.filter(req => {
    if (req.status !== 'pending') return false;
    if (req.employeeId === state.currentUser.id) return false;

    const applicant = state.employees.find(e => e.id === req.employeeId);
    const applicantRole = applicant ? (applicant.role.toLowerCase() === 'tech lead' ? 'techlead' : applicant.role.toLowerCase() === 'hr' ? 'hr' : applicant.role.toLowerCase() === 'admin' ? 'admin' : 'employee') : 'employee';

    if (state.currentRole === 'admin') {
      return true;
    } else if (state.currentRole === 'hr') {
      return applicantRole === 'employee' || applicantRole === 'techlead';
    } else if (state.currentRole === 'techlead') {
      return applicantRole === 'employee' && req.dept === state.currentUser.dept;
    }
    return false;
  }).length;

  document.getElementById('hr-total-employees').textContent = totalEmployeesCount;
  document.getElementById('hr-pending-requests').textContent = pendingApprovalsCount;
  document.getElementById('hr-absent-days').textContent = totalAbsentDays;

  // Toggle views
  const dashboardCardRow = document.getElementById('hr-dashboard-row');
  const rosterCard = document.getElementById('hr-roster-card');
  const hrTasksCard = document.getElementById('hr-tasks-card');

  // Update Page Header Label based on view
  const titleLabel = document.getElementById('page-title-label');
  if (titleLabel) {
    if (viewName === 'dashboard') titleLabel.textContent = 'HR Overview Dashboard';
    else if (viewName === 'requests') titleLabel.textContent = 'Applied Leaves Archive';
    else if (viewName === 'roster') titleLabel.textContent = 'Employee Absence Roster';
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
    const applicantRole = applicant ? (applicant.role.toLowerCase() === 'tech lead' ? 'techlead' : applicant.role.toLowerCase() === 'hr' ? 'hr' : applicant.role.toLowerCase() === 'admin' ? 'admin' : 'employee') : 'employee';

    if (state.currentRole === 'admin') {
      return true;
    } else if (state.currentRole === 'hr') {
      return applicantRole === 'employee' || applicantRole === 'techlead';
    } else if (state.currentRole === 'techlead') {
      return applicantRole === 'employee' && req.dept === state.currentUser.dept;
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
    // Sort oldest first for fairness
    const oldestPending = [...pendingRequests].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

    oldestPending.forEach(req => {
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
        <td><span class="text-muted" title="${req.reason}">${truncateText(req.reason, 30)}</span></td>
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
        <td><span class="text-muted" title="${req.reason}">${truncateText(req.reason, 20)}</span></td>
        <td><span class="text-muted" title="${req.comment || 'No comment'}">${truncateText(req.comment || '-', 20)}</span></td>
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
  if (state.currentRole === 'techlead') return;
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


  let employeesToRender = state.employees;
  if (state.currentRole === 'techlead' && state.currentUser) {
    employeesToRender = state.employees.filter(emp => emp.dept === state.currentUser.dept);
  }

  employeesToRender.forEach(emp => {
    // Use dynamic accrual-based balance (1.5/month, max 18/year)
    const empAccrual = getEmployeeLeaveAccumulation(emp.id, '2026-06');
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

    const item = document.createElement('div');
    item.className = `roster-item ${isExpanded ? 'expanded' : ''}`;
    
    const avatarHTML = emp.photo 
      ? `<img src="${emp.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />` 
      : emp.avatar;
    
    const avatarStyle = emp.photo ? 'style="border-radius: 50%; overflow: hidden; background: none; padding: 0;"' : '';

    const headerHTML = `
      <div class="roster-header" style="display: flex; align-items: center; gap: 16px; width: 100%; ${state.currentRole !== 'techlead' ? 'cursor: pointer;' : ''}" ${state.currentRole !== 'techlead' ? `onclick="toggleEmployeeRosterExpand('${emp.id}')"` : ''}>
        <div class="roster-avatar" ${avatarStyle}>${avatarHTML}</div>
        <div class="roster-info">
          <div class="roster-name" style="display: flex; align-items: center; gap: 8px;">
            ${emp.name}
            <span style="display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; background-color: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; font-size: 0.7rem; font-weight: 700;">
              ★ ${points} Star${points !== 1 ? 's' : ''}
            </span>
          </div>
          <div class="roster-dept">${emp.dept} • ${emp.email}</div>
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
          ${state.currentRole !== 'techlead' ? `
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
      const aadharContent = emp.aadhar
        ? (emp.aadhar.startsWith('data:') 
           ? `<img src="${emp.aadhar}" style="width: 80px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('${emp.aadhar}')" title="Click to view full Aadhar card image" />`
           : `<strong style="color: var(--text-primary); font-family: monospace; font-size: 0.9rem;">${emp.aadhar}</strong>`)
        : '<span class="text-muted">Not Provided</span>';

      const panContent = emp.pan
        ? (emp.pan.startsWith('data:') 
           ? `<img src="${emp.pan}" style="width: 80px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('${emp.pan}')" title="Click to view full PAN card image" />`
           : `<strong style="color: var(--text-primary); font-family: monospace; font-size: 0.9rem; text-transform: uppercase;">${emp.pan}</strong>`)
        : '<span class="text-muted">Not Provided</span>';

      let deleteBtnHTML = '';
      const isSystemAdmin = emp.email.toLowerCase() === 'admin@company.com';
      if ((state.currentRole === 'hr' || state.currentRole === 'admin') && !isSystemAdmin) {
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

      let bankDetailsHTML = '';
      if ((emp.bankAcc && emp.bankAcc.startsWith('data:')) || (emp.bankIfsc && emp.bankIfsc.startsWith('data:'))) {
        const bankAccImg = emp.bankAcc && emp.bankAcc.startsWith('data:')
          ? `<img src="${emp.bankAcc}" style="width: 80px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('${emp.bankAcc}')" title="Click to view full Bank Account document image" />`
          : (emp.bankAcc ? `<strong style="color: var(--text-primary); font-family: monospace; font-size: 0.9rem;">${emp.bankAcc}</strong>` : '<span class="text-muted">Not Provided</span>');
        
        const bankIfscImg = emp.bankIfsc && emp.bankIfsc.startsWith('data:')
          ? `<img src="${emp.bankIfsc}" style="width: 80px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('${emp.bankIfsc}')" title="Click to view full IFSC document image" />`
          : (emp.bankIfsc ? `<strong style="color: var(--text-primary); font-family: monospace; font-size: 0.9rem;">${emp.bankIfsc}</strong>` : '<span class="text-muted">Not Provided</span>');

        bankDetailsHTML = `
          <div style="display: flex; flex-wrap: wrap; gap: 16px;">
            <div style="flex: 1; min-width: 150px;">
              <span class="text-muted" style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Bank Account Doc</span>
              <div style="margin-top: 4px;">${bankAccImg}</div>
            </div>
            <div style="flex: 1; min-width: 150px;">
              <span class="text-muted" style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">IFSC & Bank Name Doc</span>
              <div style="margin-top: 4px;">${bankIfscImg}</div>
            </div>
          </div>
        `;
      } else {
        bankDetailsHTML = `
          <div style="display: flex; flex-wrap: wrap; gap: 16px;">
            <div style="flex: 1; min-width: 150px;">
              <span class="text-muted" style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Bank Details</span>
              <strong style="color: var(--text-primary);">Account: ${emp.bankAcc || 'Not Provided'} | IFSC: ${emp.bankIfsc || 'Not Provided'}</strong>
            </div>
          </div>
        `;
      }

      if (state.currentRole === 'techlead') {
        detailsHTML = `
          <div class="roster-details" style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem; width: 100%;">
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
              <div style="flex: 1; min-width: 150px;">
                <span class="text-muted" style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Role</span>
                <strong style="color: var(--text-primary); font-size: 0.9rem;">${emp.role}</strong>
              </div>
            </div>
            <div style="display: flex; align-items: center; justify-content: center; padding: 12px; background: rgba(239, 68, 68, 0.08); border: 1px dashed rgba(239, 68, 68, 0.3); border-radius: var(--border-radius-sm); color: var(--text-primary); font-weight: 500;">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="stroke: #ef4444; margin-right: 8px; flex-shrink: 0;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Aadhar, PAN, and Bank details are restricted to HR & Admin only.
            </div>
          </div>
        `;
      } else {
        detailsHTML = `
          <div class="roster-details" style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border-color); display: flex; flex-direction: column; gap: 12px; font-size: 0.85rem; width: 100%;">
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
              <div style="flex: 1; min-width: 150px;">
                <span class="text-muted" style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Aadhar Card</span>
                <div style="margin-top: 4px;">${aadharContent}</div>
              </div>
              <div style="flex: 1; min-width: 150px;">
                <span class="text-muted" style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">PAN Card</span>
                <div style="margin-top: 4px;">${panContent}</div>
              </div>
            </div>
            ${bankDetailsHTML}
            <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-top: 4px;">
              <div style="flex: 1; min-width: 150px;">
                <span class="text-muted" style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Role</span>
                ${state.currentRole === 'admin' && !isSystemAdmin ? `
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="role-select-${emp.id}" style="padding: 6px 12px; font-size: 0.85rem; background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); cursor: pointer; outline: none;">
                      <option value="Employee" ${emp.role === 'Employee' ? 'selected' : ''}>Employee</option>
                      <option value="HR" ${emp.role === 'HR' ? 'selected' : ''}>HR</option>
                      <option value="Tech Lead" ${emp.role === 'Tech Lead' ? 'selected' : ''}>Tech Lead</option>
                    </select>
                    <button class="btn btn-primary btn-sm" onclick="updateEmployeeRole('${emp.id}', event)" style="padding: 6px 12px; border-radius: 6px; font-size: 0.85rem; font-weight: 600;">Save Role</button>
                  </div>
                ` : `
                  <strong style="color: var(--text-primary); font-size: 0.9rem;">${emp.role}</strong>
                `}
              </div>
            </div>
            ${deleteBtnHTML}
          </div>
        `;
      }
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

function deleteEmployee(empId, event) {
  if (event) event.stopPropagation();

  if (state.currentUser && state.currentUser.id === empId) {
    showToast('You cannot delete your own logged-in account!', 'error');
    return;
  }

  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  const isPrimaryAdmin = emp.email.toLowerCase() === 'admin@company.com';
  if (isPrimaryAdmin) {
    showToast('The Primary Administrator account cannot be deleted!', 'error');
    return;
  }

  if (confirm(`Are you sure you want to delete employee "${emp.name}"? This action is permanent.`)) {
    state.employees = state.employees.filter(e => e.id !== empId);
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));

    populateEmployeeDropdown();
    populateTaskModalOptions();
    renderEmployeeRoster();

    showToast(`Employee "${emp.name}" deleted successfully.`, 'success');
  }
}

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

  const roleSelect = document.getElementById(`role-select-${empId}`);
  if (!roleSelect) return;

  const newRole = roleSelect.value;
  if (!['Employee', 'HR', 'Tech Lead'].includes(newRole)) {
    showToast('Invalid role selected.', 'error');
    return;
  }

  const oldRole = emp.role;
  emp.role = newRole;
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));

  populateEmployeeDropdown();
  populateTaskModalOptions();
  renderEmployeeRoster();

  showToast(`Role of ${emp.name} updated from "${oldRole}" to "${newRole}"!`, 'success');
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
  const accrual = getEmployeeLeaveAccumulation(state.currentUser.id, '2026-06');
  if (duration > accrual.balance) {
    const lwp = Math.round((duration - accrual.balance) * 10) / 10;
    showToast(`Note: ${lwp} day(s) exceed your accrued balance and will be marked as Leave Without Pay on your payslip.`, 'warning');
  }

  // Create leave request object
  const newReq = {
    id: `REQ${100 + state.requests.length + 1}`,
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
    submittedAt: new Date().toISOString().split('T')[0]
  };

  // Update State
  state.requests.unshift(newReq);
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));

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

  // Render Avatar
  const avatarEl = document.getElementById('profile-modal-avatar');
  if (avatarEl) {
    if (emp.photo) {
      avatarEl.innerHTML = `<img src="${emp.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
    } else {
      avatarEl.innerHTML = emp.avatar;
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
  setVal('profile-edit-aadhar', emp.aadhar || '');
  setVal('profile-edit-pan', emp.pan || '');
  setVal('profile-edit-bank-acc', emp.bankAcc || '');
  setVal('profile-edit-bank-ifsc', emp.bankIfsc || '');

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
  emp.aadhar = document.getElementById('profile-edit-aadhar').value.trim() || emp.aadhar;
  emp.pan = document.getElementById('profile-edit-pan').value.trim() || emp.pan;
  emp.bankAcc = document.getElementById('profile-edit-bank-acc').value.trim() || emp.bankAcc;
  emp.bankIfsc = document.getElementById('profile-edit-bank-ifsc').value.trim() || emp.bankIfsc;

  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  state.currentUser = emp;

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

  // Save changes to localStorage
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));

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
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncateText(text, length) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substr(0, length) + '...';
}

// --- Handle Hamburger Menu for Mobile Responsive View ---
document.getElementById('mobile-hamburger').addEventListener('click', function () {
  this.classList.toggle('open');
  document.getElementById('sidebar').classList.toggle('open');
});

// --- Tasks & Projects View Logic ---

// --- 1. Employee View Logic ---
function groupTasksByMonth(tasksList) {
  // Sort tasks chronologically by dueDate
  const sorted = [...tasksList].sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate) : new Date(0);
    const db = b.dueDate ? new Date(b.dueDate) : new Date(0);
    return da - db;
  });

  const groups = {};
  sorted.forEach(task => {
    let monthKey = 'No Timeline';
    if (task.dueDate) {
      const parts = task.dueDate.split('-');
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

  // Render Projects (filtered by employee's department OR projects they are assigned tasks in)
  const grid = document.getElementById('emp-projects-grid');
  if (grid) {
    grid.innerHTML = '';
    
    // Get unique project IDs where user has at least one assigned task
    const userTaskProjectIds = state.tasks
      .filter(t => t.assigneeId === user.id && t.projectId)
      .map(t => t.projectId);

    const activeProjects = state.projects.filter(p => 
      p.dept === user.dept || userTaskProjectIds.includes(p.id)
    );

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

    // Get all projects the current user is involved in (has at least one task)
    const myProjectIds = [...new Set(
      state.tasks.filter(t => t.assigneeId === user.id && t.projectId).map(t => t.projectId)
    )];

    // Also include personal tasks (no projectId)
    const personalTasks = state.tasks.filter(t => t.assigneeId === user.id && !t.projectId);

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
                      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="cancelEditTask(event)">Cancel</button>
                        <button class="btn btn-primary btn-sm" onclick="saveEditTask('${task.id}', event)">Save Changes</button>
                      </div>
                    </div>
                  ` : `
                    <div style="font-weight: 500; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word;">${task.details || 'No details provided.'}</div>
                    ${task.images && task.images.length > 0 ? `
                      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                        ${task.images.map((imgBase64, idx) => `
                          <img src="${imgBase64}" onclick="openFullImageViewModal('${task.id}', ${idx}, event)" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.2s;" class="hover-scale-img">
                        `).join('')}
                      </div>
                    ` : ''}
                    <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                      <button class="btn btn-secondary btn-sm" onclick="startEditTask('${task.id}', event)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px;">Edit Description & Photos</button>
                    </div>
                  `}
                </div>
              </div>
            </td>
            <td>${task.projectName || 'Personal'}</td>
            <td><span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span></td>
            <td>${task.startDate ? formatDate(task.startDate) + ' to ' : ''}${formatDate(task.dueDate)}</td>
            <td><span class="badge badge-${task.status.replace(' ', '-').toLowerCase()}">${task.status}</span></td>
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
  
  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
  showToast(`Task status updated to "${task.status}"`, 'success');
}

function toggleTaskCompletion(taskId) {
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
  
  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin') {
    renderHRTasksAndProjects();
  } else {
    renderEmployeeTasksAndProjects();
  }
  showToast(`Task marked as ${task.status.toLowerCase()}`, 'success');
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
  const leadEmp = state.employees.find(e => e.id === proj.techLeadId);
  const leadName = leadEmp ? leadEmp.name : 'Unassigned';

  let dueDateDisplay = '';
  if (proj.dueDate) {
    dueDateDisplay = `
      <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; margin-top: 4px;">
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Due: <strong>${proj.dueDate}</strong>
      </div>
    `;
  }

  // Determine if editable by the project lead (the assigned Tech Lead) or Admin
  const isEditable = (state.currentUser.id === proj.techLeadId || state.currentUser.role === 'Admin');

  // LEFT COLUMN HTML
  let leftColHtml = '';
  if (isMyProject === false) {
    // Other projects (simplified view)
    leftColHtml = `
      <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
        <div class="project-card-title">${proj.name}</div>
        <div class="project-card-meta" style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Status: <span class="badge badge-${proj.status.toLowerCase()}">${proj.status}</span></span>
            <span style="font-weight: 600; color: var(--primary);">${proj.dept}</span>
          </div>
          ${dueDateDisplay}
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">
          Current Tech Lead: <strong>${leadName}</strong>
        </div>
      </div>
    `;
  } else {
    // My project (full view) or Admin/HR view (isMyProject is null)
    let leadDisplay = '';
    if (isMyProject === null) {
      // In Admin/HR view, display which Tech Lead is assigned
      leadDisplay = `
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
          Tech Lead: <strong style="color: var(--text-primary);">${leadName}</strong>
        </div>
      `;
    }

    leftColHtml = `
      <div style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
        <div class="project-card-title">${proj.name}</div>
        <div class="project-card-meta" style="display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span>Status: <span class="badge badge-${proj.status.toLowerCase()}">${proj.status}</span></span>
            <span style="font-weight: 600; color: var(--primary);">${proj.dept}</span>
          </div>
          ${dueDateDisplay}
        </div>
        <div class="project-progress-container" style="margin-top: 16px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600; margin-bottom: 6px;">
            <span style="color: var(--text-muted);">Progress</span>
            <span class="prog-info" style="color: var(--text-primary);"><span class="prog-val">${progressPercent}%</span></span>
          </div>
          ${(isMyProject === true || (isMyProject === null && state.currentUser.id === proj.techLeadId)) ? `
            <div style="position: relative; width: 100%; height: 8px; margin: 10px 0;">
              <!-- Underlay: The actual progress bar visual -->
              <div class="progress-bar-bg" style="width: 100%; height: 8px; background-color: var(--bg-tertiary); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); position: absolute; top: 0; left: 0; pointer-events: none;">
                <div class="progress-bar-fill" style="width: ${progressPercent}%; height: 100%; background: var(--primary-gradient); border-radius: 4px; transition: width 0.1s ease;"></div>
              </div>
              <!-- Overlay: The range slider, perfectly aligned and transparent track -->
              <input type="range" min="0" max="100" value="${progressPercent}" 
                     class="project-slider-overlay"
                     style="position: absolute; top: -4px; left: 0; width: 100%; height: 16px; -webkit-appearance: none; appearance: none; background: transparent; cursor: pointer; margin: 0; outline: none;" 
                     oninput="
                       this.closest('.project-progress-container').querySelector('.prog-val').innerText = this.value + '%';
                       this.previousElementSibling.querySelector('.progress-bar-fill').style.width = this.value + '%';
                     "
                     onchange="updateProjectProgress('${proj.id}', this.value)" />
            </div>
          ` : `
            <div class="progress-bar-bg" style="width: 100%; height: 8px; background-color: var(--bg-tertiary); border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color); position: relative;">
              <div class="progress-bar-fill" id="bar-fill-${proj.id}" style="width: ${progressPercent}%; height: 100%; background: var(--primary-gradient); border-radius: 4px; transition: width 0.3s ease;"></div>
            </div>
          `}
        </div>
        ${leadDisplay}
      </div>
    `;
  }

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
              <div style="position: relative; display: flex; align-items: center; gap: 4px; background-color: var(--bg-secondary); padding: 4px 6px; border-radius: 6px; border: 1px solid var(--border-color); max-width: 100%; overflow: hidden; box-sizing: border-box; flex-shrink: 0;">
                <a href="${fileData}" download="${fileName}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; color: var(--primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; max-width: calc(100% - 14px);" title="Download ${fileName}">
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="flex-shrink:0;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</span>
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
  `;

  return card;
}



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
    const proj = state.projects.find(p => p.id === projId);
    if (proj) {
      if (!proj.files) proj.files = [];
      proj.files.push({
        name: file.name,
        type: file.type,
        data: base64Data
      });
      localStorage.setItem('ems_projects', JSON.stringify(state.projects));
      showToast(`File "${file.name}" uploaded successfully!`, 'success');
      if (state.currentRole === 'hr' || state.currentRole === 'admin') {
        renderHRTasksAndProjects();
      } else {
        renderEmployeeTasksAndProjects();
      }
    }
  };
  reader.readAsDataURL(file);
}
window.uploadProjectFile = uploadProjectFile;

function deleteProjectFile(projId, fileIndex) {
  const proj = state.projects.find(p => p.id === projId);
  if (proj) {
    if (proj.files && proj.files[fileIndex]) {
      const fileName = proj.files[fileIndex].name;
      proj.files.splice(fileIndex, 1);
      localStorage.setItem('ems_projects', JSON.stringify(state.projects));
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
          <p>Click "Add New Project" to get started.</p>
        </div>
      `;
    } else if (state.currentRole === 'techlead') {
      const myProjects = state.projects.filter(p => p.techLeadId === state.currentUser.id);
      if (myProjects.length === 0) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1; padding: 24px;">
            <div class="empty-state-title">No projects active</div>
            <p>You are not assigned to any projects.</p>
          </div>
        `;
      } else {
        myProjects.forEach(proj => {
          const card = createProjectCard(proj, true);
          grid.appendChild(card);
        });
      }
    } else {
      // HR/Admin view
      state.projects.forEach(proj => {
        const card = createProjectCard(proj, null);
        grid.appendChild(card);
      });
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
      if (state.currentRole === 'techlead') {
        const proj = state.projects.find(p => p.id === t.projectId);
        if (!proj || proj.techLeadId !== state.currentUser.id) {
          return false;
        }
      }
      const matchesSearch = t.desc.toLowerCase().includes(searchQ) || t.assigneeName.toLowerCase().includes(searchQ);
      const matchesProj = filterProj === 'all' || t.projectId === filterProj;
      const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
      return matchesSearch && matchesProj && matchesStatus;
    });

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
                      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="cancelEditTask(event)">Cancel</button>
                        <button class="btn btn-primary btn-sm" onclick="saveEditTask('${task.id}', event)">Save Changes</button>
                      </div>
                    </div>
                  ` : `
                    <div style="font-weight: 500; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word;">${task.details || 'No details provided.'}</div>
                    ${task.images && task.images.length > 0 ? `
                      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                        ${task.images.map((imgBase64, idx) => `
                          <img src="${imgBase64}" onclick="openFullImageViewModal('${task.id}', ${idx}, event)" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.2s;" class="hover-scale-img">
                        `).join('')}
                      </div>
                    ` : ''}
                    <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
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
            <td><span class="badge badge-${task.status.replace(' ', '-').toLowerCase()}">${task.status}</span></td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')">Delete</button>
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
    const personalTasks = state.tasks.filter(t => t.assigneeId === state.currentUser.id);

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
          const isExpanded = state.expandedTaskIds && state.expandedTaskIds.has(task.id);
          const isEditing = state.editingTaskId === task.id;

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
                      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="cancelEditTask(event)">Cancel</button>
                        <button class="btn btn-primary btn-sm" onclick="saveEditTask('${task.id}', event)">Save Changes</button>
                      </div>
                    </div>
                  ` : `
                    <div style="font-weight: 500; color: var(--text-secondary); white-space: pre-wrap; word-break: break-word;">${task.details || 'No details provided.'}</div>
                    ${task.images && task.images.length > 0 ? `
                      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                        ${task.images.map((imgBase64, idx) => `
                          <img src="${imgBase64}" onclick="openFullImageViewModal('${task.id}', ${idx}, event)" style="width: 80px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.2s;" class="hover-scale-img">
                        `).join('')}
                      </div>
                    ` : ''}
                    <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                      <button class="btn btn-secondary btn-sm" onclick="startEditTask('${task.id}', event)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px;">Edit Description & Photos</button>
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
    const allowedProjects = state.currentRole === 'techlead'
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
    const allowedProjects = state.currentRole === 'techlead'
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
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.dept} - ${emp.role})`;
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
  
  populateTechLeadOptions();
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

function handleProjectCreationSubmit(e) {
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
    files: files
  };

  // Promote employee to Tech Lead if they aren't already a Tech Lead or Admin
  const chosenEmp = state.employees.find(emp => emp.id === techLeadId);
  if (chosenEmp && chosenEmp.role !== 'Tech Lead' && chosenEmp.role !== 'Admin') {
    chosenEmp.role = 'Tech Lead';
    localStorage.setItem('ems_employees', JSON.stringify(state.employees));
    showToast(`${chosenEmp.name} has been promoted to Tech Lead!`, 'info');
  }

  state.projects.push(newProj);
  localStorage.setItem('ems_projects', JSON.stringify(state.projects));

  hideProjectModal();
  renderHRTasksAndProjects();
  showToast(`Project "${name}" created successfully!`, 'success');
}

window.openCreateProjectModal = openCreateProjectModal;
window.hideProjectModal = hideProjectModal;

function openAssignTaskModal() {
  document.getElementById('task-assignment-form').reset();

  currentAttachedImagesHR.length = 0;
  const hrPreview = document.getElementById('task-images-preview');
  if (hrPreview) hrPreview.innerHTML = '';

  // Default due date to 1 week from now
  const oneWeekLater = new Date();
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  document.getElementById('task-due-date').value = oneWeekLater.toISOString().split('T')[0];

  // Set minimum date to today
  document.getElementById('task-due-date').min = new Date().toISOString().split('T')[0];

  const startDateInput = document.getElementById('task-start-date');
  if (startDateInput) {
    startDateInput.value = new Date().toISOString().split('T')[0];
    startDateInput.min = new Date().toISOString().split('T')[0];
  }

  populateTaskModalOptions();
  document.getElementById('task-modal-overlay').classList.add('active');
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
    projectName: project.name,
    desc: desc,
    details: details,
    images: [...currentAttachedImagesHR],
    assigneeId: empId,
    assigneeName: employee.name,
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
  showToast(`Task assigned to ${employee.name}!`, 'success');
}

function deleteTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (confirm(`Are you sure you want to delete task "${task.desc}"?`)) {
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
  const projectDeptSelect = document.getElementById('project-dept');
  if (projectDeptSelect) {
    projectDeptSelect.innerHTML = '<option value="" disabled selected>Select department...</option>';
    state.departments.forEach(dept => {
      const opt = document.createElement('option');
      opt.value = dept;
      opt.textContent = dept;
      projectDeptSelect.appendChild(opt);
    });
  }

  const empDeptSelect = document.getElementById('new-emp-dept');
  if (empDeptSelect) {
    empDeptSelect.innerHTML = '<option value="" disabled selected>Select department...</option>';
    state.departments.forEach(dept => {
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

  populateDepartmentDropdowns();
  hideDeptModal();
  showToast(`Department "${name}" created successfully!`, 'success');
}

// Employee creation modal triggers
function openCreateEmployeeModal() {
  if (!document.body.classList.contains('auth-view') && state.currentRole !== 'admin') {
    showToast('Access denied: Only Administrators can add employees inside the portal.', 'error');
    return;
  }

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

  const aadharPreview = document.getElementById('new-emp-aadhar-preview');
  if (aadharPreview) aadharPreview.style.display = 'none';
  const aadharImg = document.getElementById('new-emp-aadhar-img');
  if (aadharImg) aadharImg.src = '';

  const panPreview = document.getElementById('new-emp-pan-preview');
  if (panPreview) panPreview.style.display = 'none';
  const panImg = document.getElementById('new-emp-pan-img');
  if (panImg) panImg.src = '';

  const bankAccPreview = document.getElementById('new-emp-bank-acc-preview');
  if (bankAccPreview) bankAccPreview.style.display = 'none';
  const bankAccImg = document.getElementById('new-emp-bank-acc-img');
  if (bankAccImg) bankAccImg.src = '';

  const bankIfscPreview = document.getElementById('new-emp-bank-ifsc-preview');
  if (bankIfscPreview) bankIfscPreview.style.display = 'none';
  const bankIfscImg = document.getElementById('new-emp-bank-ifsc-img');
  if (bankIfscImg) bankIfscImg.src = '';

  // Populate dynamic role options based on current user role privilege
  const roleSelect = document.getElementById('new-emp-role');
  if (roleSelect) {
    roleSelect.innerHTML = '';
    if (!state.currentUser || (state.currentUser && state.currentRole === 'admin')) {
      roleSelect.innerHTML = `
        <option value="Employee" selected>Employee (Engineer)</option>
        <option value="Tech Lead">Tech Lead</option>
        <option value="HR">HR Manager</option>
        <option value="Admin">Admin</option>
      `;
    } else {
      // HR or Tech Lead adding someone from the portal
      roleSelect.innerHTML = `
        <option value="Employee" selected>Employee</option>
        <option value="Tech Lead">Tech Lead</option>
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
  const id = idEl ? idEl.value.trim() : '';
  const name = document.getElementById('new-emp-name').value.trim();
  const email = document.getElementById('new-emp-email').value.trim();
  const deptEl = document.getElementById('new-emp-dept');
  const dept = deptEl ? deptEl.value : 'Engineering';
  const roleEl = document.getElementById('new-emp-role');
  const role = roleEl ? roleEl.value : 'Employee';
  const balanceEl = document.getElementById('new-emp-balance');
  const balance = balanceEl ? parseInt(balanceEl.value) : 20;
  const designation = document.getElementById('new-emp-designation') ? document.getElementById('new-emp-designation').value.trim() : '';
  const phone = document.getElementById('new-emp-phone') ? document.getElementById('new-emp-phone').value.trim() : '';

  const aadhar = currentUploadedAadharFile || '';
  const pan = currentUploadedPanFile || '';
  const bankAcc = currentUploadedBankAccFile || '';
  const bankIfsc = currentUploadedBankIfscFile || '';
  const password = document.getElementById('new-emp-password') ? document.getElementById('new-emp-password').value : 'password123';

  if (!id || !name || !email || !dept || !role || !phone || isNaN(balance)) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  // Check if Employee ID already exists
  const idExists = state.employees.some(emp => emp.id.toLowerCase() === id.toLowerCase());
  if (idExists) {
    showToast(`Employee ID "${id}" already exists. Please choose a unique ID.`, 'error');
    return;
  }

  // Generate avatar initials
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

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
    aadhar: aadhar,
    pan: pan,
    bankAcc: bankAcc,
    bankIfsc: bankIfsc,
    photo: currentUploadedEmployeePhoto,
    password: password || 'password123'
  };

  state.employees.push(newEmp);
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));

  // Reset photo upload state
  currentUploadedEmployeePhoto = null;
  const photoPreview = document.getElementById('new-emp-photo-preview');
  if (photoPreview) {
    photoPreview.style.display = 'none';
  }

  // Reset Aadhar/PAN upload states
  currentUploadedAadharFile = null;
  const aadharPreview = document.getElementById('new-emp-aadhar-preview');
  if (aadharPreview) aadharPreview.style.display = 'none';
  currentUploadedPanFile = null;
  const panPreview = document.getElementById('new-emp-pan-preview');
  if (panPreview) panPreview.style.display = 'none';

  // Reset Bank details upload states
  currentUploadedBankAccFile = null;
  const bankAccPreview = document.getElementById('new-emp-bank-acc-preview');
  if (bankAccPreview) bankAccPreview.style.display = 'none';
  currentUploadedBankIfscFile = null;
  const bankIfscPreview = document.getElementById('new-emp-bank-ifsc-preview');
  if (bankIfscPreview) bankIfscPreview.style.display = 'none';

  // Re-populate all dropdown switchers and modal option lists
  populateEmployeeDropdown();
  populateTaskModalOptions();

  hideEmployeeModal();

  if (!state.currentUser) {
    showToast(`Employee "${name}" registered successfully! You can now sign in.`, 'success');
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
      if (!grouped[emp.dept]) grouped[emp.dept] = [];
      grouped[emp.dept].push(emp);
    });

    // Sort: put the project's own department first, then the rest alphabetically
    const depts = Object.keys(grouped).sort((a, b) => {
      if (a === project.dept) return -1;
      if (b === project.dept) return 1;
      return a.localeCompare(b);
    });

    depts.forEach(dept => {
      const group = document.createElement('optgroup');
      group.label = dept === project.dept ? `★ ${dept} (Project Dept)` : dept;
      grouped[dept].forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = `${emp.name} (${emp.role})`;
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

  // Default due date to 1 week from now
  const oneWeekLater = new Date();
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  const dueDateInput = document.getElementById('emp-task-due-date');
  if (dueDateInput) {
    dueDateInput.value = oneWeekLater.toISOString().split('T')[0];
    dueDateInput.min = new Date().toISOString().split('T')[0];
  }

  const startDateInput = document.getElementById('emp-task-start-date');
  if (startDateInput) {
    startDateInput.value = new Date().toISOString().split('T')[0];
    startDateInput.min = new Date().toISOString().split('T')[0];
  }

  // Populate the projects select with employee's department projects + other projects they have tasks in + "Personal Task"
  const projSelect = document.getElementById('emp-task-project-select');
  if (projSelect) {
    projSelect.innerHTML = '<option value="personal">Personal / Non-Project</option>';
    
    // Get unique project IDs where user has at least one assigned task
    const userTaskProjectIds = state.tasks
      .filter(t => t.assigneeId === state.currentUser.id && t.projectId)
      .map(t => t.projectId);

    const activeProjects = state.projects.filter(p => 
      p.dept === state.currentUser.dept || userTaskProjectIds.includes(p.id)
    );

    activeProjects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      projSelect.appendChild(opt);
    });
  }

  document.getElementById('emp-task-modal-overlay').classList.add('active');
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

  const newTask = {
    id: `TSK${400 + state.tasks.length + 1}`,
    projectId: projId === 'personal' ? '' : projId,
    projectName: projectName,
    desc: desc,
    details: details,
    images: [...currentAttachedImagesEmp],
    assigneeId: state.currentUser.id,
    assigneeName: state.currentUser.name,
    startDate: startDate,
    dueDate: dueDate,
    priority: priority,
    status: 'Not Completed',
    createdByEmployee: true
  };

  state.tasks.push(newTask);
  if (!safeSaveTasks()) {
    state.tasks.pop();
    return;
  }

  hideEmpTaskModal();
  if (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin') {
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
    messages = state.chats.filter(m => m.receiverId === 'group' && m.senderId !== state.currentUser.id);
  } else {
    messages = state.chats.filter(m => m.senderId === key && m.receiverId === state.currentUser.id);
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
  const otherEmployees = state.employees.filter(emp => emp.id !== state.currentUser.id);
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
  const isHRorAdmin = state.currentRole === 'hr' || state.currentRole === 'admin';
  
  if (isHRorAdmin) {
    // Pending reviews count (reports with empty remarks)
    return (state.dailyReports || []).filter(r => !r.remarks || r.remarks.trim() === '').length;
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
        visibleNotices = state.notices.filter(n => n.targetEmployeeIds.includes(state.currentUser.id));
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

  // Sync tab active classes
  const tabs = ['chats', 'announcements', 'notices', 'sms'];
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

function switchCommTab(tabName) {
  state.activeCommTab = tabName;
  renderCommunicationsHub();
}

function renderCommSidebar() {
  const titleEl = document.getElementById('comm-list-title-label');
  const itemsBox = document.getElementById('comm-list-items-box');
  if (!itemsBox) return;

  itemsBox.innerHTML = '';

  if (state.activeCommTab === 'chats') {
    titleEl.textContent = 'Conversations';

    // 1. Add Group Chat link
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

    // 2. Add Direct Messages for all other employees
    const otherEmployees = state.employees.filter(emp => emp.id !== state.currentUser.id);
    otherEmployees.forEach(emp => {
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
      empLink.innerHTML = `
        <div class="avatar" style="width:30px; height:30px; font-size:0.75rem;">${emp.avatar}</div>
        <div style="flex: 1;">
          <div style="font-weight:600; font-size:0.85rem;">${emp.name}</div>
          <div style="font-size:0.7rem; color:var(--text-muted);">${emp.dept}</div>
        </div>
        ${dmBadgeHtml}
      `;
      itemsBox.appendChild(empLink);
    });

  } else if (state.activeCommTab === 'announcements') {
    titleEl.textContent = 'Feeds';
    const link = document.createElement('div');
    link.className = 'comm-item-link active';
    link.innerHTML = `
      <div class="avatar" style="width:30px; height:30px; font-size:0.75rem; background: var(--warning);">📢</div>
      <div style="font-weight:600;">Announcements</div>
    `;
    itemsBox.appendChild(link);

  } else if (state.activeCommTab === 'notices') {
    titleEl.textContent = 'Feeds';
    const link = document.createElement('div');
    link.className = 'comm-item-link active';
    link.innerHTML = `
      <div class="avatar" style="width:30px; height:30px; font-size:0.75rem; background: var(--danger);">🔔</div>
      <div style="font-weight:600;">HR Notices</div>
    `;
    itemsBox.appendChild(link);
  } else if (state.activeCommTab === 'sms') {
    titleEl.textContent = 'Logs';
    const link = document.createElement('div');
    link.className = 'comm-item-link active';
    link.innerHTML = `
      <div class="avatar" style="width:30px; height:30px; font-size:0.75rem; background: var(--primary);">📱</div>
      <div style="font-weight:600;">SMS Log History</div>
    `;
    itemsBox.appendChild(link);
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
  } else if (state.activeCommTab === 'sms') {
    if (smsPane) smsPane.style.display = 'flex';
    renderSMSLogs();
  }
}

function renderChatRoom() {
  const headerTitle = document.getElementById('chat-header-title');
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
    filteredMessages = state.chats.filter(m => m.receiverId === 'group');
  } else {
    const targetEmp = state.employees.find(e => e.id === state.activeChatTargetId);
    headerTitle.textContent = targetEmp ? `Chat with ${targetEmp.name}` : 'Direct Message';
    filteredMessages = state.chats.filter(m =>
      (m.senderId === state.currentUser.id && m.receiverId === state.activeChatTargetId) ||
      (m.senderId === state.activeChatTargetId && m.receiverId === state.currentUser.id)
    );
  }

  if (filteredMessages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="empty-state" style="margin: auto;">
        <div class="empty-state-title">No messages yet</div>
        <p>Send a message below to start the conversation.</p>
      </div>
    `;
  } else {
    // Sort chronological (oldest first)
    const sorted = [...filteredMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    sorted.forEach(msg => {
      const isSent = msg.senderId === state.currentUser.id;
      const row = document.createElement('div');
      row.className = `message-row ${isSent ? 'sent' : 'received'}`;

      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let fileHtml = '';
      if (msg.file) {
        const f = msg.file;
        if (f.type.startsWith('image/')) {
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

      row.innerHTML = `
        ${(!isSent && state.activeChatType === 'group') ? `<div class="message-sender-name">${msg.senderName}</div>` : ''}
        <div class="message-bubble">
          <div>${msg.content}</div>
          ${fileHtml}
        </div>
        <div class="message-time">${timeStr}</div>
      `;
      messagesContainer.appendChild(row);
    });
  }

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleChatMessageSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input-message');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  const newMsg = {
    id: `MSG${String(state.chats.length + 1).padStart(3, '0')}`,
    senderId: state.currentUser.id,
    senderName: state.currentUser.name,
    receiverId: state.activeChatType === 'group' ? 'group' : state.activeChatTargetId,
    content: content,
    timestamp: new Date().toISOString()
  };

  state.chats.push(newMsg);
  localStorage.setItem('ems_chats', JSON.stringify(state.chats));
  triggerChatNotification(newMsg);

  input.value = '';
  renderChatRoom();
}

function handleChatFileSelected(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Data = e.target.result;
    const newMsg = {
      id: `MSG${String(state.chats.length + 1).padStart(3, '0')}`,
      senderId: state.currentUser.id,
      senderName: state.currentUser.name,
      receiverId: state.activeChatType === 'group' ? 'group' : state.activeChatTargetId,
      content: `Sent a file: ${file.name}`,
      file: {
        name: file.name,
        type: file.type,
        data: base64Data
      },
      timestamp: new Date().toISOString()
    };

    state.chats.push(newMsg);
    localStorage.setItem('ems_chats', JSON.stringify(state.chats));
    triggerChatNotification(newMsg);
    input.value = '';
    renderChatRoom();
  };
  reader.readAsDataURL(file);
}
window.handleChatFileSelected = handleChatFileSelected;

function renderAnnouncements() {
  const feedList = document.getElementById('announcements-feed-list');
  const btnPost = document.getElementById('btn-post-announcement');
  if (!feedList) return;

  feedList.innerHTML = '';

  // Show post button to HR and Admin roles
  if (state.currentRole === 'hr' || state.currentRole === 'admin') {
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

    card.innerHTML = `
      <div class="feed-card-header">
        <div class="feed-card-title">${ann.title}</div>
        <div class="feed-card-meta">
          <span>By <strong>${ann.senderName}</strong></span>
          <span>${dateStr}</span>
        </div>
      </div>
      <div class="feed-card-content">${ann.content}</div>
      ${attachmentsHtml}
    `;
    feedList.appendChild(card);
  });
}

function handleAnnouncementSubmit(e) {
  e.preventDefault();
  const titleInput = document.getElementById('announcement-title');
  const contentInput = document.getElementById('announcement-content');
  if (!titleInput || !contentInput) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  const newAnn = {
    id: `ANN${String(state.announcements.length + 1).padStart(3, '0')}`,
    title: title,
    content: content,
    images: [...currentAttachedImagesAnnouncement],
    senderName: state.currentUser.name,
    timestamp: new Date().toISOString()
  };

  state.announcements.unshift(newAnn);
  localStorage.setItem('ems_announcements', JSON.stringify(state.announcements));

  // Trigger SMS notifications for all employees (excluding sender)
  state.employees.forEach(emp => {
    if (emp.phone && emp.id !== state.currentUser.id) {
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

    // For HR, show who the notice was sent to
    let targetsStr = '';
    if (state.currentRole === 'hr') {
      const names = notice.targetEmployeeIds.map(id => state.employees.find(e => e.id === id)?.name || id);
      targetsStr = `<div style="font-size:0.75rem; color:var(--primary); margin-top: 8px;">Sent to: ${names.join(', ')}</div>`;
    }

    const attachmentsHtml = renderAttachmentsHTML(notice.images || [], notice.id);

    card.innerHTML = `
      <div class="feed-card-header">
        <div class="feed-card-title">${notice.title}</div>
        <div class="feed-card-meta">
          <span>By <strong>${notice.senderName}</strong></span>
          <span>${dateStr}</span>
        </div>
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
    timestamp: new Date().toISOString()
  };

  state.notices.unshift(newNotice);
  localStorage.setItem('ems_notices', JSON.stringify(state.notices));

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
    const item = document.createElement('label');
    item.className = 'employee-checkbox-item';
    item.dataset.name = emp.name.toLowerCase();
    item.dataset.dept = (emp.dept || 'Engineering').toLowerCase();
    item.innerHTML = `
      <input type="checkbox" value="${emp.id}">
      <span>${emp.name} (${emp.dept || 'Engineering'} - ${emp.role})</span>
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
  const todayStr = new Date().toISOString().split('T')[0];

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
      if (state.currentRole === 'hr' || state.currentRole === 'techlead') {
        return true;
      } else {
        return req.employeeId === state.currentUser.id;
      }
    });

    leaves.forEach(req => {
      const lEl = document.createElement('div');
      lEl.className = 'calendar-event event-leave';
      if (state.currentRole === 'hr' || state.currentRole === 'techlead') {
        lEl.title = `${req.employeeName} - ${req.type} Leave (${req.reason})`;
        lEl.textContent = `${req.employeeName.split(' ')[0]}: ${req.type}`;
      } else {
        lEl.title = `My ${req.type} Leave (${req.reason})`;
        lEl.textContent = `Leave: ${req.type}`;
      }
      eventsContainer.appendChild(lEl);
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
  const todayStr = new Date().toISOString().split('T')[0];

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
      if (state.currentRole === 'hr' || state.currentRole === 'techlead') {
        return true;
      } else {
        return req.employeeId === state.currentUser.id;
      }
    });

    leaves.forEach(req => {
      const lEl = document.createElement('div');
      lEl.className = 'calendar-event event-leave';
      if (state.currentRole === 'hr' || state.currentRole === 'techlead') {
        lEl.title = `${req.employeeName} - ${req.type} Leave (${req.reason})`;
        lEl.textContent = `${req.employeeName.split(' ')[0]}: ${req.type}`;
      } else {
        lEl.title = `My ${req.type} Leave (${req.reason})`;
        lEl.textContent = `Leave: ${req.type}`;
      }
      eventsContainer.appendChild(lEl);
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

// --- Daily Reports Functions ---
function setTodayReportDate() {
  const reportDateInput = document.getElementById('report-date');
  if (reportDateInput) {
    reportDateInput.value = new Date().toISOString().split('T')[0];
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
  return role === 'tech lead' ? 'techlead' : role === 'hr' ? 'hr' : role === 'admin' ? 'admin' : 'employee';
}

function canUserSeeReport(currentUserRole, reporterRole) {
  if (reporterRole === 'employee') {
    return ['techlead', 'hr', 'admin'].includes(currentUserRole);
  }
  if (reporterRole === 'techlead') {
    return ['hr', 'admin'].includes(currentUserRole);
  }
  if (reporterRole === 'hr') {
    return ['admin'].includes(currentUserRole);
  }
  return false;
}

function canUserReviewReport(currentUserRole, reporterRole) {
  return canUserSeeReport(currentUserRole, reporterRole);
}

function canUserStarReport(currentUserRole, reporterRole) {
  if (reporterRole === 'employee') {
    return currentUserRole === 'techlead';
  }
  if (reporterRole === 'techlead') {
    return currentUserRole === 'hr';
  }
  if (reporterRole === 'hr') {
    return currentUserRole === 'admin';
  }
  return false;
}

function safeSaveReports() {
  try {
    localStorage.setItem('ems_reports', JSON.stringify(state.dailyReports));
    return true;
  } catch (error) {
    console.error('Failed to save reports to localStorage:', error);
    showToast('Storage quota exceeded! Attached screenshots may be too large.', 'error');
    try {
      state.dailyReports = JSON.parse(localStorage.getItem('ems_reports') || '[]');
    } catch (e) {
      // ignore
    }
    return false;
  }
}

function renderDailyReports() {
  const empSection = document.getElementById('reports-employee-section');
  const hrSection = document.getElementById('reports-hr-section');
  if (!empSection || !hrSection) return;

  if (state.currentRole === 'employee') {
    empSection.style.display = 'flex';
    empSection.style.marginBottom = '0';
    hrSection.style.display = 'none';
    renderEmployeeReports();
  } else if (state.currentRole === 'techlead' || state.currentRole === 'hr') {
    empSection.style.display = 'flex';
    empSection.style.marginBottom = '32px';
    hrSection.style.display = 'flex';
    renderEmployeeReports();
    renderHRReports();
  } else if (state.currentRole === 'admin') {
    empSection.style.display = 'none';
    empSection.style.marginBottom = '0';
    hrSection.style.display = 'flex';
    renderHRReports();
  }
}

function renderEmployeeReports() {
  const tbody = document.getElementById('emp-reports-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const userReports = state.dailyReports.filter(r => r.employeeId === state.currentUser.id);

  if (userReports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3">
          <div class="empty-state">
            <div class="empty-state-title">No daily reports submitted yet</div>
            <p>Fill in the form to submit your report for today.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const sortedReports = [...userReports].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedReports.forEach(report => {
    const isExpanded = state.expandedReportIds && state.expandedReportIds.has(report.id);
    const hasRemarks = report.remarks && report.remarks.trim().length > 0;

    const tr = document.createElement('tr');
    tr.className = 'report-row';
    tr.onclick = (e) => toggleReportDetailsExpand(report.id, e);

    tr.innerHTML = `
      <td><strong>${formatDate(report.date)}</strong></td>
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
          ${report.images.map((imgBase64, idx) => `
            <img src="${imgBase64}" onclick="openFullImageViewModal('${report.id}', ${idx}, event)" class="report-image-thumbnail">
          `).join('')}
        </div>
      `;
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
      <td colspan="3" style="padding: 0;">
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

function populateHRReportFilters() {
  const monthSelect = document.getElementById('filter-report-month');
  const empSelect = document.getElementById('filter-report-employee');
  if (!monthSelect || !empSelect) return;

  const currentMonthVal = monthSelect.value || 'all';
  const currentEmpVal = empSelect.value || 'all';

  // Get unique months from reports
  const months = new Set();
  state.dailyReports.forEach(report => {
    if (report.date && canUserSeeReport(state.currentRole, getReportReporterRole(report))) {
      months.add(getMonthYearStr(report.date));
    }
  });

  // Sort months chronologically descending
  const sortedMonths = Array.from(months).sort((a, b) => {
    if (a === 'Unknown Month') return 1;
    if (b === 'Unknown Month') return -1;
    return new Date(b) - new Date(a);
  });

  monthSelect.innerHTML = '<option value="all">All Months</option>';
  sortedMonths.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    monthSelect.appendChild(opt);
  });

  // Get unique employees who submitted reports
  const empMap = new Map();
  state.dailyReports.forEach(report => {
    if (canUserSeeReport(state.currentRole, getReportReporterRole(report))) {
      empMap.set(report.employeeId, report.employeeName);
    }
  });

  empSelect.innerHTML = '<option value="all">All Employees</option>';
  empMap.forEach((name, id) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    empSelect.appendChild(opt);
  });

  // Restore values
  monthSelect.value = currentMonthVal;
  if (monthSelect.value !== currentMonthVal) monthSelect.value = 'all';

  empSelect.value = currentEmpVal;
  if (empSelect.value !== currentEmpVal) empSelect.value = 'all';
}

function renderHRReports() {
  const tbody = document.getElementById('hr-reports-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Populate dynamic dropdown options
  populateHRReportFilters();

  const monthSelect = document.getElementById('filter-report-month');
  const empSelect = document.getElementById('filter-report-employee');
  const selectedMonth = monthSelect ? monthSelect.value : 'all';
  const selectedEmp = empSelect ? empSelect.value : 'all';

  // Filter daily reports
  const filteredReports = state.dailyReports.filter(report => {
    // Role-based visibility check
    const reporterRole = getReportReporterRole(report);
    if (!canUserSeeReport(state.currentRole, reporterRole)) {
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

    return matchesMonth && matchesEmp;
  });

  if (filteredReports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
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
  const sortedReports = [...filteredReports].sort((a, b) => new Date(b.date) - new Date(a.date));

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
      <td colspan="5" style="font-weight: 700; padding: 12px 20px; font-size: 0.9rem;">
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
        <td><strong>${formatDate(report.date)}</strong></td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="avatar" style="width: 28px; height: 28px; font-size: 0.75rem;">
              ${report.employeeName.split(' ').map(n => n[0]).join('')}
            </div>
            <span style="font-weight: 600;">${report.employeeName}</span>
          </div>
        </td>
        <td>${report.dept}</td>
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
            ${report.images.map((imgBase64, idx) => `
              <img src="${imgBase64}" onclick="openFullImageViewModal('${report.id}', ${idx}, event)" class="report-image-thumbnail">
            `).join('')}
          </div>
        `;
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
                      ${[0,1,2,3,4,5,6,7,8,9,10].map(v => `<option value="${v}" ${report.starRating === v ? 'selected' : ''}>${v}/10</option>`).join('')}
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
                  ${[0,1,2,3,4,5,6,7,8,9,10].map(v => `<option value="${v}" ${report.starRating === v ? 'selected' : ''}>${v}/10</option>`).join('')}
                </select>
              </div>
              ` : ''}
            </div>
          </div>
        `;
      }

      detailsTr.innerHTML = `
        <td colspan="5" style="padding: 0;">
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

function handleDailyReportSubmit(e) {
  e.preventDefault();

  const reportDateInput = document.getElementById('report-date');
  const reportDetailsInput = document.getElementById('report-details');

  if (!reportDateInput || !reportDetailsInput) return;

  const dateVal = reportDateInput.value;
  const detailsVal = reportDetailsInput.value.trim();

  if (!dateVal || !detailsVal) {
    showToast('Please fill out all required fields.', 'error');
    return;
  }

  const newReport = {
    id: `REP${500 + state.dailyReports.length + 1}`,
    employeeId: state.currentUser.id,
    employeeName: state.currentUser.name,
    employeeRole: state.currentUser.role,
    dept: state.currentUser.dept,
    date: dateVal,
    details: detailsVal,
    images: [...currentAttachedImagesReport],
    remarks: '',
    reviewedBy: '',
    reviewedAt: '',
    starRating: 0
  };

  state.dailyReports.push(newReport);

  if (!safeSaveReports()) {
    state.dailyReports.pop();
    return;
  }

  // Trigger SMS notifications for HR and Admin users
  state.employees.forEach(emp => {
    if ((emp.role === 'HR' || emp.role === 'Admin') && emp.id !== state.currentUser.id) {
      if (emp.phone) {
        triggerSMSNotification(
          emp.phone,
          `New Daily Report Submitted: ${state.currentUser.name} (${state.currentUser.dept}) sent a report for ${dateVal}. Details: ${detailsVal.substring(0, 100)}${detailsVal.length > 100 ? '...' : ''}`,
          emp.name
        );
      }
    }
  });

  currentAttachedImagesReport.length = 0;
  const preview = document.getElementById('report-images-preview');
  if (preview) preview.innerHTML = '';

  document.getElementById('daily-report-form').reset();
  setTodayReportDate();

  renderDailyReports();
  showToast('Daily report submitted successfully!', 'success');
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
  report.remarks = remarksText;
  report.reviewedBy = state.currentUser.name;
  report.reviewedAt = new Date().toISOString().split('T')[0];

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
window.cycleTaskStatus = cycleTaskStatus;
window.toggleTaskCompletion = toggleTaskCompletion;
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

  if (!emp.salaries[month]) {
    if (emp.salary) {
      emp.salaries[month] = { ...emp.salary, lwpDays: computedLwp };
    } else {
      let basic = 45000;
      if (emp.role === 'Admin') basic = 90000;
      else if (emp.role === 'HR') basic = 60000;
      else if (emp.role === 'Tech Lead') basic = 75000;
      emp.salaries[month] = {
        basic: basic,
        hra: Math.round(basic * 0.40),
        other: Math.round(basic * 0.15),
        profTax: 200,
        lwpDays: computedLwp
      };
    }
  } else {
    // Always refresh LWP from simulator (unless HR has a manual override flag)
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

  const basic = Number(salary.basic);
  const hra = Number(salary.hra);
  const other = Number(salary.other);
  const totalEarnings = basic + hra + other + approvedReimbSum;

  const profTax = Number(salary.profTax);
  const lwpDays = Number(salary.lwpDays || 0);
  const lwpDeduction = Math.round((basic / 30) * lwpDays);
  const totalDeductions = profTax + lwpDeduction;

  // Compute paid leave days for this month (total approved - lwp)
  const monthAccrual = getEmployeeLeaveAccumulation(targetEmp.id, selectedMonth);
  const leavesThisMonth = getEmployeeLeavesPerMonth(targetEmp.id)[selectedMonth] || 0;
  const paidLeaveDays = Math.max(0, leavesThisMonth - lwpDays);

  const netPay = totalEarnings - totalDeductions;

  // Format month name
  const [year, month] = selectedMonth.split('-');
  const dateObj = new Date(year, month - 1);
  const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid var(--border-color); padding-bottom: 20px; margin-bottom: 24px;">
      <div>
        <h2 style="font-weight: 800; color: var(--primary); margin: 0; font-size: 1.6rem;">AIR G International</h2>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 4px 0 0 0;">100 Innovation Way, Tech District</p>
      </div>
      <div style="text-align: right;">
        <h3 style="font-weight: 700; margin: 0; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.5px;">Payslip</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 4px 0 0 0; font-weight: 600;">For the Month of ${monthName}</p>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; font-size: 0.85rem; background-color: var(--bg-tertiary); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);">
      <div>
        <span style="color: var(--text-muted); display: block; font-size: 0.75rem; text-transform: uppercase;">Employee Name</span>
        <strong style="color: var(--text-primary); font-size: 0.95rem;">${targetEmp.name}</strong>
      </div>
      <div>
        <span style="color: var(--text-muted); display: block; font-size: 0.75rem; text-transform: uppercase;">Employee ID</span>
        <strong style="color: var(--text-primary); font-size: 0.95rem;">${targetEmp.id}</strong>
      </div>
      <div>
        <span style="color: var(--text-muted); display: block; font-size: 0.75rem; text-transform: uppercase;">Department</span>
        <strong style="color: var(--text-primary); font-size: 0.95rem;">${targetEmp.dept || 'Engineering'}</strong>
      </div>
      <div>
        <span style="color: var(--text-muted); display: block; font-size: 0.75rem; text-transform: uppercase;">Designation</span>
        <strong style="color: var(--text-primary); font-size: 0.95rem;">${targetEmp.role}</strong>
      </div>
    </div>

    <!-- Earnings & Deductions Tables -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px;">
      <!-- Earnings -->
      <div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 10px; text-align: left; background-color: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">Earnings</th>
              <th style="padding: 10px; text-align: right; background-color: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">Basic Pay</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border-color);">${basic.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">House Rent Allowance</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border-color);">${hra.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">Other Allowance</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border-color);">${other.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">Expense Reimbursement</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border-color);">${approvedReimbSum.toLocaleString()}</td>
            </tr>
            <tr style="font-weight: 700; background-color: var(--bg-tertiary);">
              <td style="padding: 10px;">Total Earnings</td>
              <td style="padding: 10px; text-align: right;">${totalEarnings.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Deductions -->
      <div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 10px; text-align: left; background-color: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">Deductions</th>
              <th style="padding: 10px; text-align: right; background-color: var(--bg-tertiary); border-bottom: 2px solid var(--border-color);">Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">Professional Tax</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border-color);">${profTax.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">Leave Without Pay (${lwpDays} days)</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border-color);">${lwpDeduction.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">Leave With Pay (${paidLeaveDays} days)</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid var(--border-color);">0</td>
            </tr>
            <tr style="height: 40px; border-bottom: 1px solid var(--border-color);">
              <td style="padding: 10px;"></td>
              <td style="padding: 10px;"></td>
            </tr>
            <tr style="font-weight: 700; background-color: var(--bg-tertiary);">
              <td style="padding: 10px;">Total Deductions</td>
              <td style="padding: 10px; text-align: right;">${totalDeductions.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Net Pay Block -->
    <div style="display: flex; justify-content: space-between; align-items: center; background: var(--primary-gradient); padding: 18px 24px; border-radius: 8px; color: #fff; margin-bottom: 24px; box-shadow: var(--primary-glow);">
      <div style="font-size: 1.1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Net Take-Home Pay</div>
      <div style="font-size: 1.8rem; font-weight: 800;">$${netPay.toLocaleString()}</div>
    </div>

    <div style="display: flex; justify-content: flex-end;">
      <button class="btn btn-secondary" id="payslip-print-btn" onclick="printPayslip()" style="display: inline-flex; align-items: center; gap: 8px;">
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Print / Download Payslip
      </button>
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
            padding: 40px !important;
            font-family: system-ui, -apple-system, sans-serif !important;
          }
          .card {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
          }
          .btn, #payslip-print-btn {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-bottom: 20px !important;
          }
          th, td {
            border: 1px solid #ddd !important;
            padding: 12px !important;
          }
          th {
            background-color: #f5f5f5 !important;
            color: #000 !important;
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
  state.employees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.dept} - ${emp.role})`;
    select.appendChild(opt);
  });
  if (currentVal && state.employees.some(e => e.id === currentVal)) {
    select.value = currentVal;
  } else {
    select.value = state.employees[0].id;
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

    document.getElementById('salary-basic').value = salary.basic;
    document.getElementById('salary-hra').value = salary.hra;
    document.getElementById('salary-other').value = salary.other;
    document.getElementById('salary-proftax').value = salary.profTax;
    document.getElementById('salary-lwp').value = salary.lwpDays || 0;
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

  const salaryData = {
    basic: Number(document.getElementById('salary-basic').value),
    hra: Number(document.getElementById('salary-hra').value),
    other: Number(document.getElementById('salary-other').value),
    profTax: Number(document.getElementById('salary-proftax').value),
    lwpDays: Number(document.getElementById('salary-lwp').value || 0),
    _lwpManualOverride: true  // HR explicitly set LWP — preserve it
  };

  emp.salaries[selectedMonth] = salaryData;
  emp.salary = { ...salaryData, _lwpManualOverride: false }; // base template: auto-compute LWP

  localStorage.setItem('ems_employees', JSON.stringify(state.employees));
  showToast(`Salary details for ${emp.name} for ${selectedMonth} updated!`, 'success');
  renderPayslips();
}

function renderReimbursements() {
  const isEmployee = state.currentRole === 'employee' || state.currentRole === 'techlead';
  const empSection = document.getElementById('reimbursement-employee-section');
  const hrSection = document.getElementById('reimbursement-hr-section');

  if (isEmployee) {
    if (empSection) empSection.style.display = 'flex';
    if (hrSection) hrSection.style.display = 'none';

    // Populate employee form details
    const nameInput = document.getElementById('reimbursement-emp-name');
    if (nameInput) nameInput.value = state.currentUser.name;

    // Reset date default to today
    const dateInput = document.getElementById('reimbursement-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Render claims history
    const tbody = document.getElementById('emp-reimbursements-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      const myClaims = state.reimbursements.filter(c => c.employeeId === state.currentUser.id);
      if (myClaims.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-state-title">No reimbursement claims yet</div><p>Submit a new claim using the form on the left.</p></div></td></tr>`;
      } else {
        // Sort newest first
        myClaims.sort((a,b) => new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date));
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

          tr.innerHTML = `
            <td>${formatDate(claim.date)}</td>
            <td><strong>${claim.type}</strong></td>
            <td style="font-weight:700; color:var(--primary);">$${claim.amount}</td>
            <td>${claim.location}</td>
            <td title="${claim.purpose}">${truncateText(claim.purpose, 25)}</td>
            <td>${attachmentsHTML}</td>
            <td><span class="badge badge-${claim.status.toLowerCase()}">${claim.status}</span></td>
            <td>${claim.comment || '<span class="text-muted">-</span>'}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  } else {
    // HR / Admin
    if (empSection) empSection.style.display = 'none';
    if (hrSection) hrSection.style.display = 'flex';

    // 1. Render Approval Queue
    const queueTbody = document.getElementById('hr-reimbursements-queue-tbody');
    if (queueTbody) {
      queueTbody.innerHTML = '';
      const pendingClaims = state.reimbursements.filter(c => c.status === 'pending');
      if (pendingClaims.length === 0) {
        queueTbody.innerHTML = `<tr><td colspan="8"><div class="empty-state" style="padding: 24px;"><div class="empty-state-title">No pending claims</div><p>All reimbursement requests have been processed.</p></div></td></tr>`;
      } else {
        pendingClaims.sort((a,b) => new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date));
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
            <td style="font-weight:700; color:var(--primary);">$${claim.amount}</td>
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
    }

    // 2. Render Archive Table
    const archiveTbody = document.getElementById('hr-reimbursements-all-tbody');
    if (archiveTbody) {
      archiveTbody.innerHTML = '';
      
      const searchQ = (document.getElementById('hr-reimbursement-search').value || '').toLowerCase();
      const filterType = document.getElementById('filter-reimbursement-type').value;
      const filterStatus = document.getElementById('filter-reimbursement-status').value;

      const filtered = state.reimbursements.filter(c => {
        const matchesSearch = c.employeeName.toLowerCase().includes(searchQ) || c.purpose.toLowerCase().includes(searchQ);
        const matchesType = filterType === 'all' || c.type === filterType;
        const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
        return matchesSearch && matchesType && matchesStatus;
      });

      if (filtered.length === 0) {
        archiveTbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-state-title">No matching claims found</div><p>Adjust your search query or filter settings.</p></div></td></tr>`;
      } else {
        filtered.sort((a,b) => new Date(b.submittedAt || b.date) - new Date(a.submittedAt || a.date));
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
            <td style="font-weight:700; color:var(--primary);">$${claim.amount}</td>
            <td>${claim.location}</td>
            <td title="${claim.purpose}">${truncateText(claim.purpose, 25)}</td>
            <td>${attachmentsHTML}</td>
            <td><span class="badge badge-${claim.status.toLowerCase()}">${claim.status}</span></td>
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
    id: `REIM${100 + state.reimbursements.length + 1}`,
    employeeId: state.currentUser.id,
    employeeName: state.currentUser.name,
    type: type,
    amount: Number(amount),
    date: date,
    location: location,
    purpose: purpose,
    attachments: [...currentAttachedReimbursementFiles],
    status: 'pending',
    comment: '',
    submittedAt: new Date().toISOString().split('T')[0]
  };

  state.reimbursements.push(newClaim);
  
  try {
    localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
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
    const reader = new FileReader();
    reader.onload = function(event) {
      const base64Data = event.target.result;
      
      // Let's compress if it is an image to fit storage quota nicely
      if (file.type.startsWith('image/')) {
        compressImage(base64Data, 200, 200, 0.7, function(compressed) {
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

function approveReimbursement(id) {
  const claim = state.reimbursements.find(c => c.id === id);
  if (!claim) return;

  const commentInput = document.getElementById(`reimb-comment-${id}`);
  const comment = commentInput ? commentInput.value.trim() : '';

  claim.status = 'approved';
  claim.comment = comment || 'Approved by HR';
  localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));
  
  showToast(`Approved claim of $${claim.amount} for ${claim.employeeName}!`, 'success');
  
  // Refresh views
  renderReimbursements();
  // Also refresh payslips in case we approved a reimbursement for the current month!
  renderPayslips();
}

function rejectReimbursement(id) {
  const claim = state.reimbursements.find(c => c.id === id);
  if (!claim) return;

  const commentInput = document.getElementById(`reimb-comment-${id}`);
  const comment = commentInput ? commentInput.value.trim() : '';

  claim.status = 'rejected';
  claim.comment = comment || 'Rejected by HR';
  localStorage.setItem('ems_reimbursements', JSON.stringify(state.reimbursements));

  showToast(`Rejected claim of $${claim.amount} for ${claim.employeeName}.`, 'success');
  renderReimbursements();
  renderPayslips();
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

function checkAuthSession() {
  const loggedInStr = localStorage.getItem('ems_logged_in_user');
  if (loggedInStr) {
    try {
      const storedUser = JSON.parse(loggedInStr);
      const found = state.employees.find(emp => emp.id === storedUser.id);
      if (found) {
        loginAsUser(found);
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

function handleLoginSubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (!emailInput || !passwordInput) return;

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  const found = state.employees.find(emp => emp.email.toLowerCase() === email);
  if (found) {
    const matchPassword = found.password || 'password123';
    if (password === matchPassword) {
      localStorage.setItem('ems_logged_in_user', JSON.stringify(found));
      loginAsUser(found);
      showToast('Logged in successfully.', 'success');
      return;
    }
  }
  showToast('Invalid email or password.', 'error');
}

function quickLogin(identifier) {
  const found = state.employees.find(emp => 
    emp.id === identifier || emp.email.toLowerCase() === identifier.toLowerCase()
  );
  if (found) {
    localStorage.setItem('ems_logged_in_user', JSON.stringify(found));
    loginAsUser(found);
    showToast(`Signed in as ${found.name}.`, 'success');
  }
}

function loginAsUser(user) {
  state.currentUser = user;
  document.body.classList.remove('auth-view');

  // Update Profile Widget
  updateHeaderAvatar(user);
  const headerName = document.getElementById('header-name');
  if (headerName) headerName.textContent = user.name;
  const headerRole = document.getElementById('header-role');
  if (headerRole) headerRole.textContent = user.dept || user.role;

  // Bind role UI display
  const targetRole = user.role.toLowerCase() === 'tech lead' ? 'techlead' : user.role.toLowerCase() === 'hr' ? 'hr' : user.role.toLowerCase() === 'admin' ? 'admin' : 'employee';
  setRole(targetRole);

  updateCommMenuBadges();

  // Register push notifications
  if (user && 'serviceWorker' in navigator && 'PushManager' in window) {
    setupPushSubscription(user.id);
  }
}

function logout() {
  localStorage.removeItem('ems_logged_in_user');
  state.currentUser = null;
  state.currentRole = null;
  showLoginScreen();
  updateAllMenuBadges();
  showToast('Logged out successfully.', 'info');
}

window.quickLogin = quickLogin;
window.logout = logout;

// ==========================================
// --- SUPPORT TICKET SYSTEM MODULE ---
// ==========================================

function renderTickets() {
  const isAgent = (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin');
  
  const subTabs = document.getElementById('ticket-sub-tabs');
  const empSection = document.getElementById('ticket-employee-section');
  const agentSection = document.getElementById('ticket-agent-section');

  if (isAgent) {
    if (subTabs) subTabs.style.display = 'flex';
    
    // Update sub-tabs active classes
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
  const userId = state.currentUser.id;
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
    const statusClass = `badge badge-${t.status.toLowerCase().replace(' ', '')}`;
    const formattedDate = new Date(t.updatedAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    const assigneeName = t.assignedToName || '<span style="color: var(--text-muted); font-style: italic;">Unassigned</span>';

    return `
      <tr>
        <td><strong>${t.id}</strong></td>
        <td>${t.category}</td>
        <td>${escapeHTML(t.title)}</td>
        <td><span class="badge ${getPriorityBadgeClass(t.priority)}">${t.priority}</span></td>
        <td><span class="${statusClass}">${t.status}</span></td>
        <td>${assigneeName}</td>
        <td>${formattedDate}</td>
        <td>
          <button class="btn btn-secondary btn-xs" onclick="openTicketDetails('${t.id}')">View Details</button>
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

// Priority Badge Class Helper
function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'Critical': return 'badge-rejected'; // red
    case 'High': return 'badge-rejected'; // red/orange
    case 'Medium': return 'badge-pending'; // yellow
    case 'Low': return 'badge-approved'; // green
    default: return 'badge-pending';
  }
}

function getDepartmentTechLead(dept) {
  const tl = state.employees.find(emp => emp.role === 'Tech Lead' && emp.dept === dept);
  if (tl) return tl;
  const defaults = {
    'Engineering': { id: 'EMP007', name: 'Elena Rostova' },
    'Design': { id: 'EMP012', name: 'Liam Carter' },
    'Sales': { id: 'EMP013', name: 'Sophia Vance' },
    'Marketing': { id: 'EMP014', name: 'Oliver Brooks' },
    'Human Resources': { id: 'EMP015', name: 'Emma Stone' }
  };
  return defaults[dept] || { id: 'EMP011', name: 'Richard Boss' };
}

// 2. Agent / Admin view rendering
function renderAgentTickets() {
  const query = (document.getElementById('ticket-agent-search')?.value || '').toLowerCase().trim();
  const filterCat = document.getElementById('ticket-filter-category')?.value || 'all';
  const filterPrio = document.getElementById('ticket-filter-priority')?.value || 'all';
  const filterStatus = document.getElementById('ticket-filter-status')?.value || 'all';

  const userRole = state.currentRole; // 'hr', 'techlead', 'admin'
  const userDept = state.currentUser.dept;

  // Base role-specific visibility routing
  let visibleTickets = state.tickets.filter(t => {
    // Admin sees all tickets
    if (userRole === 'admin') return true;

    // Tech Lead only sees technical blockers from their own department (or assigned to them)
    if (userRole === 'techlead') {
      const isTechLeadAssignee = (t.assignedToId === state.currentUser.id);
      const isDeptBlocker = (t.category === 'Technical Blocker' && t.targetDept === userDept);
      return isTechLeadAssignee || isDeptBlocker;
    }

    // HR only sees HR support and Finance tickets (or assigned to them)
    if (userRole === 'hr') {
      const isHRAssignee = (t.assignedToId === state.currentUser.id);
      const isHRCategory = (t.targetRole === 'hr' || t.category === 'HR Support' || t.category === 'Finance');
      return isHRAssignee || isHRCategory;
    }

    return false;
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
    const statusClass = `badge badge-${t.status.toLowerCase().replace(' ', '')}`;
    const formattedDate = new Date(t.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    const assigneeName = t.assignedToName || '<span style="color: var(--warning); font-style: italic;">Unassigned</span>';

    return `
      <tr>
        <td><strong>${t.id}</strong></td>
        <td>${escapeHTML(t.employeeName)}</td>
        <td>${t.category}</td>
        <td>${escapeHTML(t.title)}</td>
        <td><span class="badge ${getPriorityBadgeClass(t.priority)}">${t.priority}</span></td>
        <td><span class="${statusClass}">${t.status}</span></td>
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
function handleTicketFormSubmit(e) {
  e.preventDefault();

  const titleInput = document.getElementById('ticket-title');
  const catInput = document.getElementById('ticket-category');
  const prioInput = document.getElementById('ticket-priority');
  const descInput = document.getElementById('ticket-description');

  if (!titleInput || !catInput || !prioInput || !descInput) return;

  // Determine routing rules based on category
  const category = catInput.value;
  let targetRole = 'admin';
  let targetDept = '';
  let assignedToId = '';
  let assignedToName = '';

  if (category === 'Technical Blocker') {
    targetRole = 'techlead';
    targetDept = state.currentUser.dept || 'Engineering';
    const tl = getDepartmentTechLead(targetDept);
    assignedToId = tl.id;
    assignedToName = tl.name;
  } else if (category === 'HR Support') {
    targetRole = 'hr';
    assignedToId = 'EMP001';
    assignedToName = 'Sarah Jenkins';
  } else {
    // IT Support, Facilities, Finance
    targetRole = 'admin';
    assignedToId = 'EMP011';
    assignedToName = 'Richard Boss';
  }

  // Find next sequential ID
  const maxIdNum = state.tickets.reduce((max, t) => {
    const match = t.id.match(/^TCK(\d+)$/);
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
  const newId = `TCK${String(maxIdNum + 1).padStart(3, '0')}`;

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
    attachments: [...currentAttachedImagesTicket]
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
    
    renderTickets();
  }
}

function safeSaveTickets() {
  try {
    localStorage.setItem('ems_tickets', JSON.stringify(state.tickets));
    return true;
  } catch (error) {
    console.error('Failed to save tickets to localStorage:', error);
    showToast('Storage quota exceeded! Attached images may be too large.', 'error');
    try {
      state.tickets = JSON.parse(localStorage.getItem('ems_tickets') || '[]');
    } catch (e) {}
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
    attachmentsContainer.innerHTML = renderAttachmentsHTML(ticket.attachments, ticket.id);
  }

  // Display Agent Controls only to HR/TechLead/Admin
  const isAgent = (state.currentRole === 'hr' || state.currentRole === 'techlead' || state.currentRole === 'admin');
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
    id: `SMS${Date.now()}_${Math.floor(Math.random()*1000)}`,
    recipientPhone: phone,
    recipientName: recipientName,
    message: message,
    timestamp: new Date().toISOString()
  };
  state.smsNotifications = state.smsNotifications || [];
  state.smsNotifications.unshift(newSMS);
  localStorage.setItem('ems_notifications', JSON.stringify(state.smsNotifications));
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

// Run application on DOM loaded
window.addEventListener('DOMContentLoaded', init);
