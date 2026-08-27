const cron = require('node-cron');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');
const ranking = require('./rankingHandler');
const taskTemplates = require('../data/tasks');
const config = require('../config');

function getTasksForUser(user) {
  const cat = user.category;
  const type = user.learnerType === 'visual' ? 'visual' : 'book';
  const main = taskTemplates[cat]?.[type] || [];
  const otherType = type === 'book' ? 'visual' : 'book';
  const extra = taskTemplates[cat]?.[otherType] || [];
  return [...main, ...extra].slice(0, 4); 
}

async function postDailyTasks(client) {
  const channel = await client.channels.fetch(config.tasksChannelId).catch(() => null);
  if (!channel) return;

  const users = db.getAllActiveUsers();
  const today = new Date().toISOString().split('T')[0];

  for (const user of users) {
    const tasks = getTasksForUser(user);
    if (tasks.length === 0) continue;

    const taskList = tasks.map((t, i) => `**${i + 1}.** ${t}`).join('\n');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`task_done_${user.userId}_${today}`)
        .setLabel('I finished today’s tasks')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({
      content: `<@${user.userId}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(0x6952ea)
          .setTitle(`Daily Tasks – ${today}`)
          .setDescription(taskList)
          .setFooter({ text: 'Click the button when you finish' })
      ],
      components: [row]
    });
  }
}

async function handleTaskDone(interaction) {
  const [ , , userId, date] = interaction.customId.split('_');
  if (interaction.user.id !== userId) {
    return interaction.reply({ content: 'This is not your task button.', ephemeral: true });
  }

  const user = db.getUser(userId);
  if (!user) return;

  if (user.lastTaskDate === date) {
    return interaction.reply({ content: 'You already completed today’s tasks.', ephemeral: true });
  }

  // +1 point
  const result = await ranking.addPoints(interaction.member, 1);

  db.saveUser({
    ...user,
    lastTaskDate: date,
    missedDays: 0,
    points: result.newPoints,
    rank: result.newRank
  });

  await interaction.reply({
    content: `Tasks recorded! +1 point → **${result.newPoints} pts** | Rank: **${result.newRank}**`,
    ephemeral: true
  });
}

// Check missed days (run once a day, e.g. 23:00)
async function checkMissedDays(client) {
  const users = db.getAllActiveUsers();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  for (const user of users) {
    if (user.lastTaskDate === yesterdayStr || user.lastTaskDate === today.toISOString().split('T')[0]) {
      continue; // did the task
    }

    // Missed
    const member = await client.guilds.cache.get(config.guildId)?.members.fetch(user.userId).catch(() => null);
    if (!member) continue;

    const result = await ranking.removePoints(member, 5); // -5 points
    const missedDays = (user.missedDays || 0) + 1;

    db.saveUser({
      ...user,
      points: result.newPoints,
      rank: result.newRank,
      missedDays,
      consistentDays: 0
    });

    // Auto-ban if Puppy + 3 misses
    if (result.newRank === 'puppy' && missedDays >= 3) {
      await member.ban({ reason: 'Missed 3 daily tasks at Puppy rank' }).catch(console.error);
    }
  }
}

function startCronJobs(client) {
  // Every day at 10:00 Egypt time (UTC+2 → 08:00 UTC)
  cron.schedule('0 8 * * *', () => postDailyTasks(client), { timezone: 'Africa/Cairo' });

  // Every day at 23:30 Egypt time to check misses
  cron.schedule('30 21 * * *', () => checkMissedDays(client), { timezone: 'Africa/Cairo' });
}

module.exports = {
  handleTaskDone,
  startCronJobs,
  postDailyTasks
};