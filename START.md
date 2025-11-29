# 🚀 快速启动指南

## 一键启动（3 步）

### 1️⃣ 安装依赖

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install
cd ..
```

### 2️⃣ 启动后端

**打开终端 1**：
```bash
cd server
node server.js
```

看到这个表示成功：
```
✅ 数据库已加载
🚀 服务器运行在 http://localhost:3001
🔌 WebSocket 已启用
```

### 3️⃣ 启动前端

**打开终端 2**：
```bash
npm run dev
```

访问：http://localhost:5173

## 🎮 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | 123 | 超级管理员 |
| manager | 123 | 管理员 |
| user | 123 | 普通用户 |

## ✨ 核心功能

### 管理员（admin/manager）
- ✅ 创建/编辑设备
- ✅ 启用/停用设备（实时同步）
- ✅ 查看所有预约
- ✅ 用户管理（仅 admin）

### 普通用户（user）
- ✅ 查看设备列表
- ✅ 预约设备
- ✅ 查看自己的预约
- ✅ 实时看到其他人的预约

## 🧪 测试实时同步

1. **打开两个浏览器窗口**
2. **窗口 A**：用 `admin` 登录
3. **窗口 B**：用 `user` 登录
4. **在窗口 A** 切换设备状态
5. **在窗口 B** 无需刷新，自动看到变化 ⚡

详细测试步骤：[TEST_REALTIME.md](./TEST_REALTIME.md)

## 📚 更多文档

- [完整部署指南](./SETUP.md)
- [技术架构](./ARCHITECTURE.md)
- [MySQL 迁移](./server/MYSQL_MIGRATION.md)
- [API 文档](./server/README.md)

## ❓ 常见问题

### Q: 后端启动失败？
```bash
# 删除旧数据库，重新初始化
cd server
rm drms.db
node server.js
```

### Q: 前端连接不上后端？
检查：
1. 后端是否运行在 3001 端口
2. 浏览器控制台是否有 CORS 错误
3. 防火墙是否阻止连接

### Q: WebSocket 不工作？
打开浏览器控制台（F12），查看：
- Network → WS 标签，是否有 WebSocket 连接
- Console，是否显示 "✅ WebSocket 已连接"

## 🎉 开始使用

现在你可以：
1. 体验实时同步功能
2. 创建设备和预约
3. 测试多用户协作
4. 部署到生产环境

祝你使用愉快！🚀
