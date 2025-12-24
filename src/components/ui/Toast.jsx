import React, { useEffect, useState, useLayoutEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const Toast = ({ message, type = 'success', actionText, onAction, onClose, isVisible, containerRef, position = 'absolute' }) => {
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
            if (containerRef?.current && position === 'absolute') {
                const rect = containerRef.current.getBoundingClientRect();
                const center = rect.left + rect.width / 2;
                setPositionStyle({
                    position: 'fixed', // relative to viewport but calculated based on container
                    bottom: '32px',
                    left: `${center}px`
                });
            } else if (position === 'fixed') {
                setPositionStyle({
                    position: 'fixed',
                    bottom: '32px',
                    left: '50%',
                    transform: 'translateX(-50%)'
                });
            }
        };

        if (isVisible) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            return () => window.removeEventListener('resize', updatePosition);
        }
    }, [isVisible, containerRef, position]);

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

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle2 size={20} className="text-green-500" />;
            case 'error': return <AlertCircle size={20} className="text-red-500" />;
            case 'warning': return <AlertCircle size={20} className="text-amber-500" />;
            default: return <Info size={20} className="text-blue-500" />;
        }
    };

    return (
        <div
            className={`
                transform -translate-x-1/2 z-[60] 
                flex items-center gap-3 
                bg-white/90 backdrop-blur-xl 
                border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.12)] 
                pl-4 pr-3 py-3 rounded-2xl min-w-[340px] max-w-[420px]
                ${isClosing ? 'animate-slide-down' : 'animate-slide-up'} 
                ${Object.keys(positionStyle).length === 0 ? (position === 'fixed' ? 'fixed bottom-8 left-1/2' : 'absolute bottom-0 left-1/2') : ''}
            `}
            style={positionStyle}
        >
            <div className="shrink-0">
                {getIcon()}
            </div>

            <span className="text-sm font-medium text-text-primary flex-1 leading-snug">
                {message}
            </span>

            <div className="flex items-center gap-3 pl-3 border-l border-black/5">
                {actionText && onAction && (
                    <button
                        onClick={onAction}
                        className="text-accent text-sm font-semibold hover:text-accent-hover transition-colors whitespace-nowrap"
                    >
                        {actionText}
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="text-text-tertiary hover:text-text-primary hover:bg-black/5 rounded-full p-1 transition-all"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

export default Toast;
