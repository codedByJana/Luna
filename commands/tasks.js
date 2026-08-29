const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const ranking = require('../handlers/rankingHandler');
const curriculum = require('../ctf_curriculum_roadmap.json');

// ──────────────────────────────────────────────────────────────────────────────
// A. Stored schedule — MongoDB compatible (SQL reference kept for docs)
//    SQLite reference:
//    CREATE TABLE IF NOT EXISTS task_templates (
//      id INTEGER PRIMARY KEY AUTOINCREMENT,
//      category TEXT NOT NULL,
//      learner_type TEXT NOT NULL, -- 'book' or 'visual'
//      task_text TEXT NOT NULL,
//      active INTEGER DEFAULT 1
//    );
//    Mongo equivalent is utils/database.js TaskTemplate mongoose schema:
//      { category, learnerType: 'book'|'visual', taskText, stage, order, active }
// ──────────────────────────────────────────────────────────────────────────────

// ── Daily Tasks + Scoring + Auto-ban — New scoring rules ──
// New scoring rules
// Complete a day → +1 point
// Miss a day → -5 points
// Puppy → Underdog: 15 points
// Underdog → Wolf: 30 points
// Puppy + 3 missed days → automatic ban
const SCORING = {
  COMPLETE_BONUS: 1,          // Complete a day → +1 point
  MISS_PENALTY: 5,            // Miss a day → -5 points
  PUPPY_TO_UNDERDOG: 15,      // Puppy → Underdog: 15 points
  UNDERDOG_TO_WOLF: 30,       // Underdog → Wolf: 30 points
  PUPPY_BAN_THRESHOLD: 3,     // Puppy + 3 missed days → automatic ban
};

const RANKS = {
  puppy: { min: 0, max: SCORING.PUPPY_TO_UNDERDOG - 1, label: 'Puppy', emoji: '🐶' },
  underdog: { min: SCORING.PUPPY_TO_UNDERDOG, max: SCORING.UNDERDOG_TO_WOLF - 1, label: 'Underdog', emoji: '🐺' },
  wolf: { min: SCORING.UNDERDOG_TO_WOLF, max: Infinity, label: 'Wolf', emoji: '🐺🔥' },
};

function getRankFromPoints(points) {
  if (points >= SCORING.UNDERDOG_TO_WOLF) return 'wolf';
  if (points >= SCORING.PUPPY_TO_UNDERDOG) return 'underdog';
  return 'puppy';
}

// ──────────────────────────────────────────────────────────────────────────────
// B. Daily posting (accountability) — node-cron at 10:00 Egypt time
// C. Tracking completion — ✅ reaction or button
// D. Automatic ban (Puppy + 3 misses) — GuildMember#ban()
// Full runtime implementation lives in handlers/taskHandler.js; reference snippets below
// are kept here so tasks.js itself documents the required logic per spec.
// ──────────────────────────────────────────────────────────────────────────────

// B. Daily posting (accountability) — spec snippet (executable reference):
// const cron = require('node-cron');
// cron.schedule('0 10 * * *', async () => {
//   // 1. Get all users who finished the quiz
//   // 2. For each user, pick tasks from their category + learnerType
//   // 3. Post in #daily-tasks mentioning them
//   //    "@user Your tasks today: 1. ... 2. ..."
// }, { timezone: 'Africa/Cairo' });

// C. Tracking completion helpers (spec):
// User reacts with ✅ or uses a button "I finished today's tasks"
// Bot records lastTaskDate and adds +1 point
// A second daily job checks who didn't complete → apply -5 points and count missed days
function recordCompletion(user, todayStr) {
  return {
    ...user,
    lastTaskDate: todayStr,
    points: (user.points || 0) + SCORING.COMPLETE_BONUS,
    rank: getRankFromPoints((user.points || 0) + SCORING.COMPLETE_BONUS),
    missedDays: 0,
    consistentDays: (user.consistentDays || 0) + 1,
  };
}
function applyMissPenalty(user, missedDaysCount) {
  const newPoints = Math.max(0, (user.points || 0) - SCORING.MISS_PENALTY * missedDaysCount);
  return {
    ...user,
    points: newPoints,
    rank: getRankFromPoints(newPoints),
    missedDays: (user.missedDays || 0) + missedDaysCount,
    consistentDays: 0,
  };
}

// D. Automatic ban (Puppy + 3 misses) — spec snippet:
// if (user.rank === 'puppy' && user.missedDays >= 3) {
//   await member.ban({ reason: 'Missed 3 daily tasks at Puppy rank' });
// }
// Docs reference: GuildMember#ban() / GuildMember#timeout().
async function checkAutoBan(user, member) {
  if (user.rank === 'puppy' && (user.missedDays || 0) >= SCORING.PUPPY_BAN_THRESHOLD) {
    await member.ban({ reason: 'Missed 3 daily tasks at Puppy rank' });
    return true;
  }
  return false;
}

