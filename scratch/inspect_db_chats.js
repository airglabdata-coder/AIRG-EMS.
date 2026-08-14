require('dotenv').config();
const mongoose = require('mongoose');
const models = require('../models');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB.");
  
  const chats = await models.Chat.find({});
  console.log("=== ALL CHATS ===");
  chats.forEach(c => {
    console.log(`From: ${c.senderName} (${c.senderId}) | To: ${c.receiverId} | Time: ${c.timestamp}`);
  });

  process.exit();
}
test();
