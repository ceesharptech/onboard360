import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import {
  ShieldCheck,
  UserCircle,
  Briefcase,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid credentials";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoCredentials = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#08080a]">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[#f7f8f8] m-0">
            Onboard360
          </h1>
          <p className="text-[11px] text-[#8a8f98]">HR Onboarding Platform</p>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#0f1013] border border-white/[0.08] rounded-xl p-7 sm:p-8 shadow-2xl text-left">
        <h2 className="text-xl font-medium text-[#f7f8f8] tracking-tight mb-1.5">
          Welcome back
        </h2>
        <p className="text-sm text-[#8a8f98] mb-6">
          Sign in with your workspace credentials to access your onboarding
          dashboard.
        </p>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-xs text-[#f87171] leading-relaxed">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email address"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-[#8a8f98] hover:text-[#f7f8f8] transition-colors p-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="w-full mt-2"
          >
            Sign in
          </Button>
        </form>

        {/* Demo Fast Logins */}
        <div className="mt-8 pt-6 border-t border-white/[0.06]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#62666d] block mb-3">
            Quick demo sign-in
          </span>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() =>
                setDemoCredentials("admin@acme.com", "AdminPassword123!")
              }
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#14161a] hover:bg-[#181a20] border border-white/[0.06] hover:border-white/[0.14] text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 text-[#f7f8f8]">
                <ShieldCheck size={16} className="text-purple-400" />
                <span className="font-medium">HR Admin</span>
                <span className="text-[#8a8f98] text-[11px]">
                  (admin@acme.com)
                </span>
              </div>
              <span className="text-[11px] text-white/70 font-medium">
                Auto-fill
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setDemoCredentials("manager.eng@acme.com", "Password123!")
              }
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#14161a] hover:bg-[#181a20] border border-white/[0.06] hover:border-white/[0.14] text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 text-[#f7f8f8]">
                <Briefcase size={16} className="text-amber-400" />
                <span className="font-medium">Engineering Manager</span>
                <span className="text-[#8a8f98] text-[11px]">
                  (manager.eng@acme.com)
                </span>
              </div>
              <span className="text-[11px] text-white/70 font-medium">
                Auto-fill
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setDemoCredentials("mentor.alex@acme.com", "Password123!")
              }
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#14161a] hover:bg-[#181a20] border border-white/[0.06] hover:border-white/[0.14] text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 text-[#f7f8f8]">
                <UserCircle size={16} className="text-emerald-400" />
                <span className="font-medium">Employee / Mentor</span>
                <span className="text-[#8a8f98] text-[11px]">
                  (mentor.alex@acme.com)
                </span>
              </div>
              <span className="text-[11px] text-white/70 font-medium">
                Auto-fill
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
