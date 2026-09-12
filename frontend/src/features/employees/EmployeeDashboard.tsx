import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Employee, EmployeeTask } from '../../api/endpoints';
import { employeeApi } from '../../api/endpoints';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import {
  Clock,
  UserCircle,
  CalendarBlank,
  WarningCircle,
  Check,
} from '@phosphor-icons/react';

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await employeeApi.list();
        if (isMounted) {
          if (res && res.length > 0) {
            const fullEmployee = await employeeApi.getOne(res[0].id);
            if (isMounted) setEmployee(fullEmployee);
          } else {
            setEmployee(null);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load onboarding roadmap');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleTask = async (task: EmployeeTask) => {
    if (!employee) return;
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';

    // Optimistic update
    const updatedTasks = (employee.tasks || []).map((t) =>
      t.id === task.id
        ? {
            ...t,
            status: newStatus as 'pending' | 'in_progress' | 'completed',
            completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
          }
        : t
    );
    const total = updatedTasks.length;
    const completed = updatedTasks.filter((t) => t.status === 'completed').length;
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update task status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#8a8f98]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#5e6ad2] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading your onboarding roadmap...</span>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center">
        <Card className="p-8">
          <h2 className="text-xl font-semibold text-[#f7f8f8] mb-2">No Onboarding Record Found</h2>
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
  (employee.tasks || []).forEach((task) => {
    if (!categories[task.category]) {
      categories[task.category] = [];
    }
    categories[task.category].push(task);
  });

  const percent = employee.progress?.percentComplete ?? 0;
  const completedCount = employee.progress?.completedTasks ?? 0;
  const totalCount = employee.progress?.totalTasks ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#23252a]">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-[#f7f8f8] m-0">
              Welcome, {employee.name}
            </h1>
            <Badge variant="blue">{employee.jobRole}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#8a8f98]">
            <span className="flex items-center gap-1.5">
              <CalendarBlank size={15} />
              Start Date: {new Date(employee.startDate).toLocaleDateString()}
            </span>
            <span>•</span>
            <span>{employee.department.name} Department</span>
          </div>
        </div>

        {/* Assigned Mentor Card */}
        {employee.mentor && (
          <div className="flex items-center gap-3 bg-[#0f1011] border border-[#23252a] rounded-xl px-4 py-2.5 shadow-sm">
            <div className="w-8 h-8 rounded-full bg-[rgba(39,166,68,0.12)] flex items-center justify-center text-[#27a644]">
              <UserCircle size={22} weight="duotone" />
            </div>
            <div className="text-left">
              <span className="text-[11px] font-semibold text-[#62666d] uppercase tracking-wider block">
                Assigned Mentor
              </span>
              <span className="text-xs font-medium text-[#f7f8f8]">
                {employee.mentor.email}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-xs text-[#f87171]">
          {error}
        </div>
      )}

      {/* Progress Overview Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#f7f8f8] tracking-tight">Onboarding Progress</h3>
            <span className="text-xs text-[#8a8f98]">
              {completedCount} of {totalCount} tasks completed
            </span>
          </div>
          <span className="text-xl font-bold text-[#5e6ad2]">{percent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-[#141516] rounded-full overflow-hidden border border-[#23252a]">
          <div
            className="h-full bg-[#5e6ad2] transition-all duration-300 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>

        {employee.progress && employee.progress.overdueTasks > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-[#d9730d]">
            <WarningCircle size={15} />
            <span>{employee.progress.overdueTasks} task(s) are past due date</span>
          </div>
        )}
      </Card>

      {/* Categorized Task Roadmap */}
      <div className="space-y-6">
        {Object.entries(categories).map(([category, tasks]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#8a8f98] m-0">
                {category}
              </h2>
              <span className="text-xs text-[#62666d]">({tasks.length})</span>
            </div>

            <div className="flex flex-col gap-2">
              {tasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const isOverdue =
                  !isCompleted && task.dueDate && new Date(task.dueDate) < new Date();

                return (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task)}
                    className={`flex items-start justify-between p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isCompleted
                        ? 'bg-[#0f1011]/60 border-[#23252a] opacity-75'
                        : 'bg-[#0f1011] border-[#23252a] hover:border-[#34343a] hover:bg-[#141516]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                          isCompleted
                            ? 'bg-[#27a644] text-white'
                            : 'border border-[#34343a] hover:border-[#5e6ad2] bg-[#141516]'
                        }`}
                      >
                        {isCompleted ? <Check size={13} weight="bold" /> : null}
                      </button>

                      <div>
                        <h4
                          className={`text-sm font-medium tracking-tight m-0 ${
                            isCompleted ? 'line-through text-[#62666d]' : 'text-[#f7f8f8]'
                          }`}
                        >
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="text-xs text-[#8a8f98] mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 ml-4">
                      {task.dueDate && (
                        <span
                          className={`text-xs flex items-center gap-1 ${
                            isOverdue
                              ? 'text-[#d9730d] font-medium'
                              : 'text-[#8a8f98]'
                          }`}
                        >
                          <Clock size={13} />
                          {new Date(task.dueDate).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}

                      <Badge
                        variant={
                          task.assigneeType === 'manager'
                            ? 'purple'
                            : task.assigneeType === 'mentor'
                            ? 'orange'
                            : 'gray'
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
    </div>
  );
};
