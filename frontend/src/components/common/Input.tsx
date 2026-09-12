import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-[#8a8f98] tracking-wide"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full bg-[#0f1011] border ${
          error ? 'border-[#ef4444]' : 'border-[#23252a]'
        } focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]/40 focus:outline-none text-[#f7f8f8] text-sm rounded-lg px-3 py-2 transition-colors placeholder-[#62666d] ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-[#f87171]">{error}</span>}
      {helperText && !error && <span className="text-xs text-[#8a8f98]">{helperText}</span>}
    </div>
  );
};
