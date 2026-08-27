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
  category: String,
  learnerType: String,
  points: {
    type: Number,
    default: 0,
  },
  consistentDays: {
    type: Number,
    default: 0,
  },
  missedDays: {
    type: Number,
    default: 0,
  },
  lastTaskDate: String,
  rank: {
    type: String,
    default: 'puppy',
  },
}, {
  timestamps: true,
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  date: String,
  status: {
    type: String,
    default: 'open',
  },
  createdBy: String,
}, {
  timestamps: true,
});

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

const registrationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
  },
  status: {
    type: String,
    default: 'registered',
  },
  registeredAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

const Registration = mongoose.models.Registration || mongoose.model('Registration', registrationSchema);

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
  return Event.find({ status: 'open' }).lean();
}

async function registerUser(userId, eventId) {
  await connectToDatabase();

  const eventObjectId = typeof eventId === 'string' ? eventId : eventId.toString();

  return Registration.findOneAndUpdate(
    { userId, eventId: eventObjectId },
    {
      userId,
      eventId: eventObjectId,
      status: 'registered',
      registeredAt: new Date(),
    },
    { upsert: true, new: true }
  ).lean();
}

async function getRegistrations(eventId) {
  await connectToDatabase();

  const eventObjectId = typeof eventId === 'string' ? eventId : eventId.toString();

  return Registration.find({ eventId: eventObjectId }).populate('userId', 'userId category learnerType points rank').lean();
}


module.exports = {
  getUser,
  saveUser,
  getAllUsers,
  getAllActiveUsers,
  getOpenEvents,
  registerUser,
  getRegistrations,
};