"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TaskFilters {
  opportunityId?: string;
  status?: "all" | "pending" | "completed" | "overdue";
  limit?: number;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  priority: string;
  opportunityId: string | null;
  opportunity: { id: string; title: string } | null;
  createdAt: string;
  updatedAt: string;
}

export function useTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.opportunityId) params.set("opportunityId", filters.opportunityId);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.limit) params.set("limit", String(filters.limit));
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json() as Promise<{ tasks: Task[]; total: number }>;
    },
    enabled: filters !== undefined,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      dueDate?: string;
      priority?: string;
      opportunityId?: string;
    }) => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created");
    },
    onError: () => {
      toast.error("Failed to create task");
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      toast.error("Failed to update task");
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
    onError: () => {
      toast.error("Failed to delete task");
    },
  });
}
