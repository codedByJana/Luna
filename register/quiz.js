const { StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const config = require('../config');

async function startQuiz(interaction) {
  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId('category_select')
    .setPlaceholder('Choose your category')
    .addOptions([
      { label: 'Web Security', value: 'web', description: 'Web application security' },
      { label: 'Binary Exploitation', value: 'binary', description: 'Binary exploitation' },
      { label: 'Cryptography', value: 'crypto', description: 'Encryption & decryption' },
      { label: 'Forensics', value: 'forensics', description: 'Digital forensics' },
      { label: 'Reverse Engineering', value: 'reverse', description: 'Reverse Engineering' },
      { label: 'Osint and Misc', value: 'osint_misc', description: 'Open Source Intelligence and Miscellaneous' },
    ]);

  const row = new ActionRowBuilder().addComponents(categorySelect);

  await interaction.followUp({
    content: 'Select your primary learning category:',
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

async function handleCategorySelect(interaction) {
  const category = interaction.values[0];
  if (!category) return;

  const userId = interaction.user.id;
  const existing = await db.getUser(userId) || {};

  const isFirstTake = !existing.category;
  const isSameCategory = existing.category === category;
  const isSwitch = existing.category && existing.category !== category;

  let userData;
  if (isFirstTake || isSwitch) {
    // first take OR category override -> assign category and reset rank to puppy
    userData = {
      userId,
      category,
      learnerType: existing.learnerType || null,
      points: 0,
      consistentDays: 0,
      missedDays: 0,
      lastTaskDate: null,
      rank: 'puppy'
    };
  } else if (isSameCategory) {
    // same category retake -> preserve points/rank (evolves via tasks/scoring)
    userData = {
      userId,
      category,
      learnerType: existing.learnerType || null,
      points: existing.points ?? 0,
      consistentDays: existing.consistentDays ?? 0,
      missedDays: existing.missedDays ?? 0,
      lastTaskDate: existing.lastTaskDate ?? null,
      rank: existing.rank ?? 'puppy'
    };
  }

  await db.saveUser(userData);

  // Update Discord category roles
  // Support both legacy name-based map (register/quiz) and ID-based config (quizHandler)
  const roleMap = {
    'web': 'Web Security',
    'binary': 'Binary Exploitation',
    'crypto': 'Cryptography',
    'forensics': 'Forensics',
    'reverse': 'Reverse',
    'osint_misc': 'osint_misc',
  };
  try {
    // Prefer config IDs if category matches config keys (Web, Cryptography, etc.)
    const newRoleId = config.categoryRoles[category];
    const oldRoleId = existing.category ? config.categoryRoles[existing.category] : null;

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