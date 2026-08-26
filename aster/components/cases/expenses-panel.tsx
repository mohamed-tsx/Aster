"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { createExpense, getErrorMessage } from "@/services/expenses";
import type { ExpenseFormValues } from "@/lib/validations/expense";
import type { Case } from "@/types/case";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type ExpensesPanelProps = {
  kase: Case;
  onChanged: () => void;
};

export function ExpensesPanel({ kase, onChanged }: ExpensesPanelProps) {
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSubmit = async (values: ExpenseFormValues) => {
    try {
      await createExpense({ ...values, caseId: kase.id });
      toast.success("Expense recorded");
      setDialogOpen(false);
      onChanged();
    } catch (error) {
      toast.error("Could not record expense", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Expenses</CardTitle>
        {kase.status !== "CANCELLED" && hasPermission("MANAGE_FINANCE") && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record expense
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {kase.expenses.length === 0 && (
          <p className="text-sm text-muted-foreground">No expenses recorded yet.</p>
        )}
        {kase.expenses.map((expense) => (
          <div key={expense.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{expense.category}</p>
              <p className="text-sm">
                {expense.amount} {expense.currency}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(expense.incurredAt)}
              {expense.accountTransaction && ` · ${expense.accountTransaction.account.name}`}
              {` · ${expense.paidBy.firstName} ${expense.paidBy.lastName}`}
            </p>
            {expense.notes && <p className="mt-1 text-xs">{expense.notes}</p>}
          </div>
        ))}
      </CardContent>

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        caseNumber={kase.caseNumber}
        onSubmit={handleSubmit}
      />
    </Card>
  );
}
