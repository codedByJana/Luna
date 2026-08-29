const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const config = require('../config');

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
function todayStr(date = new Date()) {
    return date.toISOString().split('T')[0];
}
function yesterdayStr(today = todayStr()) {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
}

async function startQuiz(interaction) {
  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId('category_select')
    .setPlaceholder('Choose your category')
    .addOptions([
      { label: 'Web', value: 'web', description: 'Web application security' },
      { label: 'Cryptography', value: 'cryptography', description: 'Encryption & decryption' },
      { label: 'Reverse Engineering', value: 'reverse', description: 'Reverse engineering & exploitation' },
      { label: 'Binary Exploitation(Pwn)', value: 'binary_exploitation', description: 'Binary exploitation & pwn' },
      { label: 'Forensics', value: 'forensics', description: 'Digital forensics' },
      { label: 'Osint and Misc', value: 'osint_misc', description: 'OSINT and miscellaneous' },
    ]);

  const row = new ActionRowBuilder().addComponents(categorySelect);

  await interaction.followUp({
    content: 'Select your primary learning category:',
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

async function handleCategorySelect(interaction) {
  const rawCategory = interaction.values[0];
  if (!rawCategory) return;
  const category = normalizeCategory(rawCategory) || String(rawCategory).toLowerCase();

  const userId = interaction.user.id;
  const existingRaw = await db.getUser(userId) || {};
  const existingCategory = normalizeCategory(existingRaw.category) || (existingRaw.category ? String(existingRaw.category).toLowerCase() : null);
  const existing = { ...existingRaw, category: existingCategory };

  const isFirstTake = !existing.category;
  const isSameCategory = existing.category === category;
  const isSwitch = existing.category && existing.category !== category;

  let userData;
  if (isFirstTake || isSwitch) {
    // first take OR category override -> assign category and reset rank to puppy
    // Use yesterday as baseline to avoid 13-day retroactive penalty
    userData = {
      userId,
      category,
      learnerType: existing.learnerType || null,
      points: 0,
      consistentDays: 0,
      missedDays: 0,
      lastTaskDate: yesterdayStr(),
      rank: 'puppy'
    };
  } else if (isSameCategory) {
    // same category retake -> preserve points/rank (evolves via tasks/scoring)
    // If lastTaskDate is still null, initialize to yesterday to avoid retroactive penalty
    userData = {
      userId,
      category,
      learnerType: existing.learnerType || null,
      points: existing.points ?? 0,
      consistentDays: existing.consistentDays ?? 0,
      missedDays: existing.missedDays ?? 0,
      lastTaskDate: existing.lastTaskDate ?? yesterdayStr(),
      rank: existing.rank ?? 'puppy'
    };
  }

  await db.saveUser(userData);

  // Update Discord category roles - variables capitalized first letter, values lower case unified
  const roleMap = {
    'web': 'Web Security',
    'cryptography': 'Cryptography',
    'forensics': 'Forensics',
    'reverse': 'Reverse Engineering',
    'binary_exploitation': 'Binary Exploitation',
    'osint_misc': 'OSINT & Misc',
  };
  try {
    const newRoleId = getCategoryRoleId(category);
    const oldRoleId = existing.category ? getCategoryRoleId(existing.category) : null;

    if (newRoleId) {
      if (!interaction.member.roles.cache.has(newRoleId)) {
        await interaction.member.roles.add(newRoleId);
      }
      if (isSwitch && oldRoleId && oldRoleId !== newRoleId) {
        await interaction.member.roles.remove(oldRoleId).catch(() => {});
      }
    } else {
      // Fallback to legacy name-based lookup for register/quiz categories
      const newRoleName = roleMap[category];
      const oldRoleName = existing.category ? roleMap[existing.category] : null;
      if (newRoleName) {
        const role = interaction.guild.roles.cache.find(r => r.name === newRoleName);
        if (role && !interaction.member.roles.cache.has(role.id)) {
          await interaction.member.roles.add(role);
        }
        if (isSwitch && oldRoleName && oldRoleName !== newRoleName) {
          const oldRole = interaction.guild.roles.cache.find(r => r.name === oldRoleName);
          if (oldRole && interaction.member.roles.cache.has(oldRole.id)) {
            await interaction.member.roles.remove(oldRole).catch(() => {});
          }
        }
      }
    }

    // Sync rank to puppy on first take or switch
    if (isFirstTake || isSwitch) {
      // Use rankingHandler if available, otherwise utils/ranks
      try {
        const ranking = require('../handlers/rankingHandler');
        await ranking.updateMemberRank(interaction.member, 0).catch(() => {});
      } catch {
        const { updateRank } = require('../utils/ranks');
        await updateRank(interaction.member, 0).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Failed to update category/rank roles:', err);
  }

  // Continue to learning style
  const { askLearningStyle } = require('./learningStyle');
  await askLearningStyle(interaction);
}

module.exports = { startQuiz, handleCategorySelect };