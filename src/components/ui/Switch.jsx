import React from 'react';

const Switch = ({ checked, onChange, disabled = false, className = '', activeColor }) => {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={onChange}
            style={{
                ...(checked && activeColor ? { backgroundColor: activeColor, borderColor: activeColor } : {}),
                ...(!checked ? { backgroundColor: '#FDFDF7' } : {})
            }}
            className={`
                relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                transition-colors duration-200 ease-in-out focus:outline-none
                ${checked ? (!activeColor ? 'bg-indigo-500' : '') : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                ${className}
            `}
        >
            <span className="sr-only">Use setting</span>
            <span
                aria-hidden="true"
                className={`
                    pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                    transition duration-200 ease-in-out
                    ${checked ? 'translate-x-5' : 'translate-x-0.5'}
                `}
            />
        </button>
    );
};

export default Switch;
