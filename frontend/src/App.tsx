import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './features/dashboard/AppShell';
import { EmployeeDashboard } from './features/employees/EmployeeDashboard';
import { ManagerDashboard } from './features/manager/ManagerDashboard';
import { HrAdminDashboard } from './features/admin/HrAdminDashboard';
import { TemplateBuilder } from './features/templates/TemplateBuilder';

const MainApp: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('default');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080a] flex items-center justify-center text-[#8a8f98]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-xs font-medium tracking-wide text-[#a0a6b5]">Initializing workspace...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  // Determine current tab default based on role if default
  const resolvedTab =
    activeTab === 'default'
      ? user.role === 'employee'
        ? 'my-onboarding'
        : user.role === 'manager'
        ? 'team-roster'
        : 'employees'
      : activeTab;

  return (
    <AppShell currentTab={resolvedTab} onTabChange={setActiveTab}>
      {/* Employee View */}
      {user.role === 'employee' && <EmployeeDashboard />}

      {/* Manager View */}
      {user.role === 'manager' && (
        <>
          {resolvedTab === 'team-roster' && (
            <ManagerDashboard onNavigateToTemplates={() => setActiveTab('templates')} />
          )}
          {resolvedTab === 'templates' && <TemplateBuilder />}
        </>
      )}

      {/* HR Admin View */}
      {user.role === 'hr_admin' && (
        <>
          {resolvedTab === 'employees' && <HrAdminDashboard initialTab="employees" />}
          {resolvedTab === 'departments' && <HrAdminDashboard initialTab="departments" />}
          {resolvedTab === 'templates' && <TemplateBuilder />}
        </>
      )}
    </AppShell>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
