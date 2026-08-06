async function createDailyTasks(userId, category, learningStyle) {
  const taskChannel = await client.channels.fetch(process.env.TASK_CHANNEL_ID);
  
  // Load tasks based on category and learning style
  const tasks = loadTasksForUser(category, learningStyle);
  
  const embed = new EmbedBuilder()
    .setTitle('Daily Tasks')
    .setDescription('Select your tasks for today:')
    .setColor('#00BCD4');

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('daily_task_select')
    .setPlaceholder('Choose your daily tasks (max 3)')
    .setMinValues(1)
    .setMaxValues(3)
    .addOptions(
      tasks.map(task => ({
        label: task.name,
        description: task.description.substring(0, 100),
        value: task.id
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);
  
  // Send to task channel
  const message = await taskChannel.send({
    content: `<@${userId}>`,
    embeds: [embed],
    components: [row]
  });
  
  // Store message ID for tracking
  await db.tasks.create({ userId, messageId: message.id, date: new Date() });
}