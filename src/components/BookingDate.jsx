import React from 'react';
import { Calendar } from 'lucide-react';

const DAYS = [
    { label: '一', value: 1 },
    { label: '二', value: 2 },
    { label: '三', value: 3 },
    { label: '四', value: 4 },
    { label: '五', value: 5 },
    { label: '六', value: 6 },
    { label: '日', value: 0 },
];

const BookingDate = ({ device, onUpdate, isAdmin }) => {
    // Default to Mon-Fri if undefined
    const selectedDays = device.openDays || [1, 2, 3, 4, 5];

    const toggleDay = (value) => {
        const newDays = selectedDays.includes(value)
            ? selectedDays.filter(d => d !== value)
            : [...selectedDays, value];

        onUpdate(device.id, { openDays: newDays });
    };

    const getDayLabel = (value) => {
        return DAYS.find(d => d.value === value)?.label;
    };

    // Sort days for display: Mon(1) -> Sun(0)
    // We want 1,2,3,4,5,6,0 order for display if we follow the DAYS array order
    const sortedDisplayDays = [...selectedDays].sort((a, b) => {
        const aIndex = DAYS.findIndex(d => d.value === a);
        const bIndex = DAYS.findIndex(d => d.value === b);
        return aIndex - bIndex;
    });

    if (!isAdmin) {
        return (
            <div className="flex items-center gap-1.5">
                <Calendar size={18} className="text-gray-400" />
                <div className="flex flex-wrap gap-1">
                    {sortedDisplayDays.map(day => (
                        <span key={day} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            周{getDayLabel(day)}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3 mt-2">
            <Calendar size={18} className="text-gray-400" />
            <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.value);
                    return (
                        <button
                            key={day.value}
                            onClick={() => toggleDay(day.value)}
                            className={`
                                w-8 h-8 rounded-full text-xs font-medium transition-all duration-200 flex items-center justify-center
                                ${isSelected
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-105'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                }
                            `}
                        >
                            {day.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default BookingDate;
