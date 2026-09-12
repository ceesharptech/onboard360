import React, { useState, useEffect } from 'react';
import type {
  Employee,
  Department,
  Mentor,
  OnboardingTemplate,
} from '../../api/endpoints';
import {
  employeeApi,
  departmentApi,
  templateApi,
} from '../../api/endpoints';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import {
  UserPlus,
  Buildings,
  Trash,
  Plus,
  Sparkle,
} from '@phosphor-icons/react';

export interface HrAdminDashboardProps {
  initialTab?: 'employees' | 'departments';
}

export const HrAdminDashboard: React.FC<HrAdminDashboardProps> = ({
  initialTab = 'employees',
}) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'departments'>(initialTab);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [departmentMentors, setDepartmentMentors] = useState<Record<string, Mentor[]>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Employee Modal State
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empDeptId, setEmpDeptId] = useState('');
  const [empRole, setEmpRole] = useState('');
  const [empStartDate, setEmpStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [empType, setEmpType] = useState<'full_time' | 'part_time' | 'contract'>('full_time');
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);

  // Add Mentor Modal State
  const [isMentorModalOpen, setIsMentorModalOpen] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [mentorUserId, setMentorUserId] = useState('');
  const [isAddingMentor, setIsAddingMentor] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [empList, deptList, tmplList] = await Promise.all([
        employeeApi.list(),
        departmentApi.list(),
        templateApi.list(),
      ]);

      setEmployees(empList);
      setDepartments(deptList);
      setTemplates(tmplList);

      if (deptList.length > 0 && !empDeptId) {
        setEmpDeptId(deptList[0].id);
      }

      // Load mentors for each department
      const mentorMap: Record<string, Mentor[]> = {};
      await Promise.all(
        deptList.map(async (dept) => {
          try {
            const mList = await departmentApi.getMentors(dept.id);
            mentorMap[dept.id] = mList;
          } catch {
            mentorMap[dept.id] = [];
          }
        })
      );
      setDepartmentMentors(mentorMap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load company directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute preview of matched template for employee creation
  const getMatchedTemplatePreview = () => {
    if (!empDeptId) return null;
    const exactMatch = templates.find(
      (t) =>
        t.departmentId === empDeptId &&
        t.jobRole &&
        empRole &&
        t.jobRole.toLowerCase() === empRole.trim().toLowerCase()
    );
    if (exactMatch) return { template: exactMatch, type: 'Exact Role Match' };

    const deptDefault = templates.find((t) => t.departmentId === empDeptId && t.isDefault);
    if (deptDefault) return { template: deptDefault, type: 'Department Default Fallback' };

    const companyDefault = templates.find((t) => t.isDefault);
    if (companyDefault) return { template: companyDefault, type: 'Company-Wide Fallback' };

    return null;
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || !empEmail || !empDeptId || !empRole) {
      setError('Please fill in all required fields');
      return;
    }

    setIsCreatingEmployee(true);
    setError(null);
    try {
      await employeeApi.create({
        name: empName,
        email: empEmail,
        departmentId: empDeptId,
        jobRole: empRole,
        startDate: empStartDate,
        employmentType: empType,
      });

      setIsEmployeeModalOpen(false);
      setEmpName('');
      setEmpEmail('');
      setEmpRole('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  const handleAddMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptId || !mentorUserId) return;

    setIsAddingMentor(true);
    try {
      await departmentApi.addMentor(targetDeptId, mentorUserId);
      setIsMentorModalOpen(false);
      setMentorUserId('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add mentor to pool');
    } finally {
      setIsAddingMentor(false);
    }
  };

  const handleRemoveMentor = async (deptId: string, mentorId: string) => {
    if (!confirm('Remove this mentor from the active department pool?')) return;
    try {
      await departmentApi.removeMentor(deptId, mentorId);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove mentor');
    }
  };

  const matchedPreview = getMatchedTemplatePreview();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#23252a]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#f7f8f8] m-0">HR Administration</h1>
          <p className="text-xs text-[#8a8f98] mt-1">
            Manage employees, auto-matched onboarding workflows, and department mentor pools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'employees' ? (
            <Button
              variant="primary"
              icon={<UserPlus size={16} />}
              onClick={() => setIsEmployeeModalOpen(true)}
            >
              Add Employee
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setTargetDeptId(departments[0]?.id || '');
                setIsMentorModalOpen(true);
              }}
            >
              Add Mentor
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-xs text-[#f87171]">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#23252a] pb-1">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'employees'
              ? 'bg-[#141516] text-[#f7f8f8] border border-[#23252a]'
              : 'text-[#8a8f98] hover:text-[#f7f8f8]'
          }`}
        >
          Company Employees ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('departments')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeTab === 'departments'
              ? 'bg-[#141516] text-[#f7f8f8] border border-[#23252a]'
              : 'text-[#8a8f98] hover:text-[#f7f8f8]'
          }`}
        >
          Mentor Pools ({departments.length} Departments)
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-[#8a8f98]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#5e6ad2] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading records...</span>
          </div>
        </div>
      ) : activeTab === 'employees' ? (
        /* Employees Table Card */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#f7f8f8]">
              <thead className="bg-[#141516] text-[#8a8f98] border-b border-[#23252a] uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Assigned Mentor</th>
                  <th className="py-3 px-4">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#23252a]">
                {employees.map((emp) => {
                  const percent = emp.progress?.percentComplete ?? 0;
                  const completed = emp.progress?.completedTasks ?? 0;
                  const total = emp.progress?.totalTasks ?? 0;

                  return (
                    <tr key={emp.id} className="hover:bg-[#141516] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#f7f8f8]">{emp.name}</div>
                        <div className="text-[#8a8f98] text-[11px]">{emp.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {emp.department?.name || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant="blue">{emp.jobRole}</Badge>
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {new Date(emp.startDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {emp.mentor ? (
                          <span className="text-[#27a644] font-medium">{emp.mentor.email}</span>
                        ) : (
                          <span className="text-[#62666d]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 max-w-[130px]">
                          <div className="w-full h-1.5 bg-[#141516] rounded-full overflow-hidden border border-[#23252a]">
                            <div
                              className="h-full bg-[#5e6ad2] rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-[#f7f8f8]">{percent}%</span>
                        </div>
                        <div className="text-[10px] text-[#62666d] mt-0.5">
                          {completed}/{total} completed
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Departments & Mentor Pools */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {departments.map((dept) => {
            const mentors = departmentMentors[dept.id] || [];

            return (
              <Card key={dept.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#23252a] mb-4">
                    <div className="flex items-center gap-2">
                      <Buildings size={18} className="text-[#5e6ad2]" />
                      <h3 className="text-base font-semibold text-[#f7f8f8] m-0">{dept.name}</h3>
                    </div>
                    <Badge variant="purple">{mentors.length} Mentors</Badge>
                  </div>

                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#62666d] block mb-2">
                    Active Mentor Pool
                  </span>

                  {mentors.length === 0 ? (
                    <p className="text-xs text-[#62666d] py-3">
                      No active mentors in this department pool.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {mentors.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#141516] border border-[#23252a] text-xs"
                        >
                          <div>
                            <div className="font-medium text-[#f7f8f8]">{m.user.email}</div>
                            <div className="text-[11px] text-[#27a644]">
                              {m.currentMenteeCount} active mentee(s)
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMentor(dept.id, m.id)}
                            className="text-[#62666d] hover:text-[#f87171] p-1 cursor-pointer"
                            title="Deactivate mentor"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-[#23252a]">
                  <Button
                    variant="utility"
                    size="sm"
                    icon={<Plus size={13} />}
                    onClick={() => {
                      setTargetDeptId(dept.id);
                      setIsMentorModalOpen(true);
                    }}
                    className="w-full"
                  >
                    Add Mentor to {dept.name}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        title="Add New Employee"
        maxWidth="md"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Alex Morgan"
            value={empName}
            onChange={(e) => setEmpName(e.target.value)}
            required
          />

          <Input
            label="Work Email"
            type="email"
            placeholder="alex.morgan@company.com"
            value={empEmail}
            onChange={(e) => setEmpEmail(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Department"
              value={empDeptId}
              onChange={(e) => setEmpDeptId(e.target.value)}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />

            <Input
              label="Job Role"
              placeholder="e.g. Frontend Developer"
              value={empRole}
              onChange={(e) => setEmpRole(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={empStartDate}
              onChange={(e) => setEmpStartDate(e.target.value)}
              required
            />

            <Select
              label="Employment Type"
              value={empType}
              onChange={(e) => setEmpType(e.target.value as 'full_time' | 'part_time' | 'contract')}
              options={[
                { value: 'full_time', label: 'Full Time' },
                { value: 'part_time', label: 'Part Time' },
                { value: 'contract', label: 'Contract' },
              ]}
            />
          </div>

          {/* Real-time Template Matching & Snapshot Preview */}
          <div className="p-3.5 bg-[#141516] border border-[#23252a] rounded-xl text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#828fff] font-medium">
              <Sparkle size={15} weight="fill" />
              <span>Snapshot Workflow Preview</span>
            </div>
            {matchedPreview ? (
              <p className="text-[#8a8f98] m-0">
                Matches template <strong className="text-[#f7f8f8]">"{matchedPreview.template.name}"</strong> (
                {matchedPreview.template.tasks?.length || 0} tasks).
                <br />
                <span className="text-[11px] text-[#27a644]">({matchedPreview.type})</span>
              </p>
            ) : (
              <p className="text-[#8a8f98] m-0">
                No template matched yet. An empty onboarding roadmap will be created.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#23252a]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsEmployeeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isCreatingEmployee}>
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Mentor Modal */}
      <Modal
        isOpen={isMentorModalOpen}
        onClose={() => setIsMentorModalOpen(false)}
        title="Add Mentor to Department Pool"
        maxWidth="sm"
      >
        <form onSubmit={handleAddMentor} className="space-y-4">
          <Select
            label="Department"
            value={targetDeptId}
            onChange={(e) => setTargetDeptId(e.target.value)}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />

          <Input
            label="User UUID (from Users or Seed)"
            placeholder="e.g. user UUID"
            value={mentorUserId}
            onChange={(e) => setMentorUserId(e.target.value)}
            helperText="Enter the UUID of the user to enroll into this department's mentor pool"
            required
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#23252a]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsMentorModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" isLoading={isAddingMentor}>
              Enroll Mentor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
