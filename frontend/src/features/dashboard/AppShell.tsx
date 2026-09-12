import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../../components/common/Badge";
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
  Minus,
  ArrowsOut,
  X,
  Paperclip,
  ArrowUp,
  Circle,
  UsersIcon,
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
  const [isAssistantOpen, setIsAssistantOpen] = useState(true);
  const [isAssistantMinimized, setIsAssistantMinimized] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [isStarred, setIsStarred] = useState(true);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "hr_admin":
        return <Badge variant="white">HR Admin</Badge>;
      case "manager":
        return <Badge variant="purple">Manager</Badge>;
      case "employee":
      default:
        return <Badge variant="green">Employee</Badge>;
    }
  };

  const navItems = [
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

  // Current tab display title for Linear breadcrumb
  const currentTabName =
    navItems.find((item) => item.id === currentTab)?.label ||
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
              {navItems.map((item) => {
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onTabChange(item.id)}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm font-normal transition-colors cursor-pointer text-left ${
                      isActive
                        ? "bg-white/[0.03] text-white shadow-2xs font-medium"
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
            <div className="h-3 w-px bg-white/[0.08] mx-1"></div>
            <button
              type="button"
              onClick={() => setIsAssistantOpen(!isAssistantOpen)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                isAssistantOpen
                  ? "bg-white/[0.1] text-white"
                  : "hover:bg-white/[0.06] text-[#8a8f98]"
              }`}
            >
              <div className="text-indigo-400">
                <Sparkle size={14} weight="fill" />
              </div>
              <span className="hidden md:inline">Assistant</span>
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-7 md:p-8 text-left relative">
          {children}

          {/* Floating Linear Opus-style Assistant Panel (Matching Screenshot) */}
          {isAssistantOpen && (
            <aside
              className={`fixed bottom-4 right-4 z-40 w-80 sm:w-96 rounded-xl border border-white/[0.1] bg-[#0e0f14]/95 backdrop-blur-xl shadow-2xl transition-all duration-200 overflow-hidden flex flex-col ${
                isAssistantMinimized ? "h-10" : "max-h-[440px]"
              }`}
            >
              {/* Header */}
              <div className="h-10 px-3.5 border-b border-white/[0.08] flex items-center justify-between bg-[#111319]/80 select-none">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    Qorra
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[#8a8f98]">
                  <button
                    type="button"
                    onClick={() =>
                      setIsAssistantMinimized(!isAssistantMinimized)
                    }
                    className="p-1 hover:text-white rounded transition-colors cursor-pointer"
                    title={isAssistantMinimized ? "Expand" : "Minimize"}
                  >
                    <Minus size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIsAssistantMinimized(!isAssistantMinimized)
                    }
                    className="p-1 hover:text-white rounded transition-colors cursor-pointer"
                    title="Toggle size"
                  >
                    <ArrowsOut size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAssistantOpen(false)}
                    className="p-1 hover:text-white rounded transition-colors cursor-pointer"
                    title="Close assistant"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {!isAssistantMinimized && (
                <>
                  {/* Context & Updates Feed (Matching Linear reference) */}
                  <div className="p-3.5 space-y-3 overflow-y-auto text-xs text-[#d0d6e0] max-h-64 select-text">
                    <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs leading-relaxed text-[#f7f8f8]">
                      Onboarding snapshot active for your role. 4 checklist
                      items ready for review.
                    </div>

                    <div className="text-[11px] text-[#8a8f98] flex items-center gap-1.5">
                      <Circle
                        size={10}
                        className="text-amber-400"
                        weight="fill"
                      />
                      <span>ONB-104 synced with department template</span>
                    </div>

                    <div className="p-2 rounded-md bg-[#12141a] border border-white/[0.06] space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#f7f8f8] font-medium">
                          Changed 2 tasks
                        </span>
                        <span className="text-emerald-400 font-mono">
                          +12 -0
                        </span>
                      </div>
                      <div className="text-[11px] text-[#8a8f98] flex items-center gap-1">
                        <GitPullRequest size={12} />
                        <span>Ready for employee review</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Input (Matching Linear reference reply bar) */}
                  <div className="p-2.5 border-t border-white/[0.06] bg-[#0c0d12]">
                    <div className="flex items-center gap-2 bg-[#14161d] border border-white/[0.08] rounded-lg px-2.5 py-1.5 focus-within:border-white/30 transition-colors">
                      <input
                        type="text"
                        placeholder="Reply or ask Onboard Assistant..."
                        value={assistantInput}
                        onChange={(e) => setAssistantInput(e.target.value)}
                        className="bg-transparent text-xs text-[#f7f8f8] placeholder-[#5a5e6b] focus:outline-none flex-1"
                      />
                      <div className="flex items-center gap-1 text-[#8a8f98] shrink-0">
                        <span className="text-[10px] text-[#5a5e6b] px-1 hover:text-[#f7f8f8] cursor-pointer">
                          Skills ▾
                        </span>
                        <button
                          type="button"
                          className="p-1 hover:text-white transition-colors cursor-pointer"
                        >
                          <Paperclip size={13} />
                        </button>
                        <button
                          type="button"
                          className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 transition-colors cursor-pointer ml-0.5"
                        >
                          <ArrowUp size={11} weight="bold" />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </aside>
          )}
        </main>
      </div>
    </div>
  );
};
