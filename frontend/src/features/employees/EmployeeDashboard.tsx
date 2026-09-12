import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import type { Employee, EmployeeTask } from "../../api/endpoints";
import { employeeApi } from "../../api/endpoints";
import { Card } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import {
  Clock,
  UserCircle,
  CalendarBlank,
  WarningCircle,
  Check,
} from "@phosphor-icons/react";

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await employeeApi.list();
        if (isMounted) {
          if (res && res.length > 0) {
            const fullEmployee = await employeeApi.getOne(res[0].id);
            if (isMounted) setEmployee(fullEmployee);
          } else {
            setEmployee(null);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load onboarding roadmap",
          );
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleTask = async (task: EmployeeTask) => {
    if (!employee) return;
    const newStatus = task.status === "completed" ? "pending" : "completed";

    // Optimistic update
    const updatedTasks = (employee.tasks || []).map((t) =>
      t.id === task.id
        ? {
            ...t,
            status: newStatus as "pending" | "in_progress" | "completed",
            completedAt:
              newStatus === "completed" ? new Date().toISOString() : null,
          }
        : t,
    );
    const total = updatedTasks.length;
    const completed = updatedTasks.filter(
      (t) => t.status === "completed",
    ).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    setEmployee({
      ...employee,
      tasks: updatedTasks,
      progress: {
        totalTasks: total,
        completedTasks: completed,
        percentComplete: percent,
        overdueTasks: employee.progress?.overdueTasks || 0,
      },
    });

    try {
      await employeeApi.updateTask(employee.id, task.id, { status: newStatus });
      const refreshed = await employeeApi.getOne(employee.id);
      setEmployee(refreshed);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update task status",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8a8f98]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-xs font-medium text-[#a0a6b5]">
            Loading onboarding roadmap...
          </span>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <Card className="p-8">
          <h2 className="text-xl font-semibold text-[#f7f8f8] mb-2">
            No Onboarding Record Found
          </h2>
          <p className="text-sm text-[#8a8f98] mb-4">
            Your user account ({user?.email}) is not yet linked to an active
            employee onboarding record.
          </p>
          <p className="text-xs text-[#62666d]">
            Please reach out to your HR Administrator to initiate your
            onboarding checklist.
          </p>
        </Card>
      </div>
    );
  }

  // Group tasks by category
  const categories: Record<string, EmployeeTask[]> = {};
  (employee.tasks || []).forEach((task) => {
    if (!categories[task.category]) {
      categories[task.category] = [];
    }
    categories[task.category].push(task);
  });

  const percent = employee.progress?.percentComplete ?? 0;
  const completedCount = employee.progress?.completedTasks ?? 0;
  const totalCount = employee.progress?.totalTasks ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-7">
      {/* Linear Issue / Roadmap Header View (Matching Reference Screenshot) */}
      <div className="space-y-3 pb-6 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                ONB-{employee.id.slice(0, 4).toUpperCase()}
              </span>
              <Badge variant="white">{employee.jobRole}</Badge>
              <Badge variant="green">In Progress</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f7f8f8] m-0">
              Welcome, {employee.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#8a8f98] max-w-2xl leading-relaxed">
              Complete your initial onboarding roadmap before{" "}
              <span className="bg-[#181a20] px-1.5 py-0.5 rounded font-mono text-xs text-[#d0d6e0] border border-white/[0.06]">
                start_date
              </span>{" "}
              sync to ensure all system credentials, hardware, and team
              introductions are in place.
            </p>
          </div>

          {/* Properties Block (Linear Right-Hand Meta Style) */}
          <div className="flex items-center gap-3 bg-[#0f1013] border border-white/[0.06] rounded-lg p-3 shrink-0">
            {employee.mentor ? (
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-8 h-8 rounded-full bg-white/[0.08] text-white flex items-center justify-center text-xs font-bold border border-white/[0.08]">
                  {employee.mentor.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="text-[10px] text-[#5a5e6b] uppercase tracking-wider block font-semibold">
                    Assigned Mentor
                  </span>
                  <span className="text-xs text-[#f7f8f8] font-medium block">
                    {employee.mentor.email}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#8a8f98]">
                <span className="text-[10px] text-[#5a5e6b] uppercase tracking-wider block">
                  Department
                </span>
                <span className="text-[#f7f8f8] font-medium">
                  {employee.department.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Start Date & Department Meta Row */}
        <div className="flex items-center gap-4 text-xs text-[#8a8f98] pt-1">
          <span className="flex items-center gap-1.5">
            <CalendarBlank size={14} className="text-[#5a5e6b]" />
            Started: {new Date(employee.startDate).toLocaleDateString()}
          </span>
          <span className="text-[#5a5e6b]">•</span>
          <span>{employee.department.name} Department</span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Progress Overview Card (Linear Flat Bar with White/Emerald Accents) */}
      <div className="bg-[#0f1013] border border-white/[0.06] rounded-xl p-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#f7f8f8]">
              Roadmap Progress
            </span>
            <span className="text-[11px] text-[#8a8f98]">
              ({completedCount} of {totalCount} items finished)
            </span>
          </div>
          <span className="text-base font-bold font-mono text-white">
            {percent}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-300 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>

        {employee.progress && employee.progress.overdueTasks > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-400">
            <WarningCircle size={14} />
            <span>
              {employee.progress.overdueTasks} task(s) past scheduled due date
            </span>
          </div>
        )}
      </div>

      {/* Categorized Task Roadmap (Activity Timeline Style Matching Linear Screenshot) */}
      <div className="space-y-6">
        {Object.entries(categories).map(([category, tasks]) => (
          <div key={category} className="space-y-2.5">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-tight text-[#f7f8f8]">
                  {category}
                </span>
                <span className="text-[11px] font-mono text-[#5a5e6b]">
                  ({tasks.length})
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {tasks.map((task) => {
                const isCompleted = task.status === "completed";
                const isOverdue =
                  !isCompleted &&
                  task.dueDate &&
                  new Date(task.dueDate) < new Date();

                return (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task)}
                    className={`flex items-start justify-between p-3 rounded-lg border transition-all cursor-pointer group select-none ${
                      isCompleted
                        ? "bg-[#0b0c0f]/60 border-white/[0.03] opacity-65"
                        : "bg-[#0f1013] border-white/[0.06] hover:border-white/[0.12] hover:bg-[#13151a]"
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Linear Status Checkbox Glyph */}
                      <button
                        type="button"
                        className={`mt-0.5 w-4.5 h-4.5 rounded-md flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          isCompleted
                            ? "bg-emerald-500 text-black"
                            : "border border-white/[0.15] group-hover:border-white/40 bg-white/[0.02]"
                        }`}
                      >
                        {isCompleted && <Check size={11} weight="bold" />}
                      </button>

                      <div className="space-y-0.5 flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-[#5a5e6b] bg-white/[0.04] px-1.5 py-0.2 rounded border border-white/[0.04]">
                            ONB-{task.orderIndex + 1}
                          </span>
                          <h4
                            className={`text-xs sm:text-sm font-medium tracking-tight m-0 truncate ${
                              isCompleted
                                ? "line-through text-[#5a5e6b]"
                                : "text-[#f7f8f8]"
                            }`}
                          >
                            {task.title}
                          </h4>
                        </div>
                        {task.description && (
                          <p className="text-xs text-[#8a8f98] line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 ml-2">
                      {task.dueDate && (
                        <span
                          className={`text-[11px] font-mono flex items-center gap-1 ${
                            isOverdue
                              ? "text-amber-400 font-medium"
                              : "text-[#8a8f98]"
                          }`}
                        >
                          <Clock size={12} />
                          {new Date(task.dueDate).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                      )}

                      <Badge
                        variant={
                          task.assigneeType === "manager"
                            ? "purple"
                            : task.assigneeType === "mentor"
                              ? "orange"
                              : "gray"
                        }
                      >
                        {task.assigneeType}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
