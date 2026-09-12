import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  SignOut,
  Sparkle,
  Kanban,
  UsersThree,
  GitFork,
  Buildings,
  AddressBook,
} from '@phosphor-icons/react';

export interface AppShellProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { user, logout } = useAuth();

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'hr_admin':
        return <Badge variant="blue">HR Admin</Badge>;
      case 'manager':
        return <Badge variant="purple">Manager</Badge>;
      case 'employee':
      default:
        return <Badge variant="green">Employee</Badge>;
    }
  };

  const navItems = [
    ...(user?.role === 'employee'
      ? [
          {
            id: 'my-onboarding',
            label: 'My Onboarding',
            icon: <Kanban size={18} />,
          },
        ]
      : []),
    ...(user?.role === 'manager'
      ? [
          {
            id: 'team-roster',
            label: 'Team Roster',
            icon: <UsersThree size={18} />,
          },
          {
            id: 'templates',
            label: 'Department Templates',
            icon: <GitFork size={18} />,
          },
        ]
      : []),
    ...(user?.role === 'hr_admin'
      ? [
          {
            id: 'employees',
            label: 'Employees',
            icon: <AddressBook size={18} />,
          },
          {
            id: 'templates',
            label: 'Workflow Templates',
            icon: <GitFork size={18} />,
          },
          {
            id: 'departments',
            label: 'Departments & Mentors',
            icon: <Buildings size={18} />,
          },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen w-full bg-[#010102] text-[#f7f8f8] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#08090a] border-r border-[#23252a] flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Workspace Title */}
          <div className="p-4 border-b border-[#23252a] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#5e6ad2] flex items-center justify-center text-white shadow-sm">
                <Sparkle weight="fill" size={16} />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-bold text-[#f7f8f8] tracking-tight leading-none mb-1">
                  Acme Onboard
                </h2>
                <span className="text-[11px] text-[#8a8f98]">v1.0 Workspace</span>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="p-3">
            <span className="px-3 text-[11px] font-semibold text-[#62666d] uppercase tracking-wider block mb-2 text-left">
              Navigation
            </span>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left ${
                      isActive
                        ? 'bg-[#141516] text-[#f7f8f8] border border-[#23252a]'
                        : 'text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-[#0f1011]'
                    }`}
                  >
                    <span className={isActive ? 'text-[#5e6ad2]' : 'text-[#62666d]'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* User Profile Footer */}
        <div className="p-3 border-t border-[#23252a] bg-[#08090a]">
          <div className="flex items-center justify-between mb-3 px-1 text-left">
            <div className="flex flex-col max-w-[140px] overflow-hidden">
              <span className="text-xs font-semibold text-[#f7f8f8] truncate">{user?.email}</span>
              <div className="mt-1">{getRoleBadge(user?.role)}</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<SignOut size={16} />}
              onClick={logout}
              title="Sign out"
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#010102]">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 text-left">{children}</div>
      </main>
    </div>
  );
};
