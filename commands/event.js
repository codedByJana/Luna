const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const { isAlpha } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Manage CTF events (Alpha only)')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a new CTF event')
        .addStringOption(o => o.setName('name').setDescription('Event name').setRequired(true))
        .addStringOption(o => o.setName('date').setDescription('Event date (e.g. 2026-09-12 or free text)').setRequired(false))
        .addStringOption(o => o.setName('close').setDescription('Create as closed (true/false)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close an open CTF event')
        .addStringOption(o => o.setName('event_id').setDescription('Event ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all CTF events')
    ),

  async execute(interaction) {
    if (!isAlpha(interaction.member)) {
      return interaction.reply({ content: 'Alpha role only.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const name = interaction.options.getString('name');
      const date = interaction.options.getString('date') || null;
      const closeFlag = (interaction.options.getString('close') || '').toLowerCase();
      const status = ['1', 'true', 'yes', 'y'].includes(closeFlag) ? 'closed' : 'open';

      const event = await db.saveEvent({
        name,
        date,
        status,
        createdBy: interaction.user.id,
      });

      return interaction.reply({
        content:
          `✅ Event **${event.name}** created (${event.status}).\n` +
          `ID: \`${event._id}\`` +
          (event.date ? ` | Date: ${event.date}` : ''),
        ephemeral: true,
      });
    }

    if (sub === 'close') {
      const eventId = interaction.options.getString('event_id');
      const event = await db.closeEvent(eventId);
      if (!event) {
        return interaction.reply({ content: 'Event not found.', ephemeral: true });
      }
      return interaction.reply({ content: `🔒 Closed **${event.name}**.`, ephemeral: true });
    }

    if (sub === 'list') {
      const events = await db.getAllEvents();
      if (events.length === 0) {
        return interaction.reply({ content: 'No events yet.', ephemeral: true });
      }
      const lines = events
        .map(e => `• \`${e._id}\` — **${e.name}** [${e.status}]${e.date ? ` (${e.date})` : ''}`)
        .join('\n');
      return interaction.reply({ content: lines.slice(0, 1900), ephemeral: true });
    }
  },
};
