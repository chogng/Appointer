import { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import Button from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';
import DeviceCard from '../components/DeviceCard';

const Devices = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const navigate = useNavigate();
    const { isAdmin } = usePermission();

    useEffect(() => {
        const handleClickOutside = () => {
            if (deleteConfirmId) {
                setDeleteConfirmId(null);
            }
        };

        if (deleteConfirmId) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [deleteConfirmId]);

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

        // 监听设备删除事件
        const handleDeviceDeleted = (data) => {
            console.log('📡 收到设备删除:', data);
            setDevices(prevDevices => prevDevices.filter(d => d.id !== data.id));
        };

        socketService.on('device:updated', handleDeviceUpdated);
        socketService.on('device:created', handleDeviceCreated);
        socketService.on('device:deleted', handleDeviceDeleted);

        // 清理：组件卸载时取消订阅
        return () => {
            socketService.off('device:updated', handleDeviceUpdated);
            socketService.off('device:created', handleDeviceCreated);
            socketService.off('device:deleted', handleDeviceDeleted);
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
        await handleUpdateDevice(deviceId, { isEnabled: newStatus });
    };

    const handleUpdateDevice = async (deviceId, updates) => {
        try {
            await apiService.updateDevice(deviceId, updates);
        } catch (error) {
            console.error('Failed to update device:', error);
            alert('更新失败，请重试');
        }
    };

    const handleDeleteClick = (deviceId, e) => {
        e.stopPropagation();
        if (deleteConfirmId === deviceId) {
            handleDeleteDevice(deviceId);
        } else {
            setDeleteConfirmId(deviceId);
        }
    };

    const handleDeleteDevice = async (deviceId) => {
        try {
            await apiService.deleteDevice(deviceId);
            setDevices(prev => prev.filter(d => d.id !== deviceId));
            setDeleteConfirmId(null);
        } catch (error) {
            console.error('Failed to delete device:', error);
            alert('删除失败，请重试');
        }
    };

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    return (
        <div className="max-w-[1500px] mx-auto">
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
                    <DeviceCard
                        key={device.id}
                        device={device}
                        isAdmin={isAdmin()}
                        onToggle={handleToggleDevice}
                        onUpdate={handleUpdateDevice}
                        onBook={() => navigate(`/devices/${device.id}`)}
                        deleteConfirmId={deleteConfirmId}
                        onDeleteClick={handleDeleteClick}
                    />
                ))}
            </div>
        </div>
    );
};

export default Devices;
