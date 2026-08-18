"use client";

import { useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface DeleteConfirmationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
    description: string;
    itemName?: string;
    isLoading?: boolean;
    variant?: "default" | "force";
}

export function DeleteConfirmationDialog({
    open,
    onOpenChange,
    onConfirm,
    onCancel,
    title,
    description,
    itemName,
    isLoading = false,
    variant = "default",
}: DeleteConfirmationDialogProps) {
    const isForceDelete = variant === "force";

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle
                            className={`h-5 w-5 ${isForceDelete ? "text-orange-500" : "text-red-500"
                                }`}
                        />
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {itemName && (
                            <>
                                Are you sure you want to{" "}
                                {isForceDelete ? "force delete" : "permanently delete"}{" "}
                                <span className="font-semibold">{itemName}</span>?
                                <br />
                                <br />
                            </>
                        )}
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel} disabled={isLoading}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`${isForceDelete
                                ? "bg-orange-600 hover:bg-orange-700"
                                : "bg-red-600 hover:bg-red-700"
                            }`}
                    >
                        {isLoading
                            ? `${isForceDelete ? "Force Deleting" : "Deleting"}...`
                            : `${isForceDelete ? "Force Delete" : "Delete Permanently"}`}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}