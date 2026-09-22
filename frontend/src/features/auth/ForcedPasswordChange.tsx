import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import {
  Lock,
  Key,
  CheckCircle,
  Warning,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";

interface ForcedPasswordChangeProps {
  email: string;
}

export const ForcedPasswordChange: React.FC<ForcedPasswordChangeProps> = ({
  email,
}) => {
  const { changePassword, cancelPasswordChange } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Requirements checks
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === confirmPassword;
  const isValid =
    hasMinLength &&
    hasUppercase &&
    hasLowercase &&
    hasNumber &&
    passwordsMatch &&
    currentPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      if (!passwordsMatch) {
        setError("New passwords do not match");
      } else {
        setError("Please meet all password requirements");
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await changePassword(currentPassword, newPassword);
      toast.success(
        "Password updated",
        "Your new password has been set successfully.",
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to update password. Check your current password.";
      setError(message);
      toast.error("Password update failed", message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#08080a]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#f7f8f8] m-0">
            Onboard360
          </h1>
          <p className="text-[11px] text-[#8a8f98]">HR Onboarding Platform</p>
        </div>
      </div>

      {/* Password Reset Card */}
      <div className="w-full max-w-md bg-[#0f1013] border border-white/[0.08] rounded-xl p-7 sm:p-8 shadow-md text-left">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Lock size={18} weight="bold" />
          </div>
          <h2 className="text-xl font-medium text-[#f7f8f8] tracking-tight m-0">
            Set your workspace password
          </h2>
        </div>
        <p className="text-sm text-[#8a8f98] mb-6 leading-relaxed">
          Your account was provisioned with a temporary password. For security,
          please set your personal password before accessing the workspace.
        </p>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-xs text-[#f87171] leading-relaxed flex items-start gap-2">
            <Warning size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email address"
            type="email"
            value={email}
            disabled
            className="opacity-70 cursor-not-allowed bg-white/[0.02]"
          />

          <Input
            label="Current temporary password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter temporary password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <div className="relative">
            <Input
              label="New password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-[#8a8f98] hover:text-[#f7f8f8] transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <Input
            label="Confirm new password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {/* Requirements Checklist */}
          <div className="p-3.5 rounded-lg bg-[#14161a] border border-white/[0.06] text-xs flex flex-col gap-2 mt-1">
            <span className="text-[11px] font-medium text-[#8a8f98] uppercase tracking-wider">
              Password requirements
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div
                className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-400" : "text-[#62666d]"}`}
              >
                <CheckCircle
                  size={14}
                  weight={hasMinLength ? "fill" : "regular"}
                />
                <span>8+ characters</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${hasUppercase ? "text-emerald-400" : "text-[#62666d]"}`}
              >
                <CheckCircle
                  size={14}
                  weight={hasUppercase ? "fill" : "regular"}
                />
                <span>Uppercase letter</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${hasLowercase ? "text-emerald-400" : "text-[#62666d]"}`}
              >
                <CheckCircle
                  size={14}
                  weight={hasLowercase ? "fill" : "regular"}
                />
                <span>Lowercase letter</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-400" : "text-[#62666d]"}`}
              >
                <CheckCircle
                  size={14}
                  weight={hasNumber ? "fill" : "regular"}
                />
                <span>At least 1 number</span>
              </div>
            </div>
            {newPassword && confirmPassword && (
              <div
                className={`flex items-center gap-1.5 pt-1 border-t border-white/[0.04] text-[11px] ${passwordsMatch ? "text-emerald-400" : "text-rose-400"}`}
              >
                <CheckCircle
                  size={14}
                  weight={passwordsMatch ? "fill" : "regular"}
                />
                <span>
                  {passwordsMatch
                    ? "Passwords match"
                    : "Passwords do not match"}
                </span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            disabled={!isValid}
            className="w-full mt-2 flex items-center justify-center gap-2"
          >
            <Key size={16} weight="bold" />
            Set password & enter workspace
          </Button>

          <button
            type="button"
            onClick={cancelPasswordChange}
            className="w-full text-center text-xs text-[#8a8f98] hover:text-[#f7f8f8] py-1 transition-colors"
          >
            Cancel and return to sign in
          </button>
        </form>
      </div>
    </div>
  );
};
