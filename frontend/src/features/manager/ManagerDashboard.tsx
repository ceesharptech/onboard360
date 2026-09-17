import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import type {
  Employee,
  EmployeeTask,
  Mentor,
  ManagerAssignedTask,
  MyMenteeResponse,
  PaginationMeta,
} from "../../api/endpoints";
import { employeeApi, departmentApi } from "../../api/endpoints";
import { useToast } from "../../context/ToastContext";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { Select } from "../../components/common/Select";
import { Pagination } from "../../components/common/Pagination";
import { TaskDetailModal } from "../../components/common/TaskDetailModal";
import { AssignTaskModal } from "../employees/AssignTaskModal";
import {
  UsersThree,
  GitFork,
  ListBullets,
  CheckCircle,
  Clock,
  ArrowSquareOut,
  Users,
  CheckSquare,
  Square,
  Link as LinkIcon,
  Plus,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";

export interface ManagerDashboardProps {
  onNavigateToTemplates: () => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  onNavigateToTemplates,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<
    "roster" | "my-tasks" | "my-mentees"
  >("roster");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departmentMentors, setDepartmentMentors] = useState<Mentor[]>([]);
  const [managerTasks, setManagerTasks] = useState<ManagerAssignedTask[]>([]);
  const [menteeData, setMenteeData] = useState<MyMenteeResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drilldown Modal
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // View Mentee Full Roadmap Modal
  const [menteeRoadmap, setMenteeRoadmap] = useState<Employee | null>(null);
  const [isRoadmapLoading, setIsRoadmapLoading] = useState(false);

  // Mentor reassign state
  const [newMentorId, setNewMentorId] = useState("");
  const [isUpdatingMentor, setIsUpdatingMentor] = useState(false);

  // Task Detail Modal State (Phase 5.2)
  const [taskDetailTarget, setTaskDetailTarget] = useState<EmployeeTask | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  // Assign Ad-hoc Task Modal State (Phase 5.2)
  const [assigneeTargetEmployee, setAssigneeTargetEmployee] = useState<Employee | null>(null);
  const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);

  // Roster Search, Filter & Pagination State (Phase 5.3)
  const [rosterSearch, setRosterSearch] = useState("");
  const [debouncedRosterSearch, setDebouncedRosterSearch] = useState("");
  const [rosterStatusFilter, setRosterStatusFilter] = useState<
    "" | "not_started" | "in_progress" | "complete" | "overdue"
  >("");
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPagination, setRosterPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const isInitialMount = React.useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRosterSearch(rosterSearch);
      setRosterPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [rosterSearch]);

  const loadRoster = async (
    page = rosterPage,
    search = debouncedRosterSearch,
    status = rosterStatusFilter
  ) => {
    try {
      const res = await employeeApi.list({
        page,
        limit: 20,
        search: search || undefined,
        status: status || undefined,
      });
      setEmployees(res);
      if (res.pagination) {
        setRosterPagination(res.pagination);
      }
    } catch (err: unknown) {
      console.error("Failed to load roster:", err);
    }
  };

  const handleAdHocTaskAssigned = async (newTask: EmployeeTask) => {
    await fetchAllData();
    if (selectedEmployee && selectedEmployee.id === newTask.employeeId) {
      const refreshed = await employeeApi.getOne(selectedEmployee.id);
      setSelectedEmployee(refreshed);
    }
  };

  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [empList, mentorList, tasksList, mentees] = await Promise.all([
        employeeApi.list({
          page: 1,
          limit: 20,
          search: debouncedRosterSearch || undefined,
          status: rosterStatusFilter || undefined,
        }),
        user?.departmentId
          ? departmentApi.getMentors(user.departmentId).catch(() => [])
          : Promise.resolve([]),
        employeeApi.getMyManagerTasks().catch(() => []),
        employeeApi.getMyMentees().catch(() => null),
      ]);

      setEmployees(empList);
      if (empList.pagination) {
        setRosterPagination(empList.pagination);
      }
      setDepartmentMentors(mentorList);
      setManagerTasks(tasksList);
      setMenteeData(mentees);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load manager dashboard data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    loadRoster(rosterPage, debouncedRosterSearch, rosterStatusFilter);
  }, [rosterPage, debouncedRosterSearch, rosterStatusFilter]);

  const openDrilldown = async (emp: Employee) => {
    setModalLoading(true);
    setIsModalOpen(true);
    try {
      const fullEmp = await employeeApi.getOne(emp.id);
      setSelectedEmployee(fullEmp);
      setNewMentorId(fullEmp.mentorId || "");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load employee tasks",
      );
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenMenteeRoadmap = async (menteeId: string) => {
    setIsRoadmapLoading(true);
    try {
      const fullEmp = await employeeApi.getOne(menteeId);
      setMenteeRoadmap(fullEmp);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load mentee roadmap",
      );
    } finally {
      setIsRoadmapLoading(false);
    }
  };

  const handleToggleTaskStatus = async (
    employeeId: string,
    taskId: string,
    currentStatus: "pending" | "in_progress" | "completed",
  ) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await employeeApi.updateTask(employeeId, taskId, { status: nextStatus });
      toast.success(
        nextStatus === "completed" ? "Task completed" : "Task reopened",
        nextStatus === "completed"
          ? "Marked task as completed"
          : "Task status set to pending",
      );
      // Refresh manager tasks and mentee data
      const [updatedTasks, updatedMentees, updatedEmps] = await Promise.all([
        employeeApi.getMyManagerTasks().catch(() => managerTasks),
        employeeApi.getMyMentees().catch(() => menteeData),
        employeeApi.list().catch(() => employees),
      ]);
      setManagerTasks(updatedTasks);
      setMenteeData(updatedMentees);
      setEmployees(updatedEmps);

      if (selectedEmployee && selectedEmployee.id === employeeId) {
        const refreshed = await employeeApi.getOne(employeeId);
        setSelectedEmployee(refreshed);
      }
      if (menteeRoadmap && menteeRoadmap.id === employeeId) {
        const refreshed = await employeeApi.getOne(employeeId);
        setMenteeRoadmap(refreshed);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update task status";
      setError(msg);
      toast.error("Failed to update task", msg);
    }
  };

  const handleReassignTask = async (
    task: EmployeeTask,
    newAssignee: "employee" | "manager" | "mentor",
  ) => {
    if (!selectedEmployee) return;
    try {
      await employeeApi.updateTask(selectedEmployee.id, task.id, {
        assigneeType: newAssignee,
      });
      toast.success("Task reassigned", `Ownership changed to ${newAssignee}`);
      const refreshed = await employeeApi.getOne(selectedEmployee.id);
      setSelectedEmployee(refreshed);
      fetchAllData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reassign task";
      setError(msg);
      toast.error("Failed to reassign task", msg);
    }
  };

  const handleReassignMentor = async () => {
    if (!selectedEmployee) return;
    setIsUpdatingMentor(true);
    try {
      await employeeApi.update(selectedEmployee.id, {
        mentorId: newMentorId || null,
      });
      toast.success("Mentor assigned", "Updated employee's assigned mentor");
      const refreshed = await employeeApi.getOne(selectedEmployee.id);
      setSelectedEmployee(refreshed);
      fetchAllData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to reassign mentor";
      setError(msg);
      toast.error("Failed to reassign mentor", msg);
    } finally {
      setIsUpdatingMentor(false);
    }
  };

  const pendingManagerTasksCount = managerTasks.filter(
    (t) => t.status !== "completed",
  ).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-[#f7f8f8] m-0">
            Manager Workspace
          </h1>
          <p className="text-sm text-[#8a8f98] mt-1">
            Monitor team onboarding, complete your assigned onboarding tasks,
            and guide mentees.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<GitFork size={16} />}
          onClick={onNavigateToTemplates}
        >
          Department Templates
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 pb-2">
        <button
          onClick={() => setActiveTab("roster")}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "roster"
              ? "bg-white/[0.08] text-white border-white/[0.15] shadow-xs"
              : "border-transparent text-[#8a8f98] hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <UsersThree size={14} />
          <span>Team Roster ({rosterPagination.total})</span>
        </button>

        <button
          onClick={() => setActiveTab("my-tasks")}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "my-tasks"
              ? "bg-white/[0.08] text-white border-white/[0.15] shadow-xs"
              : "border-transparent text-[#8a8f98] hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          <CheckCircle size={14} />
          <span>My Assigned Tasks</span>
          {pendingManagerTasksCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500/20 text-amber-400 font-semibold">
              {pendingManagerTasksCount}
            </span>
          )}
        </button>

        {menteeData?.isMentor && (
          <button
            onClick={() => setActiveTab("my-mentees")}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "my-mentees"
                ? "bg-white/[0.08] text-white border-white/[0.15] shadow-xs"
                : "border-transparent text-[#8a8f98] hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <Users size={14} />
            <span>My Mentees ({menteeData.mentees.length})</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-[#8a8f98]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading manager workspace...</span>
          </div>
        </div>
      ) : activeTab === "roster" ? (
        /* Team Roster View */
        <div className="space-y-3">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8a8f98]">
                <MagnifyingGlass size={14} />
              </div>
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search team by name, email, or role..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#0f1013] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/30 rounded-md text-[#f7f8f8] placeholder-[#565964] focus:outline-none transition-colors"
              />
              {rosterSearch && (
                <button
                  type="button"
                  onClick={() => setRosterSearch("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#8a8f98] hover:text-white"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={rosterStatusFilter}
                onChange={(e) => {
                  setRosterStatusFilter(e.target.value as any);
                  setRosterPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-[#0f1013] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/30 rounded-md text-[#f7f8f8] focus:outline-none transition-colors"
                aria-label="Filter by onboarding status"
              >
                <option value="">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="complete">Complete</option>
                <option value="overdue">Overdue</option>
              </select>

              {(rosterSearch || rosterStatusFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRosterSearch("");
                    setRosterStatusFilter("");
                    setRosterPage(1);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          <div className="bg-[#0f1013] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.06] flex items-center justify-between bg-[#111216]">
              <div className="flex items-center gap-2">
                <UsersThree size={16} className="text-white" />
                <h2 className="text-xs sm:text-sm font-medium text-[#f7f8f8] m-0">
                  Department Team Members ({rosterPagination.total})
                </h2>
              </div>
            </div>

            {employees.length === 0 ? (
              <div className="text-center py-12 text-[#8a8f98]">
                <p className="text-sm">
                  {rosterSearch || rosterStatusFilter
                    ? "No employees match your search or filter criteria."
                    : "No employees currently onboarding in your department."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#f7f8f8]">
                  <thead className="bg-[#111216] text-[#8a8f98] border-b border-white/[0.06] uppercase font-medium text-[11px] tracking-wider select-none">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Mentor</th>
                      <th className="py-3 px-4">Start Date</th>
                      <th className="py-3 px-4">Progress</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {employees.map((emp) => {
                      const percent = emp.progress?.percentComplete ?? 0;
                      const completed = emp.progress?.completedTasks ?? 0;
                      const total = emp.progress?.totalTasks ?? 0;
                      const overdue = emp.progress?.overdueTasks ?? 0;

                      return (
                        <tr
                          key={emp.id}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-[#f7f8f8]">
                              {emp.name}
                            </div>
                            <div className="text-[#8a8f98] text-[11px] font-mono">
                              {emp.email}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="white">{emp.jobRole}</Badge>
                          </td>
                          <td className="py-3 px-4 text-[#8a8f98]">
                            {emp.mentor ? (
                              emp.mentor.email
                            ) : (
                              <span className="text-[#5a5e6b]">None</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#8a8f98] font-mono">
                            {emp.startDate
                              ? new Date(emp.startDate).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 max-w-[140px]">
                              <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-white rounded-full transition-all"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono font-medium text-[#f7f8f8]">
                                {percent}%
                              </span>
                            </div>
                            <div className="text-[10px] text-[#5a5e6b] mt-0.5">
                              {completed}/{total} tasks{" "}
                              {overdue > 0 && `• ${overdue} overdue`}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="utility"
                                size="sm"
                                icon={<Plus size={13} />}
                                onClick={() => {
                                  setAssigneeTargetEmployee(emp);
                                  setIsAssignTaskOpen(true);
                                }}
                              >
                                Assign Task
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<ListBullets size={14} />}
                                onClick={() => openDrilldown(emp)}
                              >
                                Inspect Tasks
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination
              currentPage={rosterPage}
              totalPages={rosterPagination.totalPages}
              totalItems={rosterPagination.total}
              pageSize={rosterPagination.limit}
              onPageChange={(newPage) => setRosterPage(newPage)}
            />
          </div>
        </div>
      ) : activeTab === "my-tasks" ? (
        /* "My Assigned Tasks" View (Fix 2 Requirement) */
        <div className="bg-[#0f1013] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] bg-[#111216] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} className="text-amber-400" />
              <h2 className="text-sm font-semibold text-white m-0">
                Tasks Assigned to You as Manager
              </h2>
            </div>
            <span className="text-xs text-[#8a8f98]">
              {managerTasks.filter((t) => t.status === "completed").length} of{" "}
              {managerTasks.length} completed
            </span>
          </div>

          {managerTasks.length === 0 ? (
            <div className="text-center py-12 text-[#8a8f98]">
              <p className="text-sm">
                You have no tasks assigned to you across your department.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {managerTasks.map((task) => {
                const isCompleted = task.status === "completed";

                return (
                  <div
                    key={task.id}
                    className="p-4 hover:bg-white/[0.02] flex items-center justify-between gap-4 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      {/* Direct Completion Toggle Checkbox */}
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleTaskStatus(
                            task.employeeId,
                            task.id,
                            task.status,
                          )
                        }
                        className={`p-1 rounded text-lg cursor-pointer transition-colors ${
                          isCompleted
                            ? "text-emerald-400 hover:text-emerald-300"
                            : "text-[#62666d] hover:text-white"
                        }`}
                        title={
                          isCompleted ? "Mark incomplete" : "Mark completed"
                        }
                      >
                        {isCompleted ? (
                          <CheckSquare size={19} weight="fill" />
                        ) : (
                          <Square size={19} />
                        )}
                      </button>

                      <div
                        className="min-w-0 flex-1 cursor-pointer group/title"
                        onClick={() => {
                          setTaskDetailTarget({
                            id: task.id,
                            employeeId: task.employeeId,
                            title: task.title,
                            description: task.description,
                            category: task.category,
                            orderIndex: task.orderIndex,
                            assigneeType: task.assigneeType,
                            dueDate: task.dueDate,
                            status: task.status,
                            completedAt: task.completedAt,
                            sourceTemplateTaskId: task.sourceTemplateTaskId,
                            taskUrl: task.taskUrl,
                          });
                          setIsTaskDetailOpen(true);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium text-sm truncate group-hover/title:text-indigo-300 transition-colors ${isCompleted ? "line-through text-[#8a8f98]" : "text-white"}`}
                          >
                            {task.title}
                          </span>
                          {task.taskUrl && (
                            <a
                              href={task.taskUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#8a8f98] hover:text-white p-1 rounded hover:bg-white/[0.06] transition-colors"
                              title="Open task link in new tab"
                            >
                              <LinkIcon size={14} />
                            </a>
                          )}
                        </div>

                        <div className="text-[11px] text-[#62666d] flex items-center gap-2 mt-1">
                          <span className="text-white/80 font-medium">
                            {task.employee.name}
                          </span>
                          <span>•</span>
                          <span>{task.category}</span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span
                                className={
                                  !isCompleted &&
                                  new Date(task.dueDate) < new Date()
                                    ? "text-amber-400 font-medium"
                                    : ""
                                }
                              >
                                Due{" "}
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Badge variant={isCompleted ? "green" : "gray"}>
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* "My Mentees" View for Mentors (Fix 2 Requirement) */
        <div className="space-y-4">
          {!menteeData || menteeData.mentees.length === 0 ? (
            <div className="bg-[#0f1013] border border-white/[0.06] rounded-xl p-8 text-center text-[#8a8f98]">
              <p className="text-sm">
                You do not have any active mentees assigned to you yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {menteeData.mentees.map((mentee) => {
                const percent = mentee.progress?.percentComplete ?? 0;
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
                          <h3 className="font-semibold text-white text-sm m-0">
                            {mentee.name}
                          </h3>
                          <div className="text-[11px] text-[#8a8f98] mt-0.5">
                            {mentee.jobRole} • {mentee.department.name}
                          </div>
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
                          <span className="text-[#8a8f98]">
                            Overall Onboarding Progress
                          </span>
                          <span className="font-semibold text-emerald-400 font-mono">
                            {percent}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-[#62666d] mt-1">
                          {completed} of {total} tasks complete
                        </div>
                      </div>

                      {/* Mentor Assigned Tasks for this Mentee */}
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8a8f98] block mb-2">
                          Tasks Assigned to Mentor ({mentee.mentorTasks.length})
                        </span>

                        {mentee.mentorTasks.length === 0 ? (
                          <p className="text-xs text-[#62666d] py-2">
                            No mentor-specific tasks in this mentee's plan.
                          </p>
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
                                      onClick={() =>
                                        handleToggleTaskStatus(
                                          mentee.id,
                                          t.id,
                                          t.status,
                                        )
                                      }
                                      className={`p-0.5 rounded cursor-pointer transition-colors ${
                                        isTaskDone
                                          ? "text-emerald-400"
                                          : "text-[#62666d] hover:text-white"
                                      }`}
                                    >
                                      {isTaskDone ? (
                                        <CheckSquare size={16} weight="fill" />
                                      ) : (
                                        <Square size={16} />
                                      )}
                                    </button>
                                    <span
                                      onClick={() => {
                                        setTaskDetailTarget({
                                          ...t,
                                          employeeId: mentee.id,
                                        } as any);
                                        setIsTaskDetailOpen(true);
                                      }}
                                      className={`truncate font-medium cursor-pointer hover:text-indigo-300 transition-colors ${isTaskDone ? "line-through text-[#8a8f98]" : "text-white"}`}
                                    >
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
                                    <Badge
                                      variant={isTaskDone ? "green" : "gray"}
                                    >
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
          )}
        </div>
      )}

      {/* Employee Tasks Drilldown & Reassignment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          selectedEmployee
            ? `${selectedEmployee.name}'s Onboarding Tasks`
            : "Employee Details"
        }
        maxWidth="lg"
      >
        {modalLoading || !selectedEmployee ? (
          <div className="py-8 text-center text-xs text-[#8a8f98]">
            Loading tasks...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#0a0b0e] p-3 rounded-lg border border-white/[0.06] text-xs">
              <div>
                <span className="text-[#5a5e6b] block">Role</span>
                <span className="font-medium text-[#f7f8f8]">
                  {selectedEmployee.jobRole}
                </span>
              </div>
              <div>
                <span className="text-[#5a5e6b] block">Department</span>
                <span className="font-medium text-[#f7f8f8]">
                  {selectedEmployee.department.name}
                </span>
              </div>
              <div>
                <span className="text-[#5a5e6b] block">Progress</span>
                <span className="font-medium font-mono text-white">
                  {selectedEmployee.progress?.percentComplete}%
                </span>
              </div>
              <div>
                <span className="text-[#5a5e6b] block">Overdue</span>
                <span className="font-medium text-amber-400">
                  {selectedEmployee.progress?.overdueTasks}
                </span>
              </div>
            </div>

            {/* Mentor Reassignment Section */}
            <div className="flex flex-col sm:flex-row items-end gap-2 p-3 bg-[#0a0b0e] rounded-lg border border-white/[0.06]">
              <div className="flex-1 w-full">
                <Select
                  label="Reassign Mentor (Department Pool)"
                  value={newMentorId}
                  onChange={(e) => setNewMentorId(e.target.value)}
                  options={[
                    { value: "", label: "None Assigned" },
                    ...departmentMentors.map((m) => ({
                      value: m.id,
                      label: `${m.user.email} (${m.currentMenteeCount} mentees)`,
                    })),
                  ]}
                />
              </div>
              <Button
                variant="utility"
                size="sm"
                onClick={handleReassignMentor}
                isLoading={isUpdatingMentor}
                className="py-2.5"
              >
                Save Mentor
              </Button>
            </div>

            {/* Tasks List with Reassignment Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98] block">
                  Assigned Tasks Checklist
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={() => {
                    setAssigneeTargetEmployee(selectedEmployee);
                    setIsAssignTaskOpen(true);
                  }}
                >
                  Assign Task
                </Button>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {(selectedEmployee.tasks || []).map((task) => {
                  const isCompleted = task.status === "completed";
                  return (
                    <div
                      key={task.id}
                      onClick={() => {
                        setTaskDetailTarget(task);
                        setIsTaskDetailOpen(true);
                      }}
                      className="p-2.5 bg-[#0a0b0e] border border-white/[0.06] hover:border-white/[0.15] rounded-lg flex items-center justify-between gap-3 text-xs cursor-pointer group transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isCompleted ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                        <div>
                          <div
                            className={`font-medium ${isCompleted ? "text-[#8a8f98] line-through" : "text-[#f7f8f8]"}`}
                          >
                            {task.title}
                          </div>
                          <div className="text-[11px] text-[#5a5e6b] flex items-center gap-2 mt-0.5">
                            <span>{task.category}</span>
                            {task.dueDate && (
                              <span>
                                • Due{" "}
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reassign Dropdown & Task Link */}
                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {task.taskUrl && (
                          <a
                            href={task.taskUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-[#8a8f98] hover:text-white transition-colors"
                            title="Open task link"
                          >
                            <LinkIcon size={14} />
                          </a>
                        )}

                        <select
                          value={task.assigneeType}
                          onChange={(e) =>
                            handleReassignTask(
                              task,
                              e.target.value as
                                | "employee"
                                | "manager"
                                | "mentor",
                            )
                          }
                          className="bg-[#14161a] border border-white/[0.08] hover:border-white/[0.15] text-[#f7f8f8] text-[11px] rounded-md px-2 py-1 cursor-pointer"
                        >
                          <option value="employee">Assign: Employee</option>
                          <option value="manager">Assign: Manager</option>
                          <option value="mentor">Assign: Mentor</option>
                        </select>

                        <Badge variant={isCompleted ? "green" : "gray"}>
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Mentee Full Roadmap Modal */}
      <Modal
        isOpen={Boolean(menteeRoadmap)}
        onClose={() => setMenteeRoadmap(null)}
        title={
          menteeRoadmap
            ? `${menteeRoadmap.name}'s Onboarding Roadmap`
            : "Mentee Roadmap"
        }
        maxWidth="lg"
      >
        {isRoadmapLoading || !menteeRoadmap ? (
          <div className="py-8 text-center text-xs text-[#8a8f98]">
            Loading roadmap...
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-[#14161a] border border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-sm">
                  {menteeRoadmap.name}
                </div>
                <div className="text-[#8a8f98] text-[11px]">
                  {menteeRoadmap.jobRole} • {menteeRoadmap.department.name}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-semibold text-emerald-400 text-sm">
                  {menteeRoadmap.progress?.percentComplete}% Complete
                </div>
                <div className="text-[11px] text-[#62666d]">
                  {menteeRoadmap.progress?.completedTasks} of{" "}
                  {menteeRoadmap.progress?.totalTasks} tasks
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {(menteeRoadmap.tasks || []).map((t) => {
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
                          onClick={() =>
                            handleToggleTaskStatus(
                              menteeRoadmap.id,
                              t.id,
                              t.status,
                            )
                          }
                          className={`p-0.5 rounded cursor-pointer transition-colors ${
                            isDone
                              ? "text-emerald-400"
                              : "text-[#62666d] hover:text-white"
                          }`}
                          title="Toggle mentor task completion"
                        >
                          {isDone ? (
                            <CheckSquare size={17} weight="fill" />
                          ) : (
                            <Square size={17} />
                          )}
                        </button>
                      ) : isDone ? (
                        <CheckCircle
                          size={17}
                          weight="fill"
                          className="text-emerald-400 shrink-0"
                        />
                      ) : (
                        <Clock size={17} className="text-[#62666d] shrink-0" />
                      )}

                      <div
                        className="cursor-pointer"
                        onClick={() => {
                          setTaskDetailTarget({
                            ...t,
                            employeeId: menteeRoadmap.id,
                          } as any);
                          setIsTaskDetailOpen(true);
                        }}
                      >
                        <div
                          className={`font-medium hover:text-indigo-300 transition-colors ${isDone ? "line-through text-[#8a8f98]" : "text-white"}`}
                        >
                          {t.title}
                        </div>
                        <div className="text-[11px] text-[#62666d] flex items-center gap-2 mt-0.5">
                          <span>{t.category}</span>
                          <span>•</span>
                          <span className="capitalize">{t.assigneeType}</span>
                          {t.dueDate && (
                            <span>
                              • Due {new Date(t.dueDate).toLocaleDateString()}
                            </span>
                          )}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMenteeRoadmap(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Task Detail Modal (Phase 5.2) */}
      <TaskDetailModal
        isOpen={isTaskDetailOpen}
        onClose={() => {
          setIsTaskDetailOpen(false);
          setTaskDetailTarget(null);
        }}
        task={taskDetailTarget}
        canComplete={
          taskDetailTarget
            ? taskDetailTarget.assigneeType === "manager" ||
              (taskDetailTarget.assigneeType === "mentor" && Boolean(menteeData?.isMentor))
            : false
        }
        restrictionReason="You can only mark tasks complete if they are assigned to your role (manager or mentor)."
        onToggleComplete={async (t) => {
          if (t.employeeId) {
            await handleToggleTaskStatus(t.employeeId, t.id, t.status);
            setTaskDetailTarget((prev) =>
              prev && prev.id === t.id
                ? {
                    ...prev,
                    status: prev.status === "completed" ? "pending" : "completed",
                    completedAt:
                      prev.status === "completed"
                        ? null
                        : new Date().toISOString(),
                  }
                : prev,
            );
          }
        }}
      />

      {/* Assign Task Modal (Phase 5.2) */}
      {assigneeTargetEmployee && (
        <AssignTaskModal
          isOpen={isAssignTaskOpen}
          onClose={() => {
            setIsAssignTaskOpen(false);
            setAssigneeTargetEmployee(null);
          }}
          employeeId={assigneeTargetEmployee.id}
          employeeName={assigneeTargetEmployee.name}
          existingCategories={
            assigneeTargetEmployee.tasks
              ? Array.from(
                  new Set(
                    assigneeTargetEmployee.tasks.map((t) => t.category),
                  ),
                )
              : []
          }
          onTaskAssigned={handleAdHocTaskAssigned}
        />
      )}
    </div>
  );
};
