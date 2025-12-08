import React, { useEffect, useState, useLayoutEffect } from 'react';

const Toast = ({ message, actionText, onAction, onClose, isVisible, containerRef }) => {
    const [positionStyle, setPositionStyle] = useState({});

    // Handle auto-close
    useEffect(() => {
        if (isVisible) {
            const timer = setTimeout(() => {
                onClose();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onClose]);

    // Calculate position if containerRef is provided
    useLayoutEffect(() => {
        const updatePosition = () => {
            if (containerRef?.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const center = rect.left + rect.width / 2;
                setPositionStyle({
                    position: 'fixed',
                    bottom: 0,
                    left: `${center}px`
                });
            }
        };

        if (isVisible) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            return () => window.removeEventListener('resize', updatePosition);
        }
    }, [isVisible, containerRef]);

    // Render logic
    const [shouldRender, setShouldRender] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setShouldRender(true);
            setIsClosing(false);
        } else if (shouldRender) {
            setIsClosing(true);
            const timer = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
            }, 300); // Match animation duration
            return () => clearTimeout(timer);
        }
    }, [isVisible, shouldRender]);

    if (!shouldRender) return null;

    return (
        <div
            className={`transform -translate-x-1/2 z-[60] flex items-center gap-4 bg-[#202124] text-white px-4 py-3 rounded-md shadow-lg min-w-[320px] justify-between ${isClosing ? 'animate-slide-down' : 'animate-slide-up'} ${Object.keys(positionStyle).length === 0 ? 'absolute bottom-0 left-1/2' : ''}`}
            style={positionStyle}
        >
            <span className="text-sm font-normal tracking-wide">{message}</span>
            <div className="flex items-center gap-4">
                {actionText && onAction && (
                    <button
                        onClick={onAction}
                        className="text-[#8AB4F8] text-sm font-medium hover:text-[#AECBFA] transition-colors"
                    >
                        {actionText}
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-full"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Toast;
