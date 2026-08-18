"use client";

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseDeleteConfirmationProps {
    onDelete: (id: string, force?: boolean) => Promise<void>;
    onSuccess?: () => void;
    itemType?: string;
}

/**
 * Extract error message from various API response formats
 */
function extractErrorMessage(error: any, fallback: string): string {
    // Try multiple possible error message locations
    const possibleMessages = [
        error.response?.data?.error?.message, // Primary: { error: { message: "..." } }
        error.response?.data?.error, // If error is a string
        error.response?.data?.message,
        error.response?.data?.data?.error,
        error.response?.data?.data?.message,
        error.response?.data?.errors?.[0]?.message, // Array of errors
        error.response?.data?.errors?.[0], // Array of error strings
        error.message,
    ];

    // Return the first non-empty message found
    for (const msg of possibleMessages) {
        if (msg && typeof msg === "string" && msg.trim().length > 0) {
            return msg.trim();
        }
    }

    return fallback;
}

/**
 * Categorize error type based on message content
 */
function categorizeError(errorMessage: string): {
    category: "reference" | "validation" | "network" | "permission" | "unknown";
    title: string;
} {
    const lowerMsg = errorMessage.toLowerCase();

    // Reference/dependency errors
    if (
        lowerMsg.includes("invoice") ||
        lowerMsg.includes("receipt") ||
        lowerMsg.includes("payment") ||
        lowerMsg.includes("transaction") ||
        lowerMsg.includes("order history") ||
        lowerMsg.includes("referenced") ||
        lowerMsg.includes("associated") ||
        lowerMsg.includes("cannot delete") ||
        lowerMsg.includes("has related") ||
        lowerMsg.includes("dependent")
    ) {
        return { category: "reference", title: "Cannot Delete - Has Dependencies" };
    }

    // Validation errors
    if (
        lowerMsg.includes("required") ||
        lowerMsg.includes("invalid") ||
        lowerMsg.includes("must be") ||
        lowerMsg.includes("validation")
    ) {
        return { category: "validation", title: "Validation Error" };
    }

    // Network errors
    if (
        lowerMsg.includes("network") ||
        lowerMsg.includes("timeout") ||
        lowerMsg.includes("connection") ||
        lowerMsg.includes("fetch")
    ) {
        return { category: "network", title: "Network Error" };
    }

    // Permission errors
    if (
        lowerMsg.includes("permission") ||
        lowerMsg.includes("unauthorized") ||
        lowerMsg.includes("forbidden") ||
        lowerMsg.includes("access denied")
    ) {
        return { category: "permission", title: "Permission Denied" };
    }

    return { category: "unknown", title: "Delete Failed" };
}

export function useDeleteConfirmation({
    onDelete,
    onSuccess,
    itemType = "item",
}: UseDeleteConfirmationProps) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [forceDeleteDialogOpen, setForceDeleteDialogOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const toast = useToast();

    const handleDeleteClick = (item: { id: string; name: string }) => {
        setItemToDelete(item);
        setDeleteDialogOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;

        setIsDeleting(true);
        try {
            await onDelete(itemToDelete.id);

            // Success - close dialog and show success message
            setDeleteDialogOpen(false);
            setItemToDelete(null);

            toast.success(
                `${itemType} Deleted`,
                `${itemType} "${itemToDelete.name}" has been permanently deleted`
            );

            onSuccess?.();
        } catch (error: any) {
            console.error(`Error deleting ${itemType}:`, error);

            // Extract and categorize error
            const errorMessage = extractErrorMessage(
                error,
                `Failed to delete ${itemType}. Please try again.`
            );
            const { category, title } = categorizeError(errorMessage);

            // Show appropriate error message based on category
            if (category === "reference") {
                toast.error(
                    title,
                    `${errorMessage}\n\nPlease remove or reassign the related records first.`
                );
            } else if (category === "network") {
                toast.error(
                    title,
                    `${errorMessage}\n\nPlease check your internet connection and try again.`
                );
            } else if (category === "permission") {
                toast.error(
                    title,
                    `${errorMessage}\n\nYou may not have permission to delete this ${itemType}.`
                );
            } else {
                toast.error(title, errorMessage);
            }

            // Keep dialog open so user can see the error and close manually
            // This allows them to read the error message before dismissing
        } finally {
            setIsDeleting(false);
        }
    };

    const handleForceDeleteConfirm = async () => {
        if (!itemToDelete) return;

        setIsDeleting(true);
        try {
            await onDelete(itemToDelete.id, true);

            // Success - close dialog and show success message
            setForceDeleteDialogOpen(false);
            setItemToDelete(null);

            toast.success(
                `${itemType} Force Deleted`,
                `${itemType} "${itemToDelete.name}" has been force deleted (references preserved)`
            );

            onSuccess?.();
        } catch (forceError: any) {
            console.error(`Error force deleting ${itemType}:`, forceError);

            const errorMessage = extractErrorMessage(
                forceError,
                `Failed to force delete ${itemType}. Please try again.`
            );
            const { title } = categorizeError(errorMessage);

            toast.error(title, errorMessage);

            // Keep dialog open on error
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteDialogOpen(false);
        setForceDeleteDialogOpen(false);
        setItemToDelete(null);
    };

    return {
        deleteDialogOpen,
        forceDeleteDialogOpen,
        itemToDelete,
        isDeleting,
        handleDeleteClick,
        handleDeleteConfirm,
        handleForceDeleteConfirm,
        handleDeleteCancel,
    };
}