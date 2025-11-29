import React from 'react';

const Card = ({ children, className = '', ...props }) => {
    const cardClasses = `
        bg-bg-surface rounded-2xl border border-border-subtle
        p-6 shadow-sm
        ${className}
    `.trim().replace(/\s+/g, ' ');

    return (
        <div className={cardClasses} {...props}>
            {children}
        </div>
    );
};

export default Card;
