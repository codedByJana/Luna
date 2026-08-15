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


      await quizHandler.handleInteraction(interaction);
      if (typeof taskHandler.handleInteraction === 'function') {
        await taskHandler.handleInteraction(interaction);
      }
    }
  }
};