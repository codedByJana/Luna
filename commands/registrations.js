const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const { isAlpha } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('registrations')
    .setDescription('View or mark CTF registrations (Alpha only)')
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View registrations for a CTF event')
        .addStringOption(o => o.setName('event_id').setDescription('Event ID (omit to see a list)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('mark')
        .setDescription('Mark a user present or ghosted for an event')
        .addUserOption(o => o.setName('user').setDescription('User to mark').setRequired(true))
        .addStringOption(o => o.setName('event_id').setDescription('Event ID').setRequired(true))
        .addStringOption(o =>
          o.setName('status')
            .setDescription('Attendance status')
            .setRequired(true)
            .addChoices(
              { name: 'Present', value: 'present' },
              { name: 'Ghosted', value: 'ghosted' },
              { name: 'Registered', value: 'registered' },
            )
        )
    ),

  async execute(interaction) {
    if (!isAlpha(interaction.member)) {
      return interaction.reply({ content: 'Alpha role only.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const eventId = interaction.options.getString('event_id');
      if (!eventId) {
        const events = await db.getAllEvents();
        if (events.length === 0) {
          return interaction.reply({ content: 'No events yet. Use `/event create`.', flags: MessageFlags.Ephemeral });
        }
        const lines = events
          .map(e => `• \`${e._id}\` — **${e.name}** [${e.status}]`)
          .join('\n');
        return interaction.reply({
          content: `Provide an event_id. Available events:\n${lines}`.slice(0, 1900),
          flags: MessageFlags.Ephemeral,
        });
      }

      const event = await db.getEventById(eventId);
      if (!event) {
        return interaction.reply({ content: 'Event not found.', flags: MessageFlags.Ephemeral });
      }

      const regs = await db.getRegistrations(eventId);
      if (regs.length === 0) {
        return interaction.reply({
          content: `No registrations for **${event.name}**.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const counts = regs.reduce(
        (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
        {}
      );

      const lines = regs
        .map(r => `• <@${r.userId}> — **${r.status}**`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x6952ea)
        .setTitle(`Registrations – ${event.name}`)
        .setDescription(lines.slice(0, 1900))
        .addFields(
          { name: 'Total', value: `${regs.length}`, inline: true },
          { name: 'Registered', value: `${counts.registered || 0}`, inline: true },
          { name: 'Present', value: `${counts.present || 0}`, inline: true },
          { name: 'Ghosted', value: `${counts.ghosted || 0}`, inline: true },
        )
        .setFooter({ text: `Event ID: ${event._id}` });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'mark') {
      const user = interaction.options.getUser('user');
      const eventId = interaction.options.getString('event_id');
      const status = interaction.options.getString('status');

      const existing = await db.getUserRegistration(user.id, eventId);
      if (!existing) {
        await db.registerUser(user.id, eventId);
      }
      const updated = await db.markRegistration(user.id, eventId, status);
      if (!updated) {
        return interaction.reply({ content: 'Failed to update registration.', flags: MessageFlags.Ephemeral });
      }

      return interaction.reply({
        content: `✅ Marked <@${user.id}> as **${status}** for event \`${eventId}\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
