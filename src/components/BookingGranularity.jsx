import React, { useState, useEffect } from 'react';
import Dropdown from './ui/Dropdown';

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
        <Dropdown
            options={GRANULARITY_OPTIONS}
            value={currentValue}
            onChange={onChange}
            title="Granularity"
            disabled={!isAdmin}
            className="mt-2"
            formatDisplay={() => {
                if (!isAdmin || isNarrow) {
                    return `${currentValue}m`;
                }
                return `${currentValue} mins`;
            }}
        />
    );
};

export default BookingGranularity;
