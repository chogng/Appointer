import { useState, useRef, useEffect } from 'react';
import Card from './ui/Card';
import Button from './ui/Button';
import Switch from './ui/Switch';
import { Trash2 } from 'lucide-react';

const DeviceIcon = ({ className }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M12.5 16H5C3.89543 16 3 15.1046 3 14V5C3 3.89543 3.89543 3 5 3H19C20.1046 3 21 3.89543 21 5V8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 16V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 21H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="9" width="8" height="12" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M18 17H18.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
import BookingDate from './BookingDate';
import BookingTime from './BookingTime';
import BookingGranularity from './BookingGranularity';

const DeviceCard = ({
    device,
    isAdmin,
    onToggle,
    onUpdate,
    onBook,
    deleteConfirmId,
    onDeleteClick
}) => {
    const [editingField, setEditingField] = useState(null); // 'name' | 'description' | null
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (editingField && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingField]);

    const handleDoubleClick = (field) => {
        if (!isAdmin) return;
        setEditingField(field);
        setEditValue(device[field] || '');
    };

    const handleSave = () => {
        if (editingField && editValue !== device[editingField]) {
            onUpdate(device.id, { [editingField]: editValue });
        }
        setEditingField(null);
        setEditValue('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            setEditingField(null);
            setEditValue('');
        }
    };

    return (
        <Card
            variant="glass"
            className="flex flex-col gap-[0.75rem] sm:gap-[1rem] hover-lift group"
        >
            <div className="flex items-start gap-[0.75rem] sm:gap-[1rem]">
                <div className="w-[2.5rem] h-[2.5rem] sm:w-[3rem] sm:h-[3rem] rounded-[1rem] bg-[#FAFDF7] dark:bg-green-900/20 flex items-center justify-center shrink-0 border border-green-100/50 dark:border-green-500/10 group-hover:scale-110 transition-transform duration-300">
                    <DeviceIcon className="w-[1.25rem] h-[1.25rem] sm:w-[1.5rem] sm:h-[1.5rem] text-[#7FB77E] dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center min-h-[2.5rem] sm:min-h-[3rem]">
                    <div className="flex justify-between items-start gap-2">
                        {editingField === 'name' ? (
                            <div className="relative flex-1 min-w-0">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleSave}
                                    onKeyDown={handleKeyDown}
                                    className="text-[1rem] sm:text-[1.125rem] font-semibold text-text-primary bg-transparent border-0 border-b-2 border-indigo-500 rounded-none px-0 py-0 outline-none w-full placeholder-indigo-300"
                                    placeholder="输入设备名称"
                                />
                            </div>
                        ) : (
                            <h3
                                className={`text-[1rem] sm:text-[1.125rem] font-semibold text-text-primary truncate transition-colors duration-200 border-b-2 border-transparent ${isAdmin ? 'cursor-text hover:text-indigo-600' : ''}`}
                                onDoubleClick={() => handleDoubleClick('name')}
                                title={isAdmin ? '双击编辑名称' : undefined}
                            >
                                {device.name}
                            </h3>
                        )}

                        {/* Switch for admin / Status for user */}
                        {isAdmin ? (
                            <div className="flex items-center shrink-0 md:hidden xl:flex">
                                <Switch
                                    checked={device.isEnabled}
                                    onChange={() => onToggle(device.id)}
                                    activeColor="#7FB77E"
                                />
                            </div>
                        ) : (
                            /* Status dot only for User in narrow views, or full pill in large */
                            <span className={`flex items-center gap-[0.375rem] px-[0.5rem] py-[0.125rem] rounded-[0.5rem] text-[0.875rem] font-semibold shrink-0 md:hidden xl:flex ${device.isEnabled
                                ? 'bg-green-500/10 text-green-600'
                                : 'bg-red-500/10 text-red-600'
                                }`}>
                                <span className={`w-[0.375rem] h-[0.375rem] rounded-full shrink-0 ${device.isEnabled ? 'bg-green-600' : 'bg-red-600'}`}></span>
                                <span className="hidden xl:inline">{device.isEnabled ? 'Available' : 'Unavailable'}</span>
                                <span className="xl:hidden">{device.isEnabled ? 'On' : 'Off'}</span>
                            </span>
                        )}
                    </div>
                    {editingField === 'description' ? (
                        <div className="relative w-full mt-[0.125rem] sm:mt-[0.25rem]">
                            <input
                                ref={inputRef}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleSave}
                                onKeyDown={handleKeyDown}
                                placeholder="添加描述..."
                                className="text-[0.6875rem] text-text-secondary bg-transparent border-0 border-b border-indigo-500 rounded-none px-0 py-0 outline-none w-full placeholder-indigo-300"
                            />
                        </div>
                    ) : (
                        <p
                            className={`text-[0.6875rem] text-text-secondary leading-tight line-clamp-2 mt-[0.125rem] sm:mt-[0.25rem] transition-colors duration-200 border-b border-transparent ${isAdmin ? 'cursor-text hover:text-indigo-600' : ''}`}
                            onDoubleClick={() => handleDoubleClick('description')}
                            title={isAdmin ? '双击编辑描述' : undefined}
                        >
                            {device.description || (isAdmin ? '双击添加描述...' : '\u00A0')}
                        </p>
                    )}
                </div>
            </div>

            {/* Booking date editor */}
            <div className="mt-2">
                <BookingDate
                    device={device}
                    onUpdate={onUpdate}
                    isAdmin={isAdmin}
                />
            </div>

            {/* Booking granularity editor and booking time editor*/}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[0.5rem] mt-2">
                <BookingGranularity
                    value={device.granularity}
                    onChange={(val) => onUpdate(device.id, { granularity: val })}
                    isAdmin={isAdmin}
                />
                <BookingTime
                    device={device}
                    onUpdate={onUpdate}
                    isAdmin={isAdmin}
                />
            </div>

            <div className="mt-auto pt-[0.75rem] sm:pt-[1rem] border-t border-border-subtle flex gap-[0.75rem]">
                <Button
                    variant="dark"
                    className="flex-1 text-[0.875rem] sm:text-base whitespace-nowrap overflow-hidden"
                    disabled={!device.isEnabled}
                    onClick={onBook}
                >
                    立即预约
                </Button>
                {isAdmin && (
                    <Button
                        variant={deleteConfirmId === device.id ? "danger" : "secondary"}
                        onClick={(e) => onDeleteClick(device.id, e)}
                        className={`flex-1 text-[0.875rem] sm:text-base transition-all duration-300 ${deleteConfirmId === device.id
                            ? 'bg-red-600 shadow-red-200 border-transparent shadow-lg text-white'
                            : 'bg-white/40 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border-border-subtle backdrop-blur-sm'
                            }`}
                        title={deleteConfirmId === device.id ? "确认删除" : "删除设备"}
                    >
                        {deleteConfirmId === device.id ? (
                            <div className="flex items-center gap-1">
                                <Trash2 className="w-4 h-4" />
                                <span>确认</span>
                            </div>
                        ) : (
                            "删除"
                        )}
                    </Button>
                )}
            </div>
        </Card>
    );
};

export default DeviceCard;
