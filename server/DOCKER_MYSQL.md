# 本地 MySQL（Docker）快速启动

适用于：你本机的 MySQL 账号/密码不确定，或想用一个独立的 MySQL 实例来跑 `SQLite → MySQL` 迁移验证。

## 1) 准备环境变量

在 `server/` 目录下执行：

```bash
cp .env.docker.example .env
```

如需改端口（默认把容器的 3306 映射到主机 3307），编辑 `server/.env` 里的 `MYSQL_PORT` / `DB_PORT`。

## 2) 启动 MySQL 容器

先确保 Docker Desktop 已启动，然后：

```bash
cd server
docker compose up -d
```

可选：打开 Adminer（默认端口 8081）。

## 3) 初始化表结构（可选）

后端启动时会自动建表；你也可以手动初始化一次：

```bash
cd server
npm run init-db
```

## 4) 执行 SQLite → MySQL 导入

```bash
cd server

# 如果 MySQL 里已有数据，想清空后重导入，添加 --force
npm run migrate-sqlite-to-mysql -- --sqlite ./drms.db --force
```

## 5) 生产环境模拟（前后端同源）

在项目根目录构建前端到 `dist/`，再启动后端托管它：

```bash
# repo root
npm run prod
```

## 常见问题

- `docker compose up -d` 报 “cannot find the file specified / dockerDesktopLinuxEngine”：Docker Desktop 没启动或引擎不可用。
- 导入时提示 “MySQL database is not empty”：请加 `--force` 或换一个新库。
- 生产环境：建议 `DB_SEED_DATA=0`，避免示例数据自动播种。
