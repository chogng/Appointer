import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, startOfWeek, isSameDay, parse, getHours, isSameWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import BookingPopover from './BookingPopover';

const CalendarView = ({ device, reservations, onBook, currentUserId, currentDate, className = '' }) => {
    const [viewMode, setViewMode] = useState('week');
    //
    const [hoverSlot, setHoverSlot] = useState(null);
    const [selectionDraft, setSelectionDraft] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [draftEvent, setDraftEvent] = useState(null); // Temp card while popover is open
    const gridRef = useRef(null);

    // Popover state
    const [popoverData, setPopoverData] = useState({
        isOpen: false,
        position: { top: 0, left: 0 },
        data: null
    });

    // 24 Hour Grid
    const startHour = 0;
    const endHour = 24;
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

    const isSlotBooked = (date, slot) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return reservations.find(r =>
            r.date === dateStr &&
            r.timeSlot === slot &&
            r.status !== 'CANCELLED'
        );
    };

    // Helper to get time from Y coordinate
    const getTimeFromY = (y) => {
        const time = y / 50;
        return Math.floor(time);
    };

    // Helper to get slot string from hour
    const getSlotFromHour = (hour) => {
        const startH = String(hour).padStart(2, '0');
        const endH = String(hour + 1).padStart(2, '0');
        return `${startH}:00-${endH}:00`;
    };

    const handleSaveBooking = (data) => {
        onBook(parse(data.date, 'yyyy-MM-dd', new Date()), data.timeSlot, {
            title: data.title,
            description: data.description
        });
        setPopoverData({ ...popoverData, isOpen: false });
    };

    // Helper to format hour label in 24-hour format (e.g., "12:00", "13:00")
    const formatHourLabel = (hour) => {
        return `${hour.toString().padStart(2, '0')}:00`;
    };

    // Global mouseup handler for drag completion
    useEffect(() => {
        const handleGlobalMouseUp = (e) => {
            if (!isDragging || !selectionDraft) return;

            if (gridRef.current) {
                const rect = gridRef.current.getBoundingClientRect();
                const { clientX, clientY } = e;
                const insideX = clientX >= rect.left && clientX <= rect.right;
                const insideY = clientY >= rect.top && clientY <= rect.bottom;
                if (!insideX || !insideY) {
                    setIsDragging(false);
                    setSelectionDraft(null);
                    return;
                }
            }

            const h1 = parseInt(selectionDraft.startSlot.split('-')[0].split(':')[0]);
            const h2 = parseInt(selectionDraft.endSlot.split('-')[0].split(':')[0]);
            const minH = Math.min(h1, h2);
            const maxH = Math.max(h1, h2);

            const startTime = `${String(minH).padStart(2, '0')}:00`;
            const endTime = `${String(maxH + 1).padStart(2, '0')}:00`;
            const combinedSlot = `${startTime}-${endTime}`;

            // Calculate popover position
            const popoverWidth = 400;
            const gap = 10;
            let left = e.clientX - popoverWidth - gap;
            let top = e.clientY - 50;

            if (left < 10) left = e.clientX + gap;
            if (top + 500 > window.innerHeight) {
                top = Math.max(10, window.innerHeight - 510);
            }
            if (top < 10) top = 10;

            setDraftEvent({ date: selectionDraft.date, timeSlot: combinedSlot });
            setPopoverData({
                isOpen: true,
                position: { top, left },
                data: { date: selectionDraft.date, timeSlot: combinedSlot }
            });
            setIsDragging(false);
            setSelectionDraft(null);
        };

        if (isDragging) {
            document.addEventListener('mouseup', handleGlobalMouseUp);
            return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
        }
    }, [isDragging, selectionDraft]);

    return (
        <div className={`flex flex-col bg-white h-full rounded-xl shadow-sm overflow-hidden border border-border-100 ${className}`}>
            {/* Single Scrollable Container for perfect alignment */}
            <div className="flex-1 relative flex flex-col min-h-0">
                {/* Sticky Header Section */}
                <div className="z-30 bg-white pr-[14px]">
                    <div className="grid grid-cols-[60px_8px_1fr] min-h-[24px]">
                        {/* Top-left corner (Timezone) */}
                        <div className="border-border flex flex-col justify-end pb-1 px-1 bg-white">
                            <span className="text-xs text-text-secondary">GMT+8</span>
                        </div>

                        {/* Spacer */}
                        <div></div>

                        {/* Days Header */}
                        <div className="grid grid-cols-7 bg-white">
                            {weekDays.map((day, i) => {
                                const isToday = isSameDay(day, new Date());
                                return (
                                    <div key={i} className="flex flex-col items-center justify-center py-3">
                                        {/* Day of the week */}
                                        <span className={`text-[12px] font-medium mb-1 ${isToday ? 'text-accent' : 'text-text-secondary'}`}>
                                            {format(day, 'EEE', { locale: zhCN })}
                                        </span>
                                        {/* Day of the month */}
                                        <div className={`
                                            w-[46px] h-[46px] flex items-center justify-center rounded-full text-2xl
                                            ${isToday ? 'bg-accent text-white hover:bg-accent-600' : 'text-text-primary hover:bg-bg-100'}
                                            cursor-pointer transition-colors
                                        `}>
                                            {format(day, 'd')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Blank Section */}
                    <div className="grid grid-cols-[60px_8px_1fr] border-border min-h-[20px] bg-white">
                        <div className="p-1">
                            {/* All Day Label */}
                        </div>
                        <div className="border-b border-border"></div>
                        <div className="grid grid-cols-7 divide-x divide-border relative border-b border-border">
                            {/* All Day Grid Cells */}
                            {weekDays.map((day, i) => (
                                <div key={i} className="relative h-full first:border-l first:border-border">
                                    {/* All day events would be rendered here */}
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Scrollable Time Event Area */}
                <div className="flex-1 overflow-y-scroll custom-scrollbar relative flex flex-col min-h-0">
                    <div className="grid grid-cols-[60px_8px_1fr] min-h-full">
                        {/* Timeline Area */}
                        <div className="border-border bg-white select-none relative">
                            {hours.map(hour => (
                                <div key={hour} className="h-[50px] relative">
                                    {/* Label is positioned relative to the tick mark which is at the top of the slot */}
                                    {hour !== 0 && (
                                        <span className="absolute -top-3 right-2 text-xs text-text-secondary text-right leading-none">
                                            {formatHourLabel(hour)}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Gap Column */}
                        <div className="bg-white select-none" aria-hidden="true">
                            {hours.map(hour => (
                                <div key={hour} className="h-[50px] border-b border-border"></div>
                            ))}
                        </div>

                        {/* Main Grid Area */}
                        <div ref={gridRef} className="grid grid-cols-7 divide-x divide-border relative border-b border-border">
                            {/* Horizontal Grid Lines */}
                            <div className="absolute inset-0 flex flex-col pointer-events-none z-0">
                                {hours.map(hour => (
                                    <div key={hour} className="h-[50px] border-b border-border"></div>
                                ))}
                            </div>
                            {/* Day Columns */}
                            {weekDays.map((day, dayIdx) => {
                                // format 'i' returns 1-7 (Mon-Sun), also check 0-6 format for compatibility
                                const isoDay = parseInt(format(day, 'i')); // 1-7
                                const jsDay = day.getDay(); // 0-6 (Sun-Sat)
                                const dayOpen = !device?.openDays || device.openDays.includes(isoDay) || device.openDays.includes(jsDay);
                                const dateStr = format(day, 'yyyy-MM-dd');

                                // Filter reservations for this day
                                const dayReservations = reservations.filter(r =>
                                    r.date === dateStr && r.status !== 'CANCELLED'
                                );

                                return (
                                    <div
                                        key={dayIdx}
                                        className="relative h-full z-1 last:border-r-0 cursor-default group"
                                        onMouseDown={(e) => {
                                            if (!dayOpen) return;

                                            // If popover is open, close it and don't create new booking
                                            if (popoverData.isOpen) {
                                                setPopoverData({ ...popoverData, isOpen: false });
                                                setDraftEvent(null);
                                                return;
                                            }

                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const hour = getTimeFromY(y);
                                            const slot = getSlotFromHour(hour);

                                            setIsDragging(true);
                                            setSelectionDraft({ date: dateStr, startSlot: slot, endSlot: slot, startY: e.clientY });
                                        }}
                                        onMouseMove={(e) => {
                                            if (!dayOpen) return;
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const hour = getTimeFromY(y);
                                            const slot = getSlotFromHour(hour);

                                            if (isDragging && selectionDraft) {
                                                if (selectionDraft.date !== dateStr) return;
                                                if (slot && y >= 0 && y <= rect.height) {
                                                    setSelectionDraft(prev => ({ ...prev, endSlot: slot }));
                                                }
                                            } else {
                                                if (slot) {
                                                    setHoverSlot({ date: dateStr, slot });
                                                } else {
                                                    setHoverSlot(null);
                                                }
                                            }
                                        }}
                                        onMouseUp={(e) => {
                                            // Let the event bubble to trigger global mouseup listener
                                            // e.stopPropagation(); // Removed to allow global handler to work
                                        }}
                                        onMouseLeave={() => setHoverSlot(null)}
                                    >
                                        {isSameDay(day, new Date()) && (
                                            <div
                                                className="absolute z-20 inset-x-0 pointer-events-none"
                                                style={{
                                                    top: `${(getHours(new Date()) - startHour + new Date().getMinutes() / 60) * 50}px`
                                                }}
                                            >
                                                <div className="h-[2px] bg-red-500 w-full relative">
                                                    <div className="absolute left-0 -top-[5px] w-3 h-3 bg-red-500 rounded-full"></div>
                                                </div>
                                            </div>
                                        )}
                                        {!dayOpen && (
                                            <div className="absolute inset-0 bg-bg-100/50 pattern-diagonal-lines opacity-50 pointer-events-none" />
                                        )}

                                        {/* Selection Draft (dragging) */}
                                        {selectionDraft && selectionDraft.date === dateStr && (
                                            (() => {
                                                const h1 = parseInt(selectionDraft.startSlot.split('-')[0].split(':')[0]);
                                                const h2 = parseInt(selectionDraft.endSlot.split('-')[0].split(':')[0]);
                                                const minH = Math.min(h1, h2);
                                                const maxH = Math.max(h1, h2);
                                                const top = minH * 50;
                                                const height = (maxH - minH + 1) * 50;
                                                return (
                                                    <div
                                                        className="absolute left-1 right-1 rounded bg-blue-500/20 border border-blue-500 pointer-events-none z-20"
                                                        style={{ top: `${top}px`, height: `${height}px` }}
                                                    >
                                                        <div className="text-xs text-blue-700 font-medium p-1">
                                                            {`${minH}:00 - ${maxH + 1}:00`}
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        )}

                                        {/* Draft Event Card (while popover is open) - Login card style */}
                                        {draftEvent && draftEvent.date === dateStr && (
                                            (() => {
                                                const [startStr, endStr] = draftEvent.timeSlot.split('-');
                                                const startH = parseInt(startStr.split(':')[0]);
                                                const endH = parseInt(endStr.split(':')[0]);
                                                const top = startH * 50;
                                                const height = (endH - startH) * 50;
                                                return (
                                                    <div
                                                        className="absolute left-1 right-1 rounded-[2rem] px-3 py-2 bg-bg-100 border border-border-100 shadow-[0_4px_24px_0_rgba(0,0,0,0.02),0_4px_32px_0_rgba(0,0,0,0.02)] text-text-100 text-xs z-20 flex flex-col justify-center text-center pointer-events-none"
                                                        style={{ top: `${top}px`, height: `${Math.max(height - 2, 48)}px` }}
                                                    >
                                                        <div className="font-medium truncate text-sm">（无标题）</div>
                                                        <div className="text-[10px] text-text-300 mt-0.5">{draftEvent.timeSlot}</div>
                                                    </div>
                                                );
                                            })()
                                        )}

                                        {/* Reservations */}
                                        {dayReservations.map((res) => {
                                            const [startStr, endStr] = res.timeSlot.split('-');
                                            const startH = parseInt(startStr.split(':')[0]);
                                            const startM = parseInt(startStr.split(':')[1]);
                                            const endH = parseInt(endStr.split(':')[0]);
                                            const endM = parseInt(endStr.split(':')[1]);
                                            const durationHours = (endH + endM / 60) - (startH + startM / 60);
                                            const topOffset = (startH + startM / 60) * 50;
                                            const height = durationHours * 50;
                                            const isMine = res.userId === currentUserId;

                                            return (
                                                <div
                                                    key={res.id || res.timeSlot}
                                                    className={`
                                                        absolute left-1 right-1 rounded px-2 py-1 text-xs border overflow-hidden cursor-pointer hover:brightness-95 transition-all z-10
                                                        ${isMine ? 'bg-green-100 border-green-300 text-green-800' : 'bg-blue-100 border-blue-300 text-blue-800'}
                                                    `}
                                                    style={{ top: `${topOffset}px`, height: `${height - 2}px` }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        alert(`Reservation: ${res.title || 'Untitled'}\n${res.timeSlot}`);
                                                    }}
                                                >
                                                    <div className="font-medium truncate">{res.title || (isMine ? '我的预约' : '已预约')}</div>
                                                    <div className="text-[10px] opacity-80">{res.timeSlot}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <BookingPopover
                isOpen={popoverData.isOpen}
                onClose={() => {
                    setPopoverData({ ...popoverData, isOpen: false });
                    setDraftEvent(null);
                }}
                onSave={handleSaveBooking}
                initialData={popoverData.data}
                position={popoverData.position}
            />
        </div>
    );
};

export default CalendarView;
