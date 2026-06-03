// EMS Leave Portal - Application Logic

// --- Constants & Seed Data ---
const DEFAULT_EMPLOYEES = [
  { id: 'EMP001', name: 'Sarah Jenkins', dept: 'Human Resources', email: 'sarah.j@company.com', role: 'HR', balance: 20, absent: 0, avatar: 'SJ' },
  { id: 'EMP002', name: 'Alex Rivera', dept: 'Engineering', email: 'alex.r@company.com', role: 'Employee', balance: 15, absent: 5, avatar: 'AR' },
  { id: 'EMP003', name: 'Priya Patel', dept: 'Design', email: 'priya.p@company.com', role: 'Employee', balance: 12, absent: 8, avatar: 'PP' },
  { id: 'EMP004', name: 'Marcus Chen', dept: 'Sales', email: 'marcus.c@company.com', role: 'Employee', balance: 18, absent: 2, avatar: 'MC' },
  { id: 'EMP005', name: 'Chloe Dupont', dept: 'Marketing', email: 'chloe.d@company.com', role: 'Employee', balance: 19, absent: 1, avatar: 'CD' },
  { id: 'EMP006', name: 'David Kim', dept: 'Engineering', email: 'david.k@company.com', role: 'Employee', balance: 20, absent: 0, avatar: 'DK' },
  { id: 'EMP007', name: 'Emily Wong', dept: 'Design', email: 'emily.w@company.com', role: 'Employee', balance: 17, absent: 3, avatar: 'EW' },
  { id: 'EMP008', name: 'Jason Mwangi', dept: 'Sales', email: 'jason.m@company.com', role: 'Employee', balance: 14, absent: 6, avatar: 'JM' },
  { id: 'EMP009', name: 'Sofia Al-Jamil', dept: 'Marketing', email: 'sofia.a@company.com', role: 'Employee', balance: 18, absent: 2, avatar: 'SA' }
];

const DEFAULT_REQUESTS = [
  {
    id: 'REQ101',
    employeeId: 'EMP002',
    employeeName: 'Alex Rivera',
    dept: 'Engineering',
    type: 'Sick',
    startDate: '2026-05-10',
    endDate: '2026-05-14',
    duration: 5,
    reason: 'Severe flu and recovery time prescribed by doctor.',
    status: 'approved',
    comment: 'Get well soon!',
    submittedAt: '2026-05-08'
  },
  {
    id: 'REQ102',
    employeeId: 'EMP003',
    employeeName: 'Priya Patel',
    dept: 'Design',
    type: 'Annual',
    startDate: '2026-05-18',
    endDate: '2026-05-25',
    duration: 8,
    reason: 'Annual family trip to Hawaii.',
    status: 'approved',
    comment: 'Enjoy your vacation!',
    submittedAt: '2026-05-01'
  },
  {
    id: 'REQ103',
    employeeId: 'EMP004',
    employeeName: 'Marcus Chen',
    dept: 'Sales',
    type: 'Casual',
    startDate: '2026-06-08',
    endDate: '2026-06-09',
    duration: 2,
    reason: 'Urgent personal work in hometown.',
    status: 'pending',
    comment: '',
    submittedAt: '2026-06-01'
  },
  {
    id: 'REQ104',
    employeeId: 'EMP005',
    employeeName: 'Chloe Dupont',
    dept: 'Marketing',
    type: 'Casual',
    startDate: '2026-05-05',
    endDate: '2026-05-05',
    duration: 1,
    reason: 'Attending friend\'s graduation ceremony.',
    status: 'rejected',
    comment: 'Clashes with major product launch event.',
    submittedAt: '2026-05-02'
  },
  {
    id: 'REQ105',
    employeeId: 'EMP002',
    employeeName: 'Alex Rivera',
    dept: 'Engineering',
    type: 'Annual',
    startDate: '2026-06-20',
    endDate: '2026-06-22',
    duration: 3,
    reason: 'Sister\'s wedding ceremony.',
    status: 'pending',
    comment: '',
    submittedAt: '2026-06-01'
  }
];

