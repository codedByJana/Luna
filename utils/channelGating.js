const config = require('../config');

// Channels that require quiz completion (except #general)
// Variables capitalized first letter, values lower case unified through config
const GATED_CHANNEL_IDS = [
  config.roadmapsChannelId,
  config.tasksChannelId,
].filter(Boolean);

/**
 * Ensure channel overwrites are set so only users with a category role can view gated channels.
 * @everyone -> ViewChannel: false
 * each category role -> ViewChannel: true
 * #general -> ViewChannel: true for @everyone
 */
async function ensureChannelGating(client) {
  const guild = client.guilds.cache.get(config.guildId);
  if (!guild) {
    console.warn('[gating] Guild not found for gating');
    return;
  }

  // Ensure #general is open to everyone
  try {
    const general = await guild.channels.fetch(config.generalChannelId).catch(() => null);
    if (general) {
      await general.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: true }).catch(() => {});
      console.log('[gating] #general open to @everyone');
    }
  } catch (e) {
    console.warn('[gating] Failed to set #general:', e.message);
  }

  // For each gated channel, deny @everyone and allow each category role
  for (const channelId of GATED_CHANNEL_IDS) {
    try {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        console.warn(`[gating] Channel ${channelId} not found`);
        continue;
      }
      // Deny @everyone
      await channel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false }).catch((e) => console.warn(`[gating] deny @everyone for ${channel.name} failed:`, e.message));
      // Allow each category role
      for (const roleId of Object.values(config.categoryRoles)) {
        await channel.permissionOverwrites.edit(roleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
      }
      // Also allow verified role to see? No - quiz is obligatory, so verified alone should NOT see gated channels
      // Ensure verifiedRole is NOT allowed for gated channels (explicit deny if needed)
      if (config.verifiedRoleId) {
        // Do not allow verified to view gated channels - rely on @everyone deny
        await channel.permissionOverwrites.edit(config.verifiedRoleId, { ViewChannel: false }).catch(() => {});
      }
      console.log(`[gating] Gated #${channel.name} -> @everyone DENY, category roles ALLOW`);
    } catch (e) {
      console.error(`[gating] Failed for channel ${channelId}:`, e);
    }
  }
}

/**
 * For radio silence, we rely on role-based gating, no per-member overwrites needed.
 * This helper is kept for explicit per-member deny if needed.
 */
async function denyMemberGatedChannels(member) {
  // No-op with role-based gating - @everyone already denied.
  // Kept for compatibility if per-member gating needed in future.
  return;
}

async function grantMemberGatedChannels(member) {
  // Category role addition already grants access via channel overwrites.
  // No per-member overwrite needed.
  return;
}

module.exports = {
  GATED_CHANNEL_IDS,
  ensureChannelGating,
  denyMemberGatedChannels,
  grantMemberGatedChannels,
};
