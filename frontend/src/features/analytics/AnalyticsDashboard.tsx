import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { analyticsApi, departmentApi } from "../../api/endpoints";
import type {
  AnalyticsData,
  Department,
  EmployeeAnalyticsItem,
} from "../../api/endpoints";
import {
  ChartBar,
  TrendUp,
  Clock,
  WarningCircle,
  CheckCircle,
  Users,
  GitFork,
  Buildings,
  ArrowClockwise,
  MagnifyingGlass,
  CaretDown,
} from "@phosphor-icons/react";

export const AnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "complete" | "in_progress" | "overdue"
  >("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const isHrAdmin = user?.role === "hr_admin";
  const isManager = user?.role === "manager";

  // Load department list for HR Admin filter
  useEffect(() => {
    if (isHrAdmin) {
      departmentApi
        .list({ limit: 100 })
        .then((res: any) => {
          if (Array.isArray(res)) setDepartments(res);
          else if (res && Array.isArray(res.data)) setDepartments(res.data);
        })
        .catch(() => {});
    }
  }, [isHrAdmin]);

  // Fetch analytics data
  const fetchAnalytics = async (deptId?: string) => {
    try {
      setLoading(true);
      const params = deptId ? { departmentId: deptId } : undefined;
      const res: any = await analyticsApi.get(params);
      const analyticsData = res?.summary !== undefined ? res : res?.data || res;
      setData(analyticsData);
    } catch (err: any) {
      showToast(err.message || "Failed to load analytics data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(selectedDeptId || undefined);
  }, [selectedDeptId]);

  // Filtered employee progress list
  const filteredEmployees = useMemo(() => {
    const emps = data?.employees || [];
    return emps.filter((emp: EmployeeAnalyticsItem) => {
      const matchesSearch =
        !searchQuery ||
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.jobRole.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === "complete")
        return emp.progress.percentComplete === 100;
      if (statusFilter === "overdue") return emp.progress.overdueTasks > 0;
      if (statusFilter === "in_progress")
        return (
          emp.progress.percentComplete < 100 && emp.progress.overdueTasks === 0
        );

      return true;
    });
  }, [data?.employees, searchQuery, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / pageSize),
  );
  const paginatedEmployees = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredEmployees.slice(start, start + pageSize);
  }, [filteredEmployees, page, pageSize]);

  // Handle department filter change for HR Admin
  const handleDepartmentChange = (deptId: string) => {
    setSelectedDeptId(deptId);
    setPage(1);
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[#8a8f98]">
        <div className="w-8 h-8 border-2 border-white/20 border-t-indigo-400 rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium">
          Computing analytics across onboarding workflows...
        </p>
      </div>
    );
  }

  const summary = data?.summary || {
    totalEmployees: 0,
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    overallPercentComplete: 0,
    avgDaysToComplete: 0,
  };

  const overallPercent =
    summary.overallPercentComplete ??
    (summary as any).overallCompletionRate ??
    0;
  const avgVelocityDays =
    summary.avgDaysToComplete ??
    (summary as any).averageTimeToCompleteDays ??
    0;

  const departmentRollups =
    data?.departmentRollups || (data as any)?.departments || [];
  const templateRollups =
    data?.templateRollups || (data as any)?.templates || [];
  const taskPerformance =
    data?.taskPerformance || (data as any)?.taskAverages || [];

  // SVG Circular Gauge calculations
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (overallPercent / 100) * circumference;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ChartBar size={22} weight="duotone" />
            </div>
            <div>
              <h1 className="text-xl font-medium tracking-tight text-[#f7f8f8]">
                {isManager && data?.department
                  ? `${data.department.name} Analytics`
                  : "Onboarding Analytics"}
              </h1>
              <p className="text-xs text-[#8a8f98] mt-0.5">
                Real-time completion metrics, workflow velocity, and team
                onboarding health.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Department Filter (HR Admin only) */}
          {isHrAdmin && (
            <div className="relative">
              <select
                value={selectedDeptId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                aria-label="Filter by department"
                className="appearance-none bg-[#121316] border border-white/[0.08] hover:border-white/[0.16] rounded-md px-3 py-1.5 pr-8 text-xs font-medium text-[#f7f8f8] focus:outline-none focus:border-indigo-500/60 transition-colors cursor-pointer"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <CaretDown
                size={12}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a8f98] pointer-events-none"
              />
            </div>
          )}

          {/* Department Indicator for Manager */}
          {isManager && data?.department && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs text-[#d0d6e0]">
              <Buildings size={14} className="text-[#8a8f98]" />
              <span>{data.department.name}</span>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAnalytics(selectedDeptId || undefined)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-[#d0d6e0] hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50"
            title="Refresh analytics data"
          >
            <ArrowClockwise
              size={14}
              className={loading ? "animate-spin" : ""}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Level Metric Cards with subtle hover animation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Overall Completion Rate Card with Radial Gauge */}
        <div className="bg-[#121316] border border-white/[0.06] hover:border-white/[0.12] rounded-lg p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-medium text-[#8a8f98] uppercase tracking-wider">
              Completion Rate
            </span>
            <div className="text-2xl font-medium tracking-tight text-[#f7f8f8]">
              {overallPercent}%
            </div>
            <p className="text-[11px] text-[#8a8f98]">
              {summary.completedTasks} of {summary.totalTasks} tasks complete
            </p>
          </div>

          <div className="relative w-18 h-18 flex items-center justify-center">
            <svg className="w-18 h-18 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-white/[0.06]"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-white transition-all duration-700 ease-out"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>
            <span className="absolute text-xs font-semibold text-white">
              {overallPercent}%
            </span>
          </div>
        </div>

        {/* Active Employees */}
        <div className="bg-[#121316] border border-white/[0.06] hover:border-white/[0.12] rounded-lg p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8a8f98] uppercase tracking-wider">
              Active Cohort
            </span>
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-medium tracking-tight text-[#f7f8f8]">
              {summary.totalEmployees}
            </div>
            <p className="text-[11px] text-[#8a8f98] mt-1">
              Employees in active onboarding workflows
            </p>
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="bg-[#121316] border border-white/[0.06] hover:border-white/[0.12] rounded-lg p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8a8f98] uppercase tracking-wider">
              Overdue Tasks
            </span>
            <div
              className={`p-1.5 rounded-md border ${
                summary.overdueTasks > 0
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}
            >
              {summary.overdueTasks > 0 ? (
                <WarningCircle size={16} />
              ) : (
                <CheckCircle size={16} />
              )}
            </div>
          </div>
          <div className="mt-2">
            <div
              className={`text-2xl font-medium tracking-tight ${
                summary.overdueTasks > 0 ? "text-rose-400" : "text-[#f7f8f8]"
              }`}
            >
              {summary.overdueTasks}
            </div>
            <p className="text-[11px] text-[#8a8f98] mt-1">
              {summary.overdueTasks > 0
                ? "Tasks requiring immediate attention"
                : "All workflows on schedule"}
            </p>
          </div>
        </div>

        {/* Average Time to Complete */}
        <div className="bg-[#121316] border border-white/[0.06] hover:border-white/[0.12] rounded-lg p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8a8f98] uppercase tracking-wider">
              Completion Velocity
            </span>
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-medium tracking-tight text-[#f7f8f8]">
              {avgVelocityDays}{" "}
              <span className="text-sm font-normal text-[#8a8f98]">days</span>
            </div>
            <p className="text-[11px] text-[#8a8f98] mt-1">
              Average duration from creation to completion
            </p>
          </div>
        </div>
      </div>

      {/* Middle Section: Department Rollups & Template Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Department Rollups (or Template Summary if Manager) */}
        {isHrAdmin && !selectedDeptId && departmentRollups.length > 0 && (
          <div className="bg-[#121316] border border-white/[0.06] rounded-lg p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
              <div className="flex items-center gap-2">
                <Buildings size={16} className="text-[#8a8f98]" />
                <h2 className="text-sm font-medium text-[#f7f8f8]">
                  Department Breakdown
                </h2>
              </div>
              <span className="text-[11px] text-[#8a8f98]">
                {departmentRollups.length} departments
              </span>
            </div>

            <div className="space-y-3">
              {departmentRollups.map((dept: any) => {
                const deptPercent =
                  dept.percentComplete ?? dept.completionRate ?? 0;
                return (
                  <div key={dept.departmentId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#f7f8f8]">
                          {dept.departmentName}
                        </span>
                        <span className="text-[10px] text-[#8a8f98]">
                          ({dept.employeeCount}{" "}
                          {dept.employeeCount === 1 ? "employee" : "employees"})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {dept.overdueTasks > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                            {dept.overdueTasks} overdue
                          </span>
                        )}
                        <span className="font-semibold text-white">
                          {deptPercent}%
                        </span>
                      </div>
                    </div>

                    {/* Horizontal Progress Bar with subtle animation */}
                    <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${deptPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#8a8f98]">
                      <span>
                        {dept.completedTasks} / {dept.totalTasks} tasks
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Template Velocity & Performance */}
        <div className="bg-[#121316] border border-white/[0.06] rounded-lg p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
            <div className="flex items-center gap-2">
              <GitFork size={16} className="text-[#8a8f98]" />
              <h2 className="text-sm font-medium text-[#f7f8f8]">
                Template Performance
              </h2>
            </div>
            <span className="text-[11px] text-[#8a8f98]">
              {templateRollups.length} templates
            </span>
          </div>

          {templateRollups.length === 0 ? (
            <p className="text-xs text-[#8a8f98] py-4 text-center">
              No template analytics available yet.
            </p>
          ) : (
            <div className="space-y-3">
              {templateRollups.map((tpl: any) => {
                const tplPercent =
                  tpl.percentComplete ?? tpl.completionRate ?? 0;
                const tplAvgDays =
                  tpl.avgDaysToComplete ?? tpl.averageTimeToCompleteDays ?? 0;
                const activeCount =
                  tpl.assignedEmployeesCount ?? tpl.assignedCount ?? 0;
                return (
                  <div key={tpl.templateId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate max-w-[200px] sm:max-w-[280px]">
                        <span className="font-medium text-[#f7f8f8] truncate">
                          {tpl.templateName}
                        </span>
                        <span className="text-[10px] text-[#8a8f98] shrink-0">
                          ({activeCount} active)
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[10px] text-[#8a8f98]">
                          Avg: {tplAvgDays}d
                        </span>
                        <span className="font-semibold text-indigo-300">
                          {tplPercent}%
                        </span>
                      </div>
                    </div>

                    <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${tplPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#8a8f98]">
                      <span>
                        {tpl.completedTasks} / {tpl.totalTasks} completed
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Task Velocity Watchlist / Bottlenecks */}
        <div className="bg-[#121316] border border-white/[0.06] rounded-lg p-4 space-y-3.5">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2.5">
            <div className="flex items-center gap-2">
              <TrendUp size={16} className="text-[#8a8f98]" />
              <h2 className="text-sm font-medium text-[#f7f8f8]">
                Task Velocity & Watchlist
              </h2>
            </div>
            <span className="text-[11px] text-[#8a8f98]">Top workflows</span>
          </div>

          {taskPerformance.length === 0 ? (
            <p className="text-xs text-[#8a8f98] py-4 text-center">
              No task performance data recorded yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {taskPerformance.slice(0, 6).map((task: any, idx: number) => {
                const taskTitle = task.taskTitle || task.title;
                const taskAvgDays =
                  task.avgDaysToComplete ?? task.averageTimeToCompleteDays ?? 0;
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-md bg-white/[0.02] border border-white/[0.04] text-xs hover:border-white/[0.08] transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <div className="font-medium text-[#f7f8f8] truncate">
                        {taskTitle}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-[#8a8f98] mt-0.5">
                        <span className="capitalize">{task.category}</span>
                        <span>•</span>
                        <span className="capitalize">
                          {task.assigneeType} task
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right shrink-0">
                      {task.overdueCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          {task.overdueCount} overdue
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-[#d0d6e0]">
                        {taskAvgDays}d avg
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Individual Employee Progress Roster */}
      <div className="bg-[#121316] border border-white/[0.06] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.04] pb-4">
          <div>
            <h2 className="text-sm font-medium text-[#f7f8f8]">
              Employee Onboarding Roster
            </h2>
            <p className="text-xs text-[#8a8f98] mt-0.5">
              Individual task progress, overdue indicators, and milestone
              tracking.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <MagnifyingGlass
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a8f98]"
              />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="bg-[#090a0c] border border-white/[0.08] focus:border-indigo-500/60 rounded-md pl-8 pr-3 py-1.5 text-xs text-[#f7f8f8] placeholder-[#8a8f98] focus:outline-none transition-colors w-44 sm:w-56"
              />
            </div>

            {/* Status Filter Pill */}
            <div className="flex items-center gap-1 bg-[#090a0c] border border-white/[0.08] rounded-md p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-white/[0.08] text-white font-medium"
                    : "text-[#8a8f98] hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("in_progress");
                  setPage(1);
                }}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === "in_progress"
                    ? "bg-white/[0.08] text-white font-medium"
                    : "text-[#8a8f98] hover:text-white"
                }`}
              >
                In Progress
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("overdue");
                  setPage(1);
                }}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === "overdue"
                    ? "bg-white/[0.08] text-white font-medium"
                    : "text-[#8a8f98] hover:text-white"
                }`}
              >
                Overdue
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("complete");
                  setPage(1);
                }}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  statusFilter === "complete"
                    ? "bg-white/[0.08] text-white font-medium"
                    : "text-[#8a8f98] hover:text-white"
                }`}
              >
                Complete
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        {paginatedEmployees.length === 0 ? (
          <div className="text-center py-10 text-xs text-[#8a8f98]">
            No employees matching criteria found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#d0d6e0]">
              <thead>
                <tr className="border-b border-white/[0.04] text-[11px] text-[#8a8f98] uppercase tracking-wider">
                  <th className="py-2.5 font-medium">Employee</th>
                  <th className="py-2.5 font-medium">Department</th>
                  <th className="py-2.5 font-medium w-48">Progress</th>
                  <th className="py-2.5 font-medium text-center">Tasks</th>
                  <th className="py-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {paginatedEmployees.map((emp) => {
                  const isCompleted = emp.progress.percentComplete === 100;
                  const isOverdue = emp.progress.overdueTasks > 0;

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-white/[0.02] transition-colors duration-150"
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-white/[0.08] text-white flex items-center justify-center font-bold text-[10px] shrink-0 border border-white/[0.06]">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[#f7f8f8] truncate">
                              {emp.name}
                            </div>
                            <div className="text-[11px] text-[#8a8f98] truncate">
                              {emp.jobRole}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 text-[#a0a6b5]">
                        {emp.department?.name || "—"}
                      </td>

                      <td className="py-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-medium text-white">
                              {emp.progress.percentComplete}%
                            </span>
                            <span className="text-[#8a8f98]">
                              {emp.progress.completedTasks}/
                              {emp.progress.totalTasks}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ease-out ${
                                isCompleted
                                  ? "bg-emerald-400"
                                  : isOverdue
                                    ? "bg-amber-400"
                                    : "bg-indigo-400"
                              }`}
                              style={{
                                width: `${emp.progress.percentComplete}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 text-center text-[#d0d6e0]">
                        <span>
                          {emp.progress.completedTasks} /{" "}
                          {emp.progress.totalTasks}
                        </span>
                        {emp.progress.overdueTasks > 0 && (
                          <div className="text-[10px] text-rose-400 font-medium">
                            {emp.progress.overdueTasks} overdue
                          </div>
                        )}
                      </td>

                      <td className="py-3 text-right">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                            <CheckCircle size={12} weight="bold" /> Completed
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
                            <WarningCircle size={12} weight="bold" /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                            In Progress
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-xs text-[#8a8f98]">
            <span>
              Showing{" "}
              {Math.min((page - 1) * pageSize + 1, filteredEmployees.length)}–
              {Math.min(page * pageSize, filteredEmployees.length)} of{" "}
              {filteredEmployees.length} employees
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[#d0d6e0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-2 text-[#d0d6e0]">
                {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[#d0d6e0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
