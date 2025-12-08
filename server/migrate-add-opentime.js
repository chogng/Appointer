import { db } from './db-adapter.js';

try {
    await db.init();
    
    // 检查字段是否已存在
    const columns = db.query('PRAGMA table_info(devices)');
    const hasOpenTime = columns.some(col => col.name === 'openTime');
    
    if (!hasOpenTime) {
        console.log('添加 openTime 字段到 devices 表...');
        // openTime 存储为 JSON 字符串，格式: {"start": "09:00", "end": "18:00"}
        db.execute("ALTER TABLE devices ADD COLUMN openTime TEXT DEFAULT '{\"start\":\"09:00\",\"end\":\"18:00\"}'");
        console.log('✅ openTime 字段添加成功！默认值为 09:00-18:00');
    } else {
        console.log('⚠️ openTime 字段已存在，跳过迁移');
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
