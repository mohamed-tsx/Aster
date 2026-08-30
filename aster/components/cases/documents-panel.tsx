"use client";

import { useMemo, useState } from "react";
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
import type { CaseDocument, DocumentType } from "@/types/document";

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PATIENT_PASSPORT: "Patient passport",
  ATTENDANT_PASSPORT: "Attendant passport",
  CASE_DOCUMENT: "Case document",
  EVALUATION_DOC: "Evaluation document",
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
  const [replaceCaseDoc, setReplaceCaseDoc] = useState(false);

  // Grouped newest-first per type, and rendered in a fixed type order (the
  // DOCUMENT_TYPE_LABELS key order) so the on-screen sequence is stable across reloads.
  const groups = useMemo(() => {
    const byType = kase.documents.reduce<Record<string, CaseDocument[]>>((acc, doc) => {
      (acc[doc.type] ??= []).push(doc);
      return acc;
    }, {});
    for (const group of Object.values(byType)) {
      group.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return (Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[])
      .filter((type) => byType[type]?.length)
      .map((type) => [type, byType[type]] as const);
  }, [kase.documents]);

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
      setReplaceCaseDoc(false);
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
        {groups.map(([type, docs]) => {
          const [newest, ...older] = docs;
          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {DOCUMENT_TYPE_LABELS[type as DocumentType]}
                  </p>
                  <p className="text-xs text-muted-foreground">{newest.fileName}</p>
                </div>
                <div className="flex items-center gap-1">
                  {type === "CASE_DOCUMENT" &&
                    kase.status !== "CANCELLED" &&
                    hasPermission("UPDATE_CASES") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReplaceCaseDoc(true)}
                    >
                      Replace
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={getImageUrl(newest.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {kase.status !== "CANCELLED" && hasPermission("DELETE_CASES") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleDeleteClick({ id: newest.id, name: newest.fileName })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {older.length > 0 && (
                <details className="rounded-md border px-3 py-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Previous versions ({older.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {older.map((document) => (
                      <div
                        key={document.id}
                        className="flex items-center justify-between rounded-md border p-2"
                      >
                        <p className="text-xs text-muted-foreground">
                          {document.fileName}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" asChild>
                            <a
                              href={getImageUrl(document.fileUrl)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          {kase.status !== "CANCELLED" &&
                            hasPermission("DELETE_CASES") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleDeleteClick({
                                  id: document.id,
                                  name: document.fileName,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </CardContent>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} onSubmit={handleUpload} />

      <UploadDocumentDialog
        open={replaceCaseDoc}
        onOpenChange={setReplaceCaseDoc}
        onSubmit={handleUpload}
        lockedType="CASE_DOCUMENT"
      />

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
