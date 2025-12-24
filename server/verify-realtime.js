import { io } from 'socket.io-client';
import http from 'http';

const verify = async () => {
    console.log('📡 Verifying realtime features...');
    console.log('Please ensure the server is running on http://localhost:3001');

    return new Promise((resolve) => {
        const socket = io('http://localhost:3001', {
            transports: ['websocket', 'polling']
        });

        let deviceCreatedReceived = false;

        socket.on('connect', () => {
            console.log('✅ WebSocket Connected');

            // Trigger an event via REST API
            const postData = JSON.stringify({
                name: 'Test Device ' + Date.now(),
                description: 'Automated test device',
                isEnabled: true,
                granularity: 60
            });

            const options = {
                hostname: 'localhost',
                port: 3001,
                path: '/api/devices',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length
                }
            };

            const req = http.request(options, (res) => {
                console.log(`REST Request Status: ${res.statusCode}`);
                if (res.statusCode !== 201) {
                    console.error('❌ Failed to create device via REST API');
                    process.exit(1);
                }
            });

            req.on('error', (e) => {
                console.error(`❌ Request error: ${e.message}`);
                process.exit(1);
            });

            req.write(postData);
            req.end();
        });

        socket.on('device:created', (data) => {
            console.log('✅ Received device:created event:', data.name);
            deviceCreatedReceived = true;
            socket.disconnect();
            console.log('✅ Realtime verification passed!');
            process.exit(0);
        });

        // Timeout
        setTimeout(() => {
            if (!deviceCreatedReceived) {
                console.error('❌ Timeout: Did not receive realtime event within 5 seconds.');
                process.exit(1);
            }
        }, 5000);
    });
};

verify();
