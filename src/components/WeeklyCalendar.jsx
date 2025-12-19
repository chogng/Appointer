import React, { useState, useEffect, useRef } from 'react';
import { format, addDays, startOfWeek, isSameDay, parse, getHours } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import BookingPopover from './BookingPopover';

const EVENT_COLORS = {
    default: { bg: 'bg-bg-100', border: 'border-border-100', text: 'text-text-100' },
    blue: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
    red: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' },
    green: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800' },
    yellow: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-800' },
    purple: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
    pink: { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800' },
    gray: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-800' },
};

const WeeklyCalendar = ({ device, reservations, onBook, onDelete, currentUserId, currentDate, layoutMode = 'grid', className = '' }) => {
    const [_hoverSlot, setHoverSlot] = useState(null);
    const [selectionDraft, setSelectionDraft] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [draftEvent, setDraftEvent] = useState(null); // The interactive draft event
    const [draftInteraction, setDraftInteraction] = useState(null); // { type: 'move' | 'resize-top' | 'resize-bottom', startY: number, startData: object }
    const gridRef = useRef(null);

    // Event card positioning based on layout mode
    const eventCardPosition = layoutMode === 'list'
        ? 'left-[20%] right-[20%]'  // Narrower for list view
        : 'left-2 right-2';          // Slightly narrower for grid view

    // Popover state
    const [popoverData, setPopoverData] = useState({
        isOpen: false,
        position: { top: 0, left: 0 },
        placement: 'right', // Default placement
        data: null
    });

    // 24 Hour Grid
    const startHour = 0;
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

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
            id: data.id, // Pass ID if updating
            title: data.title,
            description: data.description,
            color: data.color
        });
        setPopoverData({ ...popoverData, isOpen: false });
        setDraftEvent(null); // Clear draft after saving
    };

    // Helper to format hour label in 24-hour format (e.g., "12:00", "13:00")
    const formatHourLabel = (hour) => {
        return `${hour.toString().padStart(2, '0')}:00`;
    };

    // Helper to check if a time (in hours, float) is within open hours
    const isTimeOpen = (time) => {
        if (!device?.openTime) return true;
        const [startH, startM] = (device.openTime.start || '00:00').split(':').map(Number);
        const [endH, endM] = (device.openTime.end || '24:00').split(':').map(Number);

        const startTime = startH + (startM / 60);
        const endTime = endH + (endM / 60);

        return time >= startTime && time < endTime;
    };

    // Helper to get open time range in hours (float)
    const getOpenTimeRange = () => {
        const [startH, startM] = (device?.openTime?.start || '00:00').split(':').map(Number);
        const [endH, endM] = (device?.openTime?.end || '24:00').split(':').map(Number);
        return {
            start: startH + (startM / 60),
            end: endH + (endM / 60)
        };
    };

    function openPopoverForDraft(targetEvent = draftEvent) {
        if (!targetEvent || !gridRef.current) return;

        const [startStr, endStr] = targetEvent.timeSlot.split('-');
        const startH = parseInt(startStr.split(':')[0]);
        const endH = parseInt(endStr.split(':')[0]);

        // Find which day column the event is in
        const dayIndex = weekDays.findIndex(day =>
            format(day, 'yyyy-MM-dd') === targetEvent.date
        );

        // Get grid dimensions
        const gridRect = gridRef.current.getBoundingClientRect();
        const columnWidth = gridRect.width / 7;

        // Calculate event card position
        const cardLeft = gridRect.left + (dayIndex * columnWidth);
        const cardRight = cardLeft + columnWidth;
        const cardTop = gridRect.top + (startH * 50);
        const cardHeight = (endH - startH) * 50;

        const popoverWidth = 400;
        const popoverHeight = 500;
        const gap = 12;
        let left, top;

        // Horizontal positioning
        if (dayIndex < 3.5) {
            left = cardRight + gap;
            if (left + popoverWidth > window.innerWidth - 10) left = cardLeft - popoverWidth - gap;
        } else {
            left = cardLeft - popoverWidth - gap;
            if (left < 10) left = cardRight + gap;
        }

        // Vertical positioning
        if (cardTop < window.innerHeight / 2) {
            top = cardTop;
            if (top + popoverHeight > window.innerHeight - 10) top = window.innerHeight - popoverHeight - 10;
        } else {
            top = cardTop + cardHeight - popoverHeight;
            if (top < 10) top = 10;
        }

        // Boundary checks
        top = Math.max(10, Math.min(top, window.innerHeight - popoverHeight - 10));
        left = Math.max(10, Math.min(left, window.innerWidth - popoverWidth - 10));

        // Determine placement for animation direction
        // If popover is to the right of the card (left > cardLeft), it's "right" placement
        // If popover is to the left (left < cardLeft), it's "left" placement
        const placement = left > cardLeft ? 'right' : 'left';

        setPopoverData({
            isOpen: true,
            position: { top, left },
            placement,
            data: targetEvent
        });
    }

    // Global mouseup handler for drag completion and interactions
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            // Handle Selection Drag End
            if (isDragging && selectionDraft) {
                // If we were dragging to select, finalize the selection into a draft event
                const h1 = parseInt(selectionDraft.startSlot.split('-')[0].split(':')[0]);
                const h2 = parseInt(selectionDraft.endSlot.split('-')[0].split(':')[0]);
                const minH = Math.min(h1, h2);
                const maxH = Math.max(h1, h2);

                const startTime = `${String(minH).padStart(2, '0')}:00`;
                const endTime = `${String(maxH + 1).padStart(2, '0')}:00`;
                const combinedSlot = `${startTime}-${endTime}`;

                const newDraft = { date: selectionDraft.date, timeSlot: combinedSlot, color: selectionDraft.color };
                setDraftEvent(newDraft);
                setIsDragging(false);
                setSelectionDraft(null);

                // Auto-open popover after creation
                openPopoverForDraft(newDraft);
                return;
            }

            // Handle Draft Interaction End
            if (draftInteraction) {
                setDraftInteraction(null);
                return;
            }

            // ... (rest of handler)
        };

        const handleGlobalMouseMove = (e) => {
            if (draftInteraction && gridRef.current) {
                e.preventDefault(); // Prevent selection
                const gridRect = gridRef.current.getBoundingClientRect();
                const currentX = e.clientX - gridRect.left;

                const { start: openStart, end: openEnd } = getOpenTimeRange();

                // Calculate new time/date based on interaction type
                if (draftInteraction.type === 'move') {
                    // Moving the whole block
                    const deltaY = e.clientY - draftInteraction.startY;
                    const deltaHours = Math.round(deltaY / 50);

                    // Calculate new start hour
                    const [startStr, endStr] = draftInteraction.startData.timeSlot.split('-');
                    const originalStartH = parseInt(startStr.split(':')[0]);
                    const originalEndH = parseInt(endStr.split(':')[0]);
                    const duration = originalEndH - originalStartH;

                    let newStartH = originalStartH + deltaHours;
                    // Clamp to open hours
                    newStartH = Math.max(openStart, Math.min(openEnd - duration, newStartH));
                    let newEndH = newStartH + duration;

                    // Calculate new day
                    const columnWidth = gridRect.width / 7;
                    const dayIndex = Math.floor(currentX / columnWidth);
                    const newDate = weekDays[Math.max(0, Math.min(6, dayIndex))];
                    const newDateStr = format(newDate, 'yyyy-MM-dd');

                    // Check if day is open
                    const isoDay = parseInt(format(newDate, 'i'));
                    const jsDay = newDate.getDay();
                    const dayOpen = !device?.openDays || device.openDays.includes(isoDay) || device.openDays.includes(jsDay);

                    if (dayOpen) {
                        const newSlot = `${String(newStartH).padStart(2, '0')}:00-${String(newEndH).padStart(2, '0')}:00`;
                        setDraftEvent({ date: newDateStr, timeSlot: newSlot });
                    }

                } else if (draftInteraction.type === 'resize-top') {
                    const deltaY = e.clientY - draftInteraction.startY;
                    const deltaHours = Math.round(deltaY / 50);

                    const [startStr, endStr] = draftInteraction.startData.timeSlot.split('-');
                    const originalStartH = parseInt(startStr.split(':')[0]);
                    const endH = parseInt(endStr.split(':')[0]);

                    let newStartH = originalStartH + deltaHours;
                    // Clamp: openStart <= newStartH < endH
                    newStartH = Math.max(openStart, Math.min(endH - 1, newStartH));

                    const newSlot = `${String(newStartH).padStart(2, '0')}:00-${String(endH).padStart(2, '0')}:00`;
                    setDraftEvent(prev => ({ ...prev, timeSlot: newSlot }));

                } else if (draftInteraction.type === 'resize-bottom') {
                    const deltaY = e.clientY - draftInteraction.startY;
                    const deltaHours = Math.round(deltaY / 50);

                    const [startStr, endStr] = draftInteraction.startData.timeSlot.split('-');
                    const startH = parseInt(startStr.split(':')[0]);
                    const originalEndH = parseInt(endStr.split(':')[0]);

                    let newEndH = originalEndH + deltaHours;
                    // Clamp: startH < newEndH <= openEnd
                    newEndH = Math.max(startH + 1, Math.min(openEnd, newEndH));

                    const newSlot = `${String(startH).padStart(2, '0')}:00-${String(newEndH).padStart(2, '0')}:00`;
                    setDraftEvent(prev => ({ ...prev, timeSlot: newSlot }));
                }
            }
        };

        if (isDragging || draftInteraction) {
            document.addEventListener('mouseup', handleGlobalMouseUp);
            document.addEventListener('mousemove', handleGlobalMouseMove);
            return () => {
                document.removeEventListener('mouseup', handleGlobalMouseUp);
                document.removeEventListener('mousemove', handleGlobalMouseMove);
            };
        }
    }, [isDragging, selectionDraft, weekDays, draftInteraction, device, popoverData.isOpen, draftEvent]);

    const handleDeleteBooking = (id) => {
        if (onDelete) onDelete(id);
        setDraftEvent(null); // Clear any draft/ghost event that might exist
    };

    return (
        <div className={`flex flex-col bg-white h-full rounded-xl shadow-sm overflow-hidden border border-border-100 ${className}`}>
            {/* ... (header) */}
            <div className="flex-1 relative flex flex-col min-h-0">
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
                                        <span className={`text-[12px] font-medium mb-1 ${isToday ? 'text-accent' : 'text-text-secondary'}`}>
                                            {format(day, 'EEE', { locale: zhCN })}
                                        </span>
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
                <div className="flex-1 relative flex flex-col min-h-0 overflow-y-auto">
                    <div className="grid grid-cols-[60px_8px_1fr] min-h-full">
                        {/* Timeline Area */}
                        <div className="border-border bg-white select-none relative">
                            {hours.map(hour => (
                                <div key={hour} className="h-[50px] relative">
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
                                const isoDay = parseInt(format(day, 'i')); // 1-7
                                const jsDay = day.getDay(); // 0-6 (Sun-Sat)
                                const dayOpen = !device?.openDays || device.openDays.includes(isoDay) || device.openDays.includes(jsDay);
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const { start: openStart, end: openEnd } = getOpenTimeRange();

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

                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const hour = getTimeFromY(y);

                                            if (!isTimeOpen(hour)) return; // Prevent selection in closed times

                                            // If popover is open, close it
                                            if (popoverData.isOpen) {
                                                setPopoverData({ ...popoverData, isOpen: false });
                                                setDraftEvent(null);
                                                return;
                                            }

                                            // If draft exists and we click grid (not on draft), clear it
                                            if (draftEvent) {
                                                setDraftEvent(null);
                                                return;
                                            }

                                            // Snap to nearest hour for start
                                            // The user asks for creating events using drag, let's keep it hourly aligned for simplicity or use granularity
                                            // Current logic uses hour blocks
                                            const slot = getSlotFromHour(hour);

                                            setIsDragging(true);
                                            const savedColor = localStorage.getItem('lastSelectedColor');
                                            setSelectionDraft({ date: dateStr, startSlot: slot, endSlot: slot, startY: e.clientY, color: savedColor || 'default' });
                                        }}
                                        onMouseMove={(e) => {
                                            if (!dayOpen) return;
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const hour = getTimeFromY(y);
                                            const slot = getSlotFromHour(hour);

                                            if (isDragging && selectionDraft) {
                                                if (selectionDraft.date !== dateStr) return;

                                                // Check bounds
                                                if (hour >= openStart && hour < openEnd) {
                                                    if (slot && y >= 0 && y <= rect.height) {
                                                        setSelectionDraft(prev => ({ ...prev, endSlot: slot }));
                                                    }
                                                }
                                            } else {
                                                if (slot && !draftEvent && !popoverData.isOpen && isTimeOpen(hour)) {
                                                    setHoverSlot({ date: dateStr, slot });
                                                } else {
                                                    setHoverSlot(null);
                                                }
                                            }
                                        }}
                                        onMouseLeave={() => setHoverSlot(null)}
                                    >
                                        {/* Closed Time Overlays */}
                                        {dayOpen && (
                                            <>
                                                {/* Top Closed Area */}
                                                <div
                                                    className="absolute top-0 left-0 right-0 bg-bg-100/50 pattern-diagonal-lines opacity-50 pointer-events-none z-10"
                                                    style={{ height: `${openStart * 50}px` }}
                                                />
                                                {/* Bottom Closed Area */}
                                                <div
                                                    className="absolute left-0 right-0 bottom-0 bg-bg-100/50 pattern-diagonal-lines opacity-50 pointer-events-none z-10"
                                                    style={{ top: `${openEnd * 50}px` }}
                                                />
                                            </>
                                        )}

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

                                        {/* Selection Event Card (dragging for creation) */}
                                        {selectionDraft && selectionDraft.date === dateStr && (
                                            (() => {
                                                const h1 = parseInt(selectionDraft.startSlot.split('-')[0].split(':')[0]);
                                                const h2 = parseInt(selectionDraft.endSlot.split('-')[0].split(':')[0]);
                                                const minH = Math.min(h1, h2);
                                                const maxH = Math.max(h1, h2);
                                                const top = minH * 50;
                                                const height = (maxH - minH + 1) * 50;
                                                const timeSlot = `${String(minH).padStart(2, '0')}:00-${String(maxH + 1).padStart(2, '0')}:00`;
                                                const colorStyles = EVENT_COLORS[selectionDraft.color] || EVENT_COLORS.default;
                                                return (
                                                    <div
                                                        className={`absolute ${eventCardPosition} rounded-[0.5rem] px-1 py-1 border shadow-lg text-xs z-20 flex flex-col justify-center text-center pointer-events-none ${colorStyles.bg} ${colorStyles.border} ${colorStyles.text}`}
                                                        style={{ top: `${top}px`, height: `${Math.max(height - 2, 48)}px` }}
                                                    >
                                                        <div className="font-medium truncate text-sm">（无标题）</div>
                                                        <div className="text-sm opacity-80 mt-0.5">{timeSlot}</div>
                                                    </div>
                                                );
                                            })()
                                        )}

                                        {/* Ghost Event Card (original position during move) */}
                                        {draftInteraction?.type === 'move' && draftInteraction.startData.date === dateStr && (
                                            (() => {
                                                const [startStr, endStr] = draftInteraction.startData.timeSlot.split('-');
                                                const startH = parseInt(startStr.split(':')[0]);
                                                const endH = parseInt(endStr.split(':')[0]);
                                                const top = startH * 50;
                                                const height = (endH - startH) * 50;
                                                const colorStyles = EVENT_COLORS[draftInteraction.startData.color] || EVENT_COLORS.default;
                                                return (
                                                    <div
                                                        className={`absolute ${eventCardPosition} rounded-[0.5rem] px-1 py-1 border shadow-sm text-xs z-10 flex flex-col justify-center text-center pointer-events-none opacity-50 ${colorStyles.bg} ${colorStyles.border} ${colorStyles.text}`}
                                                        style={{ top: `${top}px`, height: `${Math.max(height - 2, 48)}px` }}
                                                    >
                                                        <div className="font-medium truncate text-sm">（无标题）</div>
                                                        <div className="text-sm opacity-80 mt-0.5">{draftInteraction.startData.timeSlot}</div>
                                                    </div>
                                                );
                                            })()
                                        )}

                                        {/* Interactive Draft Event Card */}
                                        {draftEvent && draftEvent.date === dateStr && (
                                            (() => {
                                                const [startStr, endStr] = draftEvent.timeSlot.split('-');
                                                const startH = parseInt(startStr.split(':')[0]);
                                                const endH = parseInt(endStr.split(':')[0]);
                                                const top = startH * 50;
                                                const height = (endH - startH) * 50;
                                                return (
                                                    <div
                                                        className={`absolute ${eventCardPosition} rounded-[0.5rem] px-1 py-1 border shadow-lg text-xs z-20 flex flex-col justify-center text-center select-none group/draft ${draftInteraction?.type === 'move' ? 'cursor-move' : 'cursor-pointer'}
                                                            ${draftEvent.color ? (EVENT_COLORS[draftEvent.color]?.bg || 'bg-bg-100') : 'bg-bg-100'}
                                                            ${draftEvent.color ? (EVENT_COLORS[draftEvent.color]?.border || 'border-border-100') : 'border-border-100'}
                                                            ${draftEvent.color ? (EVENT_COLORS[draftEvent.color]?.text || 'text-text-100') : 'text-text-100'}
                                                        `}
                                                        style={{ top: `${top}px`, height: `${Math.max(height - 2, 48)}px` }}
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            // If clicking on resize handles, don't move
                                                            // (Resize handles will have their own handlers)
                                                            setDraftInteraction({ type: 'move', startY: e.clientY, startData: draftEvent });
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!draftInteraction) {
                                                                openPopoverForDraft();
                                                            }
                                                        }}
                                                    >
                                                        {/* Resize Handle Top */}
                                                        <div
                                                            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-30 opacity-0 group-hover/draft:opacity-100"
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setDraftInteraction({ type: 'resize-top', startY: e.clientY, startData: draftEvent });
                                                            }}
                                                        />

                                                        <div className="font-medium truncate text-sm pointer-events-none">（无标题）</div>
                                                        <div className="text-sm text-text-300 mt-0.5 pointer-events-none">{draftEvent.timeSlot}</div>

                                                        {/* Resize Handle Bottom */}
                                                        <div
                                                            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-30 opacity-0 group-hover/draft:opacity-100"
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation();
                                                                setDraftInteraction({ type: 'resize-bottom', startY: e.clientY, startData: draftEvent });
                                                            }}
                                                        />
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

                                            // Determine styles based on color or fallback to default
                                            let colorStyles = EVENT_COLORS.default;
                                            if (res.color && EVENT_COLORS[res.color]) {
                                                colorStyles = EVENT_COLORS[res.color];
                                            } else if (isMine) {
                                                colorStyles = EVENT_COLORS.green;
                                            }

                                            return (
                                                <div
                                                    key={res.id || res.timeSlot}
                                                    className={`
                                                        absolute ${eventCardPosition} rounded-[0.5rem] px-1 py-1 text-xs border overflow-hidden cursor-pointer hover:brightness-95 transition-all z-20 shadow-lg flex flex-col justify-center text-center
                                                        ${colorStyles.bg} ${colorStyles.border} ${colorStyles.text}
                                                    `}
                                                    style={{ top: `${topOffset}px`, height: `${height - 2}px` }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Open popover for editing/deleting
                                                        openPopoverForDraft(res);
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                >
                                                    <div className="font-medium truncate text-sm">{res.title || (isMine ? '我的预约' : '已预约')}</div>
                                                    <div className="text-sm opacity-80 mt-0.5">{res.timeSlot}</div>
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
                }}
                onSave={handleSaveBooking}
                onColorChange={(newColor) => {
                    if (draftEvent) {
                        setDraftEvent(prev => ({ ...prev, color: newColor }));
                    }
                    setPopoverData(prev => ({
                        ...prev,
                        data: { ...prev.data, color: newColor }
                    }));
                }}
                onDelete={handleDeleteBooking}
                initialData={popoverData.data}
                position={popoverData.position}
                placement={popoverData.placement}
            />
        </div>
    );
};

export default WeeklyCalendar;
