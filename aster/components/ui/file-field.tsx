"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type FileFieldProps = {
  id: string;
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  required?: boolean;
  hint?: string;
};

const DEFAULT_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx";

export function FileField({
  id,
  label,
  value,
  onChange,
  accept = DEFAULT_ACCEPT,
  required = false,
  hint,
}: FileFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {value ? (
        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span className="truncate">
            {value.name}{" "}
            <span className="text-muted-foreground">
              ({(value.size / 1024).toFixed(0)} KB)
            </span>
          </span>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Input
          id={id}
          type="file"
          accept={accept}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
