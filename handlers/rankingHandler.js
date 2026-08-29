const { EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const config = require('../config');

const POINTS = {
  PUPPY_TO_UNDERDOG: 15,
  UNDERDOG_TO_WOLF: 30,
};

const RANKS = {
  puppy: { min: 0, max: POINTS.PUPPY_TO_UNDERDOG - 1, label: 'Puppy', emoji: '🐶' },
  underdog: { min: POINTS.PUPPY_TO_UNDERDOG, max: POINTS.UNDERDOG_TO_WOLF - 1, label: 'Underdog', emoji: '🐺' },
  wolf: { min: POINTS.UNDERDOG_TO_WOLF, max: Infinity, label: 'Wolf', emoji: '🐺🔥' }
};

function getRankFromPoints(points) {
  if (points >= POINTS.UNDERDOG_TO_WOLF) return 'wolf';
  if (points >= POINTS.PUPPY_TO_UNDERDOG) return 'underdog';
  return 'puppy';
}

/**
 * Update the user's rank role on Discord
 */
async function updateMemberRank(member, newPoints) {
  const newRank = getRankFromPoints(newPoints);
  const rankRoles = config.rankRoles;

  try {
    // Remove all existing rank roles
    const currentRankRoles = Object.values(rankRoles).filter(roleId =>
      member.roles.cache.has(roleId)
    );

    if (currentRankRoles.length > 0) {
      await member.roles.remove(currentRankRoles);
    }

    // Add the new rank role
    const newRoleId = rankRoles[newRank];
    if (newRoleId) {
      await member.roles.add(newRoleId);
    }

    return newRank;
  } catch (error) {
    console.error('Failed to update rank roles:', error);
    return getRankFromPoints(newPoints);
  }
}

/**
 * Add points and handle rank up
 */
async function addPoints(member, amount = 1) {
  const userId = member.id;
  const user = await db.getUser(userId) || {
    userId,
    points: 0,
    consistentDays: 0,
    rank: 'puppy'
  };

  const oldPoints = user.points || 0;
  const newPoints = oldPoints + amount;
  const oldRank = user.rank || 'puppy';
  const newRank = await updateMemberRank(member, newPoints);

  // Save to database
  await db.saveUser({
    ...user,
    points: newPoints,
    rank: newRank
  });

  return {
    oldPoints,
    newPoints,
    oldRank,
    newRank,
    rankedUp: oldRank !== newRank && newPoints > oldPoints
  };
}

/**
 * Remove points and handle rank down
 */
async function removePoints(member, amount = 1) {
  const userId = member.id;
  const user = await db.getUser(userId) || {
    userId,
    points: 0,
    rank: 'puppy'
  };

  const oldPoints = user.points || 0;
  const newPoints = Math.max(0, oldPoints - amount); // never go below 0
  const oldRank = user.rank || 'puppy';
  const newRank = await updateMemberRank(member, newPoints);

  await db.saveUser({
    ...user,
    points: newPoints,
    rank: newRank,
    consistentDays: 0 // reset streak on miss
  });

  return {
    oldPoints,
    newPoints,
    oldRank,
    newRank,
    rankedDown: oldRank !== newRank
  };
}

/**
 * Get a nice rank card embed
 */
function getRankEmbed(user, member) {
  const rankInfo = RANKS[user.rank] || RANKS.puppy;
  const nextRank = user.rank === 'puppy' ? 'underdog' :
                   user.rank === 'underdog' ? 'wolf' : null;

  const embed = new EmbedBuilder()
    .setColor(user.rank === 'wolf' ? 0xc6ff33 : user.rank === 'underdog' ? 0x6952ea : 0x7d638f)
    .setTitle(`${rankInfo.emoji} ${member.user.username}'s Rank`)
    .addFields(
      { name: 'Current Rank', value: `**${rankInfo.label}**`, inline: true },
      { name: 'Points', value: `**${user.points || 0}**`, inline: true },
      { name: 'Missed Days', value: `${user.missedDays || 0}`, inline: true }
    )
    .setFooter({ text: 'Underdogs Pack' })
    .setTimestamp();

  if (nextRank) {
    const needed = RANKS[nextRank].min - (user.points || 0);
    embed.addFields({
      name: 'Next Rank',
      value: `${RANKS[nextRank].label} (need ${needed} more point${needed > 1 ? 's' : ''})`
    });
  } else {
    embed.addFields({ name: 'Status', value: 'Max rank reached (Wolf)' });
  }

  return embed;
}

/**
 * Main handler for ranking related interactions (optional)
 */
async function handler(interaction) {
  // You can add buttons later like "Check my rank"
  if (interaction.isButton() && interaction.customId === 'check_rank') {
    const user = await db.getUser(interaction.user.id) || { points: 0, rank: 'puppy', consistentDays: 0 };
    const embed = getRankEmbed(user, interaction.member);

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}

module.exports = {
  handler,
  getRankFromPoints,
  updateMemberRank,
  addPoints,
  removePoints,
  getRankEmbed,
  RANKS
};