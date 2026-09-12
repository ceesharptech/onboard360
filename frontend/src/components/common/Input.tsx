import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = "",
  id,
  ...props
}) => {
  const inputId =
    id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="flex flex-col gap-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-normal text-[#8a8f98] tracking-wide"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full bg-[#0a0b0d] border ${
          error
            ? "border-red-500/50"
            : "border-white/[0.08] hover:border-white/[0.15]"
        } focus:border-white/40 focus:ring-1 focus:ring-white/20 focus:outline-none text-[#f7f8f8] text-xs sm:text-sm rounded-md px-3 py-2 transition-colors placeholder-[#5a5e6b] ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-[#f87171]">{error}</span>}
      {helperText && !error && (
        <span className="text-xs text-[#8a8f98]">{helperText}</span>
      )}
    </div>
  );
};
