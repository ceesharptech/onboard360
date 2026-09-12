import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Sparkle, ShieldCheck, UserCircle, Briefcase } from '@phosphor-icons/react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid credentials';
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#010102]">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-lg bg-[#5e6ad2] flex items-center justify-center text-white shadow-sm">
          <Sparkle weight="fill" size={20} />
        </div>
        <div className="text-left">
          <h1 className="text-xl font-bold tracking-tight text-[#f7f8f8] m-0">Onboard360</h1>
          <p className="text-xs text-[#8a8f98]">HR Onboarding Platform</p>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#0f1011] border border-[#23252a] rounded-2xl p-8 shadow-2xl text-left">
        <h2 className="text-2xl font-bold text-[#f7f8f8] tracking-tight mb-2">Welcome back</h2>
        <p className="text-sm text-[#8a8f98] mb-6">
          Sign in with your workspace credentials to access your onboarding dashboard.
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

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

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
        <div className="mt-8 pt-6 border-t border-[#23252a]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#62666d] block mb-3">
            Quick demo sign-in
          </span>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setDemoCredentials('admin@acme.com', 'AdminPassword123!')}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#23252a] hover:border-[#34343a] text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 text-[#f7f8f8]">
                <ShieldCheck size={16} className="text-[#828fff]" />
                <span className="font-medium">HR Admin</span>
                <span className="text-[#8a8f98]">(admin@acme.com)</span>
              </div>
              <span className="text-[11px] text-[#828fff]">Auto-fill</span>
            </button>

            <button
              type="button"
              onClick={() => setDemoCredentials('manager.eng@acme.com', 'Password123!')}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#23252a] hover:border-[#34343a] text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 text-[#f7f8f8]">
                <Briefcase size={16} className="text-[#a5abdf]" />
                <span className="font-medium">Engineering Manager</span>
                <span className="text-[#8a8f98]">(manager.eng@acme.com)</span>
              </div>
              <span className="text-[11px] text-[#828fff]">Auto-fill</span>
            </button>

            <button
              type="button"
              onClick={() => setDemoCredentials('mentor.alex@acme.com', 'Password123!')}
              className="flex items-center justify-between p-2.5 rounded-lg bg-[#141516] hover:bg-[#18191a] border border-[#23252a] hover:border-[#34343a] text-xs text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 text-[#f7f8f8]">
                <UserCircle size={16} className="text-[#27a644]" />
                <span className="font-medium">Employee / Mentor</span>
                <span className="text-[#8a8f98]">(mentor.alex@acme.com)</span>
              </div>
              <span className="text-[11px] text-[#828fff]">Auto-fill</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
