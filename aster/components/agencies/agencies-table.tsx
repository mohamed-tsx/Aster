"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { AgencyFormDialog } from "@/components/agencies/agency-form-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useToast } from "@/hooks/use-toast";
import {
  listAgencies,
  createAgency,
  updateAgency,
  deleteAgency,
  getErrorMessage,
} from "@/services/agencies";
import type { Agency } from "@/types/agency";
import type { AgencyFormValues } from "@/lib/validations/agency";

export function AgenciesTable() {
  const toast = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setAgencies(await listAgencies());
    } catch (error) {
      toast.error("Failed to load agencies", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const {
    deleteDialogOpen,
    itemToDelete,
    isDeleting,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useDeleteConfirmation({
    itemType: "Agency",
    onDelete: async (id) => {
      await deleteAgency(id);
    },
    onSuccess: fetchAll,
  });

  const openCreate = () => {
    setEditingAgency(null);
    setDialogOpen(true);
  };

  const openEdit = (agency: Agency) => {
    setEditingAgency(agency);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: AgencyFormValues) => {
    try {
      if (editingAgency) {
        await updateAgency(editingAgency.id, values);
        toast.success("Agency updated");
      } else {
        await createAgency(values);
        toast.success("Agency created");
      }
      setDialogOpen(false);
      fetchAll();
    } catch (error) {
      toast.error("Save failed", getErrorMessage(error));
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add agency
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agencies.map((agency) => (
              <TableRow key={agency.id}>
                <TableCell className="font-medium">{agency.name}</TableCell>
                <TableCell>{agency.contactPerson || "—"}</TableCell>
                <TableCell>{agency.phone || "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(agency)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleDeleteClick({ id: agency.id, name: agency.name })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AgencyFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agency={editingAgency}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete agency"
        description="This cannot be undone. Agencies with linked cases cannot be deleted."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </div>
  );
}
