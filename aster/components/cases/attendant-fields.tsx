"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CaseFormValues } from "@/lib/validations/case";

type FieldProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
};

function TextField({
  form,
  name,
  label,
  type = "text",
}: FieldProps & { name: keyof CaseFormValues; label: string; type?: string }) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} {...field} value={(field.value as string) ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function AttendantFields({ form }: FieldProps) {
  const hasAttendant = form.watch("hasAttendant");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attendant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="hasAttendant"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0">Traveling with an attendant</FormLabel>
            </FormItem>
          )}
        />

        {hasAttendant && (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="attendantFirstName" label="First name" />
            <TextField form={form} name="attendantLastName" label="Last name" />
            <FormField
              control={form.control}
              name="attendantGender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value as string}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <TextField
              form={form}
              name="attendantDateOfBirth"
              label="Date of birth"
              type="date"
            />
            <TextField form={form} name="attendantNationality" label="Nationality" />
            <TextField form={form} name="attendantPassportNumber" label="Passport number" />
            <TextField
              form={form}
              name="attendantPassportExpiry"
              label="Passport expiry"
              type="date"
            />
            <TextField form={form} name="attendantPhone" label="Phone" />
            <TextField
              form={form}
              name="attendantRelationToPatient"
              label="Relation to patient"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
