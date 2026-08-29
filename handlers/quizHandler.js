const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');

const config = require('../config');
const db = require('../utils/database');
const ranking = require('./rankingHandler');
const { getRoadmapEmbed } = require('../embeds/roadmaps');

// Unified category handling - values lower case, variables capitalized first letter
function normalizeCategory(input) {
    if (!input || typeof input !== 'string') return null;
    return String(input).trim().toLowerCase();
}
function getCanonicalKey(lowerValue) {
    const map = {
        'web': 'Web',
        'cryptography': 'Cryptography',
        'forensics': 'Forensics',
        'reverse': 'Reverse',
        'binary_exploitation': 'Binary_exploitation',
        'osint_misc': 'Osint_misc',
    };
    return map[lowerValue] || lowerValue;
}
function getCategoryRoleId(categoryValue) {
    if (!categoryValue) return null;
    const lower = normalizeCategory(categoryValue);
    const key = getCanonicalKey(lower);
    return config.categoryRoles[key] || null;
}

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
        { label: 'Web', value: 'web' },
        { label: 'Cryptography', value: 'cryptography' },
        { label: 'Reverse Engineering', value: 'reverse' },
        { label: 'Binary Exploitation(Pwn)', value: 'binary_exploitation' },
        { label: 'Forensics', value: 'forensics' },
        { label: 'Osint and Misc', value: 'osint_misc' }
      ])
  );

  await interaction.reply({
    content: '**Step 1/2 – Choose your category**',
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

// ========== CATEGORY SELECT ==========
async function handleCategorySelect(interaction) {
  await interaction.deferUpdate();
  const rawCategory = interaction.values[0];
  if (!rawCategory) return;
  const category = normalizeCategory(rawCategory) || rawCategory;

  const userId = interaction.user.id;
  const existingRaw = await db.getUser(userId) || {};
  const existingCategory = normalizeCategory(existingRaw.category) || existingRaw.category;
  const existing = { ...existingRaw, category: existingCategory };

  const isFirstTake = !existing.category;
  const isSameCategory = existing.category === category;
  const isSwitch = existing.category && existing.category !== category;

  let userData;
  if (isFirstTake || isSwitch) {
    // First take OR switching category -> assign new category and reset to puppy
    // e.g. crypto -> Web ==> Web + puppy (points reset)
    userData = {
      userId,
      category,
      learnerType: existingRaw.learnerType || null,
      points: 0,
      consistentDays: 0,
      missedDays: 0,
      lastTaskDate: null,
      rank: 'puppy'
    };
  } else if (isSameCategory) {
    // Same category retake -> preserve scoring state (rank evolves via tasks)
    userData = {
      userId,
      category,
      learnerType: existingRaw.learnerType || null,
      points: existingRaw.points ?? 0,
      consistentDays: existingRaw.consistentDays ?? 0,
      missedDays: existingRaw.missedDays ?? 0,
      lastTaskDate: existingRaw.lastTaskDate ?? null,
      rank: existingRaw.rank ?? 'puppy'
    };
  }

  await db.saveUser(userData);

  try {
    const newRoleId = getCategoryRoleId(category);
    const oldRoleId = existing.category ? getCategoryRoleId(existing.category) : null;

    // Add new category role (idempotent)
    if (newRoleId && !interaction.member.roles.cache.has(newRoleId)) {
      await interaction.member.roles.add(newRoleId);
    }
    // Remove old category role only when switching
    if (isSwitch && oldRoleId && oldRoleId !== newRoleId) {
      await interaction.member.roles.remove(oldRoleId).catch(() => {});
    }

    // Sync rank roles to puppy on first take or switch
    if (isFirstTake || isSwitch) {
      await ranking.updateMemberRank(interaction.member, 0).catch(() => {});
    }
  } catch (err) {
    console.error('Failed to update category/rank roles:', err);
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
  const rawCategory = interaction.customId.replace('select_learner_', '');
  const category = normalizeCategory(rawCategory) || rawCategory;

  const existing = await db.getUser(userId) || {};
  // Ensure stored category is normalized (migrate legacy aliases)
  const normalizedExistingCategory = normalizeCategory(existing.category) || existing.category;
  await db.saveUser({
    ...existing,
    userId,
    category: normalizedExistingCategory || category,
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
  const rawCategory = interaction.customId.replace('view_both_', '');
  const category = normalizeCategory(rawCategory) || rawCategory;
  const book = getRoadmapEmbed(category, 'book', 0);
  const visual = getRoadmapEmbed(category, 'visual', 0);
  
  const payload = {
    content: `Both styles for **${category}**:`,
    embeds: [...book.embeds, ...visual.embeds],
    components: [...book.components, ...visual.components],
  };
  if (interaction.deferred) {
    await interaction.editReply(payload);
  } else if (interaction.replied) {
    await interaction.editReply(payload).catch(() => {});
  } else {
    await interaction.update(payload);
  }
  return true;
}

// ========== NAVIGATION BUTTONS ==========
async function handleRoadmapNavigation(interaction) {
  // Guard clauses to prevent processing unintended interactions
  if (!interaction.isButton()) return false;
  if (!interaction.customId.startsWith('roadmap_')) return false;

  // Prevent double-reply if already acknowledged (race condition / duplicate handler)
  if (interaction.replied || interaction.deferred) return true;

  const id = interaction.customId;
  const [actionWithPrefix, rawCategory, path, indexStr] = id.split(':');
  const category = normalizeCategory(rawCategory) || rawCategory;
  const action = actionWithPrefix.replace('roadmap_', ''); 
  
  let stageIndex = parseInt(indexStr, 10) || 0;
  let currentPath = path || 'book';

  if (action === 'next') stageIndex += 1;
  if (action === 'prev') stageIndex -= 1;
  if (action === 'switch') {
    currentPath = currentPath === 'visual' ? 'book' : 'visual';
  }

  const payload = getRoadmapEmbed(category, currentPath, stageIndex);

  // Safe update: interaction is a Button, not yet deferred/replied -> use update
  // If somehow already deferred/replied (guard above), fallback to editReply
  try {
    if (interaction.deferred) {
      await interaction.editReply({
        embeds: payload.embeds,
        components: payload.components
      });
    } else if (interaction.replied) {
      await interaction.editReply({
        embeds: payload.embeds,
        components: payload.components
      }).catch(() => {});
    } else {
      await interaction.update({
        embeds: payload.embeds,
        components: payload.components
      });
    }
  } catch (err) {
    // Ignore InteractionAlreadyReplied - happens on rapid double-click
    if (err.code !== 'InteractionAlreadyReplied' && err.code !== 40060) {
      throw err;
    }
  }
  return true;
}

// ========== MAIN HANDLER ==========
async function handler(interaction) {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'select_category') {
      await handleCategorySelect(interaction);
      return true;
    }
    if (interaction.customId.startsWith('select_learner_')) {
      await handleLearnerTypeSelect(interaction);
      return true;
    }
  }
  
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('view_both_')) {
      return handleViewBoth(interaction);
    }
    if (interaction.customId.startsWith('roadmap_')) {
      return handleRoadmapNavigation(interaction);
    }
  }
  return false;
}

module.exports = {
  handleInteraction: handler,
  startQuiz,
  handleRoadmapNavigation,
  browseRoadmaps,
};