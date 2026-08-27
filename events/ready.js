const { Events, REST, Routes } = require('discord.js');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const db = require('../utils/database');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Logged in as ${client.user.tag}`);

    try {
      await db.connectToDatabase();
      console.log('MongoDB connected.');
    } catch (err) {
      console.error('MongoDB connection failed:', err);
    }

    const commands = [];
    const commandsPath = path.join(__dirname, '../commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

    for (const file of commandFiles) {
      const command = require(`../commands/${file}`);
      if (!command?.data) continue;
      commands.push(command.data.toJSON());
    }

    const rest = new REST().setToken(config.token);

    try {
      console.log(`Refreshing ${commands.length} slash command(s)...`);
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands }
      );
      console.log('Slash commands registered successfully.');
    } catch (error) {
      console.error(error);
    }
  }
};

