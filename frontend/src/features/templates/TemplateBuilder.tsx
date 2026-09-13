import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import type {
  OnboardingTemplate,
  TemplateTask,
  Department,
} from "../../api/endpoints";
import { templateApi, departmentApi } from "../../api/endpoints";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { Input } from "../../components/common/Input";
import { Select } from "../../components/common/Select";
import { Modal } from "../../components/common/Modal";
import {
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  PencilSimple,
  GitFork,
} from "@phosphor-icons/react";

export const TemplateBuilder: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<OnboardingTemplate | null>(null);
  const [name, setName] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tList, dList] = await Promise.all([
        templateApi.list(),
        departmentApi.list(),
      ]);
      setTemplates(tList);
      setDepartments(dList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName("");
    setJobRole("");
    setDepartmentId(user?.departmentId || (departments[0]?.id ?? ""));
    setIsDefault(false);
    setTasks([
      {
        title: "Initial Welcome & Workspace Setup",
        description: "Sign in to workspace apps and complete setup.",
        category: "IT Setup",
        orderIndex: 0,
        assigneeType: "employee",
        dueOffsetDays: 1,
      },
    ]);
    setIsModalOpen(true);
  };

  const openEditModal = (t: OnboardingTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setJobRole(t.jobRole || "");
    setDepartmentId(t.departmentId || "");
    setIsDefault(t.isDefault);
    setTasks(
      t.tasks && t.tasks.length > 0
        ? [...t.tasks].sort((a, b) => a.orderIndex - b.orderIndex)
        : [],
    );
    setIsModalOpen(true);
  };

  const handleAddTask = () => {
    setTasks([
      ...tasks,
      {
        title: "",
        description: "",
        category: "Role Training",
        orderIndex: tasks.length,
        assigneeType: "employee",
        dueOffsetDays: 3,
      },
    ]);
  };

  const handleRemoveTask = (index: number) => {
    const updated = tasks.filter((_, i) => i !== index);
    setTasks(updated.map((t, idx) => ({ ...t, orderIndex: idx })));
  };

  const handleMoveTask = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;

    const updated = [...tasks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setTasks(updated.map((t, idx) => ({ ...t, orderIndex: idx })));
  };

  const handleUpdateTaskField = (
    index: number,
    field: keyof TemplateTask,
    value: string | number,
  ) => {
    const updated = [...tasks];
    updated[index] = { ...updated[index], [field]: value };
    setTasks(updated);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        jobRole: jobRole.trim() || null,
        departmentId: departmentId || null,
        isDefault,
        tasks: tasks.map((t, idx) => ({
          title: t.title,
          description: t.description || null,
          category: t.category,
          orderIndex: idx,
          assigneeType: t.assigneeType,
          dueOffsetDays: Number(t.dueOffsetDays),
        })),
      };

      if (editingTemplate) {
        await templateApi.update(editingTemplate.id, payload);
      } else {
        await templateApi.create(payload);
      }

      setIsModalOpen(false);
      fetchTemplates();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await templateApi.delete(id);
      fetchTemplates();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete template",
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f7f8f8] m-0">
            {user?.role === "manager"
              ? "Department Templates"
              : "Workflow Templates"}
          </h1>
          <p className="text-sm text-[#8a8f98] mt-1">
            Build and manage role-specific onboarding templates. Template tasks
            are snapshotted on employee assignment.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={openCreateModal}
        >
          New Template
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Template Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-[#8a8f98]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading templates...</span>
          </div>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-[#0f1013] border border-white/[0.06] rounded-xl p-8">
          <GitFork size={32} className="text-[#5a5e6b] mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[#f7f8f8] mb-1">
            No Templates Found
          </h3>
          <p className="text-xs text-[#8a8f98] max-w-sm mx-auto mb-4">
            Create your first onboarding workflow template to auto-populate
            tasks when new employees join.
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={openCreateModal}
          >
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-[#0f1013] border border-white/[0.06] hover:border-white/[0.12] rounded-xl p-5 flex flex-col justify-between transition-colors shadow-2xs"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-[#f7f8f8] tracking-tight m-0">
                      {t.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {t.department && (
                        <Badge variant="purple">{t.department.name}</Badge>
                      )}
                      {t.jobRole && <Badge variant="white">{t.jobRole}</Badge>}
                      {t.isDefault && (
                        <Badge variant="green">Default Template</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<PencilSimple size={14} />}
                      onClick={() => openEditModal(t)}
                      title="Edit template"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:text-red-400"
                      icon={<Trash size={14} />}
                      onClick={() => handleDeleteTemplate(t.id)}
                      title="Delete template"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5a5e6b] block mb-2">
                    Tasks ({t.tasks?.length || 0})
                  </span>
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {(t.tasks || []).map((task, idx) => (
                      <div
                        key={task.id || idx}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-md bg-[#14161a] border border-white/[0.06]"
                      >
                        <span className="truncate text-[#f7f8f8] max-w-[220px]">
                          {task.orderIndex + 1}. {task.title}
                        </span>
                        <span className="text-[11px] font-mono text-[#8a8f98] shrink-0">
                          +{task.dueOffsetDays}d ({task.assigneeType})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTemplate ? "Edit Template" : "Create Onboarding Template"}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Template Name"
              placeholder="e.g. Frontend Developer Onboarding"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Job Role Match"
              placeholder="e.g. Frontend Developer"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              helperText="Matches employees created with this exact job role"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {user?.role === "hr_admin" && (
              <Select
                label="Department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                options={[
                  { value: "", label: "None (Company-Wide)" },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            )}

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-white/[0.2] bg-white/[0.05] text-white focus:ring-0 cursor-pointer"
              />
              <label
                htmlFor="isDefault"
                className="text-xs text-[#f7f8f8] cursor-pointer"
              >
                Department Fallback Default Template
              </label>
            </div>
          </div>

          {/* Tasks Builder */}
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98]">
                Template Tasks Checklist ({tasks.length})
              </span>
              <Button
                type="button"
                variant="utility"
                size="sm"
                icon={<Plus size={13} />}
                onClick={handleAddTask}
              >
                Add Task
              </Button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {tasks.map((task, index) => (
                <div
                  key={index}
                  className="p-2.5 bg-[#0a0b0e] border border-white/[0.06] rounded-lg flex items-start gap-2.5"
                >
                  {/* Reorder Buttons */}
                  <div className="flex flex-col gap-1 mt-1 shrink-0">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMoveTask(index, "up")}
                      className="p-1 text-[#5a5e6b] hover:text-[#f7f8f8] disabled:opacity-20 cursor-pointer"
                      title="Move up"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={index === tasks.length - 1}
                      onClick={() => handleMoveTask(index, "down")}
                      className="p-1 text-[#5a5e6b] hover:text-[#f7f8f8] disabled:opacity-20 cursor-pointer"
                      title="Move down"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>

                  {/* Task Fields */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        placeholder="Task title"
                        value={task.title}
                        onChange={(e) =>
                          handleUpdateTaskField(index, "title", e.target.value)
                        }
                        required
                        className="w-full bg-[#14161a] border border-white/[0.08] focus:border-white/30 text-xs text-[#f7f8f8] rounded-md px-2.5 py-1.5 focus:outline-none"
                      />
                    </div>

                    <div>
                      <input
                        placeholder="Category (e.g. IT Setup)"
                        value={task.category}
                        onChange={(e) =>
                          handleUpdateTaskField(
                            index,
                            "category",
                            e.target.value,
                          )
                        }
                        required
                        className="w-full bg-[#14161a] border border-white/[0.08] focus:border-white/30 text-xs text-[#f7f8f8] rounded-md px-2.5 py-1.5 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <input
                        placeholder="Description (optional)"
                        value={task.description || ""}
                        onChange={(e) =>
                          handleUpdateTaskField(
                            index,
                            "description",
                            e.target.value,
                          )
                        }
                        className="w-full bg-[#14161a] border border-white/[0.08] focus:border-white/30 text-xs text-[#f7f8f8] rounded-md px-2.5 py-1.5 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={task.assigneeType}
                        onChange={(e) =>
                          handleUpdateTaskField(
                            index,
                            "assigneeType",
                            e.target.value as "employee" | "manager" | "mentor",
                          )
                        }
                        className="bg-[#14161a] border border-white/[0.08] text-xs text-[#f7f8f8] rounded-md px-2 py-1.5 flex-1 focus:outline-none cursor-pointer"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="mentor">Mentor</option>
                      </select>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-[#5a5e6b]">+</span>
                        <input
                          type="number"
                          min="0"
                          title="Due offset in days"
                          value={task.dueOffsetDays}
                          onChange={(e) =>
                            handleUpdateTaskField(
                              index,
                              "dueOffsetDays",
                              Number(e.target.value),
                            )
                          }
                          className="w-12 bg-[#14161a] border border-white/[0.08] text-xs text-[#f7f8f8] rounded-md px-1.5 py-1.5 text-center font-mono focus:outline-none"
                        />
                        <span className="text-[11px] text-[#5a5e6b]">d</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveTask(index)}
                    className="text-[#5a5e6b] hover:text-red-400 p-1.5 mt-1 cursor-pointer transition-colors"
                    title="Remove task"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/[0.06]">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
            >
              Save Template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
