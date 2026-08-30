const db = require('../utils/database');

const alias = {
  'web': 'web',
  'Web': 'web',
  'WEB': 'web',
  'cryptography': 'cryptography',
  'Cryptography': 'cryptography',
  'crypto': 'cryptography',
  'Crypto': 'cryptography',
  'forensics': 'forensics',
  'Forensics': 'forensics',
  'reverse': 'reverse',
  'Reverse': 'reverse',
  'binary': 'binary_exploitation',
  'Binary': 'binary_exploitation',
  'binary_exploitation': 'binary_exploitation',
  'Binary_exploitation': 'binary_exploitation',
  'Pwn': 'binary_exploitation',
  'pwn': 'binary_exploitation',
  'osint': 'osint_misc',
  'osint_misc': 'osint_misc',
  'Osint_misc': 'osint_misc',
  'OSINT': 'osint_misc',
};

async function main() {
  await db.connectToDatabase();
  const users = await db.getAllUsers();
  console.log(`Found ${users.length} users`);
  let fixed = 0;
  for (const u of users) {
    if (!u.category) continue;
    const lower = String(u.category).trim().toLowerCase();
    const normalized = alias[u.category] || alias[lower] || lower;
    // Also handle direct lower
    const expected = alias[u.category] || alias[lower] || u.category;
    // Use alias map for Pwn etc, otherwise lower
    let target = normalized;
    // Ensure target is one of canonical lower values
    const canonical = ['web','cryptography','reverse','binary_exploitation','forensics','osint_misc'];
    if (!canonical.includes(target)) {
      // try alias
      target = alias[u.category] || alias[lower] || lower;
    }
    if (target !== u.category) {
      console.log(` - ${u.userId}: '${u.category}' -> '${target}'`);
      await db.saveUser({ ...u, category: target });
      fixed++;
    }
  }
  console.log(`Migrated ${fixed} users to unified lower categories`);
  process.exit(0);
}
main().catch(e=>{console.error(e); process.exit(1)});
