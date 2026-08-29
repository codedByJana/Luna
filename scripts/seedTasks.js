const db = require('../utils/database');
const { allTemplates } = require('../commands/tasks');

async function main() {
  await db.connectToDatabase();
  const count = await db.seedTaskTemplates(allTemplates);
  console.log(`[seed] Upserted ${count} task templates (${allTemplates.length} total).`);
  const total = await db.getAllTaskTemplates();
  console.log(`[seed] Active templates in DB: ${total.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
