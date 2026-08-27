const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register for an open CTF event'),

  async execute(interaction) {
    const events = db.getOpenEvents();
    if (events.length === 0) {
      return interaction.reply({ content: 'No open CTFs right now.', ephemeral: true });
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('register_event')
      .setPlaceholder('Choose a CTF to register for')
      .addOptions(
        events.map(e => ({
          label: e.name,
          description: e.date || 'No date set',
          value: String(e.id)
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.reply({
      content: 'Select the CTF you want to join:',
      components: [row],
      ephemeral: true
    });
  }
};