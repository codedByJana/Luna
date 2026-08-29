// Reset missed days counting to start from today (fixes 13-day retroactive penalty)
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
  await db.connectToDatabase();
  const users = await db.getAllUsers();
  const today = todayStr();
  const yesterday = yesterdayStr(today);

  console.log(`[reset] Today: ${today}, Yesterday: ${yesterday}`);
  console.log(`[reset] Found ${users.length} users`);
  console.log(`[reset] Dry run: ${dryRun ? 'YES (no changes will be saved)' : 'NO (changes WILL be saved)'}`);
  console.log('---');

  const restorePoints = process.env.RESTORE_POINTS === '1';
  let fixed = 0;
  for (const user of users) {
    // Reset all active users (those with a category) who have a wrong baseline
    // This covers: users with null lastTaskDate (new users before fix) and users penalized 13 days
    const shouldReset = user.category && (user.missedDays > 0 || !user.lastTaskDate || user.lastTaskDate < yesterday);

    if (shouldReset) {
      const restoredPoints = restorePoints ? Math.max(0, (user.points || 0) + (user.missedDays || 0) * 5) : (user.points || 0);
      console.log(`[reset] ${user.userId} | category=${user.category} | before: lastTaskDate=${user.lastTaskDate} missedDays=${user.missedDays} points=${user.points} consistentDays=${user.consistentDays}${restorePoints ? ` -> restorePoints=${restoredPoints}` : ''}`);
      if (!dryRun) {
        await db.saveUser({
          ...user,
          lastTaskDate: yesterday,
          missedDays: 0,
          consistentDays: 0,
          points: restoredPoints,
          // rank will be recalculated on next addPoints/removePoints; keep current or recalc:
          // rank: restoredPoints >= 30 ? 'wolf' : restoredPoints >= 15 ? 'underdog' : 'puppy',
        });
      }
      console.log(`[reset]  -> after: lastTaskDate=${yesterday} missedDays=0 consistentDays=0 points=${restorePoints ? restoredPoints : user.points || 0}`);
      fixed++;
    }
  }
      console.log(`[reset]  -> after: lastTaskDate=${yesterday} missedDays=0 consistentDays=0`);
      fixed++;
    }
  }

  console.log('---');
  console.log(`[reset] ${dryRun ? 'Would fix' : 'Fixed'} ${fixed} users`);
  if (dryRun) {
    console.log('[reset] Run without --dry-run to apply changes: node scripts/resetMissedFromToday.js');
  } else {
    console.log('[reset] Done. From now on, missed days will be counted from today correctly (no retroactive penalty).');
    console.log('[reset] Note: Points already deducted (-65) are kept. To restore them, re-run with RESTORE_POINTS=1: RESTORE_POINTS=1 node scripts/resetMissedFromToday.js');
  }
  process.exit(0);
}

main().catch(err => {
  console.error('[reset] Failed:', err);
  process.exit(1);
});
