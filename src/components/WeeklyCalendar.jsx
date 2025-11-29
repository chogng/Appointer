import React, { useState } from 'react';
import { format, addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './ui/Button';

const WeeklyCalendar = ({ device, reservations, onBook, currentUserId }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

    const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
    const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

    const isSlotBooked = (date, slot) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return reservations.find(r =>
            r.date === dateStr &&
            r.timeSlot === slot &&
            r.status !== 'CANCELLED'
        );
    };

    const getSlotStatus = (date, slot) => {
        const booking = isSlotBooked(date, slot);
        if (!booking) return 'available';
        if (booking.userId === currentUserId) return 'mine';
        return 'booked';
    };

    return (
        <div style={{ background: '#fff', borderRadius: 'var(--radius-lg)', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                    {format(startDate, 'MMM d')} - {format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" size="sm" onClick={handlePrevWeek}><ChevronLeft size={16} /></Button>
                    <Button variant="secondary" size="sm" onClick={handleNextWeek}><ChevronRight size={16} /></Button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px' }}>
                {weekDays.map((day) => (
                    <div key={day.toString()} style={{ minWidth: 0 }}>
                        <div style={{
                            textAlign: 'center', marginBottom: '16px',
                            color: isSameDay(day, new Date()) ? 'var(--color-accent)' : 'var(--color-text-primary)'
                        }}>
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>{format(day, 'EEE')}</div>
                            <div style={{ fontSize: '18px', fontWeight: 600 }}>{format(day, 'd')}</div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {device.timeSlots.map((slot) => {
                                const status = getSlotStatus(day, slot);
                                const isDayOpen = device.openDays.includes(parseInt(format(day, 'i'))); // 1-7

                                if (!isDayOpen) return null;

                                let bg = '#F5F5F7';
                                let color = 'var(--color-text-primary)';
                                let cursor = 'pointer';
                                let border = '1px solid transparent';

                                if (status === 'booked') {
                                    bg = '#FF3B3015';
                                    color = '#FF3B30';
                                    cursor = 'not-allowed';
                                } else if (status === 'mine') {
                                    bg = '#34C75915';
                                    color = '#34C759';
                                    border = '1px solid #34C759';
                                } else {
                                    // Available
                                    bg = '#fff';
                                    border = '1px solid var(--color-border)';
                                }

                                return (
                                    <div
                                        key={slot}
                                        onClick={() => status === 'available' && onBook(day, slot)}
                                        style={{
                                            padding: '8px 4px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            textAlign: 'center',
                                            background: bg,
                                            color: color,
                                            cursor: cursor,
                                            border: border,
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (status === 'available') {
                                                e.target.style.borderColor = 'var(--color-accent)';
                                                e.target.style.color = 'var(--color-accent)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (status === 'available') {
                                                e.target.style.borderColor = 'var(--color-border)';
                                                e.target.style.color = 'var(--color-text-primary)';
                                            }
                                        }}
                                    >
                                        {slot}
                                    </div>
                                );
                            })}
                            {!device.openDays.includes(parseInt(format(day, 'i'))) && (
                                <div style={{
                                    height: '100%', minHeight: '100px', background: '#F5F5F7', borderRadius: '8px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--color-text-secondary)', fontSize: '12px'
                                }}>
                                    关闭
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WeeklyCalendar;
