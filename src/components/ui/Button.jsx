import React from 'react';

const Button = ({
    children,
    variant = 'primary', // primary, secondary, text, danger
    size = 'md', // sm, md, lg
    fullWidth = false,
    className = '',
    disabled = false,
    withScale = false,
    ...props
}) => {
    const baseClasses = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:shadow-none disabled:before:scale-100 disabled:hover:before:scale-100 outline-none focus:outline-none focus:ring-0 relative group isolate";

    const variants = {
        primary: "text-white border border-transparent shadow-sm hover:shadow-md before:absolute before:inset-0 before:bg-accent hover:before:bg-accent-hover before:rounded-xl before:transition-all before:duration-200 before:-z-10",
        premium: "text-white border-transparent shadow-lg hover:shadow-indigo-500/25 before:absolute before:inset-0 before:bg-gradient-to-r before:from-violet-600 before:to-indigo-600 before:rounded-xl before:transition-all before:duration-300 before:hover:scale-103 before:-z-10",
        secondary: "text-text-primary border border-border-subtle before:absolute before:inset-0 before:bg-white hover:before:bg-bg-subtle before:rounded-xl before:transition-all before:duration-200 before:-z-10",
        text: "text-text-secondary hover:text-text-primary before:absolute before:inset-0 before:bg-transparent hover:before:bg-black/5 before:rounded-xl before:transition-all before:duration-200 before:-z-10",
        danger: "text-white border border-transparent before:absolute before:inset-0 before:bg-red-600 hover:before:bg-red-700 before:rounded-xl before:transition-all before:duration-200 before:-z-10",
        dark: "text-white border border-transparent shadow-sm hover:shadow-md before:absolute before:inset-0 before:bg-black hover:before:bg-gray-900 before:rounded-xl before:transition-all before:duration-200 before:-z-10"
    };

    const sizes = {
        sm: "px-3 py-1 text-xs",
        md: "px-5 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    };

    const classes = `
        ${baseClasses}
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${fullWidth ? 'w-full' : ''}
        ${withScale ? 'hover:before:scale-103 active:before:scale-95' : ''}
        ${className}
    `.trim().replace(/\s+/g, ' ');

    return (
        <button className={classes} disabled={disabled} {...props}>
            <span className="relative z-10 flex items-center justify-center gap-2">
                {children}
            </span>
        </button>
    );
};

export default Button;
