const config = require('../config');

const RANK_THRESHOLDS = {
  puppy: { min: 0, max: 5 },
  underdog: { min: 6, max: 10 },
  wolf: { min: 11, max: Infinity }
};

function getRankFromPoints(points) {
  if (points >= 11) return 'wolf';
  if (points >= 6) return 'underdog';
  return 'puppy';
}

async function updateRank(member, newPoints) {
  const newRank = getRankFromPoints(newPoints);
  const rankRoles = config.rankRoles;

  // Remove all rank roles first
  const rolesToRemove = Object.values(rankRoles).filter(id => member.roles.cache.has(id));
  if (rolesToRemove.length > 0) {
    await member.roles.remove(rolesToRemove);
  }

  // Add the correct rank role
  const newRoleId = rankRoles[newRank];
  if (newRoleId) {
    await member.roles.add(newRoleId);
  }

  return newRank;
}

module.exports = {
  getRankFromPoints,
  updateRank,
  RANK_THRESHOLDS
};