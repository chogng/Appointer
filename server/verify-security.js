import { db } from './db-adapter.js';

const verify = async () => {
    await db.init();
    console.log('🛡️ Verifying security...');

    const users = db.query('SELECT * FROM users');
    const sensitivePasswords = ['123', 'password', 'admin', '123456'];
    let issues = 0;

    for (const user of users) {
        if (!user.password.startsWith('$2b$')) {
            console.error(`❌ Security Issue: User ${user.username} has a plain text password!`);
            issues++;
        } else {
            // Double check it's not just a hash of a known bad password (optional, but good for demo)
            // In a real audit we wouldn't check this here, but just format.
        }
    }

    if (issues === 0) {
        console.log('✅ All passwords appear to be hashed.');
        process.exit(0);
    } else {
        console.error(`🚨 Found ${issues} security issues!`);
        process.exit(1);
    }
};

verify().catch(console.error);
