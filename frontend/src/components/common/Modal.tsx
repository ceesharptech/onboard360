import React, { useEffect } from "react";
import { X } from "@phosphor-icons/react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "md",
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidthStyles[maxWidth]} bg-[#090a0c] border border-white/[0.08] rounded-xl shadow-2xl p-6 z-10 overflow-hidden flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06] mb-5">
          <h3 className="text-base font-semibold text-[#f7f8f8] tracking-tight">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-[#8a8f98] hover:text-[#f7f8f8] p-1.5 rounded-md hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto pr-1 text-left flex-1">{children}</div>
      </div>
    </div>
  );
};
