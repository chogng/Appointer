import React, { useEffect, useState } from 'react';
import { apiService } from '../services/apiService';
import { useAuth } from '../context/useAuth';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Dropdown from '../components/ui/Dropdown';
import { Calendar, Clock, LayoutGrid, List } from 'lucide-react';

const MyReservations = () => {
    const { user } = useAuth();
    const [reservations, setReservations] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterDeviceId, setFilterDeviceId] = useState('all');
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'

    useEffect(() => {
        if (!user?.id) return;
        loadData();
    }, [user?.id]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [allRes, allDevices] = await Promise.all([
                apiService.getReservations(),
                apiService.getDevices()
            ]);
            const myRes = allRes.filter(r => r.userId === user.id && r.status !== 'CANCELLED');
            setReservations(myRes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            setDevices(allDevices);
        } catch (error) {
            console.error('Failed to load reservations:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDeviceName = (id) => devices.find(d => d.id === id)?.name || '未知设备';

    const handleCancel = async (id) => {
        if (!confirm('您确定要取消此预约吗？')) return;

        try {
            await apiService.updateReservation(id, { status: 'CANCELLED' });
            await loadData();
        } catch (error) {
            console.error('Failed to cancel reservation:', error);
            alert('取消失败，请重试');
        }
    };

    const filteredReservations = filterDeviceId === 'all'
        ? reservations
        : reservations.filter(res => res.deviceId === filterDeviceId);

    const filterOptions = [
        { label: '全部设备', value: 'all' },
        ...devices.map(d => ({ label: d.name, value: d.id }))
    ];

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    return (
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <h1 className="text-3xl font-serif font-medium text-text-primary">我的预约</h1>

                <div className="flex items-center gap-3">
                    {/* Device Filter */}
                    <div className="w-[180px]">
                        <Dropdown
                            options={filterOptions}
                            value={filterDeviceId}
                            onChange={setFilterDeviceId}
                            placeholder="筛选设备"
                        />
                    </div>

                    {/* View Switcher */}
                    <div className="flex bg-white/40 backdrop-blur-sm border border-border-subtle rounded-xl p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'list'
                                ? 'bg-[#7FB77E] text-white shadow-md shadow-green-100'
                                : 'text-text-secondary hover:bg-white/60'}`}
                            title="列表视图"
                        >
                            <List size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'grid'
                                ? 'bg-[#7FB77E] text-white shadow-md shadow-green-100'
                                : 'text-text-secondary hover:bg-white/60'}`}
                            title="网格视图"
                        >
                            <LayoutGrid size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {filteredReservations.length === 0 ? (
                <Card variant="glass" className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                        <Calendar size={32} className="text-indigo-400 opacity-50" />
                    </div>
                    <p className="text-text-secondary">
                        {filterDeviceId === 'all' ? '您当前没有有效的预约。' : '该设备下没有预约记录。'}
                    </p>
                </Card>
            ) : (
                <div className={viewMode === 'list'
                    ? "flex flex-col gap-4"
                    : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                }>
                    {filteredReservations.map(res => (
                        <Card
                            key={res.id}
                            variant="glass"
                            className={`hover-lift group ${viewMode === 'list' ? 'flex justify-between items-center' : 'flex flex-col gap-6'}`}
                        >
                            <div className="flex gap-4 sm:gap-6 items-center">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#FAFDF7] dark:bg-green-900/20 flex items-center justify-center shrink-0 border border-green-100/50 group-hover:scale-110 transition-transform duration-300">
                                    <Calendar size={24} className="text-[#7FB77E] dark:text-green-400" />
                                </div>

                                <div className="min-w-0">
                                    <h3 className="text-[1rem] sm:text-lg font-semibold mb-1 text-text-primary truncate">
                                        {getDeviceName(res.deviceId)}
                                    </h3>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
                                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                                            <Calendar size={14} className="opacity-70" /> {res.date}
                                        </span>
                                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                                            <Clock size={14} className="opacity-70" /> {res.timeSlot}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleCancel(res.id)}
                                className={`transition-all duration-300 ${viewMode === 'list' ? '' : 'w-full'} bg-white/40 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border-border-subtle backdrop-blur-sm`}
                            >
                                取消
                            </Button>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyReservations;
