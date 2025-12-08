import { db } from './db-adapter.js';

try {
    await db.init();
    
    // 检查字段是否已存在
    const columns = db.query('PRAGMA table_info(devices)');
    const hasGranularity = columns.some(col => col.name === 'granularity');
    const hasMinGap = columns.some(col => col.name === 'minGap');
    
    if (hasMinGap && !hasGranularity) {
        console.log('重命名 minGap 字段为 granularity...');
        // SQLite 不支持直接重命名列，需要重建表
        db.execute(`
            CREATE TABLE devices_new (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                isEnabled INTEGER NOT NULL DEFAULT 1,
                openDays TEXT NOT NULL,
                timeSlots TEXT NOT NULL,
                granularity INTEGER DEFAULT 60
            )
        `);
        db.execute(`
            INSERT INTO devices_new (id, name, description, isEnabled, openDays, timeSlots, granularity)
            SELECT id, name, description, isEnabled, openDays, timeSlots, minGap FROM devices
        `);
        db.execute('DROP TABLE devices');
        db.execute('ALTER TABLE devices_new RENAME TO devices');
        console.log('✅ 字段已重命名为 granularity');
    } else if (!hasGranularity && !hasMinGap) {
        console.log('添加 granularity 字段到 devices 表...');
        db.execute('ALTER TABLE devices ADD COLUMN granularity INTEGER DEFAULT 60');
        console.log('✅ granularity 字段添加成功！默认值为 60 分钟');
    } else {
        console.log('⚠️ granularity 字段已存在，跳过迁移');
    }
    
    // 显示更新后的表结构
    const updatedColumns = db.query('PRAGMA table_info(devices)');
    console.log('\n当前 devices 表结构:');
    updatedColumns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
    });
    
} catch (error) {
    console.error('❌ 迁移失败:', error.message);
}
