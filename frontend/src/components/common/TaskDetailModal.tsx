import React from "react";
import type { EmployeeTask } from "../../api/endpoints";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  CalendarBlank,
  Clock,
  CheckCircle,
  ArrowSquareOut,
  LockSimple,
  Check,
  Tag,
} from "@phosphor-icons/react";

export interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: EmployeeTask | null;
  /** Whether the currently authenticated user has permission to complete this task */
  canComplete?: boolean;
  /** Reason shown when task cannot be completed by current user */
  restrictionReason?: string | null;
  /** Optional handler to toggle completion */
  onToggleComplete?: (task: EmployeeTask) => Promise<void> | void;
  /** Whether toggle action is currently saving */
  isToggling?: boolean;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  task,
  canComplete = true,
  restrictionReason,
  onToggleComplete,
  isToggling = false,
}) => {
  if (!task) return null;

  const isCompleted = task.status === "completed";
  const isOverdue =
    !isCompleted && task.dueDate && new Date(task.dueDate) < new Date();

  const formattedDueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const formattedCompletedAt = task.completedAt
    ? new Date(task.completedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const assigneeBadgeVariant =
    task.assigneeType === "employee"
      ? "blue"
      : task.assigneeType === "manager"
        ? "purple"
        : "orange";

  const statusBadgeVariant = isCompleted
    ? "green"
    : isOverdue
      ? "orange"
      : "gray";

  const statusLabel = isCompleted
    ? "Completed"
    : isOverdue
      ? "Overdue"
      : task.status === "in_progress"
        ? "In Progress"
        : "Pending";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 flex-wrap pr-4">
          <span className="font-mono text-xs text-[#5a5e6b] bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
            ONB-{task.orderIndex + 1}
          </span>
          <span className="text-sm font-semibold text-[#f7f8f8] truncate max-w-md">
            {task.title}
          </span>
        </div>
      }
      maxWidth="lg"
    >
      <div className="space-y-5 text-left">
        {/* Metadata Badges & Properties Bar */}
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-[#0b0c0f] border border-white/[0.06] text-xs">
          {/* Status Badge */}
          <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>

          {/* Assignee Badge */}
          <Badge variant={assigneeBadgeVariant}>
            <span className="capitalize">{task.assigneeType} Task</span>
          </Badge>

          {/* Category Badge */}
          {task.category && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.04] text-[#8a8f98] border border-white/[0.06]">
              <Tag size={11} />
              {task.category}
            </span>
          )}

          {/* Due Date Indicator */}
          {formattedDueDate && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border ${
                isOverdue
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-white/[0.04] text-[#8a8f98] border-white/[0.06]"
              }`}
            >
              <CalendarBlank size={11} />
              <span>Due {formattedDueDate}</span>
            </span>
          )}
        </div>

        {/* External Link (if taskUrl present) */}
        {task.taskUrl && (
          <div className="p-3 rounded-lg bg-[#14161a] border border-white/[0.08] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 shrink-0">
                <ArrowSquareOut size={14} />
              </span>
              <div className="truncate">
                <div className="text-[11px] font-semibold text-[#f7f8f8]">
                  External Resource
                </div>
                <div className="text-xs text-indigo-400 truncate hover:underline">
                  {task.taskUrl}
                </div>
              </div>
            </div>
            <a
              href={task.taskUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-[#f7f8f8] border border-white/[0.08] transition-colors shrink-0"
            >
              <span>Open Link</span>
              <ArrowSquareOut size={12} />
            </a>
          </div>
        )}

        {/* Task Description (Markdown rendered) */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#8a8f98] mb-2">
            Description & Guidance
          </h4>
          <div className="p-4 rounded-lg bg-[#08080a] border border-white/[0.06] min-h-[100px] select-text">
            {task.description ? (
              <MarkdownRenderer content={task.description} />
            ) : (
              <p className="text-xs text-[#5a5e6b] italic">
                No description provided for this task.
              </p>
            )}
          </div>
        </div>

        {/* Completed Info (if completed) */}
        {isCompleted && formattedCompletedAt && (
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
            <CheckCircle size={15} weight="fill" />
            <span>Completed on {formattedCompletedAt}</span>
          </div>
        )}

        {/* Restriction Banner (if cannot complete) */}
        {!canComplete && restrictionReason && (
          <div className="flex items-start gap-2.5 text-xs text-amber-300 bg-amber-950/20 border border-amber-500/30 p-3 rounded-lg">
            <LockSimple size={15} className="shrink-0 mt-0.5 text-amber-400" />
            <div className="space-y-0.5">
              <span className="font-semibold text-amber-400">
                Action Restricted
              </span>
              <p className="text-amber-300/80 leading-relaxed">
                {restrictionReason}
              </p>
            </div>
          </div>
        )}

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>

          {onToggleComplete && (
            <Button
              variant={isCompleted ? "secondary" : "primary"}
              size="sm"
              disabled={!canComplete || isToggling}
              icon={
                canComplete ? (
                  isCompleted ? (
                    <Clock size={14} />
                  ) : (
                    <Check size={14} weight="bold" />
                  )
                ) : (
                  <LockSimple size={14} />
                )
              }
              onClick={() => onToggleComplete(task)}
            >
              {isToggling
                ? "Updating..."
                : isCompleted
                  ? "Mark Incomplete"
                  : "Mark Completed"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default TaskDetailModal;
