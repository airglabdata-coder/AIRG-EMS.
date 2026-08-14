const state = {
  currentUser: { id: "HR" },
  chats: [
    { senderId: "HR", receiverId: "Aniket", timestamp: "2026-08-14T01:00:00Z" }, // Older message
    { senderId: "Manali", receiverId: "HR", timestamp: "2026-08-14T05:00:00Z" }  // Newer message
  ],
  employees: [
    { id: "Manali", name: "Manali" },
    { id: "Aniket", name: "Aniket" },
    { id: "Atharva", name: "Atharva" } // No messages
  ]
};

const otherEmployees = [...state.employees];
otherEmployees.sort((a, b) => {
  const msgsA = state.chats.filter(c => (c.senderId === state.currentUser.id && c.receiverId === a.id) || (c.senderId === a.id && c.receiverId === state.currentUser.id));
  const msgA = msgsA.length > 0 ? msgsA.reduce((latest, current) => new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest) : null;
  const timeA = msgA ? new Date(msgA.timestamp).getTime() : 0;
  
  const msgsB = state.chats.filter(c => (c.senderId === state.currentUser.id && c.receiverId === b.id) || (c.senderId === b.id && c.receiverId === state.currentUser.id));
  const msgB = msgsB.length > 0 ? msgsB.reduce((latest, current) => new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest) : null;
  const timeB = msgB ? new Date(msgB.timestamp).getTime() : 0;
  
  return timeB - timeA;
});

console.log(otherEmployees.map(e => e.name));
