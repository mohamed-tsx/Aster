"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
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

export function PatientFields({ form }: FieldProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Patient details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <TextField form={form} name="patientFirstName" label="First name" />
        <TextField form={form} name="patientLastName" label="Last name" />
        <FormField
          control={form.control}
          name="patientGender"
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
        <TextField form={form} name="patientDateOfBirth" label="Date of birth" type="date" />
        <TextField form={form} name="patientNationality" label="Nationality" />
        <TextField form={form} name="patientPassportNumber" label="Passport number" />
        <TextField
          form={form}
          name="patientPassportExpiry"
          label="Passport expiry"
          type="date"
        />
        <TextField form={form} name="patientPhone" label="Phone" />
        <TextField form={form} name="patientEmail" label="Email (optional)" type="email" />
        <TextField form={form} name="patientAddress" label="Address (optional)" />
      </CardContent>
    </Card>
  );
}
