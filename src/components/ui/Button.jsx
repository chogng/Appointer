import React from 'react';

const Button = ({
    children,
    variant = 'primary', // primary, secondary, text, danger
    size = 'md', // sm, md, lg
    fullWidth = false,
    className = '',
    disabled = false,
    ...props
}) => {
    const baseClasses = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed outline-none focus:outline-none focus:ring-0";

    const variants = {
        primary: "bg-accent text-white hover:bg-accent-hover border border-transparent shadow-sm hover:shadow-md",
        secondary: "bg-white text-text-primary border border-border-subtle hover:bg-bg-subtle",
        text: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-black/5",
        danger: "bg-red-600 text-white hover:bg-red-700"
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
        ${className}
    `.trim().replace(/\s+/g, ' ');

    return (
        <button className={classes} disabled={disabled} {...props}>
            {children}
        </button>
    );
};

export default Button;
