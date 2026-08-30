// Debug script to simulate postDailyTasks without waiting for cron
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('../config');
const db = require('../utils/database');
const taskHandler = require('../handlers/taskHandler');

async function main() {
  console.log('=== DEBUG postDailyTasks ===');
  console.log(`TasksChannelId: ${config.tasksChannelId}`);
  console.log(`GuildId: ${config.guildId}`);
  await db.connectToDatabase();
  console.log('MongoDB connected');

  const templates = await db.getAllTaskTemplates();
  console.log(`TaskTemplates in DB: ${templates.length}`);
  if (templates.length === 0) {
    console.error('No TaskTemplates! Run: node scripts/seedTasks.js');
  } else {
    const byCat = {};
    templates.forEach(t => {
      const key = `${t.category}:${t.learnerType}`;
      byCat[key] = (byCat[key]||0)+1;
    });
    console.log('Templates by category:learnerType:', byCat);
  }

  const users = await db.getAllActiveUsers();
  console.log(`Active users (category != null): ${users.length}`);
  users.forEach(u => console.log(` - ${u.userId} category=${u.category} learnerType=${u.learnerType} lastTaskDate=${u.lastTaskDate} points=${u.points}`));
  if (users.length === 0) {
    console.warn('No active users! Users must complete /roadmap start to set category.');
  }

  for (const user of users.slice(0,3)) {
    const tasks = await taskHandler.getTasksForUser(user);
    console.log(`getTasksForUser ${user.userId} (${user.category}/${user.learnerType}) => ${tasks.length} tasks`);
    if (tasks.length===0) console.warn(`  -> No tasks! Check category case (web vs Web) and run seedTasks.js`);
    else console.log(`  Sample: ${tasks[0].slice(0,80)}...`);
  }

  // Try to login and actually send if --send flag
  if (process.argv.includes('--send')) {
    console.log('Attempting to login and send tasks (--send flag)...');
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions],
      partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.Reaction, Partials.User]
    });
    await client.login(config.token);
    console.log(`Logged in as ${client.user.tag}, waiting for ready...`);
    await new Promise(res => client.once('ready', res));
    console.log('Client ready, calling postDailyTasks...');
    await taskHandler.postDailyTasks(client);
    console.log('Done');
    await client.destroy();
  } else {
    console.log('Run with --send to actually send tasks: node scripts/debugPostTasks.js --send');
  }
  process.exit(0);
}
main().catch(e=>{console.error(e); process.exit(1)});
