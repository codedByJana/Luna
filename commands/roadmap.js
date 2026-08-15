const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roadmap')
    .setDescription('Start your personal roadmap quiz or browse roadmaps')
    .addSubcommand(sub => sub.setName('start').setDescription('Start the quiz'))
    .addSubcommand(sub => sub.setName('view').setDescription('Browse all roadmaps')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') {
      // Call quiz start logic
      const quizHandler = require('../handlers/quizHandler');
      await quizHandler.startQuiz(interaction);
    }
    if (sub === 'view') {
      // Call browse logic
      const quizHandler = require('../handlers/quizHandler');
      await quizHandler.browseRoadmaps(interaction);
    }
  }
};