import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, MapPin, AlignLeft, Calendar as CalendarIcon, User } from 'lucide-react';
import Button from './ui/Button';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const BookingPopover = ({ isOpen, onClose, onSave, initialData, position }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const popoverRef = useRef(null);

    useEffect(() => {
        if (isOpen && initialData) {
            setTitle('');
            setDescription('');
        }
    }, [isOpen, initialData]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            // Use setTimeout to avoid conflict with grid click events
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSave = () => {
        onSave({
            ...initialData,
            title: title || '(无标题)',
            description
        });
        onClose();
    };

    // Use passed position directly
    const style = {
        top: position?.top || 0,
        left: position?.left || 0,
    };

    return (
        <div
            ref={popoverRef}
            className="fixed z-50 w-[400px] bg-white rounded-lg shadow-xl border border-border overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={style}
        >
            {/* Header */}
            <div className="bg-bg-50 px-4 py-2 flex items-center justify-between border-b border-border/50 handle cursor-move">
                <div className="flex items-center gap-2">
                    {/* Window controls simulation if needed, or just empty */}
                </div>
                <button onClick={onClose} className="text-text-secondary hover:bg-bg-200 rounded p-1">
                    <X size={18} />
                </button>
            </div>

            <div className="p-6 space-y-4">
                {/* Title Input */}
                <div>
                    <input
                        type="text"
                        placeholder="添加标题"
                        className="w-full text-2xl border-b-2 border-blue-500 pb-1 focus:outline-none placeholder:text-text-tertiary"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        autoFocus
                    />
                </div>

                {/* Type Selector (Mock) */}
                <div className="flex gap-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">活动</span>
                    <span className="px-3 py-1 hover:bg-bg-100 text-text-secondary rounded text-sm cursor-pointer">任务</span>
                    <span className="px-3 py-1 hover:bg-bg-100 text-text-secondary rounded text-sm cursor-pointer">预约安排 <span className="text-[10px] bg-blue-600 text-white px-1 rounded ml-1">新</span></span>
                </div>

                {/* Time Display */}
                <div className="flex items-start gap-4 text-text-secondary">
                    <Clock size={20} className="mt-0.5" />
                    <div className="text-sm">
                        <div>
                            {initialData?.date && format(new Date(initialData.date), 'M月 d日 (EEEE)', { locale: zhCN })}
                        </div>
                        <div className="mt-0.5">
                            {initialData?.timeSlot && (() => {
                                const [start, end] = initialData.timeSlot.split('-');
                                // Convert 24h to 12h format roughly for display if needed, or keep as is
                                // The image shows "下午1:30 - 下午2:30"
                                return `${start} - ${end}`;
                            })()}
                        </div>
                        <div className="text-xs text-text-tertiary mt-0.5">时区 · 不重复</div>
                    </div>
                </div>

                {/* Mock Fields */}
                <div className="flex items-center gap-4 text-text-secondary cursor-pointer hover:bg-bg-50 p-1 -ml-1 rounded">
                    <User size={20} />
                    <span className="text-sm">添加邀请对象</span>
                </div>

                <div className="flex items-center gap-4 text-text-secondary cursor-pointer hover:bg-bg-50 p-1 -ml-1 rounded">
                    <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-white text-[10px] font-bold">G</div>
                    <span className="text-sm">添加 Google Meet 视频会议</span>
                </div>

                <div className="flex items-center gap-4 text-text-secondary cursor-pointer hover:bg-bg-50 p-1 -ml-1 rounded">
                    <MapPin size={20} />
                    <span className="text-sm">添加地点</span>
                </div>

                <div className="flex items-start gap-4 text-text-secondary">
                    <AlignLeft size={20} className="mt-1" />
                    <textarea
                        placeholder="添加说明或Google 云端硬盘附件"
                        className="w-full text-sm resize-none focus:outline-none bg-transparent"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4 text-text-secondary">
                    <CalendarIcon size={20} />
                    <div className="text-sm">
                        <span className="font-medium text-text-primary">chogng</span>
                        <span className="ml-2 w-3 h-3 bg-blue-500 rounded-full inline-block"></span>
                        <div className="text-xs text-text-tertiary">忙碌 · 默认的公开范围 · 通知 30 分钟前</div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-4 pt-0">
                <Button variant="text" onClick={() => { }} className="text-blue-600 hover:bg-blue-50">
                    更多选项
                </Button>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                    保存
                </Button>
            </div>
        </div>
    );
};

export default BookingPopover;
