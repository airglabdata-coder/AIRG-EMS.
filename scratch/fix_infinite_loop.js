const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// The core problem: renderDailyReports calls switchReportsSubTab which calls renderDailyReports = infinite loop
// Fix: renderDailyReports should render standard reports directly.
// switchReportsSubTab('standard') should just show the standard view and render it directly via _renderStandardReports.
// switchReportsSubTab('trainer') should show trainer view.
// When the Daily Reports section is first loaded (not from a tab click), we call a new top-level function: loadDailyReportsPage()

// Step 1: Replace entire renderDailyReports with a clean version that does NOT call switchReportsSubTab
const oldRenderDailyReports = `function renderDailyReports() {
  const empSection = document.getElementById('reports-employee-section');
  const hrSection = document.getElementById('reports-hr-section');
  if (!empSection || !hrSection) return;

  populateDailyReportDropdowns();
  if (!state.activeReportSubTab) {
    state.activeReportSubTab = isUserTrainer(state.currentUser) ? 'trainer' : 'standard';
  }
  switchReportsSubTab(state.activeReportSubTab);
  return;`;

const newRenderDailyReports = `function renderDailyReports() {
  // renderDailyReports = renders ONLY the Standard Daily Project Reports content.
  // This function must NEVER call switchReportsSubTab() to avoid infinite recursion.
  // (switchReportsSubTab calls renderDailyReports for standard tab => infinite loop)
  //
  // HOW TAB SWITCHING WORKS:
  //  1. User clicks Daily Reports in sidebar => loadDailyReportsPage() is called
  //  2. loadDailyReportsPage() checks if user is a Trainer and calls switchReportsSubTab()
  //  3. switchReportsSubTab('standard') -> shows standard view + calls renderDailyReports() [DIRECT, no loop]
  //  4. switchReportsSubTab('trainer') -> shows trainer view + calls renderTrainerReportsView() [no loop]
  //
  const empSection = document.getElementById('reports-employee-section');
  const hrSection = document.getElementById('reports-hr-section');
  if (!empSection || !hrSection) return;

  populateDailyReportDropdowns();`;

appJs = appJs.replace(oldRenderDailyReports, newRenderDailyReports);

// Step 2: Fix switchReportsSubTab - for standard tab, it should NOT call renderDailyReports to avoid loop.
// Instead it will call _renderStandardReportsContent() which is the actual work.
// But since renderDailyReports IS the worker now (no loop), it's safe to call it.
// The fix is in loadDailyReportsPage instead.

// Step 3: Add loadDailyReportsPage as the nav entrypoint (replaces direct renderDailyReports nav call)
// First let's find where the nav calls renderDailyReports
const oldNavCall = `case 'reports':
      renderDailyReports();
      break;`;

const newNavCall = `case 'reports':
      loadDailyReportsPage();
      break;`;

appJs = appJs.replace(oldNavCall, newNavCall);

// Step 4: Fix switchReportsSubTab so standard tab calls renderDailyReports directly (safe since renderDailyReports no longer calls switchReportsSubTab)
// Already done correctly - switchReportsSubTab calls renderDailyReports which no longer calls switchReportsSubTab

// Step 5: Add loadDailyReportsPage function before switchReportsSubTab
const insertBefore = `function switchReportsSubTab(subTab) {`;

const newFunc = `function loadDailyReportsPage() {
  // This is the entry point when user navigates to Daily Reports from the sidebar.
  // It decides which sub-tab to show and calls switchReportsSubTab exactly once.
  // This prevents the recursion: renderDailyReports -> switchReportsSubTab -> renderDailyReports
  if (!state.activeReportSubTab) {
    state.activeReportSubTab = isUserTrainer(state.currentUser) ? 'trainer' : 'standard';
  }
  switchReportsSubTab(state.activeReportSubTab);
}
window.loadDailyReportsPage = loadDailyReportsPage;

function switchReportsSubTab(subTab) {`;

if (!appJs.includes('function loadDailyReportsPage()')) {
  appJs = appJs.replace(insertBefore, newFunc);
}

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('Fixed renderDailyReports infinite recursion!');

// Verify
const content = fs.readFileSync('app.js', 'utf8');
const stillHasLoop = content.includes('switchReportsSubTab(state.activeReportSubTab);\n  return;');
console.log('Still has loop code:', stillHasLoop);
console.log('Has loadDailyReportsPage:', content.includes('function loadDailyReportsPage()'));