const DEFAULT_PROJECTS = [
  { id: 'PRJ301', name: 'Next-Gen Engine', dept: 'Engineering', status: 'Active' },
  { id: 'PRJ302', name: 'UI Refactoring', dept: 'Design', status: 'Active' },
  { id: 'PRJ303', name: 'Enterprise CRM Rollout', dept: 'Sales', status: 'Planning' },
  { id: 'PRJ304', name: 'Product Launch Campaign', dept: 'Marketing', status: 'Active' },
  { id: 'PRJ305', name: 'Onboarding Redesign', dept: 'Human Resources', status: 'Completed' }
];

const DEFAULT_TASKS = [
  { id: 'TSK401', projectId: 'PRJ301', projectName: 'Next-Gen Engine', desc: 'Refactor authentication middleware', assigneeId: 'EMP002', assigneeName: 'Alex Rivera', dueDate: '2026-06-15', priority: 'High', status: 'In Progress' },
  { id: 'TSK402', projectId: 'PRJ302', projectName: 'UI Refactoring', desc: 'Design dashboard light/dark assets', assigneeId: 'EMP003', assigneeName: 'Priya Patel', dueDate: '2026-06-10', priority: 'Medium', status: 'Completed' },
  { id: 'TSK403', projectId: 'PRJ303', projectName: 'Enterprise CRM Rollout', desc: 'Call tier 1 sales leads', assigneeId: 'EMP004', assigneeName: 'Marcus Chen', dueDate: '2026-06-30', priority: 'Medium', status: 'Pending' },
  { id: 'TSK404', projectId: 'PRJ304', projectName: 'Product Launch Campaign', desc: 'Write marketing copy for launch email', assigneeId: 'EMP005', assigneeName: 'Chloe Dupont', dueDate: '2026-06-12', priority: 'High', status: 'In Progress' },
  { id: 'TSK405', projectId: 'PRJ305', projectName: 'Onboarding Redesign', desc: 'Review leave policy draft', assigneeId: 'EMP001', assigneeName: 'Sarah Jenkins', dueDate: '2026-05-28', priority: 'Low', status: 'Completed' },
  { id: 'TSK406', projectId: 'PRJ301', projectName: 'Next-Gen Engine', desc: 'Implement unit tests for leave logic', assigneeId: 'EMP002', assigneeName: 'Alex Rivera', dueDate: '2026-06-25', priority: 'Low', status: 'Pending' }
];

const DEFAULT_DEPARTMENTS = ['Engineering', 'Design', 'Sales', 'Marketing', 'Human Resources'];

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
  modalActionType: null // 'approve' or 'reject'
};