const CATEGORY_KEYS = {
  Web: 'Web',
  Cryptography: 'Cryptography',
  Forensics: 'Forensics',
  Reverse: 'Reverse',
  binary_exploitation: 'binary_exploitation',
  osint_misc: 'osint_misc',
};

function getCategoryData(key) {
  return curriculum.categories.find(c => c.category === key);
}

function getStages(categoryKey, learnerType) {
  const data = getCategoryData(categoryKey);
  if (!data) return [];
  const paths = data.paths || {};
  if (paths[learnerType]) return paths[learnerType].stages || [];
  if (paths.common) return paths.common.stages || [];
  const first = Object.values(paths)[0];
  return first ? first.stages || [] : [];
}

function joinTopics(topics) {
  if (!topics) return [];
  if (Array.isArray(topics)) {
    return topics.map(t => (typeof t === 'string' ? t : t?.title || t)).filter(Boolean);
  }
  const out = [];
  for (const [, value] of Object.entries(topics)) {
    if (Array.isArray(value)) {
      value.forEach(v => {
        if (typeof v === 'string') out.push(v);
        else if (v?.title) out.push(v.title);
        else if (typeof v === 'object' && v !== null) {
          out.push(String(v));
        }
      });
    } else if (typeof value === 'string') {
      out.push(value);
    }
  }
  return out;
}

// Progressive resources: keep title + link for markdown
function extractResources(resources) {
  if (!resources) return [];
  const out = [];
  const pushRes = (r) => {
    if (!r) return;
    if (typeof r === 'string') out.push({ title: r, link: null });
    else if (r.title) out.push({ title: r.title, link: r.link || null, type: r.type || null });
  };
  const visit = (arr) => {
    if (Array.isArray(arr)) arr.forEach(pushRes);
    else if (arr && typeof arr === 'object') pushRes(arr);
  };
  if (Array.isArray(resources)) {
    visit(resources);
  } else if (typeof resources === 'object') {
    for (const value of Object.values(resources)) {
      if (Array.isArray(value)) visit(value);
      else if (value && typeof value === 'object' && value.title) pushRes(value);
      else if (value && typeof value === 'object') {
        for (const inner of Object.values(value)) {
          if (Array.isArray(inner)) visit(inner);
        }
      }
    }
  }
  return out;
}

function fmtResource(r) {
  if (!r) return '';
  if (r.link) return `[${r.title}](${r.link})`;
  return `**${r.title}**`;
}

function buildTasksForStage(stage, index, prefix) {
  const title = stage.title || `Stage ${index + 1}`;
  const description = stage.description ? ` — ${stage.description}` : '';
  const note = stage.note || (Array.isArray(stage.notes) ? stage.notes.join(' ') : '');
  const topics = joinTopics(stage.topics);
  const resources = extractResources(stage.resources);
  const sequence = Array.isArray(stage.sequence) ? stage.sequence : [];
  const tasks = [];

  if (resources.length) {
    const primary = resources.slice(0, 2).map(fmtResource).join(' • ');
    tasks.push(
      `📘 [${prefix}] Study **${title}**${description}: open ${primary} — take handwritten notes and define 3 key takeaways${note ? ` (${note})` : ''}.`
    );
  } else {
    tasks.push(
      `📘 [${prefix}] Read/study: **${title}**${description} – take handwritten notes and define 3 key takeaways${note ? ` (${note})` : ''}.`
    );
  }

  if (topics.length) {
    const sample = topics.slice(0, 3).join(', ');
    const isFundamentals = /fundamental|foundation|introduction|basics/i.test(title);
    const verb = isFundamentals ? 'Define fundamentals' : 'Map concepts';
    tasks.push(
      `🔎 [${prefix}] ${verb} for **${title}** and write a 1-line definition for each: ${sample}.`
    );
  } else if (description) {
    tasks.push(`🔎 [${prefix}] Summarize **${title}** in your own words: what problem does it solve?`);
  }

  if (resources.length) {
    const pick = fmtResource(resources[0]);
    const action = resources[0].type === 'practice' || /practice|lab|challenge/i.test(resources[0].title) ? 'Complete 1 lab/challenge on' : 'Finish 1 chapter / 1 module / 1 video from';
    tasks.push(`📚 [${prefix}] ${action} ${pick} for **${title}**.`);
    if (resources.length > 1 && resources[1].title !== resources[0].title) {
      const second = fmtResource(resources[1]);
      tasks.push(`📚 [${prefix}] Bonus: skim ${second} and note 2 differences vs primary resource.`);
    }
  }

  if (sequence.length) {
    tasks.push(`🧭 [${prefix}] Follow the suggested order for **${title}**: do step 1 → ${sequence[0]}.`);
    if (sequence.length > 1) {
      tasks.push(`🧭 [${prefix}] Next: ${sequence[1]} — schedule it after finishing step 1.`);
    }
  } else {
    const labHint = resources.find(r => /pwn\.college|htb|crackmes|root-me|cryptohack|wireshark|volatility|cyberdefenders/i.test(r.title || ''));
    const labText = labHint ? `using ${fmtResource(labHint)}` : 'from your notes';
    tasks.push(`🛠️ [${prefix}] Build a tiny demo / lab applying one idea from **${title}** ${labText} and save it to your private log.`);
  }

  return tasks;
}

