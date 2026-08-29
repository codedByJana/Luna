const cron = require('node-cron');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const ranking = require('./rankingHandler');
const config = require('../config');
// Single source of truth for scoring — tasks.js (also mirrors utils/ranks.js POINTS)
const { SCORING } = require('../commands/tasks');

const MISS_PENALTY = SCORING.MISS_PENALTY; // 5
const PUPPY_BAN_THRESHOLD = SCORING.PUPPY_BAN_THRESHOLD; // 3
const COMPLETE_BONUS = SCORING.COMPLETE_BONUS; // 1
const TASKS_PER_DAY = 4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function todayStr(date = new Date()) {
  return date.toISOString().split('T')[0];
}

function yesterdayStr(today = todayStr()) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

function diffDays(aStr, bStr) {
  const a = new Date(`${aStr}T00:00:00Z`).getTime();
  const b = new Date(`${bStr}T00:00:00Z`).getTime();
  return Math.floor((b - a) / MS_PER_DAY);
}

function pickDaily(tasks, today) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  if (tasks.length <= TASKS_PER_DAY) return tasks.slice();

  const seed = new Date(`${today}T00:00:00Z`).getTime();
  const startIndex = Math.floor(seed / MS_PER_DAY) % tasks.length;
  const out = [];
  for (let i = 0; i < TASKS_PER_DAY; i++) {
    out.push(tasks[(startIndex + i) % tasks.length]);
  }
  return out;
}

function normalizeTaskCategory(input) {
  if (!input || typeof input !== 'string') return null;
  return String(input).trim().toLowerCase();
}

async function getTasksForUser(user) {
  const learnerType = user.learnerType === 'visual' ? 'visual' : 'book';
  const normalizedCategory = normalizeTaskCategory(user.category) || String(user.category || '').toLowerCase();
  // B. Daily posting: pick tasks from their category + learnerType
  const all = await db.getTaskTemplates(normalizedCategory, learnerType);
  const fallback = await db.getTaskTemplates(
    normalizedCategory,
    learnerType === 'book' ? 'visual' : 'book'
  );
  const merged = [...all, ...fallback.filter(f => !all.some(a => a.taskText === f.taskText))];
  return pickDaily(merged.map(t => t.taskText), todayStr());
}

/**
 * B. Daily posting (accountability)
 * Use node-cron to run every day at 10:00 Egypt time:
 *   cron.schedule('0 10 * * *', ..., { timezone: 'Africa/Cairo' })
 * For each user who finished the quiz (category != null), pick tasks and mention them.
 */
async function postDailyTasks(client) {
  const channel = await client.channels.fetch(config.tasksChannelId).catch(() => null);
  if (!channel) {
    console.warn('[postDailyTasks] tasksChannel not found');
    return;
  }

  const users = await db.getAllActiveUsers(); // users who finished quiz
  const today = todayStr();

  for (const user of users) {
    try {
      const tasks = await getTasksForUser(user);
      if (tasks.length === 0) continue;

      const taskList = tasks.map((t, i) => `**${i + 1}.** ${t}`).join('\n');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`task_done_${user.userId}_${today}`)
          .setLabel("I finished today's tasks")
          .setStyle(ButtonStyle.Success)
      );

      const sent = await channel.send({
        content: `<@${user.userId}> Your tasks today:`, // spec: "@user Your tasks today: 1. ... 2. ..."
        embeds: [
          new EmbedBuilder()
            .setColor(0x6952ea)
            .setTitle(`Daily Tasks – ${today}`)
            .setDescription(taskList)
            .setFooter({ text: `Click the button or react ✅ when you finish (+${COMPLETE_BONUS} pt). Miss = -${MISS_PENALTY} pts.` })
        ],
        components: [row]
      });
      // Also allow ✅ reaction path
      if (sent && sent.react) {
        await sent.react('✅').catch(() => null);
      }
    } catch (err) {
      console.error(`[postDailyTasks] failed for ${user.userId}:`, err);
    }
  }
}

