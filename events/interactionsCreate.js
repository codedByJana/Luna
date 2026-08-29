const { Events, MessageFlags } = require('discord.js');
const quizHandler = require('../handlers/quizHandler');
const taskHandler = require('../handlers/taskHandler');
const db = require('../utils/database');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(error);
        const payload = { content: 'There was an error executing that command!', flags: MessageFlags.Ephemeral };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    if (interaction.customId === 'register_event' && interaction.isStringSelectMenu()) {
      const eventId = interaction.values[0];
      try {
        await db.registerUser(interaction.user.id, eventId);
        // interaction is a StringSelectMenu - deferUpdate not used, so use update if not already replied
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: '✅ You are registered for this CTF!', components: [] }).catch(() => {});
        } else {
          await interaction.update({ content: '✅ You are registered for this CTF!', components: [] });
        }
      } catch (err) {
        console.error('register_event failed:', err);
        const payload = { content: 'Could not register you. Try again later.', flags: MessageFlags.Ephemeral };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
      return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      if (interaction.customId === 'accept_rules') {
        const config = require('../config');
        try {
          await interaction.member.roles.add(config.verifiedRoleId);
          await interaction.reply({ content: 'Rules accepted! You now have access to the server.', flags: MessageFlags.Ephemeral });
        } catch (err) {
          console.error('accept_rules failed:', err);
          const payload = { content: 'Could not verify you. Contact a mod.', flags: MessageFlags.Ephemeral };
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload).catch(() => {});
          } else {
            await interaction.reply(payload).catch(() => {});
          }
        }
        return;
      }

      if (interaction.customId === 'decline_rules') {
        await interaction.reply({ content: 'You must accept the rules to stay in the server.', flags: MessageFlags.Ephemeral }).catch(() => {});
        return;
      }

      try {
        // Check task handler first (task_done_ buttons) to avoid overlapping with quiz handler
        if (taskHandler.handleInteraction) {
          const handled = await taskHandler.handleInteraction(interaction);
          if (handled) return;
        }
        if (quizHandler.handleInteraction) {
          const handled = await quizHandler.handleInteraction(interaction);
          if (handled) return;
        }
      } catch (error) {
        console.error('Interaction Handler Error:', error);
        const errorMessage = { content: 'There was an error processing this menu!', flags: MessageFlags.Ephemeral };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(errorMessage).catch(() => {});
        } else {
          await interaction.reply(errorMessage).catch(() => {});
        }
      }
    }
  },
};
