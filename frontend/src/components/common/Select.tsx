import React from "react";

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
  className = "",
  id,
  ...props
}) => {
  const selectId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="flex flex-col gap-1.5 text-left">
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-normal text-[#8a8f98] tracking-wide"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full bg-[#0a0b0d] border ${
          error
            ? "border-red-500/50"
            : "border-white/[0.08] hover:border-white/[0.15]"
        } focus:border-white/40 focus:ring-1 focus:ring-white/20 focus:outline-none text-[#f7f8f8] text-xs sm:text-sm rounded-md px-3 py-2 transition-colors cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-[#14161a] text-[#f7f8f8]"
          >
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-[#f87171]">{error}</span>}
      {helperText && !error && (
        <span className="text-xs text-[#8a8f98]">{helperText}</span>
      )}
    </div>
  );
};
