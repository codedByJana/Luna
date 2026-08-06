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
        { label: 'Web Exploitation', value: 'web', emoji: '🕸️' },
        { label: 'Cryptography', value: 'crypto', emoji: '🔑' },
        { label: 'Forensics', value: 'forensics', emoji: '🔍' },
        { label: 'Reverse Engineering', value: 're', emoji: '🧩' },
        { label: 'Binary Exploitation (Pwn)', value: 'pwn', emoji: '💣' },
        { label: 'OSINT / Misc', value: 'osint', emoji: '🌐' }
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
  const category = interaction.values[0];
  if (!category) return;

  const userId = interaction.user.id;
  const existing = db.getUser(userId) || {};

  db.saveUser({
    userId,
    category,
    learnerType: existing.learnerType || null,
    points: existing.points || 0,
    consistentDays: existing.consistentDays || 0,
    lastTaskDate: existing.lastTaskDate || null,
    rank: existing.rank || 'puppy'
  });

  // Assign category role
  try {
    const roleId = config.categoryRoles[category];
    if (roleId) {
      await interaction.member.roles.add(roleId);
    }
  } catch (err) {
    console.error('Failed to add category role:', err);
  }

  // Show learner type menu
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_learner_type')
      .setPlaceholder('Choose your learning style')
      .addOptions([
        { label: 'Book-then-Apply (Theory first)', value: 'book', emoji: '📚' },
        { label: 'Visual Learner (Videos + Practice)', value: 'visual', emoji: '👀' },
        { label: 'Show Both Styles', value: 'both', emoji: '📖' }
      ])
  );

  await interaction.update({
    content: '**Step 2/2 – Choose your learning style**',
    components: [row],
    embeds: []
  });
}

// ========== LEARNER TYPE SELECT ==========
async function handleLearnerTypeSelect(interaction) {
  const learnerType = interaction.values[0];
  if (!learnerType) return;

  const userId = interaction.user.id;
  const existing = db.getUser(userId) || {};
  const category = existing.category;

  // Save learner type (even if they chose "both")
  db.saveUser({
    ...existing,
    userId,
    learnerType: learnerType === 'both' ? 'book' : learnerType // default to book if both
  });

  // Get the correct embed(s)
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
      .setEmoji('📖')
  );

  await interaction.update({
    content: learnerType === 'both'
      ? `Here are **both** roadmaps for **${category.toUpperCase()}**:`
      : `Here is your personalized roadmap:`,
    embeds: embedsToSend,
    components: learnerType === 'both' ? [] : [buttonRow]
  });
}

// ========== VIEW BOTH BUTTON ==========
async function handleViewBoth(interaction) {
  const category = interaction.customId.replace('view_both_', '');

  const embeds = [
    roadmaps.get(category, 'book'),
    roadmaps.get(category, 'visual')
  ];

  await interaction.reply({
    content: `Both learning styles for **${category.toUpperCase()}**:`,
    embeds,
    ephemeral: true
  });
}

// ========== MAIN HANDLER ==========
async function handler(interaction) {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_category') {
      return handleCategorySelect(interaction);
    }
    if (interaction.customId === 'select_learner_type') {
      return handleLearnerTypeSelect(interaction);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('view_both_')) {
      return handleViewBoth(interaction);
    }
  }
}

module.exports = handler;
module.exports.startQuiz = startQuiz;