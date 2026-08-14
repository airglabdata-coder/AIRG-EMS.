const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// ====================================================================
// FIX 1: Add loadDailyReportsPage function & fix switchReportsSubTab
// so there is no infinite recursion between renderDailyReports and 
// switchReportsSubTab.
//
// THE PROBLEM:
//   renderDailyReports() -> calls switchReportsSubTab()
//   switchReportsSubTab('standard') -> calls renderDailyReports()
//   = INFINITE RECURSION = Maximum call stack size exceeded at line 8058
//
// THE SOLUTION:
//   1. renderDailyReports() NEVER calls switchReportsSubTab()
//   2. A NEW function loadDailyReportsPage() handles the entry point (tab selection)
//   3. All sidebar navigation calls loadDailyReportsPage() instead
// ====================================================================

// Step 1: Add loadDailyReportsPage before switchReportsSubTab
const insertBeforeTarget = 'function switchReportsSubTab(subTab) {';
const loadDailyReportsPageFn = `function loadDailyReportsPage() {
  // Entry point when sidebar nav opens Daily Reports.
  // Selects the correct sub-tab (trainer vs standard) once, then delegates.
  // This CANNOT call renderDailyReports() directly to avoid recursion.
  if (!state.activeReportSubTab) {
    state.activeReportSubTab = isUserTrainer(state.currentUser) ? 'trainer' : 'standard';
  }
  switchReportsSubTab(state.activeReportSubTab);
}
window.loadDailyReportsPage = loadDailyReportsPage;

function switchReportsSubTab(subTab) {`;

if (!appJs.includes('function loadDailyReportsPage()')) {
  appJs = appJs.replace(insertBeforeTarget, loadDailyReportsPageFn);
  console.log('✅ Step 1: Added loadDailyReportsPage');
} else {
  console.log('⚠️  Step 1 skipped: loadDailyReportsPage already exists');
}

// Step 2: Fix renderDailyReports() — remove the switchReportsSubTab call & return that caused recursion
const oldRenderDailyReportsBlock = `  populateDailyReportDropdowns();
  
  if (!state.activeReportSubTab) {
    state.activeReportSubTab = isUserTrainer(state.currentUser) ? 'trainer' : 'standard';
  }
  switchReportsSubTab(state.activeReportSubTab);
  return;

  const isReportReviewer`;

const newRenderDailyReportsBlock = `  populateDailyReportDropdowns();

  const isReportReviewer`;

if (appJs.includes('switchReportsSubTab(state.activeReportSubTab);\r\n  return;')) {
  appJs = appJs.replace(
    `  populateDailyReportDropdowns();\r\n  \r\n  if (!state.activeReportSubTab) {\r\n    state.activeReportSubTab = isUserTrainer(state.currentUser) ? 'trainer' : 'standard';\r\n  }\r\n  switchReportsSubTab(state.activeReportSubTab);\r\n  return;\r\n\r\n  const isReportReviewer`,
    `  populateDailyReportDropdowns();\r\n\r\n  const isReportReviewer`
  );
  console.log('✅ Step 2: Removed recursive call from renderDailyReports (CRLF)');
} else if (appJs.includes('switchReportsSubTab(state.activeReportSubTab);\n  return;')) {
  appJs = appJs.replace(
    `  populateDailyReportDropdowns();\n  \n  if (!state.activeReportSubTab) {\n    state.activeReportSubTab = isUserTrainer(state.currentUser) ? 'trainer' : 'standard';\n  }\n  switchReportsSubTab(state.activeReportSubTab);\n  return;\n\n  const isReportReviewer`,
    `  populateDailyReportDropdowns();\n\n  const isReportReviewer`
  );
  console.log('✅ Step 2: Removed recursive call from renderDailyReports (LF)');
} else {
  console.log('⚠️  Step 2: Pattern not found. Trying regex...');
  appJs = appJs.replace(
    /populateDailyReportDropdowns\(\);[\s\r\n]+if\s*\(!state\.activeReportSubTab\)[^}]+}[\s\r\n]+switchReportsSubTab\(state\.activeReportSubTab\);[\s\r\n]+return;[\s\r\n]+const isReportReviewer/,
    'populateDailyReportDropdowns();\n\n  const isReportReviewer'
  );
  console.log('✅ Step 2: Applied regex removal of recursive call');
}

