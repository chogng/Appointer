import React, { useEffect, useState } from 'react';
import { mockService } from '../services/mockData';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Calendar, Clock, Monitor, XCircle } from 'lucide-react';

const MyReservations = () => {
    const { user } = useAuth();
    const [reservations, setReservations] = useState([]);
    const [devices, setDevices] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        const allRes = mockService.getReservations();
        const myRes = allRes.filter(r => r.userId === user.id && r.status !== 'CANCELLED');
        setReservations(myRes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        setDevices(mockService.getDevices());
    };

    const getDeviceName = (id) => devices.find(d => d.id === id)?.name || '未知设备';

    const handleCancel = (id) => {
        if (!confirm('您确定要取消此预约吗？')) return;

        // In a real app, we'd call a service method. For mock, we update directly.
        const allRes = mockService.getReservations();
        const index = allRes.findIndex(r => r.id === id);
        if (index !== -1) {
            allRes[index].status = 'CANCELLED';
            localStorage.setItem('drms_reservations', JSON.stringify(allRes));
            loadData();
        }
    };

    return (
        <div className="max-w-[1200px] mx-auto">
            <h1 className="text-3xl font-serif font-medium text-text-primary mb-8">我的预约</h1>

            <div className="flex flex-col gap-4">
                {reservations.length === 0 ? (
                    <Card>
                        <p className="text-center text-text-secondary py-10">
                            您当前没有有效的预约。
                        </p>
                    </Card>
                ) : (
                    reservations.map(res => (
                        <Card key={res.id} className="flex justify-between items-center">
                            <div className="flex gap-6 items-center">
                                <div className="w-14 h-14 rounded-2xl bg-bg-subtle flex items-center justify-center">
                                    <Calendar size={28} className="text-blue-600" />
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold mb-1 text-text-primary">
                                        {getDeviceName(res.deviceId)}
                                    </h3>
                                    <div className="flex gap-4 text-sm text-text-secondary">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} /> {res.date}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={14} /> {res.timeSlot}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <Button variant="danger" size="sm" onClick={() => handleCancel(res.id)}>
                                取消
                            </Button>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default MyReservations;
