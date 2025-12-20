import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useCallback, useMemo } from 'react';
import Card from '../components/ui/Card';
import { apiService } from '../services/apiService';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

import { Calendar, Clock, CheckCircle, Activity } from 'lucide-react';

import { useLanguage } from '../context/useLanguage';

const Dashboard = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const stats = [
        { label: t('upcomingReservations'), value: '2', icon: Calendar, color: '#0071E3' },
        { label: t('reservedHours'), value: '14', icon: Clock, color: '#34C759' },
        { label: t('completed'), value: '8', icon: CheckCircle, color: '#FF9F0A' },
    ];

    const fetchLogs = useCallback(async () => {
        try {
            const data = await apiService.getLogs();
            setLogs(data);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    }, []);

    useEffect(() => {
        const loadData = async () => {
            await fetchLogs();
            setLoading(false);
        };
        loadData();
    }, [fetchLogs]);

    const logSyncHandlers = useMemo(() => ({
        'reservation:created': fetchLogs,
        'device:created': fetchLogs,
        'user:created': fetchLogs,
    }), [fetchLogs]);

    useRealtimeSync(logSyncHandlers);

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    const getActionLabel = (action) => {
        const labels = {
            'LOGIN': t('loginParams'),
            'DEVICE_CREATED': t('createDevice'),
            'RESERVATION_CREATED': t('createReservation'),
            'USER_CREATED': t('registerUser'),
        };
        return labels[action] || action;
    };

    return (
        <div className="max-w-[1500px] mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">{t('dashboard')}</h1>
                <p className="text-text-secondary">
                    {t('welcomeBack')}, {user?.name}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((stat, index) => (
                    <Card key={index} variant="glass" className="flex items-center gap-4 hover:shadow-md transition-shadow duration-200">
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${stat.color}15` }}
                        >
                            <stat.icon size={24} color={stat.color} />
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
                            <div className="text-sm text-text-secondary">{stat.label}</div>
                        </div>
                    </Card>
                ))}
            </div>

            <div className="mt-10">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={20} className="text-accent" />
                    <h2 className="text-xl font-serif font-medium text-text-primary">{t('recentActivity')}</h2>
                </div>
                <Card variant="glass" className="p-0 overflow-hidden">
                    {logs.length > 0 ? (
                        <div className="divide-y divide-border-subtle">
                            {logs.map((log) => (
                                <div key={log.id} className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-bg-200 flex items-center justify-center text-text-secondary">
                                            {log.userName?.[0] || t('systemUser')[0]}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-text-primary">
                                                <span className="text-accent">{log.userName || t('systemUser')}</span> {getActionLabel(log.action)}
                                            </div>
                                            <div className="text-xs text-text-tertiary">
                                                {log.details}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-text-tertiary">
                                        {format(new Date(log.timestamp), 'MM-dd HH:mm', { locale: zhCN })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-text-secondary text-center py-8">
                            {t('noActivity')}
                        </p>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;

