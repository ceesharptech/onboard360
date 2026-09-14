import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import type { Employee, EmployeeTask, MyMenteeResponse } from "../../api/endpoints";
import { employeeApi } from "../../api/endpoints";
import { useToast } from "../../context/ToastContext";
import { Card } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { Button } from "../../components/common/Button";
import {
  Clock,
  CalendarBlank,
  WarningCircle,
  Check,
  Users,
  CheckSquare,
  Square,
  ArrowSquareOut,
  CheckCircle,
  Link as LinkIcon,
} from "@phosphor-icons/react";

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"roadmap" | "mentees">("roadmap");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [menteeData, setMenteeData] = useState<MyMenteeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mentee Full Roadmap Modal
  const [selectedMenteeRoadmap, setSelectedMenteeRoadmap] = useState<Employee | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [empList, mentees] = await Promise.all([
        employeeApi.list(),
        employeeApi.getMyMentees().catch(() => null),
      ]);

      if (empList && empList.length > 0) {
        const fullEmployee = await employeeApi.getOne(empList[0].id);
        setEmployee(fullEmployee);
      } else {
        setEmployee(null);
      }

      setMenteeData(mentees);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load onboarding roadmap",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
            completedAt: newStatus === "completed" ? new Date().toISOString() : null,
          }
        : t,
    );
    const total = updatedTasks.length;
    const completed = updatedTasks.filter((t) => t.status === "completed").length;
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
      toast.success(
        newStatus === "completed" ? "Task completed" : "Task reopened",
        task.title
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update task status";
      setError(msg);
      toast.error("Failed to update task", msg);
      loadData();
    }
  };

  const handleToggleMentorTask = async (
    menteeId: string,
    taskId: string,
    currentStatus: "pending" | "in_progress" | "completed"
  ) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await employeeApi.updateTask(menteeId, taskId, { status: nextStatus });
      const updatedMentees = await employeeApi.getMyMentees();
      setMenteeData(updatedMentees);

      if (selectedMenteeRoadmap && selectedMenteeRoadmap.id === menteeId) {
        const refreshed = updatedMentees.mentees.find((m) => m.id === menteeId);
        if (refreshed) {
          setSelectedMenteeRoadmap(refreshed as unknown as Employee);
        }
      }
      toast.success(
        nextStatus === "completed" ? "Mentee task completed" : "Mentee task reopened",
        "Updated task status for mentee"
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update mentee task status";
      setError(msg);
      toast.error("Update failed", msg);
    }
  };

  const handleOpenMenteeRoadmap = (menteeId: string) => {
    const targetMentee = menteeData?.mentees.find((m) => m.id === menteeId);
    if (targetMentee) {
      setSelectedMenteeRoadmap(targetMentee as unknown as Employee);
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

  if (!employee && (!menteeData || menteeData.mentees.length === 0)) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <Card className="p-8">
          <h2 className="text-xl font-semibold text-[#f7f8f8] mb-2">
            No Onboarding Record Found
          </h2>
          <p className="text-sm text-[#8a8f98] mb-4">
            Your user account ({user?.email}) is not yet linked to an active employee onboarding record.
          </p>
          <p className="text-xs text-[#62666d]">
            Please reach out to your HR Administrator to initiate your onboarding checklist.
          </p>
        </Card>
      </div>
    );
  }

  // Group tasks by category
  const categories: Record<string, EmployeeTask[]> = {};
  (employee?.tasks || []).forEach((task) => {
    if (!categories[task.category]) {
      categories[task.category] = [];
    }
    categories[task.category].push(task);
  });

  const percent = employee?.progress?.percentComplete ?? 0;
  const completedCount = employee?.progress?.completedTasks ?? 0;
  const totalCount = employee?.progress?.totalTasks ?? 0;
  const hasMentees = Boolean(menteeData?.isMentor && menteeData.mentees.length > 0);

  return (
    <div className="max-w-5xl mx-auto space-y-7">
      {/* Tabs if Employee is also an Active Mentor */}
      {hasMentees && (
        <div className="flex items-center gap-2 pb-1 border-b border-white/[0.06]">
          <button
            onClick={() => setActiveTab("roadmap")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "roadmap"
                ? "bg-white/[0.08] text-white border-white/[0.15] shadow-xs"
                : "border-transparent text-[#8a8f98] hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <span>My Onboarding Roadmap</span>
          </button>

          <button
            onClick={() => setActiveTab("mentees")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "mentees"
                ? "bg-white/[0.08] text-white border-white/[0.15] shadow-xs"
                : "border-transparent text-[#8a8f98] hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <Users size={14} />
            <span>My Mentees ({menteeData?.mentees.length})</span>
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {activeTab === "roadmap" && employee ? (
        <>
          {/* Header */}
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
                  Complete your initial onboarding roadmap before sync to ensure all system credentials, hardware, and team introductions are in place.
                </p>
              </div>

              {/* Mentor Meta Block */}
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

          {/* Progress Overview Card */}
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

          {/* Categorized Task Roadmap */}
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
                                  isCompleted ? "line-through text-[#5a5e6b]" : "text-[#f7f8f8]"
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
                          {/* Optional Task Link Button (Fix 3 Requirement) */}
                          {task.taskUrl && (
                            <a
                              href={task.taskUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded text-[#8a8f98] hover:text-white hover:bg-white/[0.08] transition-colors"
                              title="Open task link in new tab"
                            >
                              <LinkIcon size={14} />
                            </a>
                          )}

                          {task.dueDate && (
                            <span
                              className={`text-[11px] font-mono flex items-center gap-1 ${
                                isOverdue ? "text-amber-400 font-medium" : "text-[#8a8f98]"
                              }`}
                            >
                              <Clock size={12} />
                              {new Date(task.dueDate).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
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
        </>
      ) : activeTab === "mentees" && menteeData ? (
        /* My Mentees View for Employee as Mentor (Fix 2 Requirement) */
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight m-0">
              My Assigned Mentees
            </h2>
            <p className="text-xs text-[#8a8f98] mt-1">
              Guide your mentees through their onboarding, complete your mentor tasks, and review their progress.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menteeData.mentees.map((mentee) => {
              const menteePercent = mentee.progress?.percentComplete ?? 0;
              const completed = mentee.progress?.completedTasks ?? 0;
              const total = mentee.progress?.totalTasks ?? 0;

              return (
                <div
                  key={mentee.id}
                  className="bg-[#0f1013] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/[0.06]">
                      <div>
                        <h3 className="font-semibold text-white text-sm m-0">{mentee.name}</h3>
                        <div className="text-[11px] text-[#8a8f98] mt-0.5">{mentee.jobRole} • {mentee.department.name}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenMenteeRoadmap(mentee.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-white/90 text-xs border border-white/[0.08] transition-colors cursor-pointer"
                      >
                        <span>Full Roadmap</span>
                        <ArrowSquareOut size={12} />
                      </button>
                    </div>

                    {/* Mentee Overall Progress */}
                    <div className="mt-3.5 mb-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-[#8a8f98]">Overall Onboarding Progress</span>
                        <span className="font-semibold text-emerald-400 font-mono">{menteePercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${menteePercent}%` }} />
                      </div>
                      <div className="text-[10px] text-[#62666d] mt-1">{completed} of {total} tasks complete</div>
                    </div>

                    {/* Mentor Tasks for this Mentee */}
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8f98] block mb-2">
                        Tasks Assigned to You as Mentor ({mentee.mentorTasks.length})
                      </span>

                      {mentee.mentorTasks.length === 0 ? (
                        <p className="text-xs text-[#62666d] py-2">No mentor-specific tasks in this mentee's plan.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {mentee.mentorTasks.map((t) => {
                            const isTaskDone = t.status === "completed";

                            return (
                              <div
                                key={t.id}
                                className="p-2.5 rounded-lg bg-[#14161a] border border-white/[0.04] flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMentorTask(mentee.id, t.id, t.status)}
                                    className={`p-0.5 rounded cursor-pointer transition-colors ${
                                      isTaskDone ? "text-emerald-400" : "text-[#62666d] hover:text-white"
                                    }`}
                                  >
                                    {isTaskDone ? <CheckSquare size={16} weight="fill" /> : <Square size={16} />}
                                  </button>
                                  <span className={`truncate font-medium ${isTaskDone ? "line-through text-[#8a8f98]" : "text-white"}`}>
                                    {t.title}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {t.taskUrl && (
                                    <a
                                      href={t.taskUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#8a8f98] hover:text-white p-1 rounded hover:bg-white/[0.06] transition-colors"
                                      title="Open task link"
                                    >
                                      <LinkIcon size={13} />
                                    </a>
                                  )}
                                  <Badge variant={isTaskDone ? "green" : "gray"}>
                                    {t.status.replace("_", " ")}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Mentee Full Roadmap Modal */}
      <Modal
        isOpen={Boolean(selectedMenteeRoadmap)}
        onClose={() => setSelectedMenteeRoadmap(null)}
        title={selectedMenteeRoadmap ? `${selectedMenteeRoadmap.name}'s Onboarding Roadmap` : "Mentee Roadmap"}
        maxWidth="lg"
      >
        {!selectedMenteeRoadmap ? (
          <div className="py-8 text-center text-xs text-[#8a8f98]">Loading roadmap...</div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-[#14161a] border border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-sm">{selectedMenteeRoadmap.name}</div>
                <div className="text-[#8a8f98] text-[11px]">{selectedMenteeRoadmap.jobRole} • {selectedMenteeRoadmap.department.name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-semibold text-emerald-400 text-sm">
                  {selectedMenteeRoadmap.progress?.percentComplete}% Complete
                </div>
                <div className="text-[11px] text-[#62666d]">
                  {selectedMenteeRoadmap.progress?.completedTasks} of {selectedMenteeRoadmap.progress?.totalTasks} tasks
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(selectedMenteeRoadmap.tasks || []).map((t) => {
                const isDone = t.status === "completed";
                const isMentorTask = t.assigneeType === "mentor";

                return (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg bg-[#14161a] border border-white/[0.04] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      {isMentorTask ? (
                        <button
                          type="button"
                          onClick={() => handleToggleMentorTask(selectedMenteeRoadmap.id, t.id, t.status)}
                          className={`p-0.5 rounded cursor-pointer transition-colors ${
                            isDone ? "text-emerald-400" : "text-[#62666d] hover:text-white"
                          }`}
                          title="Toggle mentor task completion"
                        >
                          {isDone ? <CheckSquare size={17} weight="fill" /> : <Square size={17} />}
                        </button>
                      ) : isDone ? (
                        <CheckCircle size={17} weight="fill" className="text-emerald-400 shrink-0" />
                      ) : (
                        <Clock size={17} className="text-[#62666d] shrink-0" />
                      )}

                      <div>
                        <div className={`font-medium ${isDone ? "line-through text-[#8a8f98]" : "text-white"}`}>
                          {t.title}
                        </div>
                        <div className="text-[11px] text-[#62666d] flex items-center gap-2 mt-0.5">
                          <span>{t.category}</span>
                          <span>•</span>
                          <span className="capitalize">{t.assigneeType}</span>
                          {t.dueDate && <span>• Due {new Date(t.dueDate).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.taskUrl && (
                        <a
                          href={t.taskUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded text-[#8a8f98] hover:text-white transition-colors"
                          title="Open task link"
                        >
                          <LinkIcon size={14} />
                        </a>
                      )}
                      <Badge variant={isDone ? "green" : "gray"}>
                        {t.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/[0.06]">
              <Button variant="ghost" size="sm" onClick={() => setSelectedMenteeRoadmap(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
