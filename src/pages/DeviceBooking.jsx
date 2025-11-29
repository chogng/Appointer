import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { useReservationSync } from '../hooks/useRealtimeSync';
import { useAuth } from '../context/AuthContext';
import CalendarView from '../components/CalendarView';
import Button from '../components/ui/Button';

import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, subWeeks } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const DeviceBooking = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [device, setDevice] = useState(null);
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        loadDevice();
        loadReservations();
    }, [id]);

    const loadDevice = async () => {
        try {
            const data = await apiService.getDevice(id);
            setDevice(data);
        } catch (error) {
            console.error('Failed to load device:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadReservations = async () => {
        try {
            const allRes = await apiService.getReservations();
            const deviceRes = allRes.filter(r => r.deviceId === id);
            setReservations(deviceRes);
        } catch (error) {
            console.error('Failed to load reservations:', error);
        }
    };

    // 实时同步：当有人预约时，自动更新
    const handleReservationCreated = useCallback((newReservation) => {
        if (newReservation.deviceId === id) {
            console.log('📡 收到新预约（实时）:', newReservation);
            setReservations(prev => [...prev, newReservation]);
        }
    }, [id]);

    const handleReservationUpdated = useCallback((updatedReservation) => {
        if (updatedReservation.deviceId === id) {
            console.log('📡 预约已更新（实时）:', updatedReservation);
            setReservations(prev =>
                prev.map(r => r.id === updatedReservation.id ? updatedReservation : r)
            );
        }
    }, [id]);

    const handleReservationDeleted = useCallback((data) => {
        console.log('📡 预约已删除（实时）:', data);
        setReservations(prev => prev.filter(r => r.id !== data.id));
    }, []);

    // 启用实时同步
    useReservationSync(
        handleReservationCreated,
        handleReservationUpdated,
        handleReservationDeleted
    );

    const handlePrev = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNext = () => setCurrentDate(addWeeks(currentDate, 1));
    const handleToday = () => setCurrentDate(new Date());

    const handleBook = async (date, slot, extraData = {}) => {
        try {
            await apiService.createReservation({
                deviceId: device.id,
                userId: user.id,
                date: format(date, 'yyyy-MM-dd'),
                timeSlot: slot,
                ...extraData
            });
            alert('预约已确认!');
            // 不需要手动刷新，WebSocket 会自动同步
        } catch (error) {
            alert(error.message);
        }
    };

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    if (!device) return <div>Device not found</div>;

    return (
        <div className="h-full flex flex-col">
            <div className="mb-2 -mt-[8px] grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                {/* Left buttons */}
                <div className="flex items-center gap-4 justify-self-start">
                    <Button
                        variant="text"
                        onClick={() => navigate('/devices')}
                        className="pl-0 hover:bg-transparent text-text-secondary hover:text-text-primary"
                    >
                        <ArrowLeft size={28} className="mr-2" />
                        Back
                    </Button>

                    <Button variant="secondary" onClick={handleToday} className="px-4 py-1.5 text-sm border border-border rounded-md">
                        Today
                    </Button>
                    {/* Calendar switch */}
                    <div className="flex items-center gap-1">
                        <button onClick={handlePrev} className="p-1.5 hover:bg-bg-100 rounded-full">
                            <ChevronLeft size={20} className="text-text-secondary" />
                        </button>
                        <button onClick={handleNext} className="p-1.5 hover:bg-bg-100 rounded-full">
                            <ChevronRight size={20} className="text-text-secondary" />
                        </button>
                    </div>
                    {/* Calendar Date */}
                    <h2 className="text-xl font-normal text-text-primary ml-2 min-w-[120px] text-center">
                        {format(currentDate, 'yyyy年M月', { locale: zhCN })}
                    </h2>
                </div>

                {/*Device Name - Centered */}
                <h1 className="text-2xl font-serif font-medium text-text-primary justify-self-center whitespace-nowrap">
                    {device.name}
                </h1>

                {/* Right Side Controls */}
                <div className="flex items-center gap-4 justify-self-end">
                    {/* Calendar View Switch */}
                    <div className="flex items-center gap-2 ml-4">
                        <select className="bg-bg-50 border border-border rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-accent/20">
                            <option>Weeks</option>
                            <option>Days</option>
                            <option>月</option>
                        </select>
                    </div>
                </div>
            </div>

            <CalendarView
                device={device}
                reservations={reservations}
                onBook={handleBook}
                currentUserId={user.id}
                currentDate={currentDate}
                className="flex-1 min-h-0"
            />
        </div>
    );
};

export default DeviceBooking;
