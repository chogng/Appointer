import React from 'react';
import { useLanguage } from '../context/useLanguage';
const Calendar = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 14H8.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 14H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 14H16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 18H8.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 18H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 18H16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const BookingDate = ({ device, onUpdate, isAdmin }) => {
    const { t } = useLanguage();

    const getDays = () => [
        { label: t('mon'), value: 1 },
        { label: t('tue'), value: 2 },
        { label: t('wed'), value: 3 },
        { label: t('thu'), value: 4 },
        { label: t('fri'), value: 5 },
        { label: t('sat'), value: 6 },
        { label: t('sun'), value: 0 },
    ];

    // Default to Mon-Fri if undefined
    const selectedDays = device.openDays || [1, 2, 3, 4, 5];

    const toggleDay = (value) => {
        const newDays = selectedDays.includes(value)
            ? selectedDays.filter(d => d !== value)
            : [...selectedDays, value];

        onUpdate(device.id, { openDays: newDays });
    };

    const getDayLabel = (value) => {
        return getDays().find(d => d.value === value)?.label;
    };

    // Sort days for display: Mon(1) -> Sun(0)
    // We want 1,2,3,4,5,6,0 order for display if we follow the DAYS array order
    const sortedDisplayDays = [...selectedDays].sort((a, b) => {
        const days = getDays();
        const aIndex = days.findIndex(d => d.value === a);
        const bIndex = days.findIndex(d => d.value === b);
        return aIndex - bIndex;
    });

    if (!isAdmin) {
        return (
            <div className="flex items-center gap-1.5">
                <Calendar size={18} className="text-gray-400" />
                <div className="flex flex-wrap gap-1">
                    {sortedDisplayDays.map(day => (
                        <span key={day} className="text-[0.625rem] sm:text-xs px-2 py-0.5 bg-bg-100 text-text-secondary rounded-lg border border-border-subtle">
                            {t('week')}{getDayLabel(day)}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400" />
            <div className="flex flex-wrap gap-2">
                {getDays().map((day) => {
                    const isSelected = selectedDays.includes(day.value);
                    return (
                        <button
                            key={day.value}
                            onClick={() => toggleDay(day.value)}
                            className={`
                                w-8 h-8 rounded-full text-xs font-medium transition-all duration-200 flex items-center justify-center
                                ${isSelected
                                    ? 'bg-accent text-white shadow-lg shadow-black/5 scale-105'
                                    : 'bg-bg-100 text-gray-500 hover:bg-white hover:text-accent hover:shadow-sm'
                                }
                            `}
                        >
                            {day.label}
                        </button>
                    );
                })}
            </div>
        </div >
    );
};

export default BookingDate;
