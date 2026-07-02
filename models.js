const mongoose = require('mongoose');

// Employee Schema
const EmployeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  dept: { type: String },
  email: { type: String, required: true },
  role: { type: String },
  balance: { type: Number, default: 0 },
  absent: { type: Number, default: 0 },
  avatar: { type: String },
  aadhar: { type: String },
  pan: { type: String },
  bankAcc: { type: String },
  bankIfsc: { type: String },
  password: { type: String },
  phone: { type: String },
  photo: { type: String },
  designation: { type: String },
  salaries: { type: Map, of: mongoose.Schema.Types.Mixed },
  salary: { type: mongoose.Schema.Types.Mixed }
}, { strict: false });

// LeaveRequest Schema
const LeaveRequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String },
  employeeName: { type: String },
  dept: { type: String },
  type: { type: String },
  startDate: { type: String },
  endDate: { type: String },
  duration: { type: Number },
  reason: { type: String },
  status: { type: String },
  comment: { type: String },
  submittedAt: { type: String }
}, { strict: false });

// Project Schema
const ProjectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String },
  dept: { type: String },
  status: { type: String },
  techLeadId: { type: String },
  progress: { type: Number },
  description: { type: String },
  files: { type: Array }
}, { strict: false });

// Task Schema
const TaskSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  projectId: { type: String },
  projectName: { type: String },
  desc: { type: String },
  assigneeId: { type: String },
  assigneeName: { type: String },
  dueDate: { type: String },
  priority: { type: String },
  status: { type: String }
}, { strict: false });

// Chat Schema
const ChatSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  senderId: { type: String },
  senderName: { type: String },
  receiverId: { type: String },
  content: { type: String },
  timestamp: { type: String }
}, { strict: false });

// DailyReport Schema
const DailyReportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String },
  employeeName: { type: String },
  employeeRole: { type: String },
  dept: { type: String },
  date: { type: String },
  details: { type: String },
  images: { type: Array },
  remarks: { type: String },
  reviewedBy: { type: String },
  reviewedAt: { type: String },
  starRating: { type: Number }
}, { strict: false });

// Announcement Schema
const AnnouncementSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String },
  content: { type: String },
  senderName: { type: String },
  timestamp: { type: String }
}, { strict: false });

// Notice Schema
const NoticeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String },
  content: { type: String },
  targetEmployeeIds: { type: Array },
  senderName: { type: String },
  timestamp: { type: String }
}, { strict: false });

// Reimbursement Schema
const ReimbursementSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String },
  employeeName: { type: String },
  type: { type: String },
  amount: { type: Number },
  date: { type: String },
  purpose: { type: String },
  location: { type: String },
  attachments: { type: Array },
  status: { type: String },
  comment: { type: String },
  submittedAt: { type: String }
}, { strict: false });

// Ticket Schema
const TicketSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String },
  employeeName: { type: String },
  title: { type: String },
  description: { type: String },
  category: { type: String },
  priority: { type: String },
  status: { type: String },
  assignedToId: { type: String },
  assignedToName: { type: String },
  targetRole: { type: String },
  targetDept: { type: String },
  createdAt: { type: String },
  updatedAt: { type: String },
  replies: { type: Array },
  attachments: { type: Array }
}, { strict: false });

// Holiday Schema (both National Holidays and Celebration Days can use this or be separate)
const NationalHolidaySchema = new mongoose.Schema({
  date: { type: String, required: true },
  name: { type: String }
});

const CelebrationDaySchema = new mongoose.Schema({
  date: { type: String, required: true },
  name: { type: String }
});

// SystemState Metadata Schema (to keep track of sync timestamps, lastUpdated etc.)
const SystemMetadataSchema = new mongoose.Schema({
  key: { type: String, default: 'lastUpdated' },
  timestamp: { type: Number, default: Date.now }
});

// PushSubscription Schema
const PushSubscriptionSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  subscription: { type: mongoose.Schema.Types.Mixed, required: true }
});

const SchoolSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  managerName: { type: String },
  instructors: { type: Array, default: [] }
}, { strict: false });

// Compile and Export Models
module.exports = {
  Employee: mongoose.model('Employee', EmployeeSchema),
  LeaveRequest: mongoose.model('LeaveRequest', LeaveRequestSchema),
  Project: mongoose.model('Project', ProjectSchema),
  Task: mongoose.model('Task', TaskSchema),
  Chat: mongoose.model('Chat', ChatSchema),
  DailyReport: mongoose.model('DailyReport', DailyReportSchema),
  Announcement: mongoose.model('Announcement', AnnouncementSchema),
  Notice: mongoose.model('Notice', NoticeSchema),
  Reimbursement: mongoose.model('Reimbursement', ReimbursementSchema),
  Ticket: mongoose.model('Ticket', TicketSchema),
  NationalHoliday: mongoose.model('NationalHoliday', NationalHolidaySchema),
  CelebrationDay: mongoose.model('CelebrationDay', CelebrationDaySchema),
  SystemMetadata: mongoose.model('SystemMetadata', SystemMetadataSchema),
  PushSubscription: mongoose.model('PushSubscription', PushSubscriptionSchema),
  School: mongoose.model('School', SchoolSchema)
};
