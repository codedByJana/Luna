const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    const channel = member.guild.channels.cache.get(config.welcomeChannelId);
    if (!channel) return;

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x6952ea)
      .setTitle(`Welcome to The Underdogs, ${member.user.username}!`)
      .setDescription('We are a girls-focused CTF pack.\nPlease read and accept the rules to unlock the server.');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('accept_rules')
        .setLabel('Accept Rules')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('decline_rules')
        .setLabel('Decline')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `${member}`,
      embeds: [welcomeEmbed],
      components: [row]
    });
  }
};