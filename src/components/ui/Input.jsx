import React from 'react';

const Input = ({
    label,
    error,
    fullWidth = false,
    className = '',
    ...props
}) => {
    const containerClasses = `flex flex-col gap-1.5 mb-4 ${fullWidth ? 'w-full' : ''}`;

    const labelClasses = "text-sm font-medium text-text-secondary ml-1";

    const inputClasses = `
        w-full px-4 py-3 rounded-xl
        bg-bg-surface border border-border-subtle
        text-text-primary text-base
        placeholder-text-secondary/50
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-white/20
        disabled:opacity-50 disabled:cursor-not-allowed
        ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'hover:border-zinc-700'}
        ${className}
    `.trim().replace(/\s+/g, ' ');

    const errorClasses = "text-sm text-red-500 ml-1";

    return (
        <div className={containerClasses}>
            {label && <label className={labelClasses}>{label}</label>}
            <input
                className={inputClasses}
                {...props}
            />
            {error && <span className={errorClasses}>{error}</span>}
        </div>
    );
};

export default Input;
