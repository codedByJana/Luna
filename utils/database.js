const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Luna';

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  category: { type: String, default: null },
  learnerType: { type: String, default: null },
  points: { type: Number, default: 0 },
  consistentDays: { type: Number, default: 0 },
  missedDays: { type: Number, default: 0 },
  lastTaskDate: { type: String, default: null },
  rank: { type: String, default: 'puppy' },
}, { timestamps: true });

const ctfEventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: String, default: null },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdBy: { type: String, default: null },
}, { timestamps: true });

const registrationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CtfEvent', required: true, index: true },
  status: {
    type: String,
    enum: ['registered', 'present', 'ghosted'],
    default: 'registered',
  },
  registeredAt: { type: Date, default: Date.now },
}, { timestamps: true });

registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });

const taskTemplateSchema = new mongoose.Schema({
  category: { type: String, required: true, index: true },
  learnerType: {
    type: String,
    enum: ['book', 'visual'],
    required: true,
    index: true,
  },
  taskText: { type: String, required: true },
  stage: { type: String, default: null },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

taskTemplateSchema.index({ category: 1, learnerType: 1, order: 1 });
taskTemplateSchema.index(
  { category: 1, learnerType: 1, taskText: 1 },
  { unique: true }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);
const CtfEvent = mongoose.models.CtfEvent || mongoose.model('CtfEvent', ctfEventSchema);
const Registration = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);
const TaskTemplate = mongoose.models.TaskTemplate || mongoose.model('TaskTemplate', taskTemplateSchema);

let connectionPromise = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
  }
  try {
    await connectionPromise;
    return mongoose.connection;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

async function getUser(userId) {
  await connectToDatabase();
  return User.findOne({ userId }).lean();
}

async function saveUser(data) {
  await connectToDatabase();
  const payload = {
    userId: data.userId,
    category: data.category ?? null,
    learnerType: data.learnerType ?? null,
    points: data.points ?? 0,
    consistentDays: data.consistentDays ?? 0,
    missedDays: data.missedDays ?? 0,
    lastTaskDate: data.lastTaskDate ?? null,
    rank: data.rank ?? 'puppy',
  };
  await User.updateOne(
    { userId: data.userId },
    { $set: payload },
    { upsert: true }
  );
  return payload;
}

async function getAllUsers() {
  await connectToDatabase();
  return User.find().lean();
}

async function getAllActiveUsers() {
  await connectToDatabase();
  return User.find({ category: { $ne: null } }).lean();
}

async function getOpenEvents() {
  await connectToDatabase();
  return CtfEvent.find({ status: 'open' }).sort({ createdAt: -1 }).lean();
}

async function getAllEvents() {
  await connectToDatabase();
  return CtfEvent.find().sort({ createdAt: -1 }).lean();
}

async function getEventById(eventId) {
  await connectToDatabase();
  return CtfEvent.findById(eventId).lean();
}

async function saveEvent(data) {
  await connectToDatabase();
  const payload = {
    name: data.name,
    date: data.date ?? null,
    status: data.status ?? 'open',
    createdBy: data.createdBy ?? null,
  };
  const doc = await CtfEvent.create(payload);
  return doc.toObject();
}

async function closeEvent(eventId) {
  await connectToDatabase();
  await CtfEvent.updateOne({ _id: eventId }, { $set: { status: 'closed' } });
  return getEventById(eventId);
}

async function registerUser(userId, eventId) {
  await connectToDatabase();
  return Registration.findOneAndUpdate(
    { userId, eventId },
    {
      $setOnInsert: {
        userId,
        eventId,
        status: 'registered',
        registeredAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

async function getRegistrations(eventId) {
  await connectToDatabase();
  return Registration.find({ eventId }).sort({ registeredAt: -1 }).lean();
}

async function getUserRegistration(userId, eventId) {
  await connectToDatabase();
  return Registration.findOne({ userId, eventId }).lean();
}

async function markRegistration(userId, eventId, status) {
  await connectToDatabase();
  const doc = await Registration.findOneAndUpdate(
    { userId, eventId },
    { $set: { status } },
    { new: true }
  ).lean();
  return doc;
}

async function getTaskTemplates(category, learnerType) {
  await connectToDatabase();
  return TaskTemplate
    .find({ category, learnerType, active: true })
    .sort({ order: 1, createdAt: 1 })
    .lean();
}

async function getTasksForUser(category, learnerType, limit = 4) {
  await connectToDatabase();
  const docs = await TaskTemplate
    .find({ category, active: true, $or: [{ learnerType }, { learnerType: learnerType === 'book' ? 'visual' : 'book' }] })
    .sort({ order: 1, createdAt: 1 })
    .limit(limit)
    .lean();
  return docs.map(d => d.taskText);
}

async function getAllTaskTemplates() {
  await connectToDatabase();
  return TaskTemplate.find({ active: true }).lean();
}

async function seedTaskTemplates(templates) {
  await connectToDatabase();
  const ops = templates.map((t, idx) => ({
    updateOne: {
      filter: { category: t.category, learnerType: t.learnerType, taskText: t.taskText },
      update: {
        $set: {
          category: t.category,
          learnerType: t.learnerType,
          taskText: t.taskText,
          stage: t.stage ?? null,
          order: t.order ?? idx,
          active: true,
        },
      },
      upsert: true,
    }
  }));
  if (ops.length === 0) return 0;
  const result = await TaskTemplate.bulkWrite(ops);
  return (result.upsertedCount || 0) + (result.modifiedCount || 0);
}

async function addTaskTemplate({ category, learnerType, taskText, stage = null, order = 0 }) {
  await connectToDatabase();
  return TaskTemplate.create({ category, learnerType, taskText, stage, order });
}

async function deactivateTaskTemplate(id) {
  await connectToDatabase();
  return TaskTemplate.updateOne({ _id: id }, { $set: { active: false } });
}

module.exports = {
  connectToDatabase,
  getUser,
  saveUser,
  getAllUsers,
  getAllActiveUsers,
  getOpenEvents,
  getAllEvents,
  getEventById,
  saveEvent,
  closeEvent,
  registerUser,
  getRegistrations,
  getUserRegistration,
  markRegistration,
  getTaskTemplates,
  getAllTaskTemplates,
  getTasksForUser,
  seedTaskTemplates,
  addTaskTemplate,
  deactivateTaskTemplate,
  models: { User, CtfEvent, Registration, TaskTemplate },
};
