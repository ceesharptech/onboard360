import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Employee, EmployeeTask, Mentor } from '../../api/endpoints';
import { employeeApi, departmentApi } from '../../api/endpoints';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Select } from '../../components/common/Select';
import {
  UsersThree,
  GitFork,
  ListBullets,
} from '@phosphor-icons/react';

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
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Mentor reassign state
  const [newMentorId, setNewMentorId] = useState('');
  const [isUpdatingMentor, setIsUpdatingMentor] = useState(false);

  const fetchTeamData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [empList, mentorList] = await Promise.all([
        employeeApi.list(),
        user?.departmentId ? departmentApi.getMentors(user.departmentId) : Promise.resolve([]),
      ]);
      setEmployees(empList);
      setDepartmentMentors(mentorList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load team data');
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
      setNewMentorId(fullEmp.mentorId || '');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load employee tasks');
    } finally {
      setModalLoading(false);
    }
  };

  const handleReassignTask = async (task: EmployeeTask, newAssignee: 'employee' | 'manager' | 'mentor') => {
    if (!selectedEmployee) return;
    try {
      await employeeApi.updateTask(selectedEmployee.id, task.id, {
        assigneeType: newAssignee,
      });
      const refreshed = await employeeApi.getOne(selectedEmployee.id);
      setSelectedEmployee(refreshed);
      fetchTeamData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reassign task');
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
      setError(err instanceof Error ? err.message : 'Failed to reassign mentor');
    } finally {
      setIsUpdatingMentor(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#23252a]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f7f8f8] m-0">Team Onboarding Roster</h1>
          <p className="text-xs text-[#8a8f98] mt-1">
            Monitor progress, inspect onboarding roadmaps, and reassign task ownership across your team.
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
        <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-xs text-[#f87171]">
          {error}
        </div>
      )}

      {/* Roster Table Card */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[#23252a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersThree size={18} className="text-[#5e6ad2]" />
            <h2 className="text-sm font-semibold text-[#f7f8f8] m-0">
              Department Team Members ({employees.length})
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-[#8a8f98]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-[#5e6ad2] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading team roster...</span>
            </div>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12 text-[#8a8f98]">
            <p className="text-sm">No employees currently onboarding in your department.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#f7f8f8]">
              <thead className="bg-[#141516] text-[#8a8f98] border-b border-[#23252a] uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Mentor</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#23252a]">
                {employees.map((emp) => {
                  const percent = emp.progress?.percentComplete ?? 0;
                  const completed = emp.progress?.completedTasks ?? 0;
                  const total = emp.progress?.totalTasks ?? 0;
                  const overdue = emp.progress?.overdueTasks ?? 0;

                  return (
                    <tr key={emp.id} className="hover:bg-[#141516] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#f7f8f8]">{emp.name}</div>
                        <div className="text-[#8a8f98] text-[11px]">{emp.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="blue">{emp.jobRole}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {emp.mentor ? emp.mentor.email : <span className="text-[#62666d]">None</span>}
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {new Date(emp.startDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 max-w-[140px]">
                          <div className="w-full h-1.5 bg-[#141516] rounded-full overflow-hidden border border-[#23252a]">
                            <div
                              className="h-full bg-[#5e6ad2] rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-[#f7f8f8]">{percent}%</span>
                        </div>
                        <div className="text-[10px] text-[#62666d] mt-0.5">
                          {completed}/{total} tasks {overdue > 0 && `• ${overdue} overdue`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
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
      </Card>

      {/* Employee Tasks Drilldown & Reassignment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedEmployee ? `${selectedEmployee.name}'s Onboarding Tasks` : 'Employee Details'}
        maxWidth="lg"
      >
        {modalLoading || !selectedEmployee ? (
          <div className="py-8 text-center text-xs text-[#8a8f98]">Loading tasks...</div>
        ) : (
          <div className="space-y-5">
            {/* Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#141516] p-3 rounded-xl border border-[#23252a] text-xs">
              <div>
                <span className="text-[#62666d] block">Role</span>
                <span className="font-medium text-[#f7f8f8]">{selectedEmployee.jobRole}</span>
              </div>
              <div>
                <span className="text-[#62666d] block">Department</span>
                <span className="font-medium text-[#f7f8f8]">{selectedEmployee.department.name}</span>
              </div>
              <div>
                <span className="text-[#62666d] block">Progress</span>
                <span className="font-medium text-[#5e6ad2]">
                  {selectedEmployee.progress?.percentComplete}%
                </span>
              </div>
              <div>
                <span className="text-[#62666d] block">Overdue</span>
                <span className="font-medium text-[#d9730d]">
                  {selectedEmployee.progress?.overdueTasks}
                </span>
              </div>
            </div>

            {/* Mentor Reassignment Section */}
            <div className="flex flex-col sm:flex-row items-end gap-2 p-3 bg-[#141516] rounded-xl border border-[#23252a]">
              <div className="flex-1 w-full">
                <Select
                  label="Reassign Mentor (Department Pool)"
                  value={newMentorId}
                  onChange={(e) => setNewMentorId(e.target.value)}
                  options={[
                    { value: '', label: 'None Assigned' },
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
              >
                Save Mentor
              </Button>
            </div>

            {/* Tasks List with Reassignment Controls */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98] block">
                Assigned Tasks Checklist
              </span>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(selectedEmployee.tasks || []).map((task) => {
                  const isCompleted = task.status === 'completed';
                  return (
                    <div
                      key={task.id}
                      className="p-3 bg-[#141516] border border-[#23252a] rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isCompleted ? 'bg-[#27a644]' : 'bg-[#d9730d]'
                          }`}
                        />
                        <div>
                          <div className={`font-medium ${isCompleted ? 'text-[#8a8f98]' : 'text-[#f7f8f8]'}`}>
                            {task.title}
                          </div>
                          <div className="text-[11px] text-[#62666d] flex items-center gap-2 mt-0.5">
                            <span>{task.category}</span>
                            {task.dueDate && (
                              <span>• Due {new Date(task.dueDate).toLocaleDateString()}</span>
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
                              e.target.value as 'employee' | 'manager' | 'mentor'
                            )
                          }
                          className="bg-[#0f1011] border border-[#23252a] hover:border-[#34343a] text-[#f7f8f8] text-[11px] rounded-md px-2 py-1 cursor-pointer"
                        >
                          <option value="employee">Assign: Employee</option>
                          <option value="manager">Assign: Manager</option>
                          <option value="mentor">Assign: Mentor</option>
                        </select>

                        <Badge variant={isCompleted ? 'green' : 'gray'}>
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
