import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

const Modal = ({ isOpen, onClose, title, children, footer, className = '' }) => {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div
                className={`
                    relative w-full max-w-md 
                    bg-white/80 backdrop-blur-xl 
                    border border-white/40 
                    shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] 
                    rounded-2xl 
                    flex flex-col 
                    animate-in fade-in zoom-in-95 duration-200
                    ${className}
                `}
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-2">
                    <h3 className="text-xl font-serif font-medium text-text-primary">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-tertiary hover:text-text-primary hover:bg-black/5 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 pt-2">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="p-6 pt-0 flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default Modal;
