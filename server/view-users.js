import { db } from './db-adapter.js';

async function viewUsers() {
    try {
        // Initialize database first
        await db.init();

        const users = await db.query('SELECT id, username, role, status, name, email, expiryDate FROM users');
        console.log('\n=== Database Users ===\n');
        console.table(users);
        console.log(`\nTotal users: ${users.length}`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

viewUsers();
