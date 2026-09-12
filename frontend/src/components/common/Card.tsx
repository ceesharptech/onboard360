import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-[#0f1013] border border-white/[0.06] rounded-xl p-5 ${
        hoverable
          ? 'hover:border-white/[0.12] hover:bg-[#13151a] cursor-pointer transition-all duration-150'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
