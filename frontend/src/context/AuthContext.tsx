import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../api/endpoints';
import { authApi } from '../api/endpoints';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  pendingPasswordChange: { email: string } | null;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean; email?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  cancelPasswordChange: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user_profile');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [pendingPasswordChange, setPendingPasswordChange] = useState<{ email: string } | null>(() => {
    const saved = sessionStorage.getItem('pending_password_change');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleLogoutEvent = () => {
      setUser(null);
      setPendingPasswordChange(null);
      localStorage.removeItem('user_profile');
      sessionStorage.removeItem('pending_password_change');
    };

    window.addEventListener('auth:logout', handleLogoutEvent);
    setLoading(false);

    return () => {
      window.removeEventListener('auth:logout', handleLogoutEvent);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password);

    if (data.mustChangePassword) {
      const pending = { email: data.email || email };
      setPendingPasswordChange(pending);
      sessionStorage.setItem('pending_password_change', JSON.stringify(pending));
      return { mustChangePassword: true, email: pending.email };
    }

    if (data.accessToken && data.refreshToken && data.user) {
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('user_profile', JSON.stringify(data.user));
      sessionStorage.removeItem('pending_password_change');
      setPendingPasswordChange(null);
      setUser(data.user);
    }

    return { mustChangePassword: false };
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!pendingPasswordChange?.email) {
      throw new Error('No pending password change session found');
    }

    const data = await authApi.changePassword(pendingPasswordChange.email, currentPassword, newPassword);
    localStorage.setItem('access_token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    localStorage.setItem('user_profile', JSON.stringify(data.user));
    sessionStorage.removeItem('pending_password_change');
    setPendingPasswordChange(null);
    setUser(data.user);
  };

  const cancelPasswordChange = () => {
    setPendingPasswordChange(null);
    sessionStorage.removeItem('pending_password_change');
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch (err) {
        console.error('Logout failed:', err);
      }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_profile');
    sessionStorage.removeItem('pending_password_change');
    setPendingPasswordChange(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user && localStorage.getItem('access_token')),
        loading,
        pendingPasswordChange,
        login,
        changePassword,
        cancelPasswordChange,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
