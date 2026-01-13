const config = require('./config');
const { Telegraf } = require('telegraf');

const bot = new Telegraf(config.telegramBotToken);

(async () => {
  try {
    const commands = await bot.telegram.getMyCommands();
    console.log('Current Commands on Telegram Server:');
    commands.forEach(cmd => {
        console.log(`/${cmd.command} - ${cmd.description}`);
    });
  } catch (e) {
    console.error(e);
  }
})();
