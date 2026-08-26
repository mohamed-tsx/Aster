"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/users/page-header";
import { ExpensesTable } from "@/components/expenses/expenses-table";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ListPagination } from "@/components/pagination/list-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useRBAC } from "@/hooks/useRBAC";
import { useToast } from "@/hooks/use-toast";
import { listExpenses, createExpense, getErrorMessage } from "@/services/expenses";
import type { ExpenseFormValues } from "@/lib/validations/expense";
import type { Expense } from "@/types/expense";

export default function ExpensesPage() {
  const allowed = usePermissionGuard("VIEW_FINANCE");
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { page, limit, setPage, setLimit } = usePagination();
  const [total, setTotal] = useState(0);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listExpenses({ page, limit });
      setExpenses(result.expenses);
      setTotal(result.total);
    } catch (error) {
      toast.error("Failed to load expenses", getErrorMessage(error));
      setExpenses([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  if (!allowed) return null;

  const handleSubmit = async (values: ExpenseFormValues) => {
    try {
      await createExpense(values);
      toast.success("Expense recorded");
      setDialogOpen(false);
      fetchExpenses();
    } catch (error) {
      toast.error("Could not record expense", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-6">
      <PageHeader
        title="Expenses"
        description="General business expenses not tied to a specific case. Case expenses are recorded from the case detail page."
        actions={
          <>
            <Button variant="outline" size="icon" onClick={fetchExpenses} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasPermission("MANAGE_FINANCE") && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Record expense
              </Button>
            )}
          </>
        }
      />

      <ExpensesTable expenses={expenses} loading={loading} />

      <ListPagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="expenses"
      />

      <ExpenseFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} />
    </div>
  );
}
