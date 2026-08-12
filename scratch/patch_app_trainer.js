const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// 1. Update cleanState in triggerBackendSync and syncStateNow
appJs = appJs.replace(
  'smsNotifications: state.smsNotifications || [],\r\n      schools: state.schools || []\r\n    };',
  'smsNotifications: state.smsNotifications || [],\r\n      schools: state.schools || [],\r\n      trainerReports: state.trainerReports || []\r\n    };'
);
appJs = appJs.replace(
  'smsNotifications: state.smsNotifications || [],\n      schools: state.schools || []\n    };',
  'smsNotifications: state.smsNotifications || [],\n      schools: state.schools || [],\n      trainerReports: state.trainerReports || []\n    };'
);

// 2. Update fetchCentralizedState to store s.trainerReports
if (!appJs.includes('state.trainerReports = s.trainerReports;')) {
  const targetSync = 'if (s.schools) {';
  const replacementSync = `if (s.trainerReports) {
        state.trainerReports = s.trainerReports;
        safeOriginalSetItem('ems_trainer_reports', JSON.stringify(s.trainerReports));
      }
      if (s.schools) {`;
  appJs = appJs.replace(targetSync, replacementSync);
}

// 3. Update state definition to include trainerReports
if (!appJs.includes('trainerReports: [],')) {
  appJs = appJs.replace(
    'dailyReports: [],',
    'dailyReports: [],\n  trainerReports: [],\n  currentTrainerSessions: [],\n  activeReportSubTab: null,'
  );
}

// 4. Update loadInitialState to load ems_trainer_reports
if (!appJs.includes("localStorage.getItem('ems_trainer_reports')")) {
  const targetInit = "state.dailyReports = JSON.parse(localStorage.getItem('ems_reports')) || [];";
  const replacementInit = `state.dailyReports = JSON.parse(localStorage.getItem('ems_reports')) || [];
    try {
      state.trainerReports = JSON.parse(localStorage.getItem('ems_trainer_reports')) || [];
    } catch(e) {
      state.trainerReports = [];
    }`;
  appJs = appJs.replace(targetInit, replacementInit);
}