// --- Initialization ---
function init() {
  // Load or seed data
  if (!localStorage.getItem('ems_employees')) {
    localStorage.setItem('ems_employees', JSON.stringify(DEFAULT_EMPLOYEES));
  } else {
    // Self-healing merge to make sure new default employees are seeded
    const stored = JSON.parse(localStorage.getItem('ems_employees'));
    if (stored.length < DEFAULT_EMPLOYEES.length) {
      localStorage.setItem('ems_employees', JSON.stringify(DEFAULT_EMPLOYEES));
    }
  }
  if (!localStorage.getItem('ems_requests')) {
    localStorage.setItem('ems_requests', JSON.stringify(DEFAULT_REQUESTS));
  }
  if (!localStorage.getItem('ems_projects')) {
    localStorage.setItem('ems_projects', JSON.stringify(DEFAULT_PROJECTS));
  }
  if (!localStorage.getItem('ems_tasks')) {
    localStorage.setItem('ems_tasks', JSON.stringify(DEFAULT_TASKS));
  }
  if (!localStorage.getItem('ems_departments')) {
    localStorage.setItem('ems_departments', JSON.stringify(DEFAULT_DEPARTMENTS));
  }

  state.employees = JSON.parse(localStorage.getItem('ems_employees'));
  state.requests = JSON.parse(localStorage.getItem('ems_requests'));
  state.projects = JSON.parse(localStorage.getItem('ems_projects'));
  state.tasks = JSON.parse(localStorage.getItem('ems_tasks'));
  state.departments = JSON.parse(localStorage.getItem('ems_departments'));

  // Bind role toggles
  document.getElementById('btn-role-employee').addEventListener('click', () => setRole('employee'));
  document.getElementById('btn-role-hr').addEventListener('click', () => setRole('hr'));

  // Bind Task and Project Form submissions
  const projectForm = document.getElementById('project-creation-form');
  if (projectForm) {
    projectForm.addEventListener('submit', handleProjectCreationSubmit);
  }
  const taskForm = document.getElementById('task-assignment-form');
  if (taskForm) {
    taskForm.addEventListener('submit', handleTaskAssignmentSubmit);
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
        document.getElementById('header-avatar').textContent = selectedEmp.avatar;
        document.getElementById('header-name').textContent = selectedEmp.name;
        document.getElementById('header-role').textContent = selectedEmp.dept;
        // Refresh active views
        const activeMenuItem = document.querySelector('.menu-item.active');
        const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'dashboard';
        renderEmployeeDashboard(currentView);
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
 
  // Set initial view
  setRole('employee');
  switchView('dashboard');
  setupDateLimits();
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

// --- Role Selection & View Toggling ---
function setRole(role) {
  state.currentRole = role;
  
  const empSelectorWrapper = document.getElementById('employee-selector-wrapper');
  const empSelect = document.getElementById('active-employee-select');

  // Update Role Switcher styling
  if (role === 'employee') {
    document.getElementById('btn-role-employee').classList.add('active');
    document.getElementById('btn-role-hr').classList.remove('active');
    
    // Switch to currently selected employee in dropdown (or default to first employee)
    if (empSelect && empSelect.value) {
      state.currentUser = state.employees.find(emp => emp.id === empSelect.value);
    } else {
      state.currentUser = state.employees.find(emp => emp.role === 'Employee'); // Default employee
    }
    
    if (empSelectorWrapper) {
      empSelectorWrapper.style.display = 'flex';
    }
  } else {
    document.getElementById('btn-role-hr').classList.add('active');
    document.getElementById('btn-role-employee').classList.remove('active');
    state.currentUser = state.employees.find(emp => emp.role === 'HR'); // Default HR (Sarah)
    
    if (empSelectorWrapper) {
      empSelectorWrapper.style.display = 'none';
    }
  }

  // Update Profile Widget
  document.getElementById('header-avatar').textContent = state.currentUser.avatar;
  document.getElementById('header-name').textContent = state.currentUser.name;
  document.getElementById('header-role').textContent = state.currentUser.dept;

  // Sync dropdown selection if in employee mode
  if (role === 'employee' && empSelect) {
    empSelect.value = state.currentUser.id;
  }

  // Toggle visible items in navigation
  updateSidebarMenu();

  // Render current role screens
  switchView('dashboard');
}

// Populate the Employee dropdown list
function populateEmployeeDropdown() {
  const empSelect = document.getElementById('active-employee-select');
  if (!empSelect) return;
  empSelect.innerHTML = '';
  state.employees.filter(emp => emp.role === 'Employee').forEach(emp => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = `${emp.name} (${emp.dept})`;
    empSelect.appendChild(option);
  });
}

function updateSidebarMenu() {
  const rosterMenu = document.getElementById('menu-item-roster');
  if (state.currentRole === 'hr') {
    rosterMenu.style.display = 'flex';
  } else {
    rosterMenu.style.display = 'none';
  }
}

function switchView(viewName) {
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

  if (state.currentRole === 'employee') {
    empContainer.style.display = 'flex';
    hrContainer.style.display = 'none';
    renderEmployeeDashboard(viewName);
  } else {
    empContainer.style.display = 'none';
    hrContainer.style.display = 'flex';
    renderHRDashboard(viewName);
  }
}

// --- Render Employee Dashboard ---
function renderEmployeeDashboard(viewName = 'dashboard') {
  const userId = state.currentUser.id;
  const userRequests = state.requests.filter(req => req.employeeId === userId);
  const employeeData = state.employees.find(emp => emp.id === userId);

  // Update Stats Cards
  const totalBalance = employeeData.balance;
  const approvedRequests = userRequests.filter(req => req.status === 'approved');
  const pendingRequests = userRequests.filter(req => req.status === 'pending');

  const approvedDays = approvedRequests.reduce((sum, req) => sum + req.duration, 0);
  const pendingDays = pendingRequests.reduce((sum, req) => sum + req.duration, 0);

  // Render balance stats card (using circular progress ring)
  const percentUsed = Math.min(100, Math.round(((20 - totalBalance) / 20) * 100));
  const circularProgress = document.getElementById('balance-progress-ring');
  if (circularProgress) {
    circularProgress.style.background = `conic-gradient(var(--primary) ${percentUsed * 3.6}deg, var(--bg-tertiary) 0deg)`;
    document.getElementById('balance-progress-value').textContent = totalBalance;
  }
  document.getElementById('emp-approved-days').textContent = approvedDays;
  document.getElementById('emp-pending-days').textContent = pendingDays;

  // Toggle View Panels
  const dashboardCardRow = document.getElementById('emp-dashboard-row');
  const myRequestsTableCard = document.getElementById('emp-requests-table-card');
  const empTasksCard = document.getElementById('emp-tasks-card');

  // Update Page Header Label based on view
  const titleLabel = document.getElementById('page-title-label');
  if (titleLabel) {
    if (viewName === 'dashboard') titleLabel.textContent = 'Leave Dashboard';
    else if (viewName === 'requests') titleLabel.textContent = 'Leave Requests';
    else if (viewName === 'tasks') titleLabel.textContent = 'Tasks & Projects';
  }

  if (viewName === 'dashboard') {
    dashboardCardRow.style.display = 'grid';
    myRequestsTableCard.style.display = 'none';
    if (empTasksCard) empTasksCard.style.display = 'none';
  } else if (viewName === 'requests') {
    dashboardCardRow.style.display = 'none';
    myRequestsTableCard.style.display = 'flex';
    if (empTasksCard) empTasksCard.style.display = 'none';
  } else if (viewName === 'tasks') {
    dashboardCardRow.style.display = 'none';
    myRequestsTableCard.style.display = 'none';
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

  // Filter requests
  let filteredRequests = state.requests.filter(req => {
    const matchesSearch = req.employeeName.toLowerCase().includes(searchQuery) || req.dept.toLowerCase().includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
    const matchesType = filterType === 'all' || req.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate HR stats cards
  const pendingApprovalsCount = state.requests.filter(req => req.status === 'pending').length;
  const totalEmployeesCount = state.employees.length;
  
  // Total absenteeism metric (total approved leave days taken by all employees)
  const totalAbsentDays = state.employees.reduce((sum, emp) => sum + emp.absent, 0);

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
  const pendingRequests = filteredRequests.filter(req => req.status === 'pending');
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

function renderEmployeeRoster() {
  const listEl = document.getElementById('hr-roster-list');
  listEl.innerHTML = '';

  state.employees.forEach(emp => {
    // Total days = 20. Percent absent days = (absent / 20) * 100
    const limit = 20;
    const usagePercent = Math.min(100, Math.round((emp.absent / limit) * 100));

    const item = document.createElement('div');
    item.className = 'roster-item';
    item.innerHTML = `
      <div class="roster-avatar">${emp.avatar}</div>
      <div class="roster-info">
        <div class="roster-name">${emp.name}</div>
        <div class="roster-dept">${emp.dept} • ${emp.email}</div>
      </div>
      <div class="roster-stat">
        <div>
          <span class="roster-absent-count">${emp.absent} day${emp.absent !== 1 ? 's' : ''}</span>
          <span class="text-muted" style="font-size: 0.8rem;">absent</span>
        </div>
        <div class="progress-bar-container" title="Leave allowance utilized: ${usagePercent}%">
          <div class="progress-bar" style="width: ${usagePercent}%"></div>
        </div>
        <div style="font-size: 0.7rem; color: var(--text-muted); display:flex; justify-content:space-between; margin-top:2px;">
          <span>Remaining: ${emp.balance}d</span>
          <span>Max Allowed: 20d</span>
        </div>
      </div>
    `;
    listEl.appendChild(item);
  });
}

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

  // Check remaining balance
  const employeeData = state.employees.find(emp => emp.id === state.currentUser.id);
  if (duration > employeeData.balance) {
    showToast(`Insufficient leave balance. You have only ${employeeData.balance} days left.`, 'error');
    return;
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

  // Reset form
  document.getElementById('leave-request-form').reset();
  document.getElementById('calculated-days').textContent = '0 days';
  
  // Notification and Refresh
  showToast('Leave request submitted successfully!', 'success');
  renderEmployeeDashboard('dashboard');
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
    
    // Adjust employee balance and absent days
    if (empIdx !== -1) {
      state.employees[empIdx].balance = Math.max(0, state.employees[empIdx].balance - req.duration);
      state.employees[empIdx].absent += req.duration;
    }
    showToast(`Leave request from ${req.employeeName} approved!`, 'success');
  } else {
    req.status = 'rejected';
    req.comment = comment;
    showToast(`Leave request from ${req.employeeName} rejected.`, 'success'); // styled toast
  }

  // Save changes to localStorage
  localStorage.setItem('ems_requests', JSON.stringify(state.requests));
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));

  // Refresh view
  renderHRDashboard('dashboard');
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
    `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>`;

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto-remove toast after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
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
document.getElementById('mobile-hamburger').addEventListener('click', function() {
  this.classList.toggle('open');
  document.getElementById('sidebar').classList.toggle('open');
});

// --- Tasks & Projects View Logic ---

// --- 1. Employee View Logic ---
function renderEmployeeTasksAndProjects() {
  const user = state.currentUser;
  
  // Render Projects (filtered by employee's department)
  const grid = document.getElementById('emp-projects-grid');
  if (grid) {
    grid.innerHTML = '';
    const deptProjects = state.projects.filter(p => p.dept === user.dept);
    
    if (deptProjects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 24px;">
          <div class="empty-state-title">No Projects in ${user.dept}</div>
          <p>Projects will appear here once registered by HR.</p>
        </div>
      `;
    } else {
      deptProjects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
          <div class="project-card-title">${proj.name}</div>
          <div class="project-card-meta">
            <span>Status: <span class="badge badge-${proj.status.toLowerCase()}">${proj.status}</span></span>
            <span style="font-weight: 600; color: var(--primary);">${proj.dept}</span>
          </div>
        `;
        grid.appendChild(card);
      });
    }
  }

  // Render Tasks (filtered to current employee's assigned tasks)
  const tbody = document.getElementById('emp-tasks-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    const userTasks = state.tasks.filter(t => t.assigneeId === user.id);
    
    if (userTasks.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-state-title">No assigned tasks</div>
              <p>You have a clean sheet! Check back later.</p>
            </div>
          </td>
        </tr>
      `;
    } else {
      userTasks.forEach(task => {
        const tr = document.createElement('tr');
        
        let btnText = 'Start';
        let btnClass = 'btn-primary';
        if (task.status === 'In Progress') {
          btnText = 'Complete';
          btnClass = 'btn-success';
        } else if (task.status === 'Completed') {
          btnText = 'Reopen';
          btnClass = 'btn-secondary';
        }

        const isCompleted = task.status === 'Completed';

        tr.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="checkbox" ${isCompleted ? 'checked' : ''} 
                     onchange="toggleTaskCompletion('${task.id}')"
                     style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--success);">
              <span style="${isCompleted ? 'text-decoration: line-through; opacity: 0.6;' : ''}"><strong>${task.desc}</strong></span>
            </div>
          </td>
          <td>${task.projectName || 'Personal'}</td>
          <td><span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span></td>
          <td>${formatDate(task.dueDate)}</td>
          <td><span class="badge badge-${task.status.replace(' ', '-').toLowerCase()}">${task.status}</span></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="btn ${btnClass} btn-sm" onclick="cycleTaskStatus('${task.id}')">${btnText}</button>
              ${task.createdByEmployee ? `<button class="btn btn-danger btn-sm" onclick="deleteEmployeeTask('${task.id}')" title="Delete Personal Task" style="padding: 6px 10px; line-height: 1;">&times;</button>` : ''}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }
}

function cycleTaskStatus(taskId) {
  const taskIdx = state.tasks.findIndex(t => t.id === taskId);
  if (taskIdx === -1) return;
  
  const task = state.tasks[taskIdx];
  if (task.status === 'Pending') {
    task.status = 'In Progress';
  } else if (task.status === 'In Progress') {
    task.status = 'Completed';
  } else {
    task.status = 'Pending';
  }

  localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
  renderEmployeeTasksAndProjects();
  showToast(`Task status updated to "${task.status}"`, 'success');
}

function toggleTaskCompletion(taskId) {
  const taskIdx = state.tasks.findIndex(t => t.id === taskId);
  if (taskIdx === -1) return;
  
  const task = state.tasks[taskIdx];
  if (task.status === 'Completed') {
    task.status = 'Pending';
  } else {
    task.status = 'Completed';
  }
  
  localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
  renderEmployeeTasksAndProjects();
  showToast(`Task marked as ${task.status.toLowerCase()}`, 'success');
}

function deleteEmployeeTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  if (confirm(`Are you sure you want to delete task "${task.desc}"?`)) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
    renderEmployeeTasksAndProjects();
    showToast('Personal task deleted.', 'success');
  }
}

// --- 2. HR View Logic ---
function renderHRTasksAndProjects() {
  // Render Projects (All)
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
    } else {
      state.projects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
          <div class="project-card-title">${proj.name}</div>
          <div class="project-card-meta">
            <span>Status: <span class="badge badge-${proj.status.toLowerCase()}">${proj.status}</span></span>
            <span style="font-weight: 600; color: var(--primary);">${proj.dept}</span>
          </div>
        `;
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
      filteredTasks.forEach(task => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${task.desc}</strong></td>
          <td>${task.projectName}</td>
          <td>
            <div style="font-weight:600; color: var(--text-primary);">${task.assigneeName}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${state.employees.find(e => e.id === task.assigneeId)?.dept || ''}</div>
          </td>
          <td><span class="badge badge-${task.priority.toLowerCase()}">${task.priority}</span></td>
          <td>${formatDate(task.dueDate)}</td>
          <td><span class="badge badge-${task.status.replace(' ', '-').toLowerCase()}">${task.status}</span></td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')">Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
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
    state.projects.forEach(p => {
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
    state.projects.forEach(p => {
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

// --- 3. Modals and Forms Logic ---
function openCreateProjectModal() {
  document.getElementById('project-creation-form').reset();
  document.getElementById('project-modal-overlay').classList.add('active');
}

function hideProjectModal() {
  document.getElementById('project-modal-overlay').classList.remove('active');
}

function handleProjectCreationSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('project-name').value.trim();
  const dept = document.getElementById('project-dept').value;
  const status = document.getElementById('project-status').value;

  if (!name || !dept || !status) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  const newProj = {
    id: `PRJ${300 + state.projects.length + 1}`,
    name: name,
    dept: dept,
    status: status
  };

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
  
  // Default due date to 1 week from now
  const oneWeekLater = new Date();
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  document.getElementById('task-due-date').value = oneWeekLater.toISOString().split('T')[0];
  
  // Set minimum date to today
  document.getElementById('task-due-date').min = new Date().toISOString().split('T')[0];
  
  populateTaskModalOptions();
  document.getElementById('task-modal-overlay').classList.add('active');
}

function hideTaskModal() {
  document.getElementById('task-modal-overlay').classList.remove('active');
}

function handleTaskAssignmentSubmit(e) {
  e.preventDefault();

  const desc = document.getElementById('task-desc').value.trim();
  const projId = document.getElementById('task-project-select').value;
  const empId = document.getElementById('task-assignee-select').value;
  const dueDate = document.getElementById('task-due-date').value;
  const priority = document.getElementById('task-priority').value;

  if (!desc || !projId || !empId || !dueDate || !priority) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  const project = state.projects.find(p => p.id === projId);
  const employee = state.employees.find(e => e.id === empId);

  const newTask = {
    id: `TSK${400 + state.tasks.length + 1}`,
    projectId: projId,
    projectName: project.name,
    desc: desc,
    assigneeId: empId,
    assigneeName: employee.name,
    dueDate: dueDate,
    priority: priority,
    status: 'Pending'
  };

  state.tasks.push(newTask);
  localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));

  hideTaskModal();
  renderHRTasksAndProjects();
  showToast(`Task assigned to ${employee.name}!`, 'success');
}

function deleteTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (confirm(`Are you sure you want to delete task "${task.desc}"?`)) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
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
  document.getElementById('employee-creation-form').reset();
  populateDepartmentDropdowns();
  document.getElementById('employee-modal-overlay').classList.add('active');
}

function hideEmployeeModal() {
  document.getElementById('employee-modal-overlay').classList.remove('active');
}

function handleEmployeeCreationSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('new-emp-name').value.trim();
  const email = document.getElementById('new-emp-email').value.trim();
  const dept = document.getElementById('new-emp-dept').value;
  const role = document.getElementById('new-emp-role').value;
  const balance = parseInt(document.getElementById('new-emp-balance').value);

  if (!name || !email || !dept || !role || isNaN(balance)) {
    showToast('Please fill out all fields.', 'error');
    return;
  }

  // Generate unique employee ID (sequential suffix)
  const empNum = state.employees.length + 1;
  const id = `EMP${String(empNum).padStart(3, '0')}`;

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
    avatar: initials
  };

  state.employees.push(newEmp);
  localStorage.setItem('ems_employees', JSON.stringify(state.employees));

  // Re-populate all dropdown switchers and modal option lists
  populateEmployeeDropdown();
  populateTaskModalOptions();
  
  hideEmployeeModal();
  
  // Refresh views
  const activeMenuItem = document.querySelector('.menu-item.active');
  const currentView = activeMenuItem ? activeMenuItem.getAttribute('data-view') : 'dashboard';
  
  if (state.currentRole === 'hr') {
    renderHRDashboard(currentView);
  } else {
    renderEmployeeDashboard(currentView);
  }

  showToast(`Employee "${name}" registered successfully!`, 'success');
}

function handleAssignTaskProjectChange(e) {
  const projId = e.target.value;
  const project = state.projects.find(p => p.id === projId);
  const assigneeSelect = document.getElementById('task-assignee-select');
  if (!assigneeSelect) return;
  
  assigneeSelect.innerHTML = '<option value="" disabled selected>Select employee...</option>';
  
  if (project) {
    // Filter employees to only show those belonging to the project's department
    const deptEmployees = state.employees.filter(emp => emp.dept === project.dept);
    if (deptEmployees.length === 0) {
      const opt = document.createElement('option');
      opt.value = "";
      opt.disabled = true;
      opt.textContent = `No employees in ${project.dept}`;
      assigneeSelect.appendChild(opt);
    } else {
      deptEmployees.forEach(emp => {
        const opt = document.createElement('option');
        opt.value = emp.id;
        opt.textContent = `${emp.name} (${emp.dept})`;
        assigneeSelect.appendChild(opt);
      });
    }
  } else {
    assigneeSelect.innerHTML = '<option value="" disabled selected>Select a project first...</option>';
  }
}

function openCreateEmpTaskModal() {
  const form = document.getElementById('emp-task-creation-form');
  if (form) form.reset();
  
  // Default due date to 1 week from now
  const oneWeekLater = new Date();
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  const dueDateInput = document.getElementById('emp-task-due-date');
  if (dueDateInput) {
    dueDateInput.value = oneWeekLater.toISOString().split('T')[0];
    dueDateInput.min = new Date().toISOString().split('T')[0];
  }
  
  // Populate the projects select with employee's department projects + "Personal Task"
  const projSelect = document.getElementById('emp-task-project-select');
  if (projSelect) {
    projSelect.innerHTML = '<option value="personal">Personal / Non-Project</option>';
    const deptProjects = state.projects.filter(p => p.dept === state.currentUser.dept);
    deptProjects.forEach(p => {
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
  const projId = document.getElementById('emp-task-project-select').value;
  const dueDate = document.getElementById('emp-task-due-date').value;
  const priority = document.getElementById('emp-task-priority').value;
  
  if (!desc || !projId || !dueDate || !priority) {
    showToast('Please fill out all fields.', 'error');
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
    assigneeId: state.currentUser.id,
    assigneeName: state.currentUser.name,
    dueDate: dueDate,
    priority: priority,
    status: 'Pending',
    createdByEmployee: true
  };
  
  state.tasks.push(newTask);
  localStorage.setItem('ems_tasks', JSON.stringify(state.tasks));
  
  hideEmpTaskModal();
  renderEmployeeTasksAndProjects();
  showToast('Task added successfully!', 'success');
}

// Global modal/action bindings
window.cycleTaskStatus = cycleTaskStatus;
window.toggleTaskCompletion = toggleTaskCompletion;
window.deleteEmployeeTask = deleteEmployeeTask;
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

// Run application on DOM loaded
window.addEventListener('DOMContentLoaded', init);
