"use client";

import { useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { UploadDocumentDialog } from "@/components/cases/upload-document-dialog";
import { useDeleteConfirmation } from "@/hooks/use-delete-confirmation";
import { useToast } from "@/hooks/use-toast";
import { useRBAC } from "@/hooks/useRBAC";
import { uploadDocument, deleteDocument, getErrorMessage } from "@/services/documents";
import { getImageUrl } from "@/utils/imageUtils";
import type { Case } from "@/types/case";
import type { DocumentType } from "@/types/document";

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PATIENT_PASSPORT: "Patient passport",
  ATTENDANT_PASSPORT: "Attendant passport",
  INVITATION_LETTER: "Invitation letter",
  VISA_COPY: "Visa copy",
  OTHER: "Other",
};

type DocumentsPanelProps = {
  kase: Case;
  onChanged: () => void;
};

export function DocumentsPanel({ kase, onChanged }: DocumentsPanelProps) {
  const toast = useToast();
  const { hasPermission } = useRBAC();
  const [uploadOpen, setUploadOpen] = useState(false);

  const {
    deleteDialogOpen,
    itemToDelete,
    isDeleting,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
  } = useDeleteConfirmation({
    itemType: "Document",
    onDelete: async (id) => {
      await deleteDocument(kase.id, id);
    },
    onSuccess: onChanged,
  });

  const handleUpload = async (file: File, type: DocumentType) => {
    try {
      await uploadDocument(kase.id, file, type);
      toast.success("Document uploaded");
      setUploadOpen(false);
      onChanged();
    } catch (error) {
      toast.error("Upload failed", getErrorMessage(error));
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Documents</CardTitle>
        {kase.status !== "CANCELLED" && hasPermission("UPDATE_CASES") && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {kase.documents.length === 0 && (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        )}
        {kase.documents.map((document) => (
          <div
            key={document.id}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div>
              <p className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[document.type]}</p>
              <p className="text-xs text-muted-foreground">{document.fileName}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" asChild>
                <a href={getImageUrl(document.fileUrl)} target="_blank" rel="noreferrer">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
              {kase.status !== "CANCELLED" && hasPermission("DELETE_CASES") && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    handleDeleteClick({ id: document.id, name: document.fileName })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} onSubmit={handleUpload} />

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => !open && handleDeleteCancel()}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        title="Delete document"
        description="This cannot be undone."
        itemName={itemToDelete?.name}
        isLoading={isDeleting}
      />
    </Card>
  );
}
