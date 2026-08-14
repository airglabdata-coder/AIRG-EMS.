const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Sort conversations in renderCommSidebar
const search1 = `const otherEmployees = state.employees.filter(emp => emp.id !== state.currentUser.id && (isPratap(state.currentUser) || !isPratap(emp)) && !emp.isDeleted && emp.status !== 'pending_approval');
    otherEmployees.forEach(emp => {`;

const replace1 = `const otherEmployees = state.employees.filter(emp => emp.id !== state.currentUser.id && (isPratap(state.currentUser) || !isPratap(emp)) && !emp.isDeleted && emp.status !== 'pending_approval');
    
    // Sort employees by latest message timestamp
    otherEmployees.sort((a, b) => {
      const msgsA = state.chats.filter(c => (c.senderId === state.currentUser.id && c.receiverId === a.id) || (c.senderId === a.id && c.receiverId === state.currentUser.id));
      const msgA = msgsA.length > 0 ? msgsA.reduce((latest, current) => new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest) : null;
      const timeA = msgA ? new Date(msgA.timestamp).getTime() : 0;
      
      const msgsB = state.chats.filter(c => (c.senderId === state.currentUser.id && c.receiverId === b.id) || (c.senderId === b.id && c.receiverId === state.currentUser.id));
      const msgB = msgsB.length > 0 ? msgsB.reduce((latest, current) => new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest) : null;
      const timeB = msgB ? new Date(msgB.timestamp).getTime() : 0;
      
      return timeB - timeA;
    });

    otherEmployees.forEach(emp => {`;

code = code.replace(search1, replace1);

// 2. Add date dividers in renderChatRoom
const search2 = `// Sort chronological (oldest first)
    const sorted = [...filteredMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    sorted.forEach(msg => {
      const isSent = msg.senderId === state.currentUser.id;`;

const replace2 = `// Sort chronological (oldest first)
    const sorted = [...filteredMessages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    let lastDateStr = null;
    sorted.forEach(msg => {
      const msgDate = new Date(msg.timestamp);
      const dateStr = msgDate.toLocaleDateString();
      
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
        
        divider.innerHTML = \`<span style="background-color: var(--surface-light); padding: 4px 12px; border-radius: 12px; border: 1px solid var(--border-color);">\${displayDate}</span>\`;
        messagesContainer.appendChild(divider);
        lastDateStr = dateStr;
      }

      const isSent = msg.senderId === state.currentUser.id;`;

code = code.replace(search2, replace2);

fs.writeFileSync('app.js', code, 'utf8');
console.log('Chat UI Patched');
