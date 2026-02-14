"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, PenLine, Plus, Trash2, X, Check, Zap } from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { cn, formatRelativeDate } from "@/lib/utils";

interface TasksPanelProps {
  opportunityId: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-gray-500",
  MEDIUM: "text-yellow-600",
  HIGH: "text-orange-600",
  CRITICAL: "text-red-600",
};

const PRIORITY_BG: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  MEDIUM: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400",
  HIGH: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400",
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400",
};

export function TasksPanel({ opportunityId }: TasksPanelProps) {
  const { data } = useTasks({ opportunityId, status: "all" });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState("MEDIUM");

  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState("MEDIUM");

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    createTask.mutate(
      {
        title: newTitle.trim(),
        dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
        priority: newPriority,
        opportunityId,
      },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDueDate("");
          setNewPriority("MEDIUM");
          setShowAdd(false);
        },
      }
    );
  };

  const startEdit = (task: { id: string; title: string; dueDate: string | null; priority: string }) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "");
    setEditPriority(task.priority);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditTitle("");
    setEditDueDate("");
    setEditPriority("MEDIUM");
  };

  const saveEdit = () => {
    if (!editingTaskId || !editTitle.trim()) return;
    updateTask.mutate(
      {
        id: editingTaskId,
        data: {
          title: editTitle.trim(),
          dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
          priority: editPriority,
        },
      },
      { onSuccess: cancelEdit }
    );
  };

  const toggleComplete = (taskId: string, isCompleted: boolean) => {
    updateTask.mutate({ id: taskId, data: { isCompleted: !isCompleted } });
  };

  const tasks = data?.tasks ?? [];
  const pendingTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Tasks</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {pendingTasks.length}
          </span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs text-primary hover:underline"
        >
          + Add Task
        </button>
      </div>

      <div className="divide-y">
        {showAdd && (
          <div className="p-3 space-y-2 bg-muted/20">
            <input
              type="text"
              placeholder="Task title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setShowAdd(false);
              }}
              className="w-full rounded border bg-background px-2 py-1.5 text-xs"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-xs"
              />
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
                className="rounded border bg-background px-2 py-1 text-xs"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setShowAdd(false)} className="rounded border px-2 py-1 text-xs hover:bg-muted">Cancel</button>
              <button
                onClick={handleAdd}
                disabled={!newTitle.trim() || createTask.isPending}
                className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {pendingTasks.map((task) => {
          const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
          const isEditing = editingTaskId === task.id;

          if (isEditing) {
            return (
              <div key={task.id} className="p-3 space-y-2 bg-muted/20">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="w-full rounded border bg-background px-2 py-1.5 text-xs"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="rounded border bg-background px-2 py-1 text-xs"
                  />
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="rounded border bg-background px-2 py-1 text-xs"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="flex gap-1">
                  <button onClick={cancelEdit} className="rounded border px-2 py-1 text-xs hover:bg-muted flex items-center gap-1">
                    <X className="h-3 w-3" /> Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={!editTitle.trim() || updateTask.isPending}
                    className="rounded bg-primary px-2 py-1 text-xs text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" /> Save
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={task.id} className="group flex items-start gap-2 p-3">
              <button
                onClick={() => toggleComplete(task.id, task.isCompleted)}
                className="mt-0.5 text-muted-foreground hover:text-primary"
                aria-label="Mark task complete"
              >
                <Circle className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {task.source !== "MANUAL" && (
                    <span
                      title={
                        task.source === "STAGE_TRIGGER" ? "Auto-created on stage change" :
                        task.source === "FOLLOW_UP_CHAIN" ? "Follow-up chain" :
                        task.source === "STALE_DETECTION" ? "Stale contact detected" :
                        task.source === "OVERDUE_DETECTION" ? "Overdue follow-up" :
                        "Automated"
                      }
                    >
                      <Zap className="h-3 w-3 flex-shrink-0 text-amber-500" />
                    </span>
                  )}
                  <p className={cn("text-sm", PRIORITY_COLORS[task.priority])}>{task.title}</p>
                  {task.priority !== "MEDIUM" && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", PRIORITY_BG[task.priority])}>
                      {task.priority}
                    </span>
                  )}
                </div>
                {task.dueDate && (
                  <span className={cn("text-[10px]", isOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                    <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                    {isOverdue ? "Overdue: " : ""}{formatRelativeDate(task.dueDate)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => startEdit(task)}
                  className="text-muted-foreground hover:text-primary p-0.5"
                  aria-label="Edit task"
                >
                  <PenLine className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this task?")) deleteTask.mutate(task.id);
                  }}
                  className="text-muted-foreground hover:text-destructive p-0.5"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}

        {completedTasks.length > 0 && (
          <>
            <div className="px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/30">
              Completed ({completedTasks.length})
            </div>
            {completedTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="group flex items-start gap-2 p-3 opacity-60">
                <button
                  onClick={() => toggleComplete(task.id, task.isCompleted)}
                  className="mt-0.5 text-primary"
                  aria-label="Mark task incomplete"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {task.source !== "MANUAL" && (
                    <Zap className="h-3 w-3 flex-shrink-0 text-amber-500/60" />
                  )}
                  <p className="text-sm line-through truncate">{task.title}</p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => startEdit(task)}
                    className="text-muted-foreground hover:text-primary p-0.5"
                    aria-label="Edit task"
                  >
                    <PenLine className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this task?")) deleteTask.mutate(task.id);
                    }}
                    className="text-muted-foreground hover:text-destructive p-0.5"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {tasks.length === 0 && !showAdd && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No tasks yet
          </div>
        )}
      </div>
    </div>
  );
}
