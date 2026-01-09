import React, { useState } from 'react';
import { format, startOfMonth, startOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { enUS, zhCN } from 'date-fns/locale';
import { useLanguage } from '../hooks/useLanguage';

const MiniCalendar = ({ selectedDate, onDateSelect, className = '' }) => {
    const [viewDate, setViewDate] = useState(selectedDate || new Date());
    const { language, t } = useLanguage();
    const locale = language === 'zh' ? zhCN : enUS;

    const prevMonthLabel = language === 'zh' ? '上个月' : 'Previous month';
    const nextMonthLabel = language === 'zh' ? '下个月' : 'Next month';
    const prevMonthTestId = import.meta.env.DEV ? 'minical-prev-month' : undefined;
    const nextMonthTestId = import.meta.env.DEV ? 'minical-next-month' : undefined;

    const monthStart = startOfMonth(viewDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const endDate = addDays(startDate, 41); // Force 6 weeks (42 days)

    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const weekDays = [t('sun'), t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat')].map((label) =>
        String(label).slice(0, 1),
    );

    const handlePrevMonth = () => setViewDate(subMonths(viewDate, 1));
    const handleNextMonth = () => setViewDate(addMonths(viewDate, 1));

    return (
        <div className={`w-full p-4 ${className}`}>
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-text-primary">
                    {format(viewDate, language === 'zh' ? 'yyyy年M月' : 'MMM yyyy', { locale })}
                </span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-1 hover:bg-bg-200 rounded-full text-text-secondary"
                        aria-label={prevMonthLabel}
                        data-testid={prevMonthTestId}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-1 hover:bg-bg-200 rounded-full text-text-secondary"
                        aria-label={nextMonthLabel}
                        data-testid={nextMonthTestId}
                    >
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