// Step 3: Replace sidebar navigation entries (lines 414, 3107) to use loadDailyReportsPage
// Line 414 context (in initSyncPolling or inline navigation switch):
const old414 = `        } else if (currentView === 'reports') {
          renderDailyReports();
        } else if (currentView === 'school-management') {`;
const new414 = `        } else if (currentView === 'reports') {
          loadDailyReportsPage();
        } else if (currentView === 'school-management') {`;

if (appJs.includes(old414)) {
  appJs = appJs.replace(old414, new414);
  console.log('✅ Step 3a: Fixed initSyncPolling nav call');
} else {
  console.log('⚠️  Step 3a: initSyncPolling nav call pattern not found - trying CRLF');
  const old414crlf = old414.replace(/\n/g, '\r\n');
  const new414crlf = new414.replace(/\n/g, '\r\n');
  if (appJs.includes(old414crlf)) {
    appJs = appJs.replace(old414crlf, new414crlf);
    console.log('✅ Step 3a: Fixed initSyncPolling nav call (CRLF)');
  }
}

// Line 3107 context (in navigateTo function):
const old3107 = `    renderDailyReports();
  } else if (viewName === 'payslips') {`;
const new3107 = `    loadDailyReportsPage();
  } else if (viewName === 'payslips') {`;

const count3107 = (appJs.match(new RegExp(old3107.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
console.log(`Step 3b: Found ${count3107} occurrences of navigateTo renderDailyReports pattern`);

// Only replace if unique or first occurrence
if (count3107 === 1) {
  appJs = appJs.replace(old3107, new3107);
  console.log('✅ Step 3b: Fixed navigateTo nav call');
} else if (count3107 > 1) {
  // Replace specifically the one near 'payslips'
  appJs = appJs.replace(old3107, new3107);
  console.log('✅ Step 3b: Fixed navigateTo nav call (first occurrence)');
} else {
  // Try CRLF
  const old3107crlf = old3107.replace(/\n/g, '\r\n');
  const new3107crlf = new3107.replace(/\n/g, '\r\n');
  if (appJs.includes(old3107crlf)) {
    appJs = appJs.replace(old3107crlf, new3107crlf);
    console.log('✅ Step 3b: Fixed navigateTo nav call (CRLF)');
  } else {
    console.log('⚠️  Step 3b: Pattern not found, trying inline version...');
    // Try inline search
    appJs = appJs.replace(/renderDailyReports\(\);\s*\n(\s*\}\s*else if\s*\(viewName\s*===\s*'payslips'\))/, 'loadDailyReportsPage();\n$1');
    console.log('✅ Step 3b: Applied regex fix for navigateTo nav call');
  }
}

// ====================================================================
// FIX 2: Data persistence — trainerReports lost after reload
//
// THE PROBLEM:
//   fetchCentralizedState checks "if (s.trainerReports) {" 
//   If the array is EMPTY [], that is falsy in JS = the block is SKIPPED
//   So state.trainerReports stays empty = reports appear gone
//
// THE SOLUTION:
//   Use "if (Array.isArray(s.trainerReports)) {" 
//   to correctly handle BOTH empty array AND populated array cases
// ====================================================================

const oldTrainerCheck = `      if (s.trainerReports) {
        state.trainerReports = s.trainerReports;
        safeOriginalSetItem('ems_trainer_reports', JSON.stringify(s.trainerReports));
      }`;

const newTrainerCheck = `      if (Array.isArray(s.trainerReports)) {
        state.trainerReports = s.trainerReports;
        safeOriginalSetItem('ems_trainer_reports', JSON.stringify(s.trainerReports));
      }`;

if (appJs.includes(oldTrainerCheck)) {
  appJs = appJs.replace(oldTrainerCheck, newTrainerCheck);
  console.log('✅ Fix 2: Fixed trainerReports falsy array check in fetchCentralizedState');
} else {
  console.log('⚠️  Fix 2: Pattern not found (CRLF variant)');
  const oldCrlf = oldTrainerCheck.replace(/\n/g, '\r\n');
  const newCrlf = newTrainerCheck.replace(/\n/g, '\r\n');
  if (appJs.includes(oldCrlf)) {
    appJs = appJs.replace(oldCrlf, newCrlf);
    console.log('✅ Fix 2: Fixed trainerReports falsy array check (CRLF)');
  }
}

// Save the file
fs.writeFileSync('app.js', appJs, 'utf8');
console.log('\n✅ All fixes applied! Running syntax check...');
