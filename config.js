require('dotenv').config();

module.exports = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID, 

    // Channel IDs
    welcomeChannelId: '1532502240450056485',
    roadmapsChannelId: '1532502921986572299',
    tasksChannelId: '1534705244838170805',
    generalChannelId: '1532502240450056489',

    // Role IDs - variables capitalized first letter, values are role IDs (unified) - 6 categories persistent
    categoryRoles: {
        Web: '1534723540291424356',
        Cryptography: '1534723585615335551',
        Reverse: '1534723660051644526',
        Binary_exploitation: '1534723716867559584',
        Forensics: '1534723782533447690',
        Osint_misc: '1534723840209453096',
    },
    rankRoles: {
        puppy: '1534720184793956382',
        underdog: '1534720736701317150',
        wolf: '1534721067069997056',
        alpha: '1534721969004609587'
    }
};