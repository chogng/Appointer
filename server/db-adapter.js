// 数据库适配器 - 抽象层，方便切换数据库
import { initDatabase, getDatabase, saveDatabase } from './database.js';

class DatabaseAdapter {
    constructor() {
        this.dbType = 'sqlite'; // 以后可以改成 'mysql'
    }

    async init() {
        if (this.dbType === 'sqlite') {
            await initDatabase();
        }
        // 以后添加 MySQL 初始化
        // else if (this.dbType === 'mysql') {
        //     await initMySQLDatabase();
        // }
    }

    // 查询多行
    query(sql, params = []) {
        if (this.dbType === 'sqlite') {
            const db = getDatabase();
            const stmt = db.prepare(sql);
            stmt.bind(params);
            
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        }
        // 以后添加 MySQL 实现
        // else if (this.dbType === 'mysql') {
        //     return await mysqlQuery(sql, params);
        // }
    }

    // 查询单行
    queryOne(sql, params = []) {
        const results = this.query(sql, params);
        return results.length > 0 ? results[0] : null;
    }

    // 执行更新/插入
    execute(sql, params = []) {
        if (this.dbType === 'sqlite') {
            const db = getDatabase();
            db.run(sql, params);
            saveDatabase();
        }
        // 以后添加 MySQL 实现
        // else if (this.dbType === 'mysql') {
        //     await mysqlExecute(sql, params);
        // }
    }

    // 获取最后插入的 ID
    getLastInsertId() {
        if (this.dbType === 'sqlite') {
            const result = this.queryOne('SELECT last_insert_rowid() as id');
            return result?.id;
        }
    }
}

export const db = new DatabaseAdapter();
