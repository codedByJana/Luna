const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const db = require('../utils/database');
const ranking = require('./rankingHandler');
const config = require('../config');

// ========== GENERATE DAILY TASK OPTIONS ==========
function getTaskOptions(category, learnerType) {
  // Base tasks according to the user's main learning style
  const baseTasks = {
    web: {
      book: [
        { label: 'Read 1 PortSwigger topic + notes', value: 'web_book_1' },
        { label: 'Solve 2-3 PortSwigger labs', value: 'web_book_2' },
        { label: 'Solve 2 PicoCTF / Natas challenges', value: 'web_book_3' },
        { label: 'Write payloads in cheat sheet', value: 'web_book_4' }
      ],
      visual: [
        { label: 'Watch 1-2 web videos (CryptoCat / Hammond)', value: 'web_visual_1' },
        { label: 'Solve 3 matching labs after watching', value: 'web_visual_2' },
        { label: 'Review 1 writeup + add notes', value: 'web_visual_3' }
      ]
    },
    crypto: {
      book: [
        { label: 'Read 1 crypto concept', value: 'crypto_book_1' },
        { label: 'Solve 3 PicoCTF / Root-Me crypto', value: 'crypto_book_2' },
        { label: 'Practice with CyberChef / RsaCtfTool', value: 'crypto_book_3' }
      ],
      visual: [
        { label: 'Watch 1 crypto video', value: 'crypto_visual_1' },
        { label: 'Solve 3 matching crypto challenges', value: 'crypto_visual_2' }
      ]
    },
    // Add the same pattern for: forensics, re, pwn, osint
    forensics: { book: [], visual: [] },
    re: { book: [], visual: [] },
    pwn: { book: [], visual: [] },
    osint: { book: [], visual: [] }
  };

  const mainTasks = baseTasks[category]?.[learnerType] || [];
  const otherType = learnerType === 'book' ? 'visual' : 'book';
  const extraTasks = baseTasks[category]?.[otherType] || [];

  // Combine: main style first + extra from the other style
  return [...mainTasks, ...extraTasks].slice(0, 8); // max 8 options
}

// ========== START DAILY TASK MENU ==========
async function startDailyTasks(interaction) {
  const userId = interaction.user.id;
  const user = await db.getUser(userId);

  if (!user || !user.category || !user.learnerType) {
    return interaction.reply({
      content: 'You need to complete the roadmap quiz first (`/roadmap start`).',
      ephemeral: true
    });
  }

  const options = getTaskOptions(user.category, user.learnerType);

  if (options.length === 0) {
    return interaction.reply({
      content: 'No tasks available for your category yet. Contact an Alpha.',
      ephemeral: true
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_daily_tasks')
      .setPlaceholder('Select the tasks you will do today')
      .setMinValues(1)
      .setMaxValues(Math.min(options.length, 5))
      .addOptions(options)
  );

  await interaction.reply({
    content: `**Daily Tasks for ${user.category.toUpperCase()}** (${user.learnerType})\nSelect what you will complete today:`,
    components: [row],
    ephemeral: true
  });
}

// ========== HANDLE TASK SELECTION ==========
async function handleTaskSelect(interaction) {
  const selected = interaction.values; // array of task values
  const userId = interaction.user.id;
  const user = await db.getUser(userId) || {};

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if already submitted today
  if (user.lastTaskDate === today) {
    return interaction.update({
      content: 'You already submitted your tasks for today!',
      components: []
    });
  }

  // Calculate consistency
  let consistentDays = user.consistentDays || 0;

  // Simple logic: if they submit today → count as consistent
  consistentDays += 1;

  // Every 5 consistent days → +1 point
  let pointsResult = await ranking.addPoints(interaction.member, 0);
  if (consistentDays >= 5) {
    pointsResult = await ranking.addPoints(interaction.member, 1);
    consistentDays = 0; // reset streak counter
  }

  const points = pointsResult.newPoints;
  const newRank = pointsResult.newRank;

  await db.saveUser({
    ...user,
    userId,
    points,
    consistentDays,
    lastTaskDate: today,
    missedDays: 0, // reset missed when they submit
    rank: newRank
  });

  const embed = new EmbedBuilder()
    .setColor(0xc6ff33)
    .setTitle('Daily Tasks Recorded')
    .setDescription(`You selected **${selected.length}** task(s) for today.`)
    .addFields(
      { name: 'Current Points', value: `${points}`, inline: true },
      { name: 'Consistent Days', value: `${consistentDays}/5`, inline: true },
      { name: 'Current Rank', value: newRank.toUpperCase(), inline: true }
    )
    .setFooter({ text: 'Underdogs Pack • Keep going!' });

  await interaction.update({
    content: null,
    embeds: [embed],
    components: []
  });
}

// ========== DAILY CHECK (can be run by cron or manual command) ==========
async function checkMissedDays(client) {
  // This function should be called once per day (you can use node-cron later)
  const allUsers = await db.getAllUsers();

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  for (const user of allUsers) {
    if (user.lastTaskDate !== yesterdayStr && user.lastTaskDate !== today.toISOString().split('T')[0]) {
      // Missed a day
      let missedDays = (user.missedDays || 0) + 1;

      const member = await client.guilds.cache
        .get(config.guildId)
        ?.members.fetch(user.userId)
        .catch(() => null);

      if (member) {
        const result = await ranking.removePoints(member, 1);
        await db.saveUser({
          ...user,
          points: result.newPoints,
          missedDays,
          rank: result.newRank,
          consistentDays: 0
        });

        // Optional: punish if missed 5 days at Puppy
        if (missedDays >= 5 && result.newRank === 'puppy') {
          // You can add a warning or kick logic here
          console.log(`${user.userId} reached 5 missed days at Puppy rank`);
        }
      }
    }
  }
}

// ========== MAIN HANDLER ==========
async function handler(interaction) {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_daily_tasks') {
      return handleTaskSelect(interaction);
    }
  }
}

module.exports = handler;
module.exports.startDailyTasks = startDailyTasks;
module.exports.checkMissedDays = checkMissedDays;