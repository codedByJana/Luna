require('dotenv').config();

module.exports = {
    token: process.env.TOKEN,
    clientId: process.env.CLIENT_ID,
    guildId: process.env.GUILD_ID, // Your server ID

    // Channel IDs
    welcomeChannelId: '1532502240450056485',
    roadmapsChannelId: '1532502921986572299',
    tasksChannelId: '1534705244838170805',
    generalChannelId: '1532502240450056489',

    // Role IDs
    verifiedRoleId: '1096511622576607283',
    categoryRoles: {
        web: '1534723540291424356',
        crypto: '1534723585615335551',
        forensics: '1534723782533447690',
        re: '1534723660051644526',
        pwn: '1534723716867559584',
        osintANDmisc: '1534723840209453096',
        // mobile: 'MOBILE_ROLE_ID',
        // networking: 'NETWORKING_ROLE_ID'
    },
    rankRoles: {
        puppy: '1534720184793956382',
        underdog: '1534720736701317150',
        wolf: '1534721067069997056',
        alpha: '1534721969004609587'
    }
};