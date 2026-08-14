const fs = require('fs');

const jsCode = `
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
`;

fs.appendFileSync('app.js', jsCode);
console.log('Appended JS to app.js');
