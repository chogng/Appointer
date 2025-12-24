import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../context/useAuth';
import { useLanguage } from '../context/useLanguage';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { apiService } from '../services/apiService';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { MessageSquare, Package, CheckCircle, XCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const Messages = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchMessages = useCallback(async () => {
        try {
            const allRequests = await apiService.getRequests();
            // Filter for processed requests (APPROVED or REJECTED)
            let processed = allRequests.filter(r => r.status === 'APPROVED' || r.status === 'REJECTED');

            // If not admin, only show own requests
            if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
                processed = processed.filter(r => r.requesterId === user?.id);
            }

            setMessages(processed);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        }
    }, [user]);

    useEffect(() => {
        const load = async () => {
            await fetchMessages();
            setLoading(false);
        };
        load();
    }, [fetchMessages]);

    const syncHandlers = useMemo(() => ({
        'request:created': fetchMessages,
        'request:approved': fetchMessages,
        'request:rejected': fetchMessages,
        'request:deleted': fetchMessages
    }), [fetchMessages]);

    useRealtimeSync(syncHandlers);

    const filteredMessages = messages.filter(msg => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            msg.requesterName?.toLowerCase().includes(searchLower) ||
            msg.type?.toLowerCase().includes(searchLower) ||
            msg.status?.toLowerCase().includes(searchLower)
        );
    });

    if (loading) {
        return <div className="min-h-[200px]" />;
    }

    return (
        <div className="max-w-[1500px] mx-auto min-h-screen">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-serif font-medium text-text-primary">{t('messages') || 'Message History'}</h1>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={16} />
                    <input
                        type="text"
                        placeholder={t('searchMessages') || 'Search messages...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 text-sm bg-bg-200 border-none rounded-lg focus:ring-1 focus:ring-accent w-64 transition-all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredMessages.length > 0 ? (
                    filteredMessages.map((msg) => (
                        <Card
                            key={msg.id}
                            variant="glass"
                            className="p-4 flex items-center justify-between hover:bg-accent/5 transition-colors cursor-pointer group"
                            onClick={() => setSelectedMessage(msg)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${msg.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                    }`}>
                                    {msg.status === 'APPROVED' ? <CheckCircle size={24} /> : <XCircle size={24} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-medium text-text-primary">
                                            {msg.type === 'INVENTORY_ADD' ? 'New Inventory Item' : 'Inventory Modification'}
                                        </h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${msg.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {msg.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-text-secondary mt-1">
                                        Requested by <span className="text-text-primary font-medium">{msg.requesterName}</span>
                                    </div>
                                    <div className="text-xs text-text-tertiary mt-1">
                                        {format(new Date(msg.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                                    </div>
                                </div>
                            </div>

                            <div className="text-right">
                                {(() => {
                                    try {
                                        const data = JSON.parse(msg.newData || '{}');
                                        return (
                                            <div className="text-sm text-text-secondary">
                                                <div className="font-medium text-text-primary">{data.name}</div>
                                                <div>x{data.quantity}</div>
                                            </div>
                                        );
                                    } catch (e) {
                                        return null;
                                    }
                                })()}
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-12 text-text-secondary">
                        <MessageSquare size={48} className="mx-auto mb-4 text-text-tertiary opacity-50" />
                        <p>{t('noMessages') || 'No processed messages found'}</p>
                    </div>
                )}
            </div>

            {/* Message Details Modal */}
            <Modal
                isOpen={!!selectedMessage}
                onClose={() => setSelectedMessage(null)}
                title="Request Details"
            >
                {selectedMessage && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4 mb-6">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${selectedMessage.status === 'APPROVED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                }`}>
                                {selectedMessage.status === 'APPROVED' ? <CheckCircle size={32} /> : <XCircle size={32} />}
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-text-primary">
                                    {selectedMessage.type === 'INVENTORY_ADD' ? 'New Inventory Item' : 'Inventory Modification'}
                                </h3>
                                <div className="flex items-center gap-2 text-text-secondary">
                                    <span>Status:</span>
                                    <span className={`font-medium ${selectedMessage.status === 'APPROVED' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {selectedMessage.status}
                                    </span>
                                </div>
                                <p className="text-text-tertiary text-sm">
                                    {format(new Date(selectedMessage.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                                </p>
                            </div>
                        </div>

                        <div className="bg-bg-200/50 rounded-xl p-4">
                            <h4 className="text-sm font-medium text-text-primary mb-3">
                                {selectedMessage.type === 'INVENTORY_ADD' ? 'Item Details' : 'Changes'}
                            </h4>

                            {(() => {
                                const original = (selectedMessage.originalData ? JSON.parse(selectedMessage.originalData) : {}) || {};
                                const newData = (JSON.parse(selectedMessage.newData || '{}')) || {};

                                return (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-3 text-xs text-text-tertiary mb-1 border-b border-border/50 pb-2">
                                            <div>Field</div>
                                            <div>Original</div>
                                            <div>New Value</div>
                                        </div>

                                        {['name', 'category', 'quantity'].map(field => {
                                            const isChanged = original[field] != newData[field];
                                            return (
                                                <div key={field} className={`grid grid-cols-3 text-sm ${isChanged && selectedMessage.type !== 'INVENTORY_ADD' ? 'bg-accent/5 -mx-2 px-2 py-1 rounded' : ''}`}>
                                                    <div className="text-text-secondary capitalize">{field}</div>
                                                    <div className="text-text-secondary">{original[field] || '-'}</div>
                                                    <div className={`font-medium ${isChanged ? 'text-accent' : 'text-text-primary'}`}>
                                                        {newData[field]}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Messages;
