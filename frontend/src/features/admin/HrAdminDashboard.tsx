import React, { useState, useEffect } from "react";
import type {
  Employee,
  Department,
  Mentor,
  OnboardingTemplate,
  User,
} from "../../api/endpoints";
import {
  employeeApi,
  departmentApi,
  templateApi,
  userApi,
} from "../../api/endpoints";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { Modal } from "../../components/common/Modal";
import { Input } from "../../components/common/Input";
import { Select } from "../../components/common/Select";
import { useToast } from "../../context/ToastContext";
import {
  UserPlus,
  Buildings,
  Trash,
  Plus,
  Sparkle,
  Key,
  Copy,
  ShieldCheck,
  CaretDown,
  CaretUp,
  ArrowSquareOut,
  Users,
  CheckCircle,
  Clock,
  Link as LinkIcon,
} from "@phosphor-icons/react";

export interface HrAdminDashboardProps {
  initialTab?: "employees" | "departments";
}

export const HrAdminDashboard: React.FC<HrAdminDashboardProps> = ({
  initialTab = "employees",
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"employees" | "departments">(
    initialTab,
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departmentMentors, setDepartmentMentors] = useState<
    Record<string, Mentor[]>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Employee Modal State
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empAppRole, setEmpAppRole] = useState<"employee" | "manager" | "hr_admin">("employee");
  const [empInitialPassword, setEmpInitialPassword] = useState("");
  const [empDeptId, setEmpDeptId] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [empStartDate, setEmpStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [empType, setEmpType] = useState<
    "full_time" | "part_time" | "contract"
  >("full_time");
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);

  // Add Mentor Modal State
  const [isMentorModalOpen, setIsMentorModalOpen] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState("");
  const [mentorUserId, setMentorUserId] = useState("");
  const [isAddingMentor, setIsAddingMentor] = useState(false);

  // Expandable Mentees in Mentor Pool State
  const [expandedMentorIds, setExpandedMentorIds] = useState<Record<string, boolean>>({});

  // View Mentee Roadmap Modal State
  const [selectedMentee, setSelectedMentee] = useState<Employee | null>(null);

  const generateTempPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    let pwd = "Pass#";
    for (let i = 0; i < 7; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEmpInitialPassword(pwd);
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [empList, deptList, tmplList, userList] = await Promise.all([
        employeeApi.list(),
        departmentApi.list(),
        templateApi.list(),
        userApi.list().catch(() => []),
      ]);

      setEmployees(empList);
      setDepartments(deptList);
      setTemplates(tmplList);
      setUsers(userList);

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
        }),
      );
      setDepartmentMentors(mentorMap);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load company directory",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleMentorExpanded = (mentorId: string) => {
    setExpandedMentorIds((prev) => ({
      ...prev,
      [mentorId]: !prev[mentorId],
    }));
  };

  const handleOpenMenteeRoadmap = async (menteeId: string) => {
    try {
      const fullEmp = await employeeApi.getOne(menteeId);
      setSelectedMentee(fullEmp);
    } catch (err) {
      console.error("Failed to load mentee roadmap:", err);
    }
  };

  // Compute preview of matched template for employee creation
  const getMatchedTemplatePreview = () => {
    if (empAppRole === "hr_admin") return null;
    if (!empDeptId) return null;

    const exactMatch = templates.find(
      (t) =>
        t.departmentId === empDeptId &&
        t.jobRole &&
        empRole &&
        t.jobRole.toLowerCase() === empRole.trim().toLowerCase(),
    );
    if (exactMatch) return { template: exactMatch, type: "Exact Role Match" };

    const deptDefault = templates.find(
      (t) => t.departmentId === empDeptId && t.isDefault,
    );
    if (deptDefault)
      return { template: deptDefault, type: "Department Default Fallback" };

    const companyDefault = templates.find((t) => t.isDefault);
    if (companyDefault)
      return { template: companyDefault, type: "Company-Wide Fallback" };

    return null;
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || !empEmail) {
      setError("Name and email are required");
      return;
    }

    if (empAppRole !== "hr_admin" && (!empDeptId || !empRole)) {
      setError("Department and Job Role are required for Employees and Managers");
      return;
    }

    setIsCreatingEmployee(true);
    setError(null);
    try {
      await employeeApi.create({
        name: empName,
        email: empEmail,
        role: empAppRole,
        initialPassword: empInitialPassword || undefined,
        departmentId: empAppRole === "hr_admin" ? null : empDeptId,
        jobRole: empAppRole === "hr_admin" ? null : empRole,
        startDate: empAppRole === "hr_admin" ? null : empStartDate,
        employmentType: empAppRole === "hr_admin" ? null : empType,
      });

      toast.success(
        "Account created",
        `Successfully provisioned ${empAppRole.replace("_", " ")} account for ${empName}`
      );

      setIsEmployeeModalOpen(false);
      setEmpName("");
      setEmpEmail("");
      setEmpRole("");
      setEmpInitialPassword("");
      setEmpAppRole("employee");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create employee";
      setError(msg);
      toast.error("Failed to create account", msg);
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
      toast.success("Mentor added", "Enrolled team member into department mentor pool");
      setIsMentorModalOpen(false);
      setMentorUserId("");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add mentor to pool";
      setError(msg);
      toast.error("Failed to add mentor", msg);
    } finally {
      setIsAddingMentor(false);
    }
  };

  const handleRemoveMentor = async (deptId: string, mentorId: string) => {
    if (!confirm("Remove this mentor from the active department pool?")) return;
    try {
      await departmentApi.removeMentor(deptId, mentorId);
      toast.info("Mentor removed", "Mentor was removed from the active pool");
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove mentor";
      setError(msg);
      toast.error("Failed to remove mentor", msg);
    }
  };

  const matchedPreview = getMatchedTemplatePreview();

  // Filter users for mentor pool: users in targetDeptId or company-wide
  const eligibleMentorUsers = users.filter(
    (u) => !targetDeptId || !u.departmentId || u.departmentId === targetDeptId,
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#f7f8f8] m-0">
            HR Administration
          </h1>
          <p className="text-sm text-[#8a8f98] mt-1">
            Manage employees, auto-matched onboarding workflows, and department
            mentor pools.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "employees" ? (
            <Button
              variant="primary"
              icon={<UserPlus size={15} />}
              onClick={() => {
                generateTempPassword();
                setIsEmployeeModalOpen(true);
              }}
            >
              Add Employee / User
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => {
                const firstDept = departments[0]?.id || "";
                setTargetDeptId(firstDept);
                const firstUser = users.find((u) => !u.departmentId || u.departmentId === firstDept);
                setMentorUserId(firstUser?.id || users[0]?.id || "");
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
      <div className="flex items-center gap-1.5 pb-2">
        <button
          onClick={() => setActiveTab("employees")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === "employees"
              ? "bg-white/[0.08] text-white border border-white/[0.12] shadow-xs"
              : "text-[#8a8f98] hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          Company Employees ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab("departments")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            activeTab === "departments"
              ? "bg-white/[0.08] text-white border border-white/[0.12] shadow-xs"
              : "text-[#8a8f98] hover:text-white hover:bg-white/[0.04]"
          }`}
        >
          Mentor Pools ({departments.length} Departments)
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-[#8a8f98]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-xs text-[#a0a6b5]">Loading records...</span>
          </div>
        </div>
      ) : activeTab === "employees" ? (
        /* Employees Table Card */
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#f7f8f8]">
              <thead className="bg-[#14161a] text-[#8a8f98] border-b border-white/[0.06] uppercase font-medium text-[11px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Assigned Mentor</th>
                  <th className="py-3 px-4">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {employees.map((emp) => {
                  const percent = emp.progress?.percentComplete ?? 0;
                  const completed = emp.progress?.completedTasks ?? 0;
                  const total = emp.progress?.totalTasks ?? 0;

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-[#14161a]/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{emp.name}</div>
                        <div className="text-[#8a8f98] text-[11px] mt-0.5">
                          {emp.email}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {emp.department?.name || "N/A"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-white/[0.06] text-white/90 border border-white/[0.08]">
                          {emp.jobRole}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {emp.startDate ? new Date(emp.startDate).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-3.5 px-4 text-[#8a8f98]">
                        {emp.mentor ? (
                          <span className="text-emerald-400 font-medium">
                            {emp.mentor.email}
                          </span>
                        ) : (
                          <span className="text-[#565964]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 max-w-[130px]">
                          <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-white rounded-full transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-white/90">
                            {percent}%
                          </span>
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
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
                    <div className="flex items-center gap-2">
                      <Buildings size={17} className="text-white/80" />
                      <h3 className="text-sm font-semibold text-white m-0">
                        {dept.name}
                      </h3>
                    </div>
                    <Badge variant="purple">{mentors.length} Mentors</Badge>
                  </div>

                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#62666d] block mb-2">
                    Active Mentor Pool
                  </span>

                  {mentors.length === 0 ? (
                    <p className="text-xs text-[#62666d] py-3">
                      No active mentors in this department pool.
                    </p>
                  ) : (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {mentors.map((m) => {
                        const isExpanded = Boolean(expandedMentorIds[m.id]);
                        const mentees = m.mentees || [];

                        return (
                          <div
                            key={m.id}
                            className="rounded-lg bg-[#14161a] border border-white/[0.06] transition-colors"
                          >
                            <div className="flex items-center justify-between p-3">
                              <div className="flex-1">
                                <div className="font-medium text-white/90 text-xs">
                                  {m.user.email}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                    <Users size={12} />
                                    {m.currentMenteeCount} active mentee{m.currentMenteeCount !== 1 ? 's' : ''}
                                  </span>
                                  {mentees.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleMentorExpanded(m.id)}
                                      className="inline-flex items-center gap-0.5 text-[11px] text-[#8a8f98] hover:text-white transition-colors cursor-pointer"
                                    >
                                      <span>{isExpanded ? "Hide mentees" : "View mentees"}</span>
                                      {isExpanded ? <CaretUp size={11} /> : <CaretDown size={11} />}
                                    </button>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveMentor(dept.id, m.id)}
                                className="text-[#62666d] hover:text-[#f87171] p-1.5 cursor-pointer transition-colors"
                                title="Deactivate mentor"
                              >
                                <Trash size={14} />
                              </button>
                            </div>

                            {/* Expandable Mentees List */}
                            {isExpanded && (
                              <div className="border-t border-white/[0.06] bg-[#101216] p-3 space-y-2.5 rounded-b-lg">
                                {mentees.length === 0 ? (
                                  <div className="text-[11px] text-[#62666d]">No mentees assigned currently</div>
                                ) : (
                                  mentees.map((mentee) => {
                                    const progressPercent = mentee.progress?.percentComplete ?? 0;
                                    const completed = mentee.progress?.completedTasks ?? 0;
                                    const total = mentee.progress?.totalTasks ?? 0;

                                    return (
                                      <div
                                        key={mentee.id}
                                        className="p-2.5 rounded bg-[#16181e] border border-white/[0.04] flex items-center justify-between gap-3 text-xs"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-white truncate">{mentee.name}</div>
                                          <div className="text-[11px] text-[#8a8f98] truncate">{mentee.jobRole}</div>
                                          <div className="flex items-center gap-2 mt-1.5">
                                            <div className="w-20 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-emerald-400 rounded-full"
                                                style={{ width: `${progressPercent}%` }}
                                              />
                                            </div>
                                            <span className="text-[10px] text-[#a0a6b5]">
                                              {completed}/{total} ({progressPercent}%)
                                            </span>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenMenteeRoadmap(mentee.id)}
                                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-white/[0.06] hover:bg-white/[0.12] text-white/90 border border-white/[0.08] transition-colors cursor-pointer"
                                        >
                                          <span>Roadmap</span>
                                          <ArrowSquareOut size={12} />
                                        </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-3 border-t border-white/[0.06]">
                  <Button
                    variant="utility"
                    size="sm"
                    icon={<Plus size={13} />}
                    onClick={() => {
                      setTargetDeptId(dept.id);
                      const matchingUsers = users.filter((u) => !u.departmentId || u.departmentId === dept.id);
                      setMentorUserId(matchingUsers[0]?.id || users[0]?.id || "");
                      setIsMentorModalOpen(true);
                    }}
                    className="w-full py-3"
                  >
                    Add Mentor to {dept.name}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Employee / Account Modal */}
      <Modal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        title="Provision Workspace Account"
        maxWidth="md"
      >
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          {/* App Role Selection */}
          <div className="p-3 bg-[#14161a] border border-white/[0.08] rounded-xl space-y-2">
            <label className="text-xs font-medium text-[#f7f8f8] block">
              Application Access Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEmpAppRole("employee")}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all cursor-pointer text-left ${
                  empAppRole === "employee"
                    ? "bg-white/[0.12] border-white/30 text-white shadow-xs"
                    : "bg-[#16181e] border-white/[0.06] text-[#8a8f98] hover:text-white"
                }`}
              >
                <div className="font-semibold">Employee</div>
                <div className="text-[10px] text-[#8a8f98] mt-0.5">Standard new hire</div>
              </button>

              <button
                type="button"
                onClick={() => setEmpAppRole("manager")}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all cursor-pointer text-left ${
                  empAppRole === "manager"
                    ? "bg-white/[0.12] border-white/30 text-white shadow-xs"
                    : "bg-[#16181e] border-white/[0.06] text-[#8a8f98] hover:text-white"
                }`}
              >
                <div className="font-semibold">Manager</div>
                <div className="text-[10px] text-[#8a8f98] mt-0.5">Department head</div>
              </button>

              <button
                type="button"
                onClick={() => setEmpAppRole("hr_admin")}
                className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all cursor-pointer text-left ${
                  empAppRole === "hr_admin"
                    ? "bg-purple-950/40 border-purple-500/50 text-purple-300 shadow-xs"
                    : "bg-[#16181e] border-white/[0.06] text-[#8a8f98] hover:text-purple-300"
                }`}
              >
                <div className="font-semibold flex items-center gap-1">
                  <ShieldCheck size={13} className="text-purple-400" />
                  <span>HR Admin</span>
                </div>
                <div className="text-[10px] text-[#8a8f98] mt-0.5">Platform manager</div>
              </button>
            </div>
            {empAppRole === "hr_admin" && (
              <p className="text-[11px] text-purple-300/80 m-0 pt-1 leading-relaxed">
                HR Administrators have company-wide access to employees, templates, documents, and mentor pools. They do not have onboarding roadmaps or department templates.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>

          {/* Initial Temporary Password Input with generator & clear disclaimer */}
          <div className="space-y-1">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Initial Temporary Password"
                  placeholder="Set or generate temporary password"
                  value={empInitialPassword}
                  onChange={(e) => setEmpInitialPassword(e.target.value)}
                  required
                />
              </div>
              <Button
                type="button"
                variant="utility"
                size="md"
                onClick={generateTempPassword}
                icon={<Key size={14} />}
                className="mb-[1px]"
              >
                Generate
              </Button>
              {empInitialPassword && (
                <Button
                  type="button"
                  variant="utility"
                  size="md"
                  onClick={() => {
                    navigator.clipboard.writeText(empInitialPassword);
                    toast.info("Copied to clipboard", "Temporary password copied");
                  }}
                  icon={<Copy size={14} />}
                  className="mb-[1px]"
                  title="Copy temporary password"
                >
                  Copy
                </Button>
              )}
            </div>
            <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg leading-relaxed mt-1.5">
              Share this temporary password directly with the new hire. They will be required to change it immediately upon their first login before accessing the workspace.
            </p>
          </div>

          {/* Department & Job Role (Hidden/disabled for HR Admin) */}
          {empAppRole !== "hr_admin" && (
            <>
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
                  onChange={(e) =>
                    setEmpType(
                      e.target.value as "full_time" | "part_time" | "contract",
                    )
                  }
                  options={[
                    { value: "full_time", label: "Full Time" },
                    { value: "part_time", label: "Part Time" },
                    { value: "contract", label: "Contract" },
                  ]}
                />
              </div>

              {/* Real-time Template Matching & Snapshot Preview */}
              <div className="p-3.5 bg-[#14161a] border border-white/[0.08] rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 text-white/90 font-medium">
                  <Sparkle size={14} weight="fill" className="text-amber-400" />
                  <span>Snapshot Workflow Preview</span>
                </div>
                {matchedPreview ? (
                  <p className="text-[#8a8f98] m-0">
                    Matches template{" "}
                    <strong className="text-white">
                      "{matchedPreview.template.name}"
                    </strong>{" "}
                    ({matchedPreview.template.tasks?.length || 0} tasks).
                    <br />
                    <span className="text-[11px] text-emerald-400 font-medium">
                      ({matchedPreview.type})
                    </span>
                  </p>
                ) : (
                  <p className="text-[#8a8f98] m-0">
                    No template matched yet. An empty onboarding roadmap will be
                    created.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsEmployeeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isCreatingEmployee}
            >
              Provision Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Mentor Modal (Dropdown of users instead of raw UUID) */}
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
            onChange={(e) => {
              const newDeptId = e.target.value;
              setTargetDeptId(newDeptId);
              const matching = users.filter((u) => !u.departmentId || u.departmentId === newDeptId);
              if (matching.length > 0) {
                setMentorUserId(matching[0].id);
              }
            }}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />

          <Select
            label="Select Team Member"
            value={mentorUserId}
            onChange={(e) => setMentorUserId(e.target.value)}
            options={
              eligibleMentorUsers.length > 0
                ? eligibleMentorUsers.map((u) => ({
                    value: u.id,
                    label: `${u.email} (${u.role.replace("_", " ")})`,
                  }))
                : [{ value: "", label: "No eligible users found" }]
            }
          />
          <p className="text-[11px] text-[#8a8f98]">
            Select an employee or manager to enroll into this department's mentor pool. Mentors are automatically assigned to new hires via round-robin.
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsMentorModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isAddingMentor}
              disabled={!mentorUserId}
            >
              Enroll Mentor
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Mentee Roadmap Modal */}
      <Modal
        isOpen={Boolean(selectedMentee)}
        onClose={() => setSelectedMentee(null)}
        title={selectedMentee ? `${selectedMentee.name}'s Onboarding Roadmap` : "Onboarding Roadmap"}
        maxWidth="lg"
      >
        {selectedMentee && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#14161a] border border-white/[0.06]">
              <div>
                <div className="font-semibold text-white text-sm">{selectedMentee.name}</div>
                <div className="text-[#8a8f98] text-[11px]">{selectedMentee.email} • {selectedMentee.jobRole}</div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-semibold text-sm">
                  {selectedMentee.progress?.percentComplete ?? 0}% Complete
                </div>
                <div className="text-[#62666d] text-[11px]">
                  {selectedMentee.progress?.completedTasks ?? 0} of {selectedMentee.progress?.totalTasks ?? 0} tasks
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(!selectedMentee.tasks || selectedMentee.tasks.length === 0) ? (
                <div className="text-center py-6 text-[#62666d]">No tasks in this onboarding roadmap.</div>
              ) : (
                selectedMentee.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg bg-[#14161a] border border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      {task.status === "completed" ? (
                        <CheckCircle size={17} weight="fill" className="text-emerald-400 shrink-0" />
                      ) : (
                        <Clock size={17} className="text-[#62666d] shrink-0" />
                      )}
                      <div>
                        <div className={`font-medium text-xs ${task.status === "completed" ? "text-[#8a8f98] line-through" : "text-white/90"}`}>
                          {task.title}
                        </div>
                        <div className="text-[11px] text-[#62666d] flex items-center gap-2 mt-0.5">
                          <span>{task.category}</span>
                          <span>•</span>
                          <span className="capitalize">{task.assigneeType}</span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {task.taskUrl && (
                        <a
                          href={task.taskUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded text-[#8a8f98] hover:text-white hover:bg-white/[0.06] transition-colors"
                          title="Open external task link"
                        >
                          <LinkIcon size={14} />
                        </a>
                      )}
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                        task.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-[#8a8f98]"
                      }`}>
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/[0.06]">
              <Button variant="ghost" size="sm" onClick={() => setSelectedMentee(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
