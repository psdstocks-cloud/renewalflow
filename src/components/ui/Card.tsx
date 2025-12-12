import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', noPadding = false }) => {
    return (
        <div className={`glass-card rounded-2xl overflow-hidden shadow-xl ${className}`}>
            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>
        </div>
    );
};
