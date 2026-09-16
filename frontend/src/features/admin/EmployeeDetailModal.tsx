import React, { useState, useEffect } from "react";
import type { Employee, EmployeeTask } from "../../api/endpoints";
import { employeeApi } from "../../api/endpoints";
import { Modal } from "../../components/common/Modal";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { TaskDetailModal } from "../../components/common/TaskDetailModal";
import { AssignTaskModal } from "../employees/AssignTaskModal";
import {
  Buildings,
  Briefcase,
  CalendarBlank,
  Plus,
  ArrowSquareOut,
  Check,
  Tag,
} from "@phosphor-icons/react";

export interface EmployeeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string | null;
  onEmployeeUpdated?: () => void;
}

export const EmployeeDetailModal: React.FC<EmployeeDetailModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  onEmployeeUpdated,
}) => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-modals
  const [selectedTask, setSelectedTask] = useState<EmployeeTask | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const fetchEmployee = async () => {
    if (!employeeId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await employeeApi.getOne(employeeId);
      setEmployee(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load employee details",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && employeeId) {
      fetchEmployee();
    } else {
      setEmployee(null);
    }
  }, [isOpen, employeeId]);

  if (!isOpen) return null;

  // Group tasks by category
  const groupedTasks: Record<string, EmployeeTask[]> = {};
  if (employee?.tasks) {
    employee.tasks.forEach((task) => {
      const cat = task.category || "General";
      if (!groupedTasks[cat]) {
        groupedTasks[cat] = [];
      }
      groupedTasks[cat].push(task);
    });
  }

  const existingCategories = Object.keys(groupedTasks);

  const handleTaskAssigned = async () => {
    await fetchEmployee();
    if (onEmployeeUpdated) onEmployeeUpdated();
  };

  const progress = employee?.progress || {
    totalTasks: 0,
    completedTasks: 0,
    percentComplete: 0,
    overdueTasks: 0,
  };

  const formattedStartDate = employee?.startDate
    ? new Date(employee.startDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "N/A";

  const formattedEmploymentType = employee?.employmentType
    ? employee.employmentType.replace("_", " ")
    : "full time";

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 font-semibold text-sm">
              {employee?.name ? employee.name.charAt(0).toUpperCase() : "E"}
            </div>
            <div>
              <div className="text-sm font-semibold text-[#f7f8f8]">
                {employee?.name || "Employee Roadmap"}
              </div>
              <div className="text-xs text-[#8a8f98] font-normal">
                {employee?.email}
              </div>
            </div>
          </div>
        }
        maxWidth="xl"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-[#8a8f98]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span className="text-xs text-[#a0a6b5]">
                Loading employee roadmap...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-xs text-[#f87171]">
            {error}
          </div>
        ) : employee ? (
          <div className="space-y-6 text-left">
            {/* Header Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-[#0b0c0f] border border-white/[0.06] text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-[#5a5e6b] block mb-0.5">
                  Department
                </span>
                <span className="text-[#f7f8f8] font-medium flex items-center gap-1">
                  <Buildings size={13} className="text-[#8a8f98]" />
                  {employee.department?.name || "None"}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-[#5a5e6b] block mb-0.5">
                  Job Role
                </span>
                <span className="text-[#f7f8f8] font-medium flex items-center gap-1">
                  <Briefcase size={13} className="text-[#8a8f98]" />
                  {employee.jobRole}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-[#5a5e6b] block mb-0.5">
                  Start Date
                </span>
                <span className="text-[#f7f8f8] font-medium flex items-center gap-1">
                  <CalendarBlank size={13} className="text-[#8a8f98]" />
                  {formattedStartDate}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-semibold text-[#5a5e6b] block mb-0.5">
                  Employment Type
                </span>
                <span className="text-[#f7f8f8] font-medium capitalize">
                  {formattedEmploymentType}
                </span>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-white/[0.04]">
                <span className="text-[10px] uppercase font-semibold text-[#5a5e6b] block mb-0.5">
                  Manager
                </span>
                <span className="text-[#f7f8f8] font-medium">
                  {employee.manager ? (
                    <span className="text-white/90">{employee.manager.email}</span>
                  ) : (
                    <span className="text-[#565964]">None Assigned</span>
                  )}
                </span>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-white/[0.04]">
                <span className="text-[10px] uppercase font-semibold text-[#5a5e6b] block mb-0.5">
                  Assigned Mentor
                </span>
                <span className="text-[#f7f8f8] font-medium">
                  {employee.mentor ? (
                    <span className="text-emerald-400">
                      {employee.mentor.email}
                    </span>
                  ) : (
                    <span className="text-[#565964]">None Assigned</span>
                  )}
                </span>
              </div>
            </div>

            {/* Progress Summary Card */}
            <div className="p-4 rounded-xl bg-[#0f1015] border border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98]">
                    Onboarding Progress
                  </span>
                  <Badge variant={progress.percentComplete === 100 ? "green" : "blue"}>
                    {progress.percentComplete}% Complete
                  </Badge>
                  {progress.overdueTasks > 0 && (
                    <Badge variant="orange">
                      {progress.overdueTasks} Overdue
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-[#8a8f98] font-mono">
                  {progress.completedTasks} / {progress.totalTasks} Tasks
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    progress.percentComplete === 100
                      ? "bg-emerald-400"
                      : "bg-indigo-500"
                  }`}
                  style={{ width: `${progress.percentComplete}%` }}
                />
              </div>
            </div>

            {/* Task List Section with "Assign New Task" Header Action */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#f7f8f8]">
                    Onboarding Roadmap ({employee.tasks?.length || 0} Tasks)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={() => setIsAssignModalOpen(true)}
                >
                  Assign New Task
                </Button>
              </div>

              {/* Tasks Grouped by Category */}
              {Object.keys(groupedTasks).length === 0 ? (
                <div className="p-8 text-center text-[#8a8f98] border border-dashed border-white/[0.08] rounded-xl bg-[#0a0b0e]">
                  <p className="text-xs">No tasks currently assigned.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    icon={<Plus size={13} />}
                    onClick={() => setIsAssignModalOpen(true)}
                  >
                    Assign First Task
                  </Button>
                </div>
              ) : (
                <div className="space-y-5 max-h-[380px] overflow-y-auto pr-1">
                  {Object.entries(groupedTasks).map(([category, tasks]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#8a8f98] uppercase tracking-wider pl-1">
                        <Tag size={12} />
                        <span>{category}</span>
                        <span className="text-[11px] font-normal text-[#5a5e6b] font-mono">
                          ({tasks.filter((t) => t.status === "completed").length}/
                          {tasks.length})
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {tasks.map((task) => {
                          const isCompleted = task.status === "completed";
                          const isOverdue =
                            !isCompleted &&
                            task.dueDate &&
                            new Date(task.dueDate) < new Date();

                          return (
                            <div
                              key={task.id}
                              onClick={() => {
                                setSelectedTask(task);
                                setIsTaskDetailOpen(true);
                              }}
                              className={`flex items-start justify-between p-3 rounded-lg border transition-all cursor-pointer group hover:border-white/[0.15] hover:bg-[#13151a] ${
                                isCompleted
                                  ? "bg-[#0b0c0f]/60 border-white/[0.03] opacity-65"
                                  : "bg-[#0f1013] border-white/[0.06]"
                              }`}
                            >
                              <div className="flex items-start gap-3 flex-1 min-w-0 pr-3">
                                {/* Checkbox / Status Visual */}
                                <div
                                  className={`mt-0.5 w-4.5 h-4.5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                                    isCompleted
                                      ? "bg-emerald-500 text-black"
                                      : "border border-white/[0.15] group-hover:border-white/40 bg-white/[0.02]"
                                  }`}
                                >
                                  {isCompleted && (
                                    <Check size={11} weight="bold" />
                                  )}
                                </div>

                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-[10px] text-[#5a5e6b] bg-white/[0.04] px-1.5 py-0.2 rounded border border-white/[0.04]">
                                      ONB-{task.orderIndex + 1}
                                    </span>
                                    <h4
                                      className={`text-xs font-medium tracking-tight m-0 truncate ${
                                        isCompleted
                                          ? "line-through text-[#5a5e6b]"
                                          : "text-[#f7f8f8]"
                                      }`}
                                    >
                                      {task.title}
                                    </h4>
                                    {!task.sourceTemplateTaskId && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        Ad-hoc
                                      </span>
                                    )}
                                  </div>

                                  {task.description && (
                                    <p className="text-[11px] text-[#8a8f98] line-clamp-1 leading-relaxed">
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Badge
                                  variant={
                                    task.assigneeType === "employee"
                                      ? "blue"
                                      : task.assigneeType === "manager"
                                        ? "purple"
                                        : "orange"
                                  }
                                >
                                  {task.assigneeType}
                                </Badge>

                                {task.dueDate && (
                                  <span
                                    className={`text-[11px] font-mono flex items-center gap-1 ${
                                      isOverdue
                                        ? "text-amber-400"
                                        : "text-[#8a8f98]"
                                    }`}
                                  >
                                    <CalendarBlank size={11} />
                                    {new Date(task.dueDate).toLocaleDateString(
                                      "en-US",
                                      {
                                        month: "short",
                                        day: "numeric",
                                      },
                                    )}
                                  </span>
                                )}

                                {task.taskUrl && (
                                  <a
                                    href={task.taskUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 text-[#8a8f98] hover:text-[#f7f8f8] transition-colors"
                                    title={task.taskUrl}
                                  >
                                    <ArrowSquareOut size={13} />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isTaskDetailOpen}
        onClose={() => {
          setIsTaskDetailOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        canComplete={false}
        restrictionReason="As HR Admin, viewing this roadmap is in audit mode. Tasks must be completed by their designated assignees."
      />

      {/* Assign Task Modal */}
      {employee && (
        <AssignTaskModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          employeeId={employee.id}
          employeeName={employee.name}
          existingCategories={existingCategories}
          onTaskAssigned={handleTaskAssigned}
        />
      )}
    </>
  );
};

export default EmployeeDetailModal;