function buildTasksForCategory(categoryKey, learnerType) {
  const stages = getStages(categoryKey, learnerType);
  if (stages.length === 0) return [];
  const tasks = [];
  stages.forEach((stage, idx) => {
    tasks.push(...buildTasksForStage(stage, idx, `Stage ${idx + 1}/${stages.length}`));
  });
  const cap = `Stage ${stages.length}/${stages.length}`;
  tasks.push(`🧠 [${cap}] Summarize what you learned across all stages in 5 bullet points and post a one-paragraph reflection in your private log.`);
  tasks.push(`🎯 [${cap}] Pick 1 weak area from the last stage and schedule a 25-min focused drill tomorrow.`);
  return tasks;
}

const tasks = {};
for (const [shortKey, jsonKey] of Object.entries(CATEGORY_KEYS)) {
  const book = buildTasksForCategory(jsonKey, 'book');
  const visual = buildTasksForCategory(jsonKey, 'visual');
  if (book.length === 0 && visual.length === 0) continue;
  tasks[shortKey] = {
    book: book.length ? book : visual,
    visual: visual.length ? visual : book,
  };
}

const FALLBACK_TASKS = {
  book: [
    '📘 Read 10 pages from your main CTF book and write 3 key takeaways.',
    '🔎 Define every new term you met today in your own words.',
    '📚 Finish one chapter/module from your current roadmap stage.',
    '🧠 Summarize the day in 5 bullet points and pick tomorrow’s focus.',
  ],
  visual: [
    '🎥 Watch one focused tutorial on your current stage and pause to take notes.',
    '🔎 Recreate the demo shown in the video from scratch.',
    '📚 Complete one module/lab on your practice platform.',
    '🧠 Summarize the day in 5 bullet points and pick tomorrow’s focus.',
  ],
};

for (const key of Object.keys(tasks)) {
  if (!tasks[key].book || tasks[key].book.length === 0) tasks[key].book = FALLBACK_TASKS.book;
  if (!tasks[key].visual || tasks[key].visual.length === 0) tasks[key].visual = FALLBACK_TASKS.visual;
}

const allTemplates = [];
for (const [category, paths] of Object.entries(tasks)) {
  for (const [learnerType, list] of Object.entries(paths)) {
    list.forEach((text, idx) => {
      const stageMatch = text.match(/\[Stage (\d+)\/(\d+)\]/);
      allTemplates.push({
        category,
        learnerType,
        taskText: text,
        stage: stageMatch ? `Stage ${stageMatch[1]}` : null,
        order: idx,
      });
    });
  }
}

// ── Slash command /tasks ──
async function getDailyTasks(interaction) {
  const userId = interaction.user.id;
  const user = await db.getUser(userId);

  if (!user || !user.category) {
    return interaction.reply({ content: 'You need to set your category first using /register.', ephemeral: true });
  }

  const rankLabel = getRankFromPoints(user.points);

  const embed = new EmbedBuilder()
    .setColor(0x6952ea)
    .setTitle(`Daily Tasks - ${interaction.user.username}`)
    .addFields(
      { name: 'Current Rank', value: `**${rankLabel}**`, inline: true },
      { name: 'Points', value: `**${user.points || 0}**`, inline: true },
      { name: 'Missed Days', value: `${user.missedDays || 0}`, inline: true }
    )
    .setFooter({ text: 'React ✅ or use button to complete daily tasks' });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = {
  // Slash command
  data: new SlashCommandBuilder()
    .setName('tasks')
    .setDescription('Show your daily tasks and status'),
  async execute(interaction) {
    await getDailyTasks(interaction);
  },
  // Library (also used by handlers/taskHandler.js and scripts/seedTasks.js)
  tasks,
  allTemplates,
  CATEGORY_KEYS,
  SCORING,
  RANKS,
  getRankFromPoints,
  recordCompletion,
  applyMissPenalty,
  checkAutoBan,
};
