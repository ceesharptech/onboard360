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
      className={`bg-[#0f1011] border border-[#23252a] rounded-xl p-5 ${
        hoverable
          ? 'hover:border-[#34343a] hover:bg-[#141516] cursor-pointer transition-all duration-150'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
