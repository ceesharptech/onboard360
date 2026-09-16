import React, { useState } from "react";
import type { EmployeeTask } from "../../api/endpoints";
import { employeeApi } from "../../api/endpoints";
import { useToast } from "../../context/ToastContext";
import { Modal } from "../../components/common/Modal";
import { Input } from "../../components/common/Input";
import { Select } from "../../components/common/Select";
import { Button } from "../../components/common/Button";
import { MarkdownRenderer } from "../../components/common/MarkdownRenderer";
import { Plus, Eye, PencilSimple } from "@phosphor-icons/react";

export interface AssignTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  existingCategories?: string[];
  onTaskAssigned: (task: EmployeeTask) => void;
}

const DEFAULT_CATEGORIES = [
  "IT Setup",
  "HR Paperwork",
  "Orientation",
  "Engineering",
  "Compliance",
  "General",
];

export const AssignTaskModal: React.FC<AssignTaskModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  existingCategories = [],
  onTaskAssigned,
}) => {
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [assigneeType, setAssigneeType] = useState<
    "employee" | "manager" | "mentor"
  >("employee");
  const [dueDate, setDueDate] = useState("");
  const [taskUrl, setTaskUrl] = useState("");
  const [description, setDescription] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Combine and deduplicate categories
  const allCategories = Array.from(
    new Set([...existingCategories, ...DEFAULT_CATEGORIES]),
  );

  const handleReset = () => {
    setTitle("");
    setCategory("General");
    setAssigneeType("employee");
    setDueDate("");
    setTaskUrl("");
    setDescription("");
    setPreviewMode(false);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newTask = await employeeApi.createAdHocTask(employeeId, {
        title: title.trim(),
        category: category.trim() || "General",
        assigneeType,
        dueDate: dueDate ? dueDate : null,
        taskUrl: taskUrl.trim() ? taskUrl.trim() : null,
        description: description.trim() ? description.trim() : null,
      });

      toast.success("Task Assigned", `Assigned "${title}" to ${employeeName}`);
      onTaskAssigned(newTask);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div>
          <div className="text-sm font-semibold text-[#f7f8f8]">
            Assign New Task
          </div>
          <div className="text-xs text-[#8a8f98] font-normal">
            Adding an ad-hoc milestone to {employeeName}&apos;s onboarding
          </div>
        </div>
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {error && (
          <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.25)] text-xs text-[#f87171]">
            {error}
          </div>
        )}

        {/* Title */}
        <Input
          label="Task Title"
          placeholder="e.g. Schedule 1:1 Introduction with VP"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* Category & Assignee Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#d0d6e0] mb-1.5">
              Category
            </label>
            <input
              type="text"
              list="category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. IT Setup"
              className="w-full bg-[#14161a] border border-white/[0.08] focus:border-white/30 text-xs text-[#f7f8f8] rounded-md px-3 py-2 focus:outline-none"
              required
            />
            <datalist id="category-suggestions">
              {allCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {allCategories.slice(0, 4).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                    category === cat
                      ? "bg-white/[0.1] text-[#f7f8f8] border-white/[0.2]"
                      : "bg-white/[0.02] text-[#8a8f98] border-white/[0.04] hover:text-[#f7f8f8]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <Select
            label="Assignee Type"
            value={assigneeType}
            onChange={(e) =>
              setAssigneeType(
                e.target.value as "employee" | "manager" | "mentor",
              )
            }
            options={[
              { value: "employee", label: "Employee (Self-Completion)" },
              { value: "manager", label: "Manager Milestone" },
              { value: "mentor", label: "Mentor Milestone" },
            ]}
          />
        </div>

        {/* Due Date & Task Link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#d0d6e0] mb-1.5">
              Due Date (Specific Date)
            </label>
            <div className="relative">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#14161a] border border-white/[0.08] focus:border-white/30 text-xs text-[#f7f8f8] rounded-md px-3 py-2 focus:outline-none"
              />
            </div>
            <p className="text-[11px] text-[#5a5e6b] mt-1">
              Direct calendar deadline for this employee
            </p>
          </div>

          <Input
            label="External Resource URL (Optional)"
            placeholder="https://company.slack.com/..."
            value={taskUrl}
            onChange={(e) => setTaskUrl(e.target.value)}
            helperText="Link to relevant docs, tool setup or SaaS portal"
          />
        </div>

        {/* Rich Description (Markdown supported) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[#d0d6e0]">
              Description & Guidance
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#5a5e6b]">
                Markdown supported (lists, **bold**, links)
              </span>
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 cursor-pointer transition-colors"
              >
                {previewMode ? (
                  <>
                    <PencilSimple size={12} />
                    <span>Edit Text</span>
                  </>
                ) : (
                  <>
                    <Eye size={12} />
                    <span>Preview</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {previewMode ? (
            <div className="w-full min-h-[120px] max-h-[220px] overflow-y-auto p-3 bg-[#08080a] border border-white/[0.08] rounded-md text-xs">
              {description.trim() ? (
                <MarkdownRenderer content={description} />
              ) : (
                <p className="text-xs text-[#5a5e6b] italic">
                  Nothing to preview yet. Type markdown in edit mode.
                </p>
              )}
            </div>
          ) : (
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Please follow these steps:&#10;1. Open the internal portal&#10;2. Request access from security team&#10;3. Notify your mentor when complete"
              className="w-full bg-[#14161a] border border-white/[0.08] focus:border-white/30 text-xs text-[#f7f8f8] rounded-md px-3 py-2.5 focus:outline-none resize-y leading-relaxed font-mono"
            />
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isSubmitting}
            icon={<Plus size={14} />}
          >
            {isSubmitting ? "Assigning Task..." : "Assign Task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignTaskModal;
