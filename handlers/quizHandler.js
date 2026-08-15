const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');

const config = require('../config');
const db = require('../utils/database');
const roadmaps = require('../embeds/roadmaps'); // We will create this file

// ========== START QUIZ ==========
async function startQuiz(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_category')
      .setPlaceholder('Choose your CTF category')
      .addOptions([
        { label: 'Web Exploitation', value: 'Web', emoji: '🕸️' },
        { label: 'Cryptography', value: 'Cryptography', emoji: '🔑' },
        { label: 'Forensics', value: 'Forensics', emoji: '🔍' },
        { label: 'Reverse Engineering', value: 'Reverse', emoji: '🧩' },
        { label: 'Binary Exploitation (Pwn)', value: 'Pwn', emoji: '💣' },
        { label: 'OSINT / Misc', value: 'OSINTandMisc', emoji: '🌐' }
      ])
  );

  await interaction.reply({
    content: '**Step 1/2 – Choose your category**',
    components: [row],
    ephemeral: true
  });
}

// ========== CATEGORY SELECT ==========
async function handleCategorySelect(interaction) {
  await interaction.deferUpdate();
  const category = interaction.values[0];
  if (!category) return;

  const userId = interaction.user.id;

  // Await database read
  const existing = await db.getUser(userId) || {};

  // Await database write
  await db.saveUser({
    userId,
    category,
    learnerType: existing.learnerType || null,
    points: existing.points || 0,
    consistentDays: existing.consistentDays || 0,
    lastTaskDate: existing.lastTaskDate || null,
    rank: existing.rank || 'puppy'
  });

  try {
    const roleId = config.categoryRoles[category];
    if (roleId) {
      await interaction.member.roles.add(roleId);
    }
  } catch (err) {
    console.error('Failed to add category role:', err);
  }

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      // Embed the category into the ID for the next step to catch
      .setCustomId(`select_learner_${category}`)
      .setPlaceholder('Choose your learning style')
      .addOptions([
        { label: 'Book-then-Apply (Theory first)', value: 'book' },
        { label: 'Visual Learner (Videos + Practice)', value: 'visual' },
        { label: 'Show Both Styles', value: 'both' }
      ])
  );

  await interaction.editReply({
    content: '**Step 2/2 – Choose your learning style**',
    components: [row],
    embeds: []
  });
}

// ========== LEARNER TYPE SELECT ==========
async function handleLearnerTypeSelect(interaction) {
  await interaction.deferUpdate();
  const learnerType = interaction.values[0];
  if (!learnerType) return;

  const userId = interaction.user.id;

  // Extract category securely from the customId instead of the database
  const category = interaction.customId.replace('select_learner_', '');

  // Await database read/write
  const existing = await db.getUser(userId) || {};
  await db.saveUser({
    ...existing,
    userId,
    learnerType: learnerType === 'both' ? 'book' : learnerType
  });

  let embedsToSend = [];

  if (learnerType === 'both') {
    embedsToSend.push(roadmaps.get(category, 'book'));
    embedsToSend.push(roadmaps.get(category, 'visual'));
  } else {
    embedsToSend.push(roadmaps.get(category, learnerType));
  }

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`view_both_${category}`)
      .setLabel('View Both Styles')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({
    content: learnerType === 'both'
      ? `Here are **both** roadmaps for **${category.toUpperCase()}**:`
      : `Here is your personalized roadmap:`,
    embeds: embedsToSend,
    components: learnerType === 'both' ? [] : [buttonRow]
  });
}

// ========== MAIN HANDLER ==========
async function handler(interaction) {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_category') {
      return handleCategorySelect(interaction);
    }
    // Update this line to catch the dynamic ID containing the category
    if (interaction.customId.startsWith('select_learner_')) {
      return handleLearnerTypeSelect(interaction);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('view_both_')) {
      return handleViewBoth(interaction);
    }
  }
}

module.exports = {
  handleInteraction: handler,
  startQuiz
};