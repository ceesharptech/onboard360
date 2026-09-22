import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { analyticsApi, departmentApi } from "../../api/endpoints";
import type { AnalyticsData, Department } from "../../api/endpoints";
import {
  Clock,
  WarningCircle,
  CheckCircle,
  Users,
  GitFork,
  Buildings,
  ArrowClockwise,
  CaretDown,
} from "@phosphor-icons/react";

export const AnalyticsDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");

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

  // Handle department filter change for HR Admin
  const handleDepartmentChange = (deptId: string) => {
    setSelectedDeptId(deptId);
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
            <div>
              <h1 className="text-2xl font-medium tracking-tight text-[#f7f8f8]">
                {isManager && data?.department
                  ? `${data.department.name} Analytics`
                  : "Onboarding Analytics"}
              </h1>
              <p className="text-sm text-[#8a8f98] mt-0.5">
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
      <div
        className={`grid grid-cols-1 ${
          isHrAdmin && !selectedDeptId && departmentRollups.length > 0
            ? "lg:grid-cols-2"
            : ""
        } gap-4`}
      >
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
      </div>
    </div>
  );
};
