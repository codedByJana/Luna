const { Events } = require('discord.js');
const quizHandler = require('../handlers/quizHandler');
const taskHandler = require('../handlers/taskHandler');


module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error!', ephemeral: true });
      }
    }
    if (interaction.customId === 'register_event') {
      const eventId = interaction.values[0];
      db.registerUser(interaction.user.id, eventId);
      await interaction.update({ content: 'You are registered!!', components: [] });
    }
    // Buttons & Select Menus
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      // Rules acceptance
      if (interaction.customId === 'accept_rules') {
        const config = require('../config');
        await interaction.member.roles.add(config.verifiedRoleId);
        await interaction.reply({ content: 'Rules accepted! You now have access to the server.', ephemeral: true });
        return;
      }

      if (interaction.customId === 'decline_rules') {
        await interaction.reply({ content: 'You must accept the rules to stay in the server.', ephemeral: true });
        return;
      }

      try {
        if (quizHandler.handleInteraction) {
          await quizHandler.handleInteraction(interaction);
        }
        if (taskHandler.handleInteraction) {
          await taskHandler.handleInteraction(interaction);
        }
      } catch (error) {
        console.error('Interaction Handler Error:', error);
        const handled = await handleRoadmapNavigation(interaction);
        if (handled) return;
        // Attempt to notify the user without crashing
        const errorMessage = { content: 'There was an error processing this menu!', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(errorMessage).catch(e => console.error(e));
        } else {
          await interaction.reply(errorMessage).catch(e => console.error(e));
        }
      }
    }
  }
};