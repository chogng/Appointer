import { db } from './db-adapter.js';

console.log('=== Checking Inventory Data ===\n');

// Initialize database
await db.init();

// Check users table
console.log('SUPER_ADMIN users:');
const admins = db.query("SELECT id, username, name, role FROM users WHERE role = 'SUPER_ADMIN'");
console.log(admins);

console.log('\n=== Inventory Items ===');
const inventory = db.query('SELECT * FROM inventory ORDER BY date DESC LIMIT 5');
console.log(inventory);

console.log('\n=== Inventory with JOIN (as returned by API) ===');
const inventoryWithJoin = db.query(`
    SELECT
        i.*,
        COALESCE(uById.name, uByUsername.name, i.requesterName, 'System') AS requesterDisplayName,
        uById.id as matchedUserId,
        uById.name as matchedUserName
    FROM inventory i
    LEFT JOIN users uById ON i.requesterId = uById.id
    LEFT JOIN users uByUsername ON i.requesterId IS NULL AND i.requesterName = uByUsername.username
    ORDER BY i.date DESC
    LIMIT 5
`);
console.log(JSON.stringify(inventoryWithJoin, null, 2));

process.exit(0);
