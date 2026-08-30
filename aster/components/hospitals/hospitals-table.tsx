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
import { HospitalFormDialog } from "@/components/hospitals/hospital-form-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useToast } from "@/hooks/use-toast";
import {
  listHospitals,
  createHospital,
  updateHospital,
  deleteHospital,
  getErrorMessage,
} from "@/services/hospitals";
import type { Hospital } from "@/types/hospital";
import type { HospitalFormValues } from "@/lib/validations/hospital";

export function HospitalsTable() {
  const toast = useToast();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      setHospitals(await listHospitals());
    } catch (error) {
      toast.error("Failed to load hospitals", getErrorMessage(error));
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
    itemType: "Hospital",
    onDelete: async (id) => {
      await deleteHospital(id);
    },
    onSuccess: fetchAll,
  });

  const openCreate = () => {
    setEditingHospital(null);
    setDialogOpen(true);
  };

  const openEdit = (hospital: Hospital) => {
    setEditingHospital(hospital);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: HospitalFormValues) => {
    try {
      if (editingHospital) {
        // `country` is not yet collected by HospitalFormDialog (added in a later
        // frontend task); preserve the existing value so edits don't wipe it.
        await updateHospital(editingHospital.id, {
          ...values,
          country: editingHospital.country,
        });
        toast.success("Hospital updated");
      } else {
        await createHospital({ ...values, country: "" });
        toast.success("Hospital created");
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
          Add hospital
        </Button>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {hospitals.map((hospital) => (
              <TableRow key={hospital.id}>
                <TableCell className="font-medium">{hospital.name}</TableCell>
                <TableCell>{hospital.city}</TableCell>
                <TableCell>
                  {hospital.contactPerson || hospital.phone || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(hospital)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleDeleteClick({ id: hospital.id, name: hospital.name })
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

      <HospitalFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        hospital={editingHospital}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete hospital"
        description="This cannot be undone. Hospitals with inquiry history cannot be deleted."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </div>
  );
}
