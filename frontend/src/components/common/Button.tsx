import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "utility" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "utility",
  size = "md",
  icon,
  isLoading,
  className = "",
  disabled,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]";

  const variants = {
    primary:
      "bg-white hover:bg-[#e8e8e8] active:bg-[#dedede] text-[#08080a] font-medium rounded-md shadow-xs border border-white",
    secondary:
      "bg-[#14161a] hover:bg-[#1a1c22] text-[#f7f8f8] border border-white/[0.08] hover:border-white/[0.15] rounded-md shadow-2xs",
    utility:
      "bg-[#0f1013] hover:bg-[#15171d] text-[#d0d6e0] hover:text-[#f7f8f8] border border-white/[0.06] hover:border-white/[0.12] rounded-md shadow-2xs",
    danger:
      "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md",
    ghost:
      "bg-transparent hover:bg-white/[0.05] text-[#8a8f98] hover:text-[#f7f8f8] rounded-md",
  };

  const sizes = {
    sm: "text-xs px-2.5 py-1 gap-1.5",
    md: "text-xs sm:text-sm px-3 py-1.5 gap-2",
    lg: "text-sm px-4 py-2 gap-2 font-medium tracking-tight",
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
