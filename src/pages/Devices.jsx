import { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';
import { useLanguage } from '../context/useLanguage';
import DeviceCard from '../components/DeviceCard';
import AddDeviceCard from '../components/AddDeviceCard';

const Devices = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [createConfirm, setCreateConfirm] = useState(false);
    const navigate = useNavigate();
    const { isAdmin } = usePermission();
    const { t } = useLanguage();

    useEffect(() => {
        const handleClickOutside = () => {
            if (deleteConfirmId) {
                setDeleteConfirmId(null);
            }
            if (createConfirm) {
                setCreateConfirm(false);
            }
        };

        if (deleteConfirmId || createConfirm) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [deleteConfirmId, createConfirm]);

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
            setDevices(prevDevices =>
                prevDevices.some(d => d.id === newDevice.id) ? prevDevices : [...prevDevices, newDevice]
            );
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
            const updatedDevice = await apiService.updateDevice(deviceId, updates);
            setDevices(prevDevices =>
                prevDevices.map(d => (d.id === updatedDevice.id ? updatedDevice : d))
            );
        } catch (error) {
            console.error('Failed to update device:', error);
            alert(t('updateFailed'));
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
            alert(t('deleteFailed'));
        }
    };

    const handleCreateDevice = async () => {
        try {
            const newDevice = await apiService.createDevice({
                name: t('newDevice'),
                description: '',
                isEnabled: true,
                openDays: [1, 2, 3, 4, 5],
                timeSlots: [],
                granularity: 60,
                openTime: { start: '09:00', end: '18:00' },
            });
            setDevices(prevDevices =>
                prevDevices.some(d => d.id === newDevice.id) ? prevDevices : [...prevDevices, newDevice]
            );
            console.log('设备创建成功:', newDevice);
        } catch (error) {
            console.error('Failed to create device:', error);
            alert(t('createDeviceFailed'));
        }
    };

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    return (
        <div className="max-w-[1500px] mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">{t('deviceList')}</h1>
                <p className="text-text-secondary">{t('selectDeviceToBook')}</p>
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
                {isAdmin() && (
                    <AddDeviceCard
                        onClick={(e) => {
                            e.stopPropagation();
                            if (createConfirm) {
                                handleCreateDevice();
                                setCreateConfirm(false);
                            } else {
                                setCreateConfirm(true);
                            }
                        }}
                        isConfirming={createConfirm}
                    />
                )}
            </div>
        </div>
    );
};

export default Devices;
