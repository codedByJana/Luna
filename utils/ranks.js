const config = require('../config');

const RANK_THRESHOLDS = {
  puppy: { min: 0, max: 14 },
  underdog: { min: 15, max: 29 },
  wolf: { min: 30, max: Infinity }
};

const POINTS = {
  COMPLETE_BONUS: 1,
  MISS_PENALTY: 5,
  PUPPY_TO_UNDERDOG: 15,
  UNDERDOG_TO_WOLF: 30,
  PUPPY_BAN_THRESHOLD: 3,
};

function getRankFromPoints(points) {
  if (points >= POINTS.UNDERDOG_TO_WOLF) return 'wolf';
  if (points >= POINTS.PUPPY_TO_UNDERDOG) return 'underdog';
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
  RANK_THRESHOLDS,
  POINTS
};