import React from 'react';

const Card = ({ children, className = '', variant = 'default', ...props }) => {
    const variants = {
        default: 'bg-bg-surface border-border-subtle shadow-sm',
        glass: 'glass',
        flat: 'bg-bg-surface border-transparent'
    };

    const cardClasses = `
        rounded-2xl border
        p-6
        ${variants[variant] || variants.default}
        ${className}
    `.trim().replace(/\s+/g, ' ');

    return (
        <div className={cardClasses} {...props}>
            {children}
        </div>
    );
};

export default Card;
