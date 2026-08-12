const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// Replace generateTrainerReportPDF function with image-rendering and clean non-emoji PDF generator
const oldFuncStart = 'function generateTrainerReportPDF(report) {';
const oldFuncEnd = 'async function handleTrainerReportSubmit(event) {';

const newFunc = `function generateTrainerReportPDF(report) {
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
    doc.text(\`Trainer Name: \${report.trainerName}\`, 55, 106);
    doc.text(\`Session Date: \${report.date}\`, 320, 106);

    doc.setFont('helvetica', 'normal');
    doc.text(\`School / Center: \${report.school || 'Not Specified'}\`, 55, 124);
    doc.text(\`Reporting Manager: \${report.reportingManagerName || 'Assigned Manager'}\`, 320, 124);
    doc.text(\`Department: \${report.trainerDept || 'Instructor'}\`, 55, 142);
    doc.text(\`Report ID: \${report.id}\`, 320, 142);

    // 3. Sessions Table with embedded images
    const tableBody = report.sessions.map((s, idx) => {
      let geoInfo = '';
      if (s.geoTag && s.geoTag.lat) {
        geoInfo = \`\\n[Geotag Verified]\\nLat: \${s.geoTag.lat}, Lng: \${s.geoTag.lng}\\nTime: \${s.geoTag.timestamp || ''}\`;
      }
      
      // If photo is present, add line breaks so text appears neatly below the embedded photo
      const photoSpacing = s.image ? '\\n\\n\\n\\n\\n' : '';
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
      ? (report.managerReview.status === 'approved' ? \`[APPROVED]\\nBy: \${report.managerReview.reviewerName || 'Manager'}\\nDate: \${report.managerReview.reviewedAt || ''}\` : \`[REJECTED]\\n\${report.managerReview.remarks || ''}\`) 
      : (report.status === 'pending_manager' ? '[Pending Review]' : '[Verified]');
    doc.text(mgrText, 48, finalY + 28);

    // Box 2: HR
    doc.roundedRect(216, finalY, boxWidth, boxHeight, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('2. Human Resources (HR)', 224, finalY + 14);
    doc.setFont('helvetica', 'normal');
    const hrText = report.hrReview 
      ? (report.hrReview.status === 'approved' ? \`[APPROVED]\\nBy: \${report.hrReview.reviewerName || 'HR'}\\nDate: \${report.hrReview.reviewedAt || ''}\` : \`[REJECTED]\\n\${report.hrReview.remarks || ''}\`) 
      : (report.status === 'pending_hr' ? '[Pending HR Review]' : (['pending_manager'].includes(report.status) ? '[Awaiting Manager Approval]' : '[Verified]'));
    doc.text(hrText, 224, finalY + 28);

    // Box 3: CEO
    doc.roundedRect(393, finalY, boxWidth, boxHeight, 3, 3, 'S');
    doc.setFont('helvetica', 'bold');
    doc.text('3. CEO / Administration', 401, finalY + 14);
    doc.setFont('helvetica', 'normal');
    const ceoText = report.ceoReview 
      ? (report.ceoReview.status === 'approved' ? \`[FINAL APPROVED]\\nDate: \${report.ceoReview.reviewedAt || ''}\` : \`[REJECTED]\\n\${report.ceoReview.remarks || ''}\`) 
      : (report.status === 'approved' ? '[FINAL APPROVED]' : (report.status === 'pending_ceo' ? '[Pending CEO Approval]' : '[Awaiting HR Approval]'));
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

`;

const startIdx = appJs.indexOf(oldFuncStart);
const endIdx = appJs.indexOf(oldFuncEnd);

if (startIdx !== -1 && endIdx !== -1) {
  appJs = appJs.slice(0, startIdx) + newFunc + appJs.slice(endIdx);
  fs.writeFileSync('app.js', appJs, 'utf8');
  console.log('generateTrainerReportPDF updated with image embedding and clean formatting!');
} else {
  console.error('Could not find generateTrainerReportPDF function boundaries in app.js');
}
