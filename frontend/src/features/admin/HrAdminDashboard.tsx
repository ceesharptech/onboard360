import React, { useState, useEffect } from "react";
import type {
  Employee,
  Department,
  Mentor,
  OnboardingTemplate,
  User,
  PaginationMeta,
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
import { Pagination } from "../../components/common/Pagination";
import { useToast } from "../../context/ToastContext";
import { EmployeeDetailModal } from "./EmployeeDetailModal";
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
  PencilSimple,
  MagnifyingGlass,
  X,
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
  const [empAppRole, setEmpAppRole] = useState<
    "employee" | "manager" | "hr_admin"
  >("employee");
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

  // New Employee Manager & Template Selection State
  const [empManagerId, setEmpManagerId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("auto");

  // Department CRUD State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [isCreatingDept, setIsCreatingDept] = useState(false);

  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [isUpdatingDept, setIsUpdatingDept] = useState(false);

  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [isDeletingDept, setIsDeletingDept] = useState(false);

  // Add Mentor Modal State
  const [isMentorModalOpen, setIsMentorModalOpen] = useState(false);
  const [targetDeptId, setTargetDeptId] = useState("");
  const [mentorUserId, setMentorUserId] = useState("");
  const [isAddingMentor, setIsAddingMentor] = useState(false);

  // Expandable Mentees in Mentor Pool State
  const [expandedMentorIds, setExpandedMentorIds] = useState<
    Record<string, boolean>
  >({});

  // View Mentee Roadmap Modal State
  const [selectedMentee, setSelectedMentee] = useState<Employee | null>(null);

  // Employee Detail View State (Phase 5.2)
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Employee Search, Filter & Pagination State (Phase 5.3)
  const [empSearch, setEmpSearch] = useState("");
  const [debouncedEmpSearch, setDebouncedEmpSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<
    "" | "not_started" | "in_progress" | "complete" | "overdue"
  >("");
  const [empPage, setEmpPage] = useState(1);
  const [empPagination, setEmpPagination] = useState<PaginationMeta>({
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
      setDebouncedEmpSearch(empSearch);
      setEmpPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [empSearch]);

  const loadEmployees = async (
    page = empPage,
    search = debouncedEmpSearch,
    dept = selectedDeptFilter,
    status = selectedStatusFilter,
  ) => {
    try {
      const res = await employeeApi.list({
        page,
        limit: 20,
        search: search || undefined,
        departmentId: dept || undefined,
        status: status || undefined,
      });
      setEmployees(res);
      if (res.pagination) {
        setEmpPagination(res.pagination);
      }
    } catch (err: unknown) {
      console.error("Failed to load employees:", err);
    }
  };

  const generateTempPassword = () => {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
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
        employeeApi.list({
          page: 1,
          limit: 20,
          search: debouncedEmpSearch || undefined,
          departmentId: selectedDeptFilter || undefined,
          status: selectedStatusFilter || undefined,
        }),
        departmentApi.list(),
        templateApi.list(),
        userApi.list({ paginate: false }).catch(() => []),
      ]);

      setEmployees(empList);
      if (empList.pagination) {
        setEmpPagination(empList.pagination);
      }
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

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    loadEmployees(
      empPage,
      debouncedEmpSearch,
      selectedDeptFilter,
      selectedStatusFilter,
    );
  }, [empPage, debouncedEmpSearch, selectedDeptFilter, selectedStatusFilter]);

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
      setError(
        "Department and Job Role are required for Employees and Managers",
      );
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
        managerId: empAppRole === "hr_admin" ? null : empManagerId || null,
        templateId:
          empAppRole === "hr_admin"
            ? null
            : selectedTemplateId && selectedTemplateId !== "auto"
              ? selectedTemplateId
              : null,
      });

      toast.success(
        "Account created",
        `Successfully provisioned ${empAppRole.replace("_", " ")} account for ${empName}`,
      );

      setIsEmployeeModalOpen(false);
      setEmpName("");
      setEmpEmail("");
      setEmpRole("");
      setEmpInitialPassword("");
      setEmpAppRole("employee");
      setEmpManagerId("");
      setSelectedTemplateId("auto");
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create employee";
      setError(msg);
      toast.error("Failed to create account", msg);
    } finally {
      setIsCreatingEmployee(false);
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;

    setIsCreatingDept(true);
    try {
      await departmentApi.create(deptName.trim());
      toast.success(
        "Department created",
        `Successfully created ${deptName.trim()}`,
      );
      setIsDeptModalOpen(false);
      setDeptName("");
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to create department";
      toast.error("Failed to create department", msg);
    } finally {
      setIsCreatingDept(false);
    }
  };

  const handleUpdateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !editDeptName.trim()) return;

    setIsUpdatingDept(true);
    try {
      await departmentApi.update(editingDept.id, editDeptName.trim());
      toast.success(
        "Department updated",
        `Successfully renamed department to ${editDeptName.trim()}`,
      );
      setEditingDept(null);
      setEditDeptName("");
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update department";
      toast.error("Failed to update department", msg);
    } finally {
      setIsUpdatingDept(false);
    }
  };

  const handleDeleteDepartment = async (dept: Department) => {
    setIsDeletingDept(true);
    try {
      await departmentApi.delete(dept.id);
      toast.success("Department deleted", `Successfully removed ${dept.name}`);
      setDeletingDept(null);
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete department";
      toast.error("Cannot delete department", msg);
    } finally {
      setIsDeletingDept(false);
    }
  };

  const handleAddMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptId || !mentorUserId) return;

    setIsAddingMentor(true);
    try {
      await departmentApi.addMentor(targetDeptId, mentorUserId);
      toast.success(
        "Mentor added",
        "Enrolled team member into department mentor pool",
      );
      setIsMentorModalOpen(false);
      setMentorUserId("");
      loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to add mentor to pool";
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
      const msg =
        err instanceof Error ? err.message : "Failed to remove mentor";
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
          <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-[#f7f8f8] m-0">
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
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                icon={<Buildings size={15} />}
                onClick={() => {
                  setDeptName("");
                  setIsDeptModalOpen(true);
                }}
              >
                New Department
              </Button>
              <Button
                variant="utility"
                icon={<Plus size={15} />}
                onClick={() => {
                  const firstDept = departments[0]?.id || "";
                  setTargetDeptId(firstDept);
                  const firstUser = users.find(
                    (u) => !u.departmentId || u.departmentId === firstDept,
                  );
                  setMentorUserId(firstUser?.id || users[0]?.id || "");
                  setIsMentorModalOpen(true);
                }}
              >
                Add Mentor
              </Button>
            </div>
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
          Company Employees ({empPagination.total})
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
        <div className="space-y-3">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8a8f98]">
                <MagnifyingGlass size={14} />
              </div>
              <input
                type="text"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                placeholder="Search by name, email, or role..."
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#0f1013] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/30 rounded-md text-[#f7f8f8] placeholder-[#565964] focus:outline-none transition-colors"
              />
              {empSearch && (
                <button
                  type="button"
                  onClick={() => setEmpSearch("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#8a8f98] hover:text-white"
                  title="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedDeptFilter}
                onChange={(e) => {
                  setSelectedDeptFilter(e.target.value);
                  setEmpPage(1);
                }}
                className="px-2.5 py-1.5 text-xs bg-[#0f1013] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/30 rounded-md text-[#f7f8f8] focus:outline-none transition-colors"
                aria-label="Filter by department"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => {
                  setSelectedStatusFilter(e.target.value as any);
                  setEmpPage(1);
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

              {(empSearch || selectedDeptFilter || selectedStatusFilter) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEmpSearch("");
                    setSelectedDeptFilter("");
                    setSelectedStatusFilter("");
                    setEmpPage(1);
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          {/* Employees Table Card */}
          <Card className="p-0 overflow-hidden">
            {employees.length === 0 ? (
              <div className="text-center py-12 px-4 text-[#8a8f98]">
                <Users size={32} className="mx-auto mb-2 text-[#565964]" />
                <p className="text-sm font-medium text-white mb-1">
                  No employees found
                </p>
                <p className="text-xs max-w-sm mx-auto text-[#8a8f98]">
                  {empSearch || selectedDeptFilter || selectedStatusFilter
                    ? "No employees match the current search query or filter criteria."
                    : "No employees added yet. Click 'Add Employee / User' to get started."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#f7f8f8]">
                  <thead className="bg-[#14161a] text-[#8a8f98] border-b border-white/[0.06] uppercase font-medium text-[11px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Manager</th>
                      <th className="py-3 px-4">Assigned Mentor</th>
                      <th className="py-3 px-4">Start Date</th>
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
                          onClick={() => {
                            setDetailEmployeeId(emp.id);
                            setIsDetailModalOpen(true);
                          }}
                          className="hover:bg-[#14161a]/80 transition-colors cursor-pointer group"
                          title="Click to view full onboarding roadmap & assign tasks"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-white">
                              {emp.name}
                            </div>
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
                            {emp.manager ? (
                              <span className="text-white/90 font-medium">
                                {emp.manager.email}
                              </span>
                            ) : (
                              <span className="text-[#565964]">None</span>
                            )}
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
                          <td className="py-3.5 px-4 text-[#8a8f98]">
                            {emp.startDate
                              ? new Date(emp.startDate).toLocaleDateString()
                              : "N/A"}
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
            )}

            <Pagination
              currentPage={empPage}
              totalPages={empPagination.totalPages}
              totalItems={empPagination.total}
              pageSize={empPagination.limit}
              onPageChange={(newPage) => setEmpPage(newPage)}
            />
          </Card>
        </div>
      ) : (
        /* Departments & Mentor Pools */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 pb-1">
            <div>
              <h3 className="text-sm font-semibold text-white m-0">
                Departments & Org Structure
              </h3>
              <p className="text-xs text-[#8a8f98] mt-0.5 m-0">
                Manage company departments and configure mentor pools
              </p>
            </div>
            <Button
              variant="utility"
              size="sm"
              icon={<Plus size={13} />}
              onClick={() => {
                setDeptName("");
                setIsDeptModalOpen(true);
              }}
            >
              Add Department
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {departments.map((dept) => {
              const mentors = departmentMentors[dept.id] || [];

              return (
                <Card
                  key={dept.id}
                  className="p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
                      <div className="flex items-center gap-2">
                        <Buildings size={17} className="text-white/80" />
                        <h3 className="text-sm font-semibold text-white m-0">
                          {dept.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="purple">{mentors.length} Mentors</Badge>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDept(dept);
                            setEditDeptName(dept.name);
                          }}
                          className="p-1.5 rounded text-[#8a8f98] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                          title="Rename department"
                        >
                          <PencilSimple size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingDept(dept)}
                          className="p-1.5 rounded text-[#8a8f98] hover:text-[#f87171] hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete department"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
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
                                      {m.currentMenteeCount} active mentee
                                      {m.currentMenteeCount !== 1 ? "s" : ""}
                                    </span>
                                    {mentees.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleMentorExpanded(m.id)
                                        }
                                        className="inline-flex items-center gap-0.5 text-[11px] text-[#8a8f98] hover:text-white transition-colors cursor-pointer"
                                      >
                                        <span>
                                          {isExpanded
                                            ? "Hide mentees"
                                            : "View mentees"}
                                        </span>
                                        {isExpanded ? (
                                          <CaretUp size={11} />
                                        ) : (
                                          <CaretDown size={11} />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() =>
                                    handleRemoveMentor(dept.id, m.id)
                                  }
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
                                    <div className="text-[11px] text-[#62666d]">
                                      No mentees assigned currently
                                    </div>
                                  ) : (
                                    mentees.map((mentee) => {
                                      const progressPercent =
                                        mentee.progress?.percentComplete ?? 0;
                                      const completed =
                                        mentee.progress?.completedTasks ?? 0;
                                      const total =
                                        mentee.progress?.totalTasks ?? 0;

                                      return (
                                        <div
                                          key={mentee.id}
                                          className="p-2.5 rounded bg-[#16181e] border border-white/[0.04] flex items-center justify-between gap-3 text-xs"
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-white truncate">
                                              {mentee.name}
                                            </div>
                                            <div className="text-[11px] text-[#8a8f98] truncate">
                                              {mentee.jobRole}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5">
                                              <div className="w-20 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                                                <div
                                                  className="h-full bg-emerald-400 rounded-full"
                                                  style={{
                                                    width: `${progressPercent}%`,
                                                  }}
                                                />
                                              </div>
                                              <span className="text-[10px] text-[#a0a6b5]">
                                                {completed}/{total} (
                                                {progressPercent}%)
                                              </span>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleOpenMenteeRoadmap(mentee.id)
                                            }
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
                        const matchingUsers = users.filter(
                          (u) => !u.departmentId || u.departmentId === dept.id,
                        );
                        setMentorUserId(
                          matchingUsers[0]?.id || users[0]?.id || "",
                        );
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
                <div className="text-[10px] text-[#8a8f98] mt-0.5">
                  Standard new hire
                </div>
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
                <div className="text-[10px] text-[#8a8f98] mt-0.5">
                  Department head
                </div>
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
                <div className="text-[10px] text-[#8a8f98] mt-0.5">
                  Platform manager
                </div>
              </button>
            </div>
            {empAppRole === "hr_admin" && (
              <p className="text-[11px] text-purple-300/80 m-0 pt-1 leading-relaxed">
                HR Administrators have company-wide access to employees,
                templates, documents, and mentor pools. They do not have
                onboarding roadmaps or department templates.
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
                    toast.info(
                      "Copied to clipboard",
                      "Temporary password copied",
                    );
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
              Share this temporary password directly with the new hire. They
              will be required to change it immediately upon their first login
              before accessing the workspace.
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
                  options={departments.map((d) => ({
                    value: d.id,
                    label: d.name,
                  }))}
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

              {/* Manager Dropdown */}
              <Select
                label="Reporting Manager (Optional)"
                value={empManagerId}
                onChange={(e) => setEmpManagerId(e.target.value)}
                options={[
                  { value: "", label: "No manager assigned (optional)" },
                  ...users
                    .filter((u) => u.role === "manager")
                    .map((u) => {
                      const isSameDept = u.departmentId === empDeptId;
                      const uDept = departments.find(
                        (d) => d.id === u.departmentId,
                      );
                      const deptSuffix = isSameDept
                        ? " (Department Manager)"
                        : uDept
                          ? ` (${uDept.name})`
                          : "";
                      return {
                        value: u.id,
                        label: `${u.email}${deptSuffix}`,
                      };
                    }),
                ]}
              />

              {/* Template Selector (Auto-match with manual override) */}
              <Select
                label="Onboarding Template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                options={[
                  {
                    value: "auto",
                    label: matchedPreview
                      ? `Suggested: ${matchedPreview.template.name} (${matchedPreview.type})`
                      : "Automatic Matching (None available)",
                  },
                  ...templates.map((t) => {
                    const tDept = departments.find(
                      (d) => d.id === t.departmentId,
                    );
                    return {
                      value: t.id,
                      label: `${t.name} (${tDept ? tDept.name : "Company-wide"})${t.isDefault ? " [Default]" : ""}`,
                    };
                  }),
                ]}
              />

              {/* Real-time Template Matching & Snapshot Preview */}
              {(() => {
                const isManualOverride =
                  selectedTemplateId !== "auto" && Boolean(selectedTemplateId);
                const activeTemplate = isManualOverride
                  ? templates.find((t) => t.id === selectedTemplateId)
                  : matchedPreview?.template;

                if (!activeTemplate) {
                  return (
                    <div className="p-3.5 bg-[#14161a] border border-white/[0.08] rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 text-white/90 font-medium">
                        <Sparkle
                          size={14}
                          weight="fill"
                          className="text-amber-400"
                        />
                        <span>Snapshot Workflow Preview</span>
                      </div>
                      <p className="text-[#8a8f98] m-0">
                        No template selected or matched yet. An empty onboarding
                        roadmap will be created.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="p-3.5 bg-[#14161a] border border-white/[0.08] rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-white/90 font-medium">
                        <Sparkle
                          size={14}
                          weight="fill"
                          className="text-amber-400"
                        />
                        <span>Snapshot Workflow Preview</span>
                      </div>
                      <Badge variant={isManualOverride ? "purple" : "green"}>
                        {isManualOverride
                          ? "Manual Override"
                          : matchedPreview?.type || "Auto-Matched"}
                      </Badge>
                    </div>
                    <p className="text-[#8a8f98] m-0">
                      Assigned template:{" "}
                      <strong className="text-white font-medium">
                        "{activeTemplate.name}"
                      </strong>{" "}
                      ({activeTemplate.tasks?.length || 0} tasks).
                      <br />
                      <span className="text-[11px] text-[#8a8f98]">
                        {isManualOverride
                          ? "Selected manually by HR Admin. These tasks will be snapshotted to the new hire."
                          : "Matched automatically based on role and department."}
                      </span>
                    </p>
                  </div>
                );
              })()}
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
              const matching = users.filter(
                (u) => !u.departmentId || u.departmentId === newDeptId,
              );
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
            Select an employee or manager to enroll into this department's
            mentor pool. Mentors are automatically assigned to new hires via
            round-robin.
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
        title={
          selectedMentee
            ? `${selectedMentee.name}'s Onboarding Roadmap`
            : "Onboarding Roadmap"
        }
        maxWidth="lg"
      >
        {selectedMentee && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#14161a] border border-white/[0.06]">
              <div>
                <div className="font-semibold text-white text-sm">
                  {selectedMentee.name}
                </div>
                <div className="text-[#8a8f98] text-[11px]">
                  {selectedMentee.email} • {selectedMentee.jobRole}
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 font-semibold text-sm">
                  {selectedMentee.progress?.percentComplete ?? 0}% Complete
                </div>
                <div className="text-[#62666d] text-[11px]">
                  {selectedMentee.progress?.completedTasks ?? 0} of{" "}
                  {selectedMentee.progress?.totalTasks ?? 0} tasks
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {!selectedMentee.tasks || selectedMentee.tasks.length === 0 ? (
                <div className="text-center py-6 text-[#62666d]">
                  No tasks in this onboarding roadmap.
                </div>
              ) : (
                selectedMentee.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg bg-[#14161a] border border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      {task.status === "completed" ? (
                        <CheckCircle
                          size={17}
                          weight="fill"
                          className="text-emerald-400 shrink-0"
                        />
                      ) : (
                        <Clock size={17} className="text-[#62666d] shrink-0" />
                      )}
                      <div>
                        <div
                          className={`font-medium text-xs ${task.status === "completed" ? "text-[#8a8f98] line-through" : "text-white/90"}`}
                        >
                          {task.title}
                        </div>
                        <div className="text-[11px] text-[#62666d] flex items-center gap-2 mt-0.5">
                          <span>{task.category}</span>
                          <span>•</span>
                          <span className="capitalize">
                            {task.assigneeType}
                          </span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span>
                                Due{" "}
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
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
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                          task.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-white/[0.06] text-[#8a8f98]"
                        }`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/[0.06]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMentee(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Department Modal */}
      <Modal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Create New Department"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateDepartment} className="space-y-4">
          <Input
            label="Department Name"
            placeholder="e.g. Design, Customer Success, Product"
            value={deptName}
            onChange={(e) => setDeptName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsDeptModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isCreatingDept}
              disabled={!deptName.trim()}
            >
              Create Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Department Modal */}
      <Modal
        isOpen={Boolean(editingDept)}
        onClose={() => setEditingDept(null)}
        title="Rename Department"
        maxWidth="sm"
      >
        <form onSubmit={handleUpdateDepartment} className="space-y-4">
          <Input
            label="Department Name"
            value={editDeptName}
            onChange={(e) => setEditDeptName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setEditingDept(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isUpdatingDept}
              disabled={!editDeptName.trim()}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Department Modal */}
      <Modal
        isOpen={Boolean(deletingDept)}
        onClose={() => setDeletingDept(null)}
        title="Delete Department"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#8a8f98] leading-relaxed">
            Are you sure you want to delete{" "}
            <strong className="text-white">{deletingDept?.name}</strong>?
            <br />
            Departments can only be deleted if they have no active employees,
            onboarding templates, or mentors assigned.
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setDeletingDept(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              isLoading={isDeletingDept}
              onClick={() =>
                deletingDept && handleDeleteDepartment(deletingDept)
              }
              className="bg-red-600 hover:bg-red-700 text-white border-red-500"
            >
              Delete Department
            </Button>
          </div>
        </div>
      </Modal>

      {/* Employee Detail Modal (Phase 5.2) */}
      <EmployeeDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailEmployeeId(null);
        }}
        employeeId={detailEmployeeId}
        onEmployeeUpdated={loadData}
      />
    </div>
  );
};
