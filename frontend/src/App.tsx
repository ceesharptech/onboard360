import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LoginPage } from './features/auth/LoginPage';
import { ForcedPasswordChange } from './features/auth/ForcedPasswordChange';
import { AppShell } from './features/dashboard/AppShell';
import { EmployeeDashboard } from './features/employees/EmployeeDashboard';
import { ManagerDashboard } from './features/manager/ManagerDashboard';
import { HrAdminDashboard } from './features/admin/HrAdminDashboard';
import { TemplateBuilder } from './features/templates/TemplateBuilder';
import { DocumentManager } from './features/documents/DocumentManager';
import { DocumentLibrary } from './features/library/DocumentLibrary';
import { TrainingLibrary } from './features/training/TrainingLibrary';
import { QorraChat } from './features/assistant/QorraChat';

const getDefaultTabForRole = (role?: string) => {
  switch (role) {
    case 'employee':
      return 'my-onboarding';
    case 'manager':
      return 'team-roster';
    case 'hr_admin':
      return 'employees';
    default:
      return 'my-onboarding';
  }
};

const getValidTabsForRole = (role?: string) => {
  switch (role) {
    case 'employee':
      return ['my-onboarding', 'library', 'training', 'qorra'];
    case 'manager':
      return ['team-roster', 'templates', 'library', 'training', 'qorra'];
    case 'hr_admin':
      return ['employees', 'templates', 'departments', 'library', 'training', 'documents', 'qorra'];
    default:
      return [];
  }
};

const MainApp: React.FC = () => {
  const { user, isAuthenticated, loading, pendingPasswordChange } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('default');

  // Reset to default tab whenever user logs in or switches
  useEffect(() => {
    if (user) {
      setActiveTab(getDefaultTabForRole(user.role));
    }
  }, [user?.id, user?.role]);

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

  // Mandatory forced password change interceptor
  if (pendingPasswordChange) {
    return <ForcedPasswordChange email={pendingPasswordChange.email} />;
  }

  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  // Determine current tab default based on role: validate activeTab belongs to role
  const resolvedTab =
    user && getValidTabsForRole(user.role).includes(activeTab)
      ? activeTab
      : getDefaultTabForRole(user?.role);

  return (
    <AppShell currentTab={resolvedTab} onTabChange={setActiveTab}>
      {/* Global Company AI & Content Tabs (Accessible across roles) */}
      {resolvedTab === 'qorra' && <QorraChat />}
      {resolvedTab === 'documents' && <DocumentManager />}
      {resolvedTab === 'library' && <DocumentLibrary />}
      {resolvedTab === 'training' && <TrainingLibrary />}

      {/* Employee View */}
      {user.role === 'employee' && resolvedTab === 'my-onboarding' && <EmployeeDashboard />}

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
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}
