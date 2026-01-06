import "../config/load-env.js";

import { initDatabase, getDatabase, saveDatabase } from "./database.js";
import {
  initMySQLDatabase,
  mysqlExecute,
  mysqlQuery,
} from "./mysql-adapter.js";

class DatabaseAdapter {
  constructor() {
    const raw = process.env.DB_TYPE;
    const dbType = raw ? String(raw).trim().toLowerCase() : "mysql";

    if (dbType !== "mysql" && dbType !== "sqlite") {
      throw new Error(`Unsupported DB_TYPE: ${raw}`);
    }

    this.dbType = dbType;
  }

  get dialect() {
    return this.dbType;
  }

  async init() {
    if (this.dbType === "mysql") {
      await initMySQLDatabase();
      return;
    }

    await initDatabase();
  }

  async query(sql, params = []) {
    if (this.dbType === "mysql") {
      return mysqlQuery(sql, params);
    }

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

  async queryOne(sql, params = []) {
    const results = await this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql, params = []) {
    if (this.dbType === "mysql") {
      return mysqlExecute(sql, params);
    }

    const db = getDatabase();
    db.run(sql, params);
    saveDatabase();
    return null;
  }
}

export const db = new DatabaseAdapter();
