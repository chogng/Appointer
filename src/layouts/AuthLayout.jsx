import React from 'react';

const AuthLayout = ({ children, title, subtitle }) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-page p-5">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2 text-text-primary">{title}</h1>
                {subtitle && <p className="text-text-secondary">{subtitle}</p>}
            </div>
            {children}
        </div>
    );
};

export default AuthLayout;
