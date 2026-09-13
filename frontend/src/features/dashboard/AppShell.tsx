import React from "react";
import { useAuth } from "../../context/AuthContext";
import {
  SignOut,
  Sparkle,
  Kanban,
  UsersThree,
  GitFork,
  Buildings,
  MagnifyingGlass,
  CaretDown,
  LinkSimple,
  Copy,
  GitPullRequest,
  UsersIcon,
  FileText,
} from "@phosphor-icons/react";

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

  const workspaceNavItems = [
    ...(user?.role === "employee"
      ? [
          {
            id: "my-onboarding",
            label: "My Onboarding",
            icon: <Kanban size={16} />,
            badge: "Active",
          },
        ]
      : []),
    ...(user?.role === "manager"
      ? [
          {
            id: "team-roster",
            label: "Team Roster",
            icon: <UsersThree size={16} />,
            badge: "Team",
          },
          {
            id: "templates",
            label: "Department Templates",
            icon: <GitFork size={16} />,
          },
        ]
      : []),
    ...(user?.role === "hr_admin"
      ? [
          {
            id: "employees",
            label: "Employees",
            icon: <UsersIcon size={16} />,
          },
          {
            id: "templates",
            label: "Workflow Templates",
            icon: <GitFork size={16} />,
          },
          {
            id: "departments",
            label: "Departments & Mentors",
            icon: <Buildings size={16} />,
          },
        ]
      : []),
  ];

  const companyAiNavItems = [
    ...(user?.role === "hr_admin"
      ? [
          {
            id: "documents",
            label: "Knowledge Base",
            icon: <FileText size={16} />,
          },
        ]
      : []),
    {
      id: "qorra",
      label: "Qorra",
      icon: <Sparkle size={16} weight="fill" className="text-indigo-400" />,
      badge: "AI",
    },
  ];

  const allNavItems = [...workspaceNavItems, ...companyAiNavItems];

  // Current tab display title for Linear breadcrumb
  const currentTabName =
    currentTab === "qorra"
      ? "Qorra AI Assistant"
      : currentTab === "documents"
      ? "Company Knowledge Base"
      : allNavItems.find((item) => item.id === currentTab)?.label ||
        "Onboarding Workspace";

  return (
    <div className="flex h-screen w-full bg-[#08080a] text-[#f7f8f8] overflow-hidden font-sans select-none">
      {/* Linear Left Sidebar */}
      <aside className="w-60 bg-[#08080a] border-r border-white/[0.03] px-1 flex flex-col justify-between shrink-0 select-none">
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Workspace Switcher Header (Matching Linear Screenshot) */}
          <div className="h-12 px-3.5  flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-2 text-left p-1.5 rounded-md transition-colors -ml-1 text-sm font-semibold tracking-tight"
            >
              <div className="w-5 h-5 rounded-full bg-linear-to-l from-white to-neutral-500 shadow-xs"></div>
              <span className="text-[#f7f8f8] font-medium text-xs sm:text-base">
                Onboard360
              </span>
              {/* <CaretDown size={11} className="text-[#8a8f98]" /> */}
            </button>

            <div className="flex items-center gap-0.5 text-[#8a8f98]">
              <button
                type="button"
                className="p-1 hover:text-[#f7f8f8] hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
                title="Search (⌘K)"
              >
                <MagnifyingGlass size={15} />
              </button>
              {/* <button
                type="button"
                className="p-1 hover:text-[#f7f8f8] hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
                title="New onboarding draft"
              >
                <PencilSimpleLine size={15} />
              </button> */}
            </div>
          </div>

          {/* Quick Access Items */}
          {/* <div className="p-2 space-y-0.5">
            <button
              type="button"
              onClick={() => onTabChange(navItems[0]?.id || currentTab)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Lightning size={15} className="text-[#8a8f98]" />
              <span className="flex-1">Pulse</span>
            </button>
            <button
              type="button"
              onClick={() => onTabChange(navItems[0]?.id || currentTab)}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
            >
              <Tray size={15} className="text-[#8a8f98]" />
              <span className="flex-1">Inbox</span>
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            </button>
          </div> */}

          {/* Workspace Navigation Section */}
          <div className="px-2 pt-2">
            <div className="px-2.5 py-1 text-sm font-medium text-[#5a5e6b] flex items-center justify-between tracking-tight">
              <span>Workspace</span>
              <CaretDown size={10} />
            </div>

            <nav className="flex flex-col gap-2 mt-0.5">
              {workspaceNavItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm font-normal transition-colors cursor-pointer text-left ${
                      isActive
                        ? "bg-white/[0.08] text-white shadow-2xs font-medium"
                        : "text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className={isActive ? "text-white" : "text-[#8a8f98]"}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.08] text-[#d0d6e0]">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Company AI Navigation Section */}
          <div className="px-2 pt-4">
            <div className="px-2.5 py-1 text-sm font-medium text-[#5a5e6b] flex items-center justify-between tracking-tight">
              <span>Company AI</span>
              <CaretDown size={10} />
            </div>

            <nav className="flex flex-col gap-1 mt-0.5">
              {companyAiNavItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm font-normal transition-colors cursor-pointer text-left ${
                      isActive
                        ? "bg-white/[0.08] text-white shadow-2xs font-medium"
                        : "text-[#8a8f98] hover:text-[#f7f8f8] hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className={isActive ? "text-white" : "text-[#8a8f98]"}
                    >
                      {item.icon}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Favorites Section (Matching Linear Screenshot) */}
          {/* <div className="px-2 pt-4">
            <div className="px-2.5 py-1 text-[11px] font-medium text-[#5a5e6b] flex items-center justify-between uppercase tracking-wider">
              <span>Favorites</span>
              <CaretDown size={10} />
            </div>

            <div className="flex flex-col gap-0.5 mt-0.5 text-xs text-[#8a8f98]">
              <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-white/[0.04] hover:text-[#f7f8f8] cursor-pointer transition-colors">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="truncate">Engineering Track</span>
              </div>
              <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-white/[0.04] hover:text-[#f7f8f8] cursor-pointer transition-colors">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="truncate">Workspace Setup</span>
              </div>
              <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-white/[0.04] hover:text-[#f7f8f8] cursor-pointer transition-colors">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span className="truncate">Company Policies</span>
              </div>
            </div>
          </div> */}
        </div>

        {/* User Profile Footer */}
        <div className="p-2.5 bg-[#08080a]">
          <div className="flex items-center justify-between p-1.5 rounded-md transition-colors">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-white/[0.1] text-white flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/[0.08]">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-sm text-[#f7f8f8] font-medium truncate leading-tight">
                  {user?.email?.split("@")[0]}
                </span>
                <span className="text-[10px] text-[#8a8f98] capitalize">
                  {user?.role?.replace("_", " ")}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              className="text-[#8a8f98] hover:text-red-400 p-2 rounded hover:bg-red-300/[0.08] transition-colors cursor-pointer"
            >
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container Area with Linear Top Header Bar */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#090a0c]">
        {/* Top Breadcrumb & Actions Bar (Matching Linear Screenshot) */}
        <header className="h-12 border-b border-white/[0.06] bg-[#090a0c] flex items-center justify-between px-4 sm:px-6 shrink-0 text-xs select-none">
          {/* Left: Breadcrumbs */}
          <div className="flex items-center gap-2.5">
            <span className="text-[#d0d6e0] text-sm font-medium truncate max-w-[280px]">
              {currentTabName}
            </span>
            {/* <button
              type="button"
              onClick={() => setIsStarred(!isStarred)}
              className="p-1 text-[#8a8f98] hover:text-amber-400 transition-colors cursor-pointer"
              title="Star view"
            >
              <Star
                size={13}
                weight={isStarred ? "fill" : "regular"}
                className={isStarred ? "text-amber-400" : ""}
              />
            </button> */}
            {/* <button
              type="button"
              className="p-1 text-[#8a8f98] hover:text-white transition-colors cursor-pointer"
            >
              <DotsThreeIcon size={14} weight="bold" />
            </button> */}
          </div>

          {/* Right: Quick Tools */}
          <div className="flex items-center gap-1.5 text-[#8a8f98]">
            {/* <span className="text-[11px] text-[#5a5e6b] px-2 hidden sm:inline">
              1 / 1
            </span> */}
            <button
              type="button"
              className="p-1.5 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
              title="Copy view link"
            >
              <LinkSimple size={14} />
            </button>
            <button
              type="button"
              className="p-1.5 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
              title="Duplicate reference"
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              className="p-1.5 hover:text-white hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
              title="Branch / Activity"
            >
              <GitPullRequest size={14} />
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-7 md:p-8 text-left relative">
          {children}
        </main>
      </div>
    </div>
  );
};
