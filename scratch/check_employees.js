require('dotenv').config();
const mongoose = require('mongoose');
const models = require('../models');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const expectedEmployees = [
  "Mr.Pratap Pawar",
  "Mr.Vijay Trimbake",
  "Mr.Chakravarti Gupta",
  "Rajendra Khavale",
  "Suyash Patil",
  "Aniket Shrungare",
  "dipak reddy",
  "Prasad Shelke",
  "Rohan Patil",
  "Nilesh sonanwane",
  "Aditya Raj",
  "Atharva Nahire",
  "Shravni Khanvilkar",
  "Sujit Bhendarkar",
  "Shravani Bhilare",
  "Atharva durgavale",
  "Vivek Shinde",
  "Mayuri Patil",
  "Manali Santosh Gujar",
  "Samiksha Juwar",
  "Vaishanvi Jadhav",
  "Avinash Prabhakar Honrao"
];

async function checkEmployees() {
  await mongoose.connect(process.env.MONGODB_URI);
  const dbEmployees = await models.Employee.find({});
  const dbNames = dbEmployees.map(e => e.name.toLowerCase().trim());
  
  const found = [];
  const missing = [];
  
  for (const name of expectedEmployees) {
    const searchName = name.toLowerCase().trim().replace("mr.", "").trim();
    const isFound = dbNames.some(dbn => dbn.includes(searchName) || searchName.includes(dbn));
    if (isFound) {
      found.push(name);
    } else {
      missing.push(name);
    }
  }
  
  console.log("=== FOUND ===");
  console.log(found.join(", "));
  console.log("\n=== MISSING ===");
  console.log(missing.join(", "));
  process.exit();
}
checkEmployees();
