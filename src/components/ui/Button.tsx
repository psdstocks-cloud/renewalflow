import React from 'react';
import { Link } from 'react-router-dom';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  to?: string; 
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  to,
  icon,
  className = '',
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "btn-primary-gradient text-white shadow-lg border border-transparent",
    secondary: "bg-white text-zinc-900 hover:bg-zinc-50 border border-transparent shadow-sm",
    outline: "bg-transparent text-zinc-300 border border-zinc-700 hover:border-zinc-500 hover:text-white hover:bg-zinc-800/50",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/50",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/30",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5 text-base",
    lg: "px-8 py-3.5 text-lg",
  };

  const widthStyles = fullWidth ? "w-full" : "";

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${widthStyles} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes}>
        {icon && <span className="mr-2">{icon}</span>}
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};