/**
 * C. Tracking completion — button path
 * User reacts with ✅ OR uses button "I finished today's tasks"
 * Bot records lastTaskDate and adds +1 point, resets missedDays, increments streak
 */
async function completeTaskForUser(member, dateStr) {
  const userId = member.id;
  const user = await db.getUser(userId);
  if (!user) {
    return { error: 'No profile found. Run /roadmap start first.' };
  }
  if (user.lastTaskDate === dateStr) {
    return { error: "You already completed today's tasks." };
  }

  // New scoring rules: Complete a day → +1 point
  const result = await ranking.addPoints(member, COMPLETE_BONUS);

  const newConsistent = (user.consistentDays || 0) + 1;
  await db.saveUser({
    ...user,
    lastTaskDate: dateStr,
    missedDays: 0,
    points: result.newPoints,
    rank: result.newRank,
    consistentDays: newConsistent,
  });

  return result;
}

async function handleTaskDone(interaction) {
  const parts = interaction.customId.split('_');
  const userId = parts[2];
  const date = parts.slice(3).join('_');

  if (interaction.user.id !== userId) {
    // Guard against double-reply
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ content: 'This is not your task button.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return interaction.reply({ content: 'This is not your task button.', flags: MessageFlags.Ephemeral });
  }

  // Ensure member is available (interaction.member may be partial)
  const member = interaction.member;

  const completion = await completeTaskForUser(member, date);
  if (completion.error) {
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ content: completion.error, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
    return interaction.reply({ content: completion.error, flags: MessageFlags.Ephemeral });
  }

  let msg = `Tasks recorded! +${COMPLETE_BONUS} point → **${completion.newPoints} pts** | Rank: **${completion.newRank}**`;
  if (completion.rankedUp) {
    msg += `\n🎉 Rank up! Welcome to **${completion.newRank}**!`;
  }

  if (interaction.deferred || interaction.replied) {
    return interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
  return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
}

/**
 * C. Tracking completion — reaction path (✅)
 * Called from messageReactionAdd event. Allows reacting with ✅ on daily tasks message.
 */
async function handleReactionAdd(reaction, user, client) {
  try {
    if (user.bot) return;
    if (reaction.emoji.name !== '✅') return;
    // Ensure partials are fetched
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    const message = reaction.message;
    if (!message || !message.channel) return;
    if (message.channel.id !== config.tasksChannelId) return;
    // Only count reactions on bot's daily task messages
    if (!message.author || message.author.id !== client.user.id) return;

    const dateMatch = message.embeds[0]?.title?.match(/(\d{4}-\d{2}-\d{2})/);
    const today = dateMatch ? dateMatch[1] : todayStr();

    // Resolve guild member for ranking updates
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const userDoc = await db.getUser(user.id);
    if (!userDoc) return;
    if (userDoc.lastTaskDate === today) return; // already completed

    const result = await completeTaskForUser(member, today);
    if (result.error) return;

    // Optional: DM confirmation
    const dm = await member.createDM().catch(() => null);
    if (dm) {
      let msg = `Tasks recorded via ✅! +${COMPLETE_BONUS} point → **${result.newPoints} pts** | Rank: **${result.newRank}**`;
      if (result.rankedUp) msg += `\n🎉 Rank up! Welcome to **${result.newRank}**!`;
      await dm.send(msg).catch(() => null);
    }
  } catch (err) {
    console.error('[handleReactionAdd] failed:', err);
  }
}

/**
 * C. Second daily job — checks who didn't complete → apply -5 points and count missed days
 * Runs at 21:30 Cairo. For each user, if gap between lastTaskDate and today >1,
 * then missedNow = gap -1 days, penalty = missedNow * 5, totalMissed accumulates.
 *
 * Fixed double-count bug: after applying penalty we move lastTaskDate forward to yesterday,
 * so the same gap is not penalized again tomorrow. Also handles null lastTaskDate via createdAt.
 */
async function checkMissedDays(client) {
  const users = await db.getAllActiveUsers();
  const today = todayStr();
  const yesterday = yesterdayStr(today);

  for (const user of users) {
    try {
      let last = user.lastTaskDate;
      // FIX: Do not use createdAt/updatedAt for users who never completed a task.
      // That caused 13 days penalty since deployment. Start counting from today instead.
      if (!last) {
        // New user or legacy user with null lastTaskDate: initialize to yesterday (no retroactive penalty)
        // and skip this run. From tomorrow, missed days will be counted correctly.
        await db.saveUser({
          ...user,
          lastTaskDate: yesterday,
          missedDays: 0,
          consistentDays: 0,
        });
        continue;
      }

      const gap = diffDays(last, today);
      if (gap <= 1) continue; // completed yesterday or today → no miss

      const missedNow = gap - 1;
      if (missedNow <= 0) continue;

      const member = await client.guilds.cache
        .get(config.guildId)
        ?.members.fetch(user.userId)
        .catch(() => null);
      if (!member) continue;

      const totalMissed = (user.missedDays || 0) + missedNow;
      // Miss a day → -5 points
      const result = await ranking.removePoints(member, MISS_PENALTY * missedNow);

      // Mark penalty as applied up to yesterday to prevent double counting
      await db.saveUser({
        ...user,
        points: result.newPoints,
        rank: result.newRank,
        missedDays: totalMissed,
        consistentDays: 0,
        lastTaskDate: yesterday,
      });

      try {
        const dm = await member.createDM().catch(() => null);
        if (dm) {
          await dm.send(
            `⚠️ You missed ${missedNow} day(s) of tasks. ` +
            `-${MISS_PENALTY * missedNow} pts → **${result.newPoints} pts** (Rank: ${result.newRank}). ` +
            `Total missed: ${totalMissed}.`
          ).catch(() => null);
        }
      } catch (err) {
        console.error('[DM] failed:', err);
      }

      // D. Automatic ban (Puppy + 3 misses)
      // Docs reference: GuildMember#ban() / GuildMember#timeout()
      // if (user.rank === 'puppy' && user.missedDays >= 3) { await member.ban(...) }
      if (result.newRank === 'puppy' && totalMissed >= PUPPY_BAN_THRESHOLD) {
        await member
          .ban({ reason: `Missed ${totalMissed} daily tasks at Puppy rank` })
          .catch(err => console.error('[ban] failed:', err));
        console.log(`[ban] Banned ${user.userId} after ${totalMissed} missed days.`);
      }
    } catch (err) {
      console.error(`[checkMissedDays] failed for ${user.userId}:`, err);
    }
  }
}

async function handleInteraction(interaction) {
  if (interaction.isButton() && interaction.customId.startsWith('task_done_')) {
    await handleTaskDone(interaction);
    return true;
  }
  return false;
}

/**
 * B + C cron wiring
 * Daily posting at 10:00 Egypt time, missed check at 21:30
 * Spec example:
 *   const cron = require('node-cron');
 *   cron.schedule('0 10 * * *', async () => {
 *     // 1. Get all users who finished the quiz
 *     // 2. For each user, pick tasks from their category + learnerType
 *     // 3. Post in #daily-tasks mentioning them "@user Your tasks today: 1. ... 2. ..."
 *   });
 */
function startCronJobs(client) {
  cron.schedule('0 10 * * *', () => postDailyTasks(client), { timezone: 'Africa/Cairo' });
  cron.schedule('30 21 * * *', () => checkMissedDays(client), { timezone: 'Africa/Cairo' });
}

module.exports = {
  startCronJobs,
  postDailyTasks,
  checkMissedDays,
  handleTaskDone,
  handleReactionAdd,
  handleInteraction,
  // exported helpers for tests
  todayStr,
  yesterdayStr,
  diffDays,
  pickDaily,
  getTasksForUser,
};
