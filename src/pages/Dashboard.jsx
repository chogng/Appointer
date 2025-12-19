import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import Card from '../components/ui/Card';

import { Calendar, Clock, CheckCircle } from 'lucide-react';

const Dashboard = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 模拟加载
        const timer = setTimeout(() => setLoading(false), 100);
        return () => clearTimeout(timer);
    }, []);

    const stats = [
        { label: '即将到来的预约', value: '2', icon: Calendar, color: '#0071E3' },
        { label: '已预约时长', value: '14', icon: Clock, color: '#34C759' },
        { label: '已完成', value: '8', icon: CheckCircle, color: '#FF9F0A' },
    ];

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    return (
        <div className="max-w-[1200px] mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-serif font-medium text-text-primary mb-2">Dashboard</h1>
                <p className="text-text-secondary">
                    Welcome back, {user?.name}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.map((stat, index) => (
                    <Card key={index} className="flex items-center gap-4 hover:shadow-md transition-shadow duration-200">
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
                <h2 className="text-xl font-serif font-medium text-text-primary mb-4">Recent Activity</h2>
                <Card>
                    <p className="text-text-secondary text-center py-8">
                        No recent activity
                    </p>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
