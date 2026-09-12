import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'utility' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'utility',
  size = 'md',
  icon,
  isLoading,
  className = '',
  disabled,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

  const variants = {
    primary:
      'bg-[#5e6ad2] hover:bg-[#828fff] active:bg-[#5e69d1] text-white rounded-lg shadow-sm',
    secondary:
      'bg-[#0f1011] hover:bg-[#141516] text-[#f7f8f8] border border-[#23252a] hover:border-[#34343a] rounded-lg',
    utility:
      'bg-[#141516] hover:bg-[#18191a] text-[#f7f8f8] border border-[#23252a] hover:border-[#34343a] rounded-lg',
    danger:
      'bg-[rgba(239,68,68,0.1)] hover:bg-[rgba(239,68,68,0.2)] text-[#f87171] border border-[rgba(239,68,68,0.25)] rounded-lg',
    ghost:
      'bg-transparent hover:bg-[#141516] text-[#8a8f98] hover:text-[#f7f8f8] rounded-lg',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3.5 py-2 gap-2',
    lg: 'text-sm px-4.5 py-2.5 gap-2.5 font-medium',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
};