// 5. Add Trainer Reports Suite
const trainerReportModule = `
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
      geoTagHtml = \`
        <div style="margin-top: 4px; padding: 2px 6px; border-radius: 4px; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); font-size: 0.65rem; color: #22c55e; line-height: 1.3;">
          <div>📍 Lat: \${session.geoTag.lat}, Lng: \${session.geoTag.lng}</div>
          <div style="color: var(--text-muted); font-size: 0.6rem;">🕒 \${session.geoTag.timestamp || ''}</div>
        </div>
      \`;
    }

    let photoPreviewHtml = '';
    if (session.image) {
      photoPreviewHtml = \`
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
          <img src="\${session.image}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('\${session.image}')" title="Click to view photo">
          <button type="button" onclick="removeTrainerSessionPhoto(\${idx})" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 0.75rem; font-weight: 600;">Remove</button>
        </div>
      \`;
    }

    tr.innerHTML = \`
      <td style="text-align: center; font-weight: 700; color: var(--text-muted); padding: 8px;">\${idx + 1}</td>
      <td style="padding: 8px;">
        <select onchange="updateSessionField(\${idx}, 'classVal', this.value)" style="width: 100%; padding: 6px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); cursor: pointer;">
          \${classOptions.map(opt => \`<option value="\${opt}" \${session.classVal === opt ? 'selected' : ''}>\${opt}</option>\`).join('')}
        </select>
      </td>
      <td style="padding: 8px;">
        <input type="text" value="\${session.timeVal || ''}" placeholder="e.g. 10:00 AM - 11:00 AM" onchange="updateSessionField(\${idx}, 'timeVal', this.value)" style="width: 100%; padding: 6px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
      </td>
      <td style="padding: 8px;">
        <input type="text" value="\${session.topicVal || ''}" placeholder="e.g. Intro to Robotics & Sensors" onchange="updateSessionField(\${idx}, 'topicVal', this.value)" required style="width: 100%; padding: 6px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
      </td>
      <td style="padding: 8px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 8px; border-radius: 4px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); color: #3b82f6; font-size: 0.75rem; font-weight: 600; cursor: pointer; text-align: center;">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span>\${session.image ? 'Change Photo' : '📸 Geotag Photo'}</span>
            <input type="file" accept="image/*" capture="environment" style="display: none;" onchange="handleTrainerSessionPhotoUpload(\${idx}, event)">
          </label>
          \${photoPreviewHtml}
          \${geoTagHtml}
        </div>
      </td>
      <td style="padding: 8px;">
        <input type="text" value="\${session.remarkVal || ''}" placeholder="e.g. Active participation" onchange="updateSessionField(\${idx}, 'remarkVal', this.value)" style="width: 100%; padding: 6px 8px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); box-sizing: border-box;">
      </td>
      <td style="text-align: center; padding: 8px;">
        <button type="button" onclick="removeTrainerSessionRow(\${idx})" style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 1.1rem;" title="Delete session row">🗑️</button>
      </td>
    \`;
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
    doc.text('Trainer Daily Classroom Session Report — School Cluster', 40, 50);

    // 2. Submission Details Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(40, 88, 515, 74, 4, 4, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(40, 88, 515, 74, 4, 4, 'S');

    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text(\`Trainer Name: \${report.trainerName}\`, 55, 108);
    doc.text(\`Session Date: \${report.date}\`, 320, 108);

    doc.setFont('helvetica', 'normal');
    doc.text(\`School / Center: \${report.school || 'Not Specified'}\`, 55, 126);
    doc.text(\`Reporting Manager: \${report.reportingManagerName || 'Assigned Manager'}\`, 320, 126);
    doc.text(\`Department: \${report.trainerDept || 'Instructor'}\`, 55, 144);
    doc.text(\`Report ID: \${report.id}\`, 320, 144);

    // 3. Sessions Table
    const tableBody = report.sessions.map((s, idx) => {
      let geoInfo = '';
      if (s.geoTag && s.geoTag.lat) {
        geoInfo = \`\\n📍 Geotag: \${s.geoTag.lat}, \${s.geoTag.lng}\\n🕒 \${s.geoTag.timestamp || ''}\`;
      }
      return [
        idx + 1,
        s.classVal || s.class || 'N/A',
        s.timeVal || s.time || 'N/A',
        s.topicVal || s.topic || 'N/A',
        (s.image ? '[Photo Attached]' : '[No Photo]') + geoInfo,
        s.remarkVal || s.remark || '-'
      ];
    });

    doc.autoTable({
      startY: 172,
      head: [['#', 'Class / Std', 'Time / Duration', 'Topic Covered', 'Photo & Geotag', 'Remarks']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        1: { cellWidth: 65 },
        2: { cellWidth: 80 },
        3: { cellWidth: 140 },
        4: { cellWidth: 110 },
        5: { cellWidth: 96 }
      }
    });

    let finalY = doc.lastAutoTable.finalY + 18;

    // 4. Full Day Summary Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Full Day Work Summary:', 40, finalY);

    finalY += 8;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    const splitSummary = doc.splitTextToSize(report.summary || 'No summary provided.', 500);
    const summaryBoxHeight = Math.max(36, splitSummary.length * 11 + 16);
    doc.roundedRect(40, finalY, 515, summaryBoxHeight, 4, 4, 'FD');
    doc.text(splitSummary, 50, finalY + 14);

    finalY += summaryBoxHeight + 24;

    if (finalY > 710) {
      doc.addPage();
      finalY = 50;
    }

    // 5. 3-Level Approval Verification Flow Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
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
    const mgrText = report.managerReview ? (report.managerReview.status === 'approved' ? \`✅ Approved\\nBy: \${report.managerReview.reviewerName || 'Manager'}\\nDate: \${report.managerReview.reviewedAt || ''}\` : \`❌ Rejected\\n\${report.managerReview.remarks || ''}\`) : (report.status === 'pending_manager' ? '⏳ Pending Review' : 'Verified');
    doc.text(mgrText, 48, finalY + 28);

    // Box 2: HR
    doc.roundedRect(216, finalY, boxWidth, boxHeight, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('2. Human Resources (HR)', 224, finalY + 14);
    doc.setFont('helvetica', 'normal');
    const hrText = report.hrReview ? (report.hrReview.status === 'approved' ? \`✅ Approved\\nBy: \${report.hrReview.reviewerName || 'HR'}\\nDate: \${report.hrReview.reviewedAt || ''}\` : \`❌ Rejected\\n\${report.hrReview.remarks || ''}\`) : (report.status === 'pending_hr' ? '⏳ Pending HR Review' : (['pending_manager'].includes(report.status) ? '⏳ Awaiting Manager' : 'Verified'));
    doc.text(hrText, 224, finalY + 28);

    // Box 3: CEO
    doc.roundedRect(393, finalY, boxWidth, boxHeight, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('3. CEO / Administration', 401, finalY + 14);
    doc.setFont('helvetica', 'normal');
    const ceoText = report.ceoReview ? (report.ceoReview.status === 'approved' ? \`✅ Final Approved\\nDate: \${report.ceoReview.reviewedAt || ''}\` : \`❌ Rejected\\n\${report.ceoReview.remarks || ''}\`) : (report.status === 'approved' ? '✅ Final Approved' : (report.status === 'pending_ceo' ? '⏳ Pending CEO Approval' : '⏳ Awaiting HR'));
    doc.text(ceoText, 401, finalY + 28);

    // Footer note
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(\`Generated automatically via AIR G International EMS Portal on \${new Date().toLocaleString()}\`, 40, 812);

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
      showToast(\`Please enter the topic covered for session #\${i + 1}.\`, 'error');
      return;
    }
  }

  const submitBtn = document.getElementById('btn-submit-trainer-report');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Generating PDF &amp; Submitting...</span>';
  }

  const newReport = {
    id: \`TR-\${Date.now()}-\${Math.floor(1000 + Math.random() * 9000)}\`,
    trainerId: state.currentUser.id,
    trainerName: state.currentUser.name,
    trainerEmail: state.currentUser.email || '',
    trainerDept: state.currentUser.dept || 'Instructor',
    school: schoolVal,
    date: dateVal,
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
      \`New Trainer Daily Report: \${state.currentUser.name} submitted session report for \${schoolVal} on \${dateVal} with \${newReport.sessions.length} sessions. Please review on portal.\`,
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

  let pdfData = report.pdfBase64;
  if (!pdfData) {
    pdfData = generateTrainerReportPDF(report);
    report.pdfBase64 = pdfData;
    safeOriginalSetItem('ems_trainer_reports', JSON.stringify(state.trainerReports));
  }

  if (pdfData) {
    const win = window.open();
    if (win) {
      win.document.write(\`
        <html>
          <head><title>Trainer Report - \${report.trainerName} (\${report.date})</title></head>
          <body style="margin:0; background:#0f172a; display:flex; flex-direction:column; height:100vh;">
            <iframe src="\${pdfData}" style="width:100%; height:100%; border:none;"></iframe>
          </body>
        </html>
      \`);
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

  showToast(\`Loaded report for \${report.date}. Please make your corrections and submit again.\`, 'info');
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
    container.innerHTML = \`
      <div class="empty-state" style="padding: 32px 16px; text-align: center;">
        <div class="empty-state-title" style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">No submitted trainer reports found</div>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">Submit your today's classroom sessions above to see your date-wise reports and generated PDFs here.</p>
      </div>
    \`;
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
      statusBadgeHtml = \`<span class="badge badge-completed" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">✅ Final Approved by CEO</span>\`;
    } else if (report.status === 'pending_manager') {
      statusBadgeHtml = \`<span class="badge badge-warning" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Pending Reporting Manager Review (\${report.reportingManagerName || 'Manager'})\</span>\`;
    } else if (report.status === 'pending_hr') {
      statusBadgeHtml = \`<span class="badge badge-in-progress" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Manager Approved ➔ Pending HR Review</span>\`;
    } else if (report.status === 'pending_ceo') {
      statusBadgeHtml = \`<span class="badge badge-high" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ HR Approved ➔ Pending CEO Approval</span>\`;
    } else if (report.status === 'rejected') {
      statusBadgeHtml = \`<span class="badge badge-danger" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">❌ Rejected — Correction Needed</span>\`;
    }

    // Sessions Table Rows
    const sessionRowsHtml = (report.sessions || []).map((s, idx) => {
      let geoBadge = '';
      if (s.geoTag && s.geoTag.lat) {
        geoBadge = \`<div style="font-size: 0.7rem; color: #22c55e; margin-top: 2px;">📍 \${s.geoTag.lat}, \${s.geoTag.lng}</div>\`;
      }
      let photoThumb = '<span style="color: var(--text-muted); font-size: 0.75rem;">No photo</span>';
      if (s.image) {
        photoThumb = \`
          <div style="display: flex; align-items: center; gap: 6px;">
            <img src="\${s.image}" style="width: 38px; height: 38px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('\${s.image}')" title="Click to view full photo">
            \${geoBadge}
          </div>
        \`;
      }
      return \`
        <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.82rem;">
          <td style="text-align: center; padding: 8px 6px; font-weight: 600; color: var(--text-muted);">\${idx + 1}</td>
          <td style="padding: 8px 6px; font-weight: 600;">\${s.classVal || s.class || '-'}</td>
          <td style="padding: 8px 6px; color: var(--text-secondary);">\${s.timeVal || s.time || '-'}</td>
          <td style="padding: 8px 6px; font-weight: 500;">\${s.topicVal || s.topic || '-'}</td>
          <td style="padding: 8px 6px;">\${photoThumb}</td>
          <td style="padding: 8px 6px; color: var(--text-secondary);">\${s.remarkVal || s.remark || '-'}</td>
        </tr>
      \`;
    }).join('');

    let rejectionAlertHtml = '';
    if (report.status === 'rejected') {
      const rejectRemark = (report.ceoReview && report.ceoReview.remarks) || (report.hrReview && report.hrReview.remarks) || (report.managerReview && report.managerReview.remarks) || 'Please correct your report and resubmit.';
      rejectionAlertHtml = \`
        <div style="padding: 12px 16px; border-radius: 6px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; font-size: 0.85rem;">
          <strong>⚠️ Rejection Feedback:</strong> "\${rejectRemark}"
        </div>
      \`;
    }

    card.innerHTML = \`
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <strong style="font-size: 1.05rem; color: var(--text-primary);">👤 \${report.trainerName}</strong>
          <span style="padding: 3px 8px; border-radius: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-size: 0.78rem; font-weight: 600;">🏫 \${report.school || 'School'}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">👔 Manager: \${report.reportingManagerName || 'Assigned Manager'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: 0.9rem; color: var(--primary);">📅 Date: \${formatDate(report.date)}</span>
          \${statusBadgeHtml}
        </div>
      </div>

      <!-- Full Session Table View on UI -->
      <div class="table-container" style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary);">
        <table style="width: 100%; border-collapse: collapse; min-width: 650px;">
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
            \${sessionRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Day Summary Box -->
      <div style="padding: 10px 14px; border-radius: 6px; background: var(--bg-secondary); border: 1px solid var(--border-color); font-size: 0.83rem;">
        <span style="font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">📝 Full Day Summary:</span>
        <span style="color: var(--text-secondary); white-space: pre-wrap;">\${report.summary || 'No summary provided.'}</span>
      </div>

      \${rejectionAlertHtml}

      <!-- Bottom Actions Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding-top: 6px;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="viewTrainerReportPdf('\${report.id}')" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; padding: 6px 14px; background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.4); color: #3b82f6;">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>📄 View / Download Generated PDF</span>
        </button>

        \${report.status === 'rejected' ? \`
          <button type="button" class="btn btn-primary btn-sm" onclick="redoTrainerReport('\${report.id}')" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 700; background: var(--warning); border-color: var(--warning); color: #000;">
            <span>🔄 Redo &amp; Resubmit This Report</span>
          </button>
        \` : ''}
      </div>
    \`;

    container.appendChild(card);
  });
}

function populateTrainerReviewFilters() {
  const trainerFilter = document.getElementById('review-filter-trainer');
  if (!trainerFilter) return;

  const trainersList = state.employees.filter(e => isUserTrainer(e));
  trainerFilter.innerHTML = '<option value="all">All Trainers</option>' + 
    trainersList.map(t => \`<option value="\${t.id}">\${t.name} (\${t.dept || 'Instructor'})\</option>\`).join('');
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
    container.innerHTML = \`
      <div class="empty-state" style="padding: 32px 16px; text-align: center;">
        <div class="empty-state-title" style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">No trainer reports pending review</div>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">You have no reports awaiting your approval for the selected filter.</p>
      </div>
    \`;
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
      statusBadgeHtml = \`<span class="badge badge-completed" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">✅ Final Approved</span>\`;
    } else if (report.status === 'pending_manager') {
      statusBadgeHtml = \`<span class="badge badge-warning" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Stage 1: Pending Reporting Manager</span>\`;
    } else if (report.status === 'pending_hr') {
      statusBadgeHtml = \`<span class="badge badge-in-progress" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Stage 2: Pending HR Review</span>\`;
    } else if (report.status === 'pending_ceo') {
      statusBadgeHtml = \`<span class="badge badge-high" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">⏳ Stage 3: Pending CEO Final Approval</span>\`;
    } else if (report.status === 'rejected') {
      statusBadgeHtml = \`<span class="badge badge-danger" style="padding: 5px 12px; font-size: 0.8rem; font-weight: 700;">❌ Rejected</span>\`;
    }

    // Sessions Table Rows
    const sessionRowsHtml = (report.sessions || []).map((s, idx) => {
      let geoBadge = '';
      if (s.geoTag && s.geoTag.lat) {
        geoBadge = \`<div style="font-size: 0.7rem; color: #22c55e; margin-top: 2px;">📍 \${s.geoTag.lat}, \${s.geoTag.lng}</div>\`;
      }
      let photoThumb = '<span style="color: var(--text-muted); font-size: 0.75rem;">No photo</span>';
      if (s.image) {
        photoThumb = \`
          <div style="display: flex; align-items: center; gap: 6px;">
            <img src="\${s.image}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); cursor: pointer;" onclick="openRosterDocModal('\${s.image}')" title="Click to inspect photo">
            \${geoBadge}
          </div>
        \`;
      }
      return \`
        <tr style="border-bottom: 1px solid var(--border-color); font-size: 0.82rem;">
          <td style="text-align: center; padding: 8px 6px; font-weight: 600; color: var(--text-muted);">\${idx + 1}</td>
          <td style="padding: 8px 6px; font-weight: 600;">\${s.classVal || s.class || '-'}</td>
          <td style="padding: 8px 6px; color: var(--text-secondary);">\${s.timeVal || s.time || '-'}</td>
          <td style="padding: 8px 6px; font-weight: 500;">\${s.topicVal || s.topic || '-'}</td>
          <td style="padding: 8px 6px;">\${photoThumb}</td>
          <td style="padding: 8px 6px; color: var(--text-secondary);">\${s.remarkVal || s.remark || '-'}</td>
        </tr>
      \`;
    }).join('');

    // Workflow Review Action Controls
    let actionControlsHtml = '';
    const canManagerReview = (report.status === 'pending_manager') && (report.reportingManagerId === myId || isCEO || isHR);
    const canHRReview = (report.status === 'pending_hr') && (isHR || isCEO);
    const canCEOReview = (report.status === 'pending_ceo') && isCEO;

    if (canManagerReview) {
      actionControlsHtml = \`
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 6px;">
          <button type="button" class="btn btn-success btn-sm" onclick="reviewTrainerReport('\${report.id}', 'approve', 'manager')" style="font-weight: 700; padding: 6px 16px; background: #16a34a; border-color: #16a34a; color: #fff;">
            ✅ Manager Approve &amp; Forward to HR
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="reviewTrainerReport('\${report.id}', 'reject', 'manager')" style="font-weight: 700; padding: 6px 16px;">
            ❌ Reject (Ask Trainer to Redo)
          </button>
        </div>
      \`;
    } else if (canHRReview) {
      actionControlsHtml = \`
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 6px;">
          <div style="font-size: 0.8rem; color: #22c55e; font-weight: 600; width: 100%;">
            ✓ Approved by Manager: \${report.managerReview ? report.managerReview.reviewerName : report.reportingManagerName} on \${report.managerReview ? report.managerReview.reviewedAt : ''}
          </div>
          <button type="button" class="btn btn-success btn-sm" onclick="reviewTrainerReport('\${report.id}', 'approve', 'hr')" style="font-weight: 700; padding: 6px 16px; background: #16a34a; border-color: #16a34a; color: #fff;">
            ✅ HR Approve &amp; Forward to CEO
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="reviewTrainerReport('\${report.id}', 'reject', 'hr')" style="font-weight: 700; padding: 6px 16px;">
            ❌ HR Reject (Ask Trainer to Redo)
          </button>
        </div>
      \`;
    } else if (canCEOReview) {
      actionControlsHtml = \`
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 6px;">
          <div style="font-size: 0.8rem; color: #3b82f6; font-weight: 600; width: 100%;">
            ✓ Approved by Manager &amp; HR
          </div>
          <button type="button" class="btn btn-success btn-sm" onclick="reviewTrainerReport('\${report.id}', 'approve', 'ceo')" style="font-weight: 700; padding: 6px 18px; background: #22c55e; border-color: #22c55e; color: #000;">
            👑 CEO Final Approve &amp; Finalize
          </button>
          <button type="button" class="btn btn-danger btn-sm" onclick="reviewTrainerReport('\${report.id}', 'reject', 'ceo')" style="font-weight: 700; padding: 6px 16px;">
            ❌ Reject (Ask Trainer to Redo)
          </button>
        </div>
      \`;
    } else if (report.status === 'approved') {
      actionControlsHtml = \`
        <div style="font-size: 0.82rem; color: #22c55e; font-weight: 700; padding: 6px 12px; border-radius: 4px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);">
          ✨ Fully Approved by Manager, HR, and CEO!
        </div>
      \`;
    }

    card.innerHTML = \`
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <strong style="font-size: 1.1rem; color: var(--text-primary);">🎓 Trainer: \${report.trainerName}</strong>
          <span style="padding: 3px 8px; border-radius: 4px; background: var(--bg-tertiary); border: 1px solid var(--border-color); font-size: 0.8rem; font-weight: 600;">🏫 \${report.school || 'School'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: 0.9rem; color: var(--primary);">📅 Date: \${formatDate(report.date)}</span>
          \${statusBadgeHtml}
        </div>
      </div>

      <!-- Interactive Sessions Table on UI -->
      <div class="table-container" style="overflow-x: auto; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-primary);">
        <table style="width: 100%; border-collapse: collapse; min-width: 650px;">
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
            \${sessionRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Day Summary -->
      <div style="padding: 10px 14px; border-radius: 6px; background: var(--bg-primary); border: 1px solid var(--border-color); font-size: 0.83rem;">
        <span style="font-weight: 700; color: var(--text-primary); display: block; margin-bottom: 4px;">📝 Full Day Summary:</span>
        <span style="color: var(--text-secondary); white-space: pre-wrap;">\${report.summary || 'No summary provided.'}</span>
      </div>

      <!-- Review Actions Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; border-top: 1px solid var(--border-color); padding-top: 12px;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="viewTrainerReportPdf('\${report.id}')" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; padding: 6px 14px; background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.4); color: #3b82f6;">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>📄 View / Download Generated PDF</span>
        </button>

        \${actionControlsHtml}
      </div>
    \`;

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
      ? \`Trainer Report Update: Your report for \${report.date} was approved by \${state.currentUser.name}. Next stage: \${report.status}.\`
      : \`Trainer Report Rejected: Your report for \${report.date} was rejected by \${state.currentUser.name}. Reason: "\${remarks}". Please login to redo and resubmit.\`;
    triggerSMSNotification(trainerEmp.phone, msg, trainerEmp.name);
  }

  renderTrainerReportsReviewList();
  renderTrainerReportsHistory();
  updateTrainerReportsBadge();

  if (action === 'approve') {
    showToast(\`Report approved! Status moved to \${report.status}.\`, 'success');
  } else {
    showToast('Report rejected and returned to trainer for correction.', 'warning');
  }
}
window.reviewTrainerReport = reviewTrainerReport;
`;

// Insert the module if not present
if (!appJs.includes('TRAINER DAILY SESSION REPORT SUITE')) {
  const insertIndex = appJs.lastIndexOf('window.cycleTaskStatus = cycleTaskStatus;');
  if (insertIndex !== -1) {
    appJs = appJs.slice(0, insertIndex) + trainerReportModule + '\n\n' + appJs.slice(insertIndex);
  } else {
    appJs += '\n\n' + trainerReportModule;
  }
}

// 6. Update renderDailyReports to auto-switch subtab or keep selected
if (!appJs.includes("switchReportsSubTab(state.activeReportSubTab || (isUserTrainer(state.currentUser) ? 'trainer' : 'standard'))")) {
  appJs = appJs.replace(
    'populateDailyReportDropdowns();',
    `populateDailyReportDropdowns();
  
  if (!state.activeReportSubTab) {
    state.activeReportSubTab = isUserTrainer(state.currentUser) ? 'trainer' : 'standard';
  }
  switchReportsSubTab(state.activeReportSubTab);
  return;`
  );
}

fs.writeFileSync('app.js', appJs, 'utf8');
console.log('app.js patched successfully!');
