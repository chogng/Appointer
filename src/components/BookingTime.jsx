import React from 'react';
import { Clock } from 'lucide-react';
import Dropdown from './ui/Dropdown';

const generateTimeOptions = (granularity = 60) => {
    const options = [];
    const totalMinutes = 24 * 60; // 24 hours

    for (let m = 0; m < totalMinutes; m += granularity) {
        const h = Math.floor(m / 60);
        const min = m % 60;

        let displayH = h % 12;
        if (displayH === 0) displayH = 12;
        const ampm = h < 12 || h === 24 ? 'am' : 'pm';

        const hStr = h.toString().padStart(2, '0');
        const minStr = min.toString().padStart(2, '0');
        const val = `${hStr}:${minStr}`;

        let label = `${displayH}:${minStr}${ampm}`;

        options.push({
            label,
            value: val
        });
    }
    return options;
};

const BookingTime = ({ device, onUpdate, isAdmin }) => {
    const granularity = device.granularity || 60;
    const timeOptions = generateTimeOptions(granularity);

    const handleStartChange = (newStart) => {
        onUpdate(device.id, {
            openTime: {
                ...device.openTime,
                start: newStart
            }
        });
    };

    const handleEndChange = (newEnd) => {
        onUpdate(device.id, {
            openTime: {
                ...device.openTime,
                end: newEnd
            }
        });
    };

    const normalizeTime = (t) => {
        if (!t) return '00:00';
        const [h, m] = t.split(':');
        return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    };

    const startTime = normalizeTime(device.openTime?.start || '09:00');
    const endTime = normalizeTime(device.openTime?.end || '18:00');

    if (!isAdmin) {
        return (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-600">
                <Clock size="0.75rem" className="text-gray-400" />
                <span>
                    {startTime} - {endTime}
                </span>
            </div>
        );
    }

    const formatDisplay = (opt) => opt?.label || opt?.value;

    return (
        <div className="flex items-center gap-2 mt-2 flex-1 min-w-0">
            <Dropdown
                options={timeOptions}
                value={startTime}
                onChange={handleStartChange}
                title="START TIME"
                className="w-[10.5rem]"
                formatDisplay={formatDisplay}
                align="center"
                popupClassName="min-w-[8.75rem]"
            />
            <span className="text-gray-400">-</span>
            <Dropdown
                options={timeOptions}
                value={endTime}
                onChange={handleEndChange}
                title="END TIME"
                className="w-[5.5rem]"
                formatDisplay={formatDisplay}
                align="center"
                popupClassName="min-w-[8.75rem]"
            />
        </div>
    );
};

export default BookingTime;
