import { useRef, useEffect } from 'react';

/**
 * 通用弹出层组件
 * @param {boolean} isOpen - 是否打开
 * @param {function} onClose - 关闭回调
 * @param {string} align - 对齐方式: 'left' | 'center' | 'right'
 * @param {number} zIndex - 层级
 * @param {string} className - 额外样式
 * @param {React.ReactNode} children - 弹出内容
 * @param {string} triggerId - 触发器ID (用于 aria-labelledby)
 * @param {string} menuId - 菜单ID
 * @param {boolean} closeOnClickOutside - 点击外部是否关闭
 * @param {React.RefObject} containerRef - 容器引用 (用于点击外部检测)
 */
const Popup = ({
    isOpen,
    onClose,
    align = 'left',
    zIndex = 20,
    className = '',
    children,
    triggerId,
    menuId,
    closeOnClickOutside = true,
    containerRef,
}) => {
    const popupRef = useRef(null);

    // 点击外部关闭
    useEffect(() => {
        if (!isOpen || !closeOnClickOutside) return;

        const handleClickOutside = (e) => {
            const ref = containerRef?.current || popupRef.current;
            if (ref && !ref.contains(e.target)) {
                onClose?.();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, closeOnClickOutside, onClose, containerRef]);

    return (
        <div
            ref={popupRef}
            id={menuId}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby={triggerId}
            data-state={isOpen ? 'open' : 'closed'}
            data-side="bottom"
            data-align={align}
            tabIndex={-1}
            className={`
                absolute top-full pt-[0.5rem] min-w-full
                transition-all duration-300 ease-in-out
                ${align === 'right' ? 'right-0 origin-top-right' : align === 'center' ? 'left-1/2 -translate-x-1/2 origin-top' : 'left-0 origin-top'}
                ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-[0.5rem] pointer-events-none'}
                ${className}
            `}
            style={{ zIndex }}
        >
            <div className="bg-white border border-gray-100 rounded-[0.5rem] shadow-[0_0.625rem_2.5rem_-0.625rem_rgba(0,0,0,0.1)] py-[0.375rem] pl-[0.375rem] pr-0">
                {children}
            </div>
        </div>
    );
};

export default Popup;
