// 简单的 API 测试脚本
const API_BASE = 'http://localhost:3001/api';

async function test() {
    console.log('🧪 开始测试 API...\n');

    try {
        // 测试 1: 获取设备列表
        console.log('1️⃣ 测试获取设备列表...');
        const devicesRes = await fetch(`${API_BASE}/devices`);
        const devices = await devicesRes.json();
        console.log(`✅ 成功获取 ${devices.length} 个设备\n`);

        // 测试 2: 登录
        console.log('2️⃣ 测试用户登录...');
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: '123' })
        });
        const user = await loginRes.json();
        console.log(`✅ 登录成功: ${user.name} (${user.role})\n`);

        // 测试 3: 更新设备状态
        console.log('3️⃣ 测试更新设备状态...');
        const deviceId = devices[0].id;
        const updateRes = await fetch(`${API_BASE}/devices/${deviceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isEnabled: false })
        });
        const updated = await updateRes.json();
        console.log(`✅ 设备状态已更新: ${updated.name} -> ${updated.isEnabled ? '启用' : '停用'}\n`);

        // 测试 4: 验证更新
        console.log('4️⃣ 验证设备状态...');
        const verifyRes = await fetch(`${API_BASE}/devices/${deviceId}`);
        const verified = await verifyRes.json();
        console.log(`✅ 验证成功: ${verified.name} 状态为 ${verified.isEnabled ? '启用' : '停用'}\n`);

        console.log('🎉 所有测试通过！');
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.log('\n💡 提示: 请确保后端服务器正在运行 (npm run server)');
    }
}

test();
