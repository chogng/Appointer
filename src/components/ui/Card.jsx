import React, { forwardRef } from 'react';

const Card = forwardRef(({ children, className = '', variant = 'default', ...props }, ref) => {
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
        <div ref={ref} className={cardClasses} {...props}>
            {children}
        </div>
    );
});

Card.displayName = 'Card';

export default Card;
