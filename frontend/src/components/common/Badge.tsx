import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'white' | 'blue' | 'green' | 'orange' | 'purple' | 'gray';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gray',
  size = 'sm',
  icon,
}) => {
  const variantStyles = {
    white: 'bg-white/[0.08] text-[#f7f8f8] border-white/[0.12]',
    blue: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    orange: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    gray: 'bg-white/[0.04] text-[#8a8f98] border-white/[0.06]',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
