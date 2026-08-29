const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register for an open CTF event'),

  async execute(interaction) {
    const events = await db.getOpenEvents();
    if (!events || events.length === 0) {
      return interaction.reply({ content: 'No open CTFs right now.', flags: MessageFlags.Ephemeral });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('register_event')
      .setPlaceholder('Choose a CTF to register for')
      .addOptions(
        events.map(e => ({
          label: e.name.slice(0, 100),
          description: (e.date || 'No date set').slice(0, 100),
          value: String(e._id)
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Select the CTF you want to join:',
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  },
};
