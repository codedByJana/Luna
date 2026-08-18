const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // Required for welcome + roles
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // TO-DO: investigate the need for this permission
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

client.commands = new Collection();

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// Load slash commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
  }
}
process.on('unhandledRejection', (reason, promise) => {
  console.error(' [ANTI-CRASH] Unhandled Rejection:', promise, 'Reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error(' [ANTI-CRASH] Uncaught Exception:', error);
});

process.on('uncaughtExceptionMonitor', (error, origin) => {
  console.error(' [ANTI-CRASH] Uncaught Exception Monitor:', error, origin);
});

client.login(config.token);