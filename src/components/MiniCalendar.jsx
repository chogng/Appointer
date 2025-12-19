import React, { useState } from 'react';
import { format, startOfMonth, startOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { zhCN } from 'date-fns/locale';

const MiniCalendar = ({ selectedDate, onDateSelect, className = '' }) => {
    const [viewDate, setViewDate] = useState(selectedDate || new Date());

    const monthStart = startOfMonth(viewDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const endDate = addDays(startDate, 41); // Force 6 weeks (42 days)

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    const handlePrevMonth = () => setViewDate(subMonths(viewDate, 1));
    const handleNextMonth = () => setViewDate(addMonths(viewDate, 1));

    return (
        <div className={`w-full p-4 ${className}`}>
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-text-primary">
                    {format(viewDate, 'yyyy年M月', { locale: zhCN })}
                </span>
                <div className="flex gap-1">
                    <button onClick={handlePrevMonth} className="p-1 hover:bg-bg-200 rounded-full text-text-secondary">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={handleNextMonth} className="p-1 hover:bg-bg-200 rounded-full text-text-secondary">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 mb-2">
                {weekDays.map(day => (
                    <div key={day} className="text-xs text-center text-text-secondary py-1">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
                {days.map(day => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <button
                            key={day.toString()}
                            onClick={() => onDateSelect(day)}
                            className={`
                                h-8 w-8 rounded-full flex items-center justify-center text-xs relative
                                transition-all duration-200
                                ${!isCurrentMonth ? 'text-text-tertiary' : 'text-text-primary'}
                                ${isSelected
                                    ? 'bg-accent text-white font-semibold shadow-lg shadow-accent/25 hover:scale-105'
                                    : 'hover:bg-accent/5'
                                }
                                ${isToday && !isSelected ? 'bg-accent/10 text-accent font-bold ring-1 ring-accent/20' : ''}
                            `}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default MiniCalendar;
