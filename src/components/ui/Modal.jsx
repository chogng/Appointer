import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    className = '',
    dataUi,
    closeAriaLabel = 'Close dialog',
}) => {
    const reactId = useId();
    const titleId = `modal-title-${reactId}`;
    const uiMarker = typeof dataUi === 'string' && dataUi.trim() ? dataUi.trim() : undefined;

    const dialogRef = useRef(null);
    const previouslyFocusedRef = useRef(null);
    const previousBodyOverflowRef = useRef(null);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };

        let focusHandle = null;

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            previouslyFocusedRef.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
            previousBodyOverflowRef.current = document.body.style.overflow;
            document.body.style.overflow = 'hidden';

            focusHandle = requestAnimationFrame(() => {
                const dialog = dialogRef.current;
                if (!dialog) return;

                const focusable = dialog.querySelector(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                );

                const target = focusable instanceof HTMLElement ? focusable : dialog;
                if (typeof target.focus === 'function') target.focus();
            });
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            if (focusHandle != null) {
                cancelAnimationFrame(focusHandle);
            }

            if (!isOpen) return;

            document.body.style.overflow = previousBodyOverflowRef.current ?? '';

            const prev = previouslyFocusedRef.current;
            if (prev && typeof prev.focus === 'function') {
                try {
                    prev.focus();
                } catch {
                    // Ignore focus restore errors (element may be gone)
                }
            }
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            data-style="modal"
            data-ui={uiMarker}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
                onClick={onClose}
                data-ui={uiMarker ? `${uiMarker}-backdrop` : undefined}
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
                aria-labelledby={title != null ? titleId : undefined}
                tabIndex={-1}
                ref={dialogRef}
                data-ui={uiMarker ? `${uiMarker}-dialog` : undefined}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-2">
                    <h3
                        id={titleId}
                        className="text-xl font-serif font-medium text-text-primary"
                    >
                        {title}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-text-tertiary hover:text-text-primary hover:bg-black/5 rounded-full transition-colors"
                        aria-label={closeAriaLabel}
                        data-ui={uiMarker ? `${uiMarker}-close` : undefined}
                    >
                        <X size={20} aria-hidden="true" />
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
