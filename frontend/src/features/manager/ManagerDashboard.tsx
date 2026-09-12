import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import type { Employee, EmployeeTask, Mentor } from "../../api/endpoints";
import { employeeApi, departmentApi } from "../../api/endpoints";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { Select } from "../../components/common/Select";
import { UsersThree, GitFork, ListBullets } from "@phosphor-icons/react";

export interface ManagerDashboardProps {
  onNavigateToTemplates: () => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  onNavigateToTemplates,
}) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departmentMentors, setDepartmentMentors] = useState<Mentor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drilldown Modal
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Mentor reassign state
  const [newMentorId, setNewMentorId] = useState("");
  const [isUpdatingMentor, setIsUpdatingMentor] = useState(false);

  const fetchTeamData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [empList, mentorList] = await Promise.all([
        employeeApi.list(),
        user?.departmentId
          ? departmentApi.getMentors(user.departmentId)
          : Promise.resolve([]),
      ]);
      setEmployees(empList);
      setDepartmentMentors(mentorList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load team data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

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

  const handleReassignTask = async (
    task: EmployeeTask,
    newAssignee: "employee" | "manager" | "mentor",
  ) => {
    if (!selectedEmployee) return;
    try {
      await employeeApi.updateTask(selectedEmployee.id, task.id, {
        assigneeType: newAssignee,
      });
      const refreshed = await employeeApi.getOne(selectedEmployee.id);
      setSelectedEmployee(refreshed);
      fetchTeamData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reassign task");
    }
  };

  const handleReassignMentor = async () => {
    if (!selectedEmployee) return;
    setIsUpdatingMentor(true);
    try {
      await employeeApi.update(selectedEmployee.id, {
        mentorId: newMentorId || null,
      });
      const refreshed = await employeeApi.getOne(selectedEmployee.id);
      setSelectedEmployee(refreshed);
      fetchTeamData();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to reassign mentor",
      );
    } finally {
      setIsUpdatingMentor(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f7f8f8] m-0">
            Team Onboarding Roster
          </h1>
          <p className="text-xs text-[#8a8f98] mt-1">
            Monitor progress, inspect onboarding roadmaps, and reassign task
            ownership across your team.
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

      {/* Roster Table Card */}
      <div className="bg-[#0f1013] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between bg-[#111216]">
          <div className="flex items-center gap-2">
            <UsersThree size={16} className="text-white" />
            <h2 className="text-xs sm:text-sm font-semibold text-[#f7f8f8] m-0">
              Department Team Members ({employees.length})
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-[#8a8f98]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading team roster...</span>
            </div>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12 text-[#8a8f98]">
            <p className="text-sm">
              No employees currently onboarding in your department.
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
                        {new Date(emp.startDate).toLocaleDateString()}
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
                        <Button
                          variant="utility"
                          size="sm"
                          icon={<ListBullets size={14} />}
                          onClick={() => openDrilldown(emp)}
                        >
                          Inspect Tasks
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98] block">
                Assigned Tasks Checklist
              </span>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {(selectedEmployee.tasks || []).map((task) => {
                  const isCompleted = task.status === "completed";
                  return (
                    <div
                      key={task.id}
                      className="p-2.5 bg-[#0a0b0e] border border-white/[0.06] rounded-lg flex items-center justify-between gap-3 text-xs"
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

                      {/* Reassign Dropdown */}
                      <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
};
