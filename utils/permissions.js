const config = require('../config');

function isAlpha(member) {
  if (!member) return false;
  const alphaRoleId = config.rankRoles?.alpha;
  if (alphaRoleId && member.roles?.cache?.has(alphaRoleId)) return true;
  if (member.permissions?.has?.('Administrator')) return true;
  return false;
}

module.exports = { isAlpha };
