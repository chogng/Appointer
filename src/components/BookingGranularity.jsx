import React, { useState, useEffect } from 'react';
import Select from './ui/Select';

const GranularityIcon = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <rect x="3" y="3" width="18" height="6" rx="1" stroke="currentColor" strokeWidth="2" />
        <path d="M3 14H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 14H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 14H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 20H3.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 20H9.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 20H15.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 20H21.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const GRANULARITY_OPTIONS = [
    { label: '1 min', value: 1 },
    { label: '5 mins', value: 5 },
    { label: '10 mins', value: 10 },
    { label: '15 mins', value: 15 },
    { label: '30 mins', value: 30 },
    { label: '60 mins', value: 60 },
];

const BookingGranularity = ({ value, onChange, isAdmin }) => {
    const currentValue = value || 60;
    const [isNarrow, setIsNarrow] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsNarrow(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex items-center gap-1.5 min-w-0">
            <GranularityIcon size={18} className="text-text-tertiary shrink-0" />
            <Select
                options={GRANULARITY_OPTIONS}
                value={currentValue}
                onChange={onChange}
                title="Granularity"
                disabled={!isAdmin}
                className="w-[5.5rem]"
                align="center"
                popupClassName="min-w-[8.75rem]"
                formatDisplay={() => {
                    if (!isAdmin || isNarrow) {
                        return `${currentValue}m`;
                    }
                    return `${currentValue} mins`;
                }}
            />
        </div>
    );
};

export default BookingGranularity;
