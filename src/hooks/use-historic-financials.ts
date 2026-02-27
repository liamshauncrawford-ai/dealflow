import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Query: Fetch all historic P&Ls ─────────────

export function useHistoricFinancials(opportunityId: string) {
  return useQuery({
    queryKey: ["historic-financials", opportunityId],
    queryFn: async () => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/historic-financials`,
      );
      if (!res.ok) throw new Error("Failed to fetch historic financials");
      const data = await res.json();
      return data.historicPnLs as any[];
    },
  });
}

// ─── Mutation: Upload & parse Excel file ────────

export function useUploadHistoricPnl(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/pipeline/${opportunityId}/historic-financials`,
        { method: "POST", body: formData },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to upload file");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["historic-financials", opportunityId],
      });
      toast.success("P&L uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Mutation: Update a cell value or label ─────

interface CellUpdatePayload {
  pnlId: string;
  rowId: string;
  columnIndex?: number;
  value?: number | null;
  label?: string;
}

export function useUpdateHistoricPnlCell(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pnlId, rowId, ...body }: CellUpdatePayload) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/historic-financials/${pnlId}/rows/${rowId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update cell");
      }

      return res.json();
    },
    // Optimistic update for instant feedback
    onMutate: async ({ pnlId, rowId, columnIndex, value, label }) => {
      await queryClient.cancelQueries({
        queryKey: ["historic-financials", opportunityId],
      });

      const previous = queryClient.getQueryData<any[]>([
        "historic-financials",
        opportunityId,
      ]);

      if (previous) {
        queryClient.setQueryData<any[]>(
          ["historic-financials", opportunityId],
          (old) =>
            old?.map((pnl) => {
              if (pnl.id !== pnlId) return pnl;
              return {
                ...pnl,
                rows: pnl.rows.map((row: any) => {
                  if (row.id !== rowId) return row;
                  if (label !== undefined) {
                    return { ...row, label };
                  }
                  if (columnIndex !== undefined) {
                    const newValues = [...(row.values as any[])];
                    newValues[columnIndex] = value ?? null;
                    return { ...row, values: newValues };
                  }
                  return row;
                }),
              };
            }),
        );
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      // Revert optimistic update on error
      if (context?.previous) {
        queryClient.setQueryData(
          ["historic-financials", opportunityId],
          context.previous,
        );
      }
      toast.error("Failed to save change");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["historic-financials", opportunityId],
      });
    },
  });
}

// ─── Mutation: Delete a historic P&L ────────────

export function useDeleteHistoricPnl(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pnlId: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/historic-financials?pnlId=${pnlId}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["historic-financials", opportunityId],
      });
      toast.success("Historic P&L deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Mutation: Convert Historic P&L → Financial Periods ──

export function useConvertHistoricToFinancials(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options?: { replaceExisting?: boolean }) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/historic-financials/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options ?? { replaceExisting: true }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to convert financials");
      }

      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate both historic and financial period queries
      queryClient.invalidateQueries({
        queryKey: ["historic-financials", opportunityId],
      });
      queryClient.invalidateQueries({
        queryKey: ["financial-periods", opportunityId],
      });
      // Also invalidate the opportunity query to reflect updated summary
      queryClient.invalidateQueries({
        queryKey: ["opportunity"],
      });
      toast.success(
        `Created ${data.created} financial period(s) from "${data.sheetUsed}"`,
      );
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ─── Mutation: Delete all P&Ls in a workbook group ──

export function useDeleteHistoricWorkbookGroup(opportunityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workbookGroup: string) => {
      const res = await fetch(
        `/api/pipeline/${opportunityId}/historic-financials?workbookGroup=${workbookGroup}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete workbook");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["historic-financials", opportunityId],
      });
      toast.success("Workbook deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
