import Database from 'better-sqlite3';

const db = new Database('drms.db');

console.log('🔄 Migrating database: Adding title, description, and color to reservations...');

try {
    const columns = [
        { name: 'title', type: 'TEXT' },
        { name: 'description', type: 'TEXT' },
        { name: 'color', type: 'TEXT' }
    ];

    for (const col of columns) {
        try {
            db.prepare(`ALTER TABLE reservations ADD COLUMN ${col.name} ${col.type}`).run();
            console.log(`✅ Added column: ${col.name}`);
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log(`ℹ️ Column ${col.name} already exists.`);
            } else {
                console.error(`❌ Failed to add column ${col.name}:`, error.message);
            }
        }
    }

    console.log('✅ Migration completed successfully.');
} catch (error) {
    console.error('❌ Migration failed:', error);
} finally {
    db.close();
}
