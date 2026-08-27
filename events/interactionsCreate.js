const { Events } = require('discord.js');
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
        const payload = { content: 'There was an error executing that command!', ephemeral: true };
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
        await interaction.update({ content: '✅ You are registered for this CTF!', components: [] });
      } catch (err) {
        console.error('register_event failed:', err);
        const payload = { content: 'Could not register you. Try again later.', ephemeral: true };
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
          await interaction.reply({ content: 'Rules accepted! You now have access to the server.', ephemeral: true });
        } catch (err) {
          console.error('accept_rules failed:', err);
          await interaction.reply({ content: 'Could not verify you. Contact a mod.', ephemeral: true }).catch(() => {});
        }
        return;
      }

      if (interaction.customId === 'decline_rules') {
        await interaction.reply({ content: 'You must accept the rules to stay in the server.', ephemeral: true }).catch(() => {});
        return;
      }

      try {
        if (quizHandler.handleInteraction) {
          await quizHandler.handleInteraction(interaction);
        }
        if (taskHandler.handleInteraction) {
          const handled = await taskHandler.handleInteraction(interaction);
          if (handled) return;
        }
        if (typeof quizHandler.handleRoadmapNavigation === 'function') {
          const handled = await quizHandler.handleRoadmapNavigation(interaction);
          if (handled) return;
        }
      } catch (error) {
        console.error('Interaction Handler Error:', error);
        const errorMessage = { content: 'There was an error processing this menu!', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(errorMessage).catch(() => {});
        } else {
          await interaction.reply(errorMessage).catch(() => {});
        }
      }
    }
  },
};
