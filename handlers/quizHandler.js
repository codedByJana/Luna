const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const config = require('../config');
const db = require('../utils/database');
const { getRoadmapEmbed } = require('../embeds/roadmaps');

async function browseRoadmaps(interaction) {
  // Routes to the start quiz menu as a fallback. 
  // You can customize this later to show a static list.
  return startQuiz(interaction);
}

// ========== START QUIZ ==========
async function startQuiz(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_category')
      .setPlaceholder('Choose your CTF category')
      .addOptions([
        { label: 'Web Exploitation', value: 'Web' },
        { label: 'Cryptography', value: 'Cryptography' },
        { label: 'Forensics', value: 'Forensics' },
        { label: 'Reverse Engineering', value: 'Reverse' },
        { label: 'Binary Exploitation (Pwn)', value: 'binary_exploitation' },
        { label: 'OSINT / Misc', value: 'osint_misc' }
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
  const existing = await db.getUser(userId) || {};

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
  const category = interaction.customId.replace('select_learner_', '');

  const existing = await db.getUser(userId) || {};
  await db.saveUser({
    ...existing,
    userId,
    learnerType: learnerType === 'both' ? 'book' : learnerType
  });

  let embedsToSend = [];
  let componentsToSend = [];
  const initialPath = learnerType === 'both' ? 'book' : learnerType;

  if (learnerType === 'both') {
    const bookPayload = getRoadmapEmbed(category, 'book', 0);
    const visualPayload = getRoadmapEmbed(category, 'visual', 0);
    embedsToSend = [...bookPayload.embeds, ...visualPayload.embeds];

    componentsToSend = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`view_both_${category}`)
          .setLabel('View Interactive Menus')
          .setStyle(ButtonStyle.Secondary)
      )
    ];
  } else {
    const payload = getRoadmapEmbed(category, initialPath, 0);
    embedsToSend = payload.embeds;
    componentsToSend = payload.components;
  }

  await interaction.editReply({
    content: `Your personalized roadmap for **${category}**:`,
    embeds: embedsToSend,
    components: componentsToSend,
  });
}

// ========== VIEW BOTH BUTTON ==========
async function handleViewBoth(interaction) {
  const category = interaction.customId.replace('view_both_', '');
  const book = getRoadmapEmbed(category, 'book', 0);
  const visual = getRoadmapEmbed(category, 'visual', 0);

  await interaction.update({
    content: `Both styles for **${category}**:`,
    embeds: [...book.embeds, ...visual.embeds],
    components: [...book.components, ...visual.components],
  });
}

// ========== MAIN HANDLER ==========
async function handler(interaction) {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_category') {
      return handleCategorySelect(interaction);
    }
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
  startQuiz,
  browseRoadmaps,
};