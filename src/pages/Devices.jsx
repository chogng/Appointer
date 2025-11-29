import { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

import { Monitor } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';

const Devices = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { isAdmin } = usePermission();

    useEffect(() => {
        loadDevices();

        // 连接 WebSocket
        socketService.connect();

        // 监听设备更新事件（实时同步）
        const handleDeviceUpdated = (updatedDevice) => {
            console.log('📡 收到设备更新:', updatedDevice);
            setDevices(prevDevices =>
                prevDevices.map(d =>
                    d.id === updatedDevice.id ? updatedDevice : d
                )
            );
        };

        // 监听设备创建事件
        const handleDeviceCreated = (newDevice) => {
            console.log('📡 收到新设备:', newDevice);
            setDevices(prevDevices => [...prevDevices, newDevice]);
        };

        socketService.on('device:updated', handleDeviceUpdated);
        socketService.on('device:created', handleDeviceCreated);

        // 清理：组件卸载时取消订阅
        return () => {
            socketService.off('device:updated', handleDeviceUpdated);
            socketService.off('device:created', handleDeviceCreated);
        };
    }, []);

    const loadDevices = async () => {
        try {
            const data = await apiService.getDevices();
            setDevices(data);
        } catch (error) {
            console.error('Failed to load devices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleDevice = async (deviceId) => {
        const device = devices.find(d => d.id === deviceId);
        if (!device) return;

        const newStatus = !device.isEnabled;

        try {
            // 更新服务器（服务器会通过 WebSocket 广播给所有客户端）
            await apiService.updateDevice(deviceId, { isEnabled: newStatus });

            // 不需要手动更新本地状态，WebSocket 会自动同步
        } catch (error) {
            console.error('Failed to update device:', error);
            alert('更新失败，请重试');
        }
    };

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    return (
        <div className="max-w-[1200px] mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">Device List</h1>
                    <p className="text-text-secondary">选择设备进行预约</p>
                </div>
                {isAdmin() && (
                    <Button
                        onClick={() => navigate('/devices/create')}
                        className="relative shrink-0 overflow-hidden transition-transform will-change-transform ease-[cubic-bezier(0.165,0.85,0.45,1)] duration-150 hover:scale-y-[1.015] hover:scale-x-[1.005] active:scale-[0.985]"
                    >
                        Create
                    </Button>
                )}
            </div>
            {/* Device Card List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {devices.map(device => (
                    <Card key={device.id} className="flex flex-col gap-4 !shadow-xl hover:!shadow-2xl transition-all duration-300 border-0 hover:-translate-y-1">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-bg-subtle flex items-center justify-center shrink-0">
                                    <Monitor size={24} className="text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-1 text-text-primary">{device.name}</h3>
                                    <p className="text-[10px] text-text-secondary leading-relaxed">
                                        {device.description}
                                    </p>
                                </div>
                            </div>

                            {/* Only admin can see the switch*/}
                            {isAdmin() ? (
                                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                                    <span className="text-sm font-medium text-text-secondary">
                                        {device.isEnabled ? 'On' : 'Off'}
                                    </span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={device.isEnabled}
                                            onChange={() => handleToggleDevice(device.id)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                    </div>
                                </label>
                            ) : (
                                /* Status: avaliable/ unavailable for User */
                                <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-sm font-semibold shrink-0 ${device.isEnabled
                                    ? 'bg-green-500/10 text-green-600'
                                    : 'bg-red-500/10 text-red-600'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${device.isEnabled ? 'bg-green-600' : 'bg-red-600'}`}></span>
                                    {device.isEnabled ? 'Available' : 'Unavailable'}
                                </span>
                            )}
                        </div>

                        {/* Available Days */}
                        <div className="flex flex-wrap gap-2">
                            {['周一', '周二', '周三', '周四', '周五'].map((day) => (
                                <span key={day} className="text-xs font-medium text-text-secondary bg-bg-subtle px-2 py-1 rounded-md">
                                    {day}
                                </span>
                            ))}
                        </div>

                        <div className="mt-auto pt-4 border-t border-border-subtle">
                            <Button
                                fullWidth
                                disabled={!device.isEnabled}
                                onClick={() => navigate(`/devices/${device.id}`)}
                            >
                                立即预约
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default Devices;
