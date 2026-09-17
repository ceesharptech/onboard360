import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import type {
  OnboardingTemplate,
  TemplateTask,
  Department,
  PaginationMeta,
} from "../../api/endpoints";
import { templateApi, departmentApi } from "../../api/endpoints";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { Input } from "../../components/common/Input";
import { Select } from "../../components/common/Select";
import { Modal } from "../../components/common/Modal";
import { Pagination } from "../../components/common/Pagination";
import {
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  PencilSimple,
  GitFork,
  Link as LinkIcon,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { MarkdownRenderer } from "../../components/common/MarkdownRenderer";

export const TemplateBuilder: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search, Filter & Pagination State (Phase 5.3)
  const [templateSearch, setTemplateSearch] = useState("");
  const [debouncedTemplateSearch, setDebouncedTemplateSearch] = useState("");
  const [templateDeptFilter, setTemplateDeptFilter] = useState(
    user?.role === "manager" && user.departmentId ? user.departmentId : ""
  );
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePagination, setTemplatePagination] = useState<PaginationMeta>({
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
      setDebouncedTemplateSearch(templateSearch);
      setTemplatePage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [templateSearch]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<OnboardingTemplate | null>(null);
  const [name, setName] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [tasks, setTasks] = useState<TemplateTask[]>([]);
  const [previewDescIndices, setPreviewDescIndices] = useState<Record<number, boolean>>({});

  const togglePreviewDesc = (index: number) => {
    setPreviewDescIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = async (
    page = templatePage,
    search = debouncedTemplateSearch,
    deptId = templateDeptFilter
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const [tList, dList] = await Promise.all([
        templateApi.list({
          page,
          limit: 20,
          search: search || undefined,
          departmentId: deptId || undefined,
        }),
        departmentApi.list(),
      ]);
      setTemplates(tList);
      if (tList.pagination) {
        setTemplatePagination(tList.pagination);
      }
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

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchTemplates(templatePage, debouncedTemplateSearch, templateDeptFilter);
  }, [templatePage, debouncedTemplateSearch, templateDeptFilter]);

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
        taskUrl: null,
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
        ? [...t.tasks]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((task) => ({
              ...task,
              taskUrl: task.taskUrl ?? null,
            }))
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
        taskUrl: null,
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
    value: string | number | null,
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
          taskUrl: t.taskUrl && t.taskUrl.trim() ? t.taskUrl.trim() : null,
        })),
      };

      if (editingTemplate) {
        await templateApi.update(editingTemplate.id, payload);
        toast.success("Template updated", `"${name}" was saved successfully`);
      } else {
        await templateApi.create(payload);
        toast.success("Template created", `"${name}" was created successfully`);
      }

      setIsModalOpen(false);
      fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save template";
      setError(msg);
      toast.error("Failed to save template", msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await templateApi.delete(id);
      toast.info("Template deleted", "The template was removed");
      fetchTemplates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete template";
      setError(msg);
      toast.error("Failed to delete template", msg);
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

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8a8f98]">
            <MagnifyingGlass size={14} />
          </div>
          <input
            type="text"
            value={templateSearch}
            onChange={(e) => setTemplateSearch(e.target.value)}
            placeholder="Search templates by name or role..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-[#0f1013] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/30 rounded-md text-[#f7f8f8] placeholder-[#565964] focus:outline-none transition-colors"
          />
          {templateSearch && (
            <button
              type="button"
              onClick={() => setTemplateSearch("")}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#8a8f98] hover:text-white"
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "hr_admin" && (
            <select
              value={templateDeptFilter}
              onChange={(e) => {
                setTemplateDeptFilter(e.target.value);
                setTemplatePage(1);
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
          )}

          {(templateSearch || (user?.role === "hr_admin" && templateDeptFilter)) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTemplateSearch("");
                setTemplateDeptFilter("");
                setTemplatePage(1);
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

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
            {templateSearch || templateDeptFilter
              ? "No templates match your search or filter criteria."
              : "Create your first onboarding workflow template to auto-populate tasks when new employees join."}
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
        <div className="space-y-4">
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
                        title="Edit Template"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash size={14} className="text-red-400" />}
                        onClick={() => handleDeleteTemplate(t.id)}
                        title="Delete Template"
                      />
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/[0.06] pt-3">
                    <div className="flex items-center justify-between text-xs text-[#8a8f98] mb-2 font-medium">
                      <span>Tasks Pipeline ({t.tasks?.length || 0})</span>
                      <span className="text-[11px] font-mono">
                        {t.tasks?.reduce((acc, curr) => Math.max(acc, curr.dueOffsetDays), 0) || 0}d duration
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {t.tasks?.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-[#14161a] border border-white/[0.04] text-xs"
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                            <span className="text-[#f7f8f8] truncate">{task.title}</span>
                            {task.taskUrl && (
                              <span title={`Linked URL: ${task.taskUrl}`} className="shrink-0">
                                <LinkIcon size={12} className="text-[#8a8f98]" />
                              </span>
                            )}
                          </div>
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

          <Pagination
            currentPage={templatePage}
            totalPages={templatePagination.totalPages}
            totalItems={templatePagination.total}
            pageSize={templatePagination.limit}
            onPageChange={(newPage) => setTemplatePage(newPage)}
          />
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

                    <div className="sm:col-span-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#5a5e6b]">
                          Supports Markdown: <span className="font-mono text-[#8a8f98]">**bold**</span>, <span className="italic text-[#8a8f98]">_italic_</span>, <span className="font-mono text-[#8a8f98]">`code`</span>, <span className="text-[#8a8f98]">[link](url)</span>, lists
                        </span>
                        {task.description && (
                          <button
                            type="button"
                            onClick={() => togglePreviewDesc(index)}
                            className="text-[10px] text-[#8a8f98] hover:text-white flex items-center gap-1 cursor-pointer transition-colors px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]"
                          >
                            {previewDescIndices[index] ? (
                              <>
                                <EyeSlash size={11} />
                                <span>Edit</span>
                              </>
                            ) : (
                              <>
                                <Eye size={11} />
                                <span>Preview</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {previewDescIndices[index] && task.description ? (
                        <div className="p-2.5 rounded-md bg-[#14161a] border border-white/[0.08] min-h-[60px] text-xs">
                          <MarkdownRenderer content={task.description} />
                        </div>
                      ) : (
                        <textarea
                          rows={2}
                          placeholder="Task instructions & description (Markdown supported)..."
                          value={task.description || ""}
                          onChange={(e) =>
                            handleUpdateTaskField(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-full bg-[#14161a] border border-white/[0.08] focus:border-white/30 text-xs text-[#f7f8f8] rounded-md px-2.5 py-1.5 focus:outline-none resize-y min-h-[50px]"
                        />
                      )}
                    </div>

                    <div className="sm:col-span-2 flex items-center gap-2">
                      <label className="text-[10px] text-[#5a5e6b] shrink-0">Assignee:</label>
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
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 justify-end">
                      <label className="text-[10px] text-[#5a5e6b] shrink-0">Due in:</label>
                      <span className="text-[11px] text-[#5a5e6b]">+</span>
                      <input
                        type="number"
                        min="0"
                        title="Due offset in days after employee start date"
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
                      <span className="text-[11px] text-[#5a5e6b]">days</span>
                    </div>

                    <div className="sm:col-span-3">
                      <input
                        placeholder="External link (optional, e.g. https://wiki.company.com/handbook)"
                        value={task.taskUrl || ""}
                        onChange={(e) =>
                          handleUpdateTaskField(
                            index,
                            "taskUrl",
                            e.target.value,
                          )
                        }
                        className="w-full bg-[#14161a] border border-white/[0.08] focus:border-white/30 text-xs text-[#f7f8f8] rounded-md px-2.5 py-1.5 focus:outline-none"
                      />
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
