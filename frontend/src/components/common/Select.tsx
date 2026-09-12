import React from 'react';

export interface Option {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  error?: string;
  helperText?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  error,
  helperText,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="flex flex-col gap-1.5 text-left">
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-medium text-[#8a8f98] tracking-wide"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full bg-[#0f1011] border ${
          error ? 'border-[#ef4444]' : 'border-[#23252a]'
        } focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]/40 focus:outline-none text-[#f7f8f8] text-sm rounded-lg px-3 py-2 transition-colors ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#141516] text-[#f7f8f8]">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-[#f87171]">{error}</span>}
      {helperText && !error && <span className="text-xs text-[#8a8f98]">{helperText}</span>}
    </div>
  );
};
