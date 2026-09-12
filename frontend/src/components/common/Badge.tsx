import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'orange' | 'purple' | 'gray';
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
    blue: 'bg-[rgba(94,106,210,0.12)] text-[#828fff] border-[rgba(94,106,210,0.3)]',
    green: 'bg-[rgba(39,166,68,0.12)] text-[#27a644] border-[rgba(39,166,68,0.3)]',
    orange: 'bg-[rgba(217,115,13,0.12)] text-[#d9730d] border-[rgba(217,115,13,0.3)]',
    purple: 'bg-[rgba(122,127,173,0.15)] text-[#a5abdf] border-[rgba(122,127,173,0.3)]',
    gray: 'bg-[#141516] text-[#d0d6e0] border-[#23252a]',
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
