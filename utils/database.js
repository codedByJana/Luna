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
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    category TEXT,
    learnerType TEXT,
    points INTEGER DEFAULT 0,
    consistentDays INTEGER DEFAULT 0,
    missedDays INTEGER DEFAULT 0,
    lastTaskDate TEXT,
    rank TEXT DEFAULT 'puppy'
  );

  CREATE TABLE IF NOT EXISTS ctf_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT,
    status TEXT DEFAULT 'open', -- open | closed
    createdBy TEXT
  );

  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    eventId INTEGER NOT NULL,
    status TEXT DEFAULT 'registered', -- registered | present | ghosted
    registeredAt TEXT,
    UNIQUE(userId, eventId)
  );
`);

getAllActiveUsers() {
  return db.prepare(`SELECT * FROM users WHERE category IS NOT NULL`).all();
},

getOpenEvents() {
  return db.prepare(`SELECT * FROM ctf_events WHERE status = 'open'`).all();
},

registerUser(userId, eventId) {
  return db.prepare(`
    INSERT OR IGNORE INTO registrations (userId, eventId, status, registeredAt)
    VALUES (?, ?, 'registered', ?)
  `).run(userId, eventId, new Date().toISOString());
},

getRegistrations(eventId) {
  return db.prepare(`SELECT * FROM registrations WHERE eventId = ?`).all(eventId);
}

module.exports = {
  getUser,
  saveUser,
  getAllUsers,
};