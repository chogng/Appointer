import React, { useState, useEffect, useRef } from 'react';

const SegmentedControl = ({ options, value, onChange, className = '' }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const containerRef = useRef(null);
    const buttonsRef = useRef([]);

    useEffect(() => {
        const index = options.findIndex(o => o.value === value);
        setActiveIndex(index !== -1 ? index : 0);
    }, [value, options]);

    useEffect(() => {
        const activeButton = buttonsRef.current[activeIndex];
        if (activeButton) {
            setIndicatorStyle({
                left: activeButton.offsetLeft,
                width: activeButton.offsetWidth
            });
        }
    }, [activeIndex, options]);

    return (
        <div
            ref={containerRef}
            className={`
                relative flex p-1 bg-gray-100/50 hover:bg-gray-100 dark:bg-gray-800/50 
                rounded-lg border border-transparent hover:border-border-subtle 
                transition-all duration-200 ${className}
            `}
        >
            <div
                className="absolute top-1 bottom-1 bg-white dark:bg-gray-700 shadow-sm rounded-md border border-border-subtle transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]"
                style={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width
                }}
            />
            {options.map((option, index) => {
                const isSelected = value === option.value;
                return (
                    <button
                        key={option.value}
                        ref={el => buttonsRef.current[index] = el}
                        onClick={() => onChange(option.value)}
                        className={`
                            relative flex-1 py-1.5 px-3 text-sm font-medium rounded-md
                            transition-colors duration-200 z-10
                            ${isSelected ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}
                        `}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
};

export default SegmentedControl;
