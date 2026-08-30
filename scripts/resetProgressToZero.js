// Reset task progress to day one (progress 0) for all users
// Sets taskEpoch to today so pickDaily starts at index 0, and resets user streaks
const db = require('../utils/database');

function todayStr(date = new Date()) {
  return date.toISOString().split('T')[0];
}
function yesterdayStr(today = todayStr()) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const resetPoints = process.env.RESET_POINTS === '1';
  await db.connectToDatabase();
  const today = todayStr();
  const yesterday = yesterdayStr(today);

  console.log(`[resetProgress] Today: ${today}, Yesterday: ${yesterday}`);
  console.log(`[resetProgress] Dry run: ${dryRun ? 'YES' : 'NO'}`);
  console.log(`[resetProgress] Reset points: ${resetPoints ? 'YES' : 'NO (use RESET_POINTS=1 to reset points to 0)'}`);

  // 1. Set taskEpoch to today so pickDaily starts at 0
  const currentEpoch = await db.getTaskEpoch();
  console.log(`[resetProgress] Current taskEpoch: ${currentEpoch || 'not set (using Unix epoch)'}`);
  console.log(`[resetProgress] New taskEpoch will be: ${today} (day 0)`);
  if (!dryRun) {
    await db.setTaskEpoch(today);
    console.log(`[resetProgress] taskEpoch set to ${today}`);
  } else {
    console.log(`[resetProgress] [dry-run] Would set taskEpoch to ${today}`);
  }

  // 2. Reset user progress for active users
  const users = await db.getAllActiveUsers();
  console.log(`[resetProgress] Found ${users.length} active users`);

  let resetCount = 0;
  for (const user of users) {
    console.log(`[resetProgress] ${user.userId} | ${user.category}/${user.learnerType} | before: lastTaskDate=${user.lastTaskDate} consistentDays=${user.consistentDays} missedDays=${user.missedDays} points=${user.points}`);
    if (!dryRun) {
      const update = {
        ...user,
        lastTaskDate: yesterday,
        missedDays: 0,
        consistentDays: 0,
      };
      if (resetPoints) {
        update.points = 0;
        update.rank = 'puppy';
      }
      await db.saveUser(update);
    }
    console.log(`[resetProgress]  -> after: lastTaskDate=${yesterday} missedDays=0 consistentDays=0${resetPoints ? ' points=0 rank=puppy' : ''}`);
    resetCount++;
  }

  // 3. Verify pickDaily will now start at 0
  const taskHandler = require('../handlers/taskHandler');
  const sampleUser = users[0];
  if (sampleUser) {
    const tasks = await taskHandler.getTasksForUser(sampleUser);
    console.log(`[resetProgress] Sample tasks for ${sampleUser.userId} after reset (should be day 1): ${tasks.length} tasks`);
    if (tasks.length > 0) console.log(`[resetProgress] First task sample: ${tasks[0].slice(0, 100)}...`);
  }

  console.log('---');
  console.log(`[resetProgress] ${dryRun ? 'Would reset' : 'Reset'} ${resetCount} users + taskEpoch to ${today}`);
  if (dryRun) {
    console.log('[resetProgress] Run without --dry-run to apply: node scripts/resetProgressToZero.js');
    console.log('[resetProgress] To also reset points: RESET_POINTS=1 node scripts/resetProgressToZero.js');
  } else {
    console.log('[resetProgress] Done. Next daily tasks will be day 1 (progress 0).');
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
