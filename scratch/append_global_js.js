const fs = require('fs');

const jsCode = `
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
    
    // Check Birthday
    let isBday = false;
    if (emp.dateOfBirth) {
      const [dobY, dobM, dobD] = emp.dateOfBirth.split('-');
      if (dobM === tM && dobD === tD) {
        isBday = true;
      }
    }
    
    let isAnniv = false;
    let annivYears = 0;
    if (emp.joinDate) {
      const [joinY, joinM, joinD] = emp.joinDate.split('-');
      const diffYears = parseInt(tY) - parseInt(joinY);
      if (joinM === tM && joinD === tD && diffYears > 0) {
        isAnniv = true;
        annivYears = diffYears;
      }
    }

    if (isBday || isAnniv) {
      const storageKey = 'ems_global_announced_' + emp.id + '_' + todayStr;
      const alreadyAnnounced = localStorage.getItem(storageKey);
      
      if (!alreadyAnnounced) {
        // Double check if it's already in the chats state
        const chatExists = state.chats.some(c => c.receiverId === 'group' && c.senderId === 'system' && c.timestamp.startsWith(todayStr) && c.text.includes(emp.name));
        
        if (!chatExists) {
          // Send announcement! Only one client needs to send this, so we add a tiny random delay to prevent race conditions if multiple people log in exactly at the same millisecond
          setTimeout(() => {
            // Check again after timeout
            const stillNotExists = !state.chats.some(c => c.receiverId === 'group' && c.senderId === 'system' && c.timestamp.startsWith(todayStr) && c.text.includes(emp.name));
            if (stillNotExists) {
              const msgText = isBday 
                ? '🎉 Today is ' + emp.name + '\\'s Birthday! Wish them a great day! 🎂'
                : '🌟 Happy Work Anniversary to ' + emp.name + '! (' + annivYears + ' year' + (annivYears>1?'s':'') + ') 🚀';
                
              const newMsg = {
                id: 'MSG_' + Date.now() + Math.floor(Math.random() * 1000),
                senderId: 'system',
                receiverId: 'group',
                text: msgText,
                timestamp: new Date().toISOString()
              };
              state.chats.push(newMsg);
              triggerBackendSync();
            }
          }, Math.random() * 5000);
        }
        localStorage.setItem(storageKey, 'true');
      }
    }
  });
}
`;

fs.appendFileSync('app.js', jsCode);
console.log('Appended Global Announcement JS to app.js');
