const cron = require('node-cron');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const ranking = require('./rankingHandler');
const config = require('../config');

const MISS_PENALTY = 5;
const PUPPY_BAN_THRESHOLD = 3;
const TASKS_PER_DAY = 4;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function todayStr(date = new Date()) {
  return date.toISOString().split('T')[0];
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

async function getTasksForUser(user) {
  const learnerType = user.learnerType === 'visual' ? 'visual' : 'book';
  const all = await db.getTaskTemplates(user.category, learnerType);
  const fallback = await db.getTaskTemplates(
    user.category,
    learnerType === 'book' ? 'visual' : 'book'
  );
  const merged = [...all, ...fallback.filter(f => !all.some(a => a.taskText === f.taskText))];
  return pickDaily(merged.map(t => t.taskText), todayStr());
}

async function postDailyTasks(client) {
  const channel = await client.channels.fetch(config.tasksChannelId).catch(() => null);
  if (!channel) return;

  const users = await db.getAllActiveUsers();
  const today = todayStr();

  for (const user of users) {
    try {
      const tasks = await getTasksForUser(user);
      if (tasks.length === 0) continue;

      const taskList = tasks.map((t, i) => `**${i + 1}.** ${t}`).join('\n');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`task_done_${user.userId}_${today}`)
          .setLabel('I finished today\'s tasks')
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({
        content: `<@${user.userId}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(0x6952ea)
            .setTitle(`Daily Tasks – ${today}`)
            .setDescription(taskList)
            .setFooter({ text: 'Click the button when you finish (+1 pt). Miss = -5 pts.' })
        ],
        components: [row]
      });
    } catch (err) {
      console.error(`[postDailyTasks] failed for ${user.userId}:`, err);
    }
  }
}

async function handleTaskDone(interaction) {
  const parts = interaction.customId.split('_');
  const userId = parts[2];
  const date = parts.slice(3).join('_');

  if (interaction.user.id !== userId) {
    return interaction.reply({ content: 'This is not your task button.', ephemeral: true });
  }

  const user = await db.getUser(userId);
  if (!user) {
    return interaction.reply({ content: 'No profile found. Run /roadmap start first.', ephemeral: true });
  }

  if (user.lastTaskDate === date) {
    return interaction.reply({ content: 'You already completed today\'s tasks.', ephemeral: true });
  }

  const result = await ranking.addPoints(interaction.member, 1);

  const newConsistent = (user.consistentDays || 0) + 1;
  await db.saveUser({
    ...user,
    lastTaskDate: date,
    missedDays: 0,
    points: result.newPoints,
    rank: result.newRank,
    consistentDays: newConsistent,
  });

  let msg = `Tasks recorded! +1 point → **${result.newPoints} pts** | Rank: **${result.newRank}**`;
  if (result.rankedUp) {
    msg += `\n🎉 Rank up! Welcome to **${result.newRank}**!`;
  }

  return interaction.reply({ content: msg, ephemeral: true });
}

async function checkMissedDays(client) {
  const users = await db.getAllActiveUsers();
  const today = todayStr();

  for (const user of users) {
    try {
      const last = user.lastTaskDate;
      if (!last) continue;
      const gap = diffDays(last, today);
      if (gap <= 1) continue;

      const missedNow = gap - 1;
      if (missedNow <= 0) continue;

      const member = await client.guilds.cache
        .get(config.guildId)
        ?.members.fetch(user.userId)
        .catch(() => null);
      if (!member) continue;

      const totalMissed = (user.missedDays || 0) + missedNow;
      const result = await ranking.removePoints(member, MISS_PENALTY * missedNow);

      await db.saveUser({
        ...user,
        points: result.newPoints,
        rank: result.newRank,
        missedDays: totalMissed,
        consistentDays: 0,
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

function startCronJobs(client) {
  cron.schedule('0 10 * * *', () => postDailyTasks(client), { timezone: 'Africa/Cairo' });
  cron.schedule('30 21 * * *', () => checkMissedDays(client), { timezone: 'Africa/Cairo' });
}

module.exports = {
  startCronJobs,
  postDailyTasks,
  checkMissedDays,
  handleTaskDone,
  handleInteraction,
};
