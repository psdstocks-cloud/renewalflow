import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    fullWidth = true,
    className = '',
    ...props
}) => {
    return (
        <div className={`${fullWidth ? 'w-full' : ''} mb-4`}>
            {label && (
                <label className="block text-sm font-medium text-zinc-400 mb-1.5 ml-1">
                    {label}
                </label>
            )}
            <input
                className={`
          appearance-none block w-full px-4 py-3 
          bg-zinc-900/50 border border-zinc-800 rounded-xl
          text-white placeholder-zinc-500
          focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50
          transition-all duration-200
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
                {...props}
            />
            {error && <p className="mt-1 text-xs text-red-500 ml-1">{error}</p>}
        </div>
    );
};
