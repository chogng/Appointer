import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { useReservationSync } from '../hooks/useRealtimeSync';
import { useAuth } from '../context/useAuth';
import WeeklyCalendar from '../components/WeeklyCalendar';
import Button from '../components/ui/Button';
import Toast from '../components/ui/Toast';

import Dropdown from '../components/ui/Dropdown';
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
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
    const [viewMode, setViewMode] = useState('Weeks');
    const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' | 'list'
    const containerRef = useRef(null);
    const [toastState, setToastState] = useState({
        isVisible: false,
        message: '',
        actionText: null,
        onAction: null
    });

    const showToast = (message, actionText = null, onAction = null) => {
        setToastState({
            isVisible: true,
            message,
            actionText,
            onAction
        });
    };

    const hideToast = () => {
        setToastState(prev => ({ ...prev, isVisible: false }));
    };

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
            // Check if this is an update (if extraData has an id)
            // But currently the flow is: Create New OR Update Existing.
            // If extraData has id, it's an update?
            // WeeklyCalendar passes { title, description, color, ... } from Popover.
            // Popover initialData might have ID.

            let result;
            if (extraData.id) {
                // Update
                result = await apiService.updateReservation(extraData.id, {
                    date: format(date, 'yyyy-MM-dd'),
                    timeSlot: slot,
                    ...extraData
                });
                // No Undo for Update implemented yet for simplicity, or we can stash old data.
                showToast('预约已更新');
            } else {
                // Create
                result = await apiService.createReservation({
                    deviceId: device.id,
                    userId: user.id,
                    date: format(date, 'yyyy-MM-dd'),
                    timeSlot: slot,
                    ...extraData
                });

                showToast('Event saved', 'Undo', async () => {
                    try {
                        await apiService.deleteReservation(result.id);
                        hideToast();
                    } catch (err) {
                        console.error('Undo failed', err);
                        alert('Undo failed: ' + err.message);
                    }
                });
            }
        } catch (error) {
            alert(error.message);
        }
    };

    const handleDelete = async (reservationId) => {
        try {
            const resToDelete = reservations.find(r => r.id === reservationId);

            // Optimistic update: Remove immediately from UI
            setReservations(prev => prev.filter(r => r.id !== reservationId));

            await apiService.deleteReservation(reservationId);

            showToast('Event deleted', 'Undo', async () => {
                try {
                    // Restore
                    if (resToDelete) {
                        // We need to strip ID? Or allow backend to generate new ID?
                        // Usually create new with same data.
                        const { id: _id, ...rest } = resToDelete;
                        await apiService.createReservation(rest);
                        hideToast();
                    }
                } catch (err) {
                    console.error('Undo delete failed', err);
                    // Revert optimistic delete if undo fails (though this is "undoing the undo", so re-fetch is safer)
                    loadReservations();
                }
            });
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Delete failed: ' + error.message);
            // Revert optimistic delete on error
            loadReservations();
        }
    };

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    if (!device) return <div>Device not found</div>;

    return (
        <div ref={containerRef} className="h-full flex flex-col relative">
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
                <div className="flex items-center gap-2 justify-self-end">
                    {/* Layout Toggle */}
                    <div className="flex items-center bg-bg-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setLayoutMode('grid')}
                            className={`p-1.5 rounded-md transition-colors ${layoutMode === 'grid' ? 'bg-white shadow-sm text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                            title="网格视图"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setLayoutMode('list')}
                            className={`p-1.5 rounded-md transition-colors ${layoutMode === 'list' ? 'bg-white shadow-sm text-accent' : 'text-text-secondary hover:text-text-primary'}`}
                            title="列表视图"
                        >
                            <List size={18} />
                        </button>
                    </div>
                    <Dropdown
                        options={[
                            { label: 'Weeks', value: 'Weeks' },
                            { label: 'Days', value: 'Days' },
                            { label: 'Month', value: 'Month' },
                        ]}
                        value={viewMode}
                        onChange={setViewMode}
                        className=""
                        align="right"
                        zIndex={50}
                        id="view-mode-dropdown"
                        popupClassName="min-w-[8.75rem]"
                    />
                </div>
            </div>

            <WeeklyCalendar
                device={device}
                reservations={reservations}
                onBook={handleBook}
                onDelete={handleDelete}
                currentUserId={user.id}
                currentDate={currentDate}
                layoutMode={layoutMode}
                className="flex-1 min-h-0"
            />

            <Toast
                isVisible={toastState.isVisible}
                message={toastState.message}
                actionText={toastState.actionText}
                onAction={toastState.onAction}
                onClose={hideToast}
                containerRef={containerRef}
            />
        </div>
    );
};

export default DeviceBooking;
