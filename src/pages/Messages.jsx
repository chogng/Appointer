import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';

import { MessageSquare, Bell } from 'lucide-react';

const Messages = () => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 100);
        return () => clearTimeout(timer);
    }, []);

    const messages = [
        { id: 1, title: 'Welcome to DRMS', body: 'Your account has been successfully created.', date: '2023-10-01', read: true },
        { id: 2, title: 'System Maintenance', body: 'The system will be down for maintenance on Sunday.', date: '2023-10-05', read: false },
    ];

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    return (
        <div className="max-w-[800px] mx-auto">
            <h1 className="text-3xl font-serif font-medium text-text-primary mb-8">消息中心</h1>

            <div className="flex flex-col gap-4">
                {messages.map(msg => (
                    <Card key={msg.id} className={`
                        transition-all duration-200
                        ${!msg.read ? 'border-l-4 border-l-accent' : 'opacity-80'}
                    `}>
                        <div className="flex justify-between mb-2">
                            <h3 className="text-base font-semibold text-text-primary">{msg.title}</h3>
                            <span className="text-xs text-text-secondary">{msg.date}</span>
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed">{msg.body}</p>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default Messages;
