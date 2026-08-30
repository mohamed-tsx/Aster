"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { FileField } from "@/components/ui/file-field";
import { PatientSearch } from "@/components/cases/patient-search";
import { PatientFields } from "@/components/cases/patient-fields";
import { AttendantFields } from "@/components/cases/attendant-fields";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import {
  caseFormSchema,
  validateCaseForm,
  buildCaseCreateFormData,
  buildCaseUpdatePayload,
  type CaseFormValues,
} from "@/lib/validations/case";
import { listAgencies } from "@/services/agencies";
import { listUsers } from "@/services/users";
import type { Agency } from "@/types/agency";
import type { Case } from "@/types/case";
import type { PatientSummary } from "@/types/patient";

const EMPTY_VALUES: CaseFormValues = {
  patientFirstName: "",
  patientLastName: "",
  patientGender: undefined,
  patientDateOfBirth: "",
  patientNationality: "",
  patientPassportNumber: "",
  patientPassportExpiry: "",
  patientPhone: "",
  patientEmail: "",
  patientAddress: "",
  hasAttendant: false,
  attendantFirstName: "",
  attendantLastName: "",
  attendantGender: undefined,
  attendantDateOfBirth: "",
  attendantNationality: "",
  attendantPassportNumber: "",
  attendantPassportExpiry: "",
  attendantPhone: "",
  attendantRelationToPatient: "",
  reachOutType: "DIRECT",
  agencyId: "",
  assignedToId: "",
  notes: "",
};

function caseToFormValues(kase: Case): CaseFormValues {
  return {
    patientFirstName: kase.patient.firstName,
    patientLastName: kase.patient.lastName,
    patientGender: kase.patient.gender,
    patientDateOfBirth: kase.patient.dateOfBirth.slice(0, 10),
    patientNationality: kase.patient.nationality,
    patientPassportNumber: kase.patient.passportNumber ?? "",
    patientPassportExpiry: kase.patient.passportExpiry
      ? kase.patient.passportExpiry.slice(0, 10)
      : "",
    patientPhone: kase.patient.phone,
    patientEmail: kase.patient.email ?? "",
    patientAddress: kase.patient.address ?? "",
    hasAttendant: !!kase.attendant,
    attendantFirstName: kase.attendant?.firstName ?? "",
    attendantLastName: kase.attendant?.lastName ?? "",
    attendantGender: kase.attendant?.gender,
    attendantDateOfBirth: kase.attendant?.dateOfBirth?.slice(0, 10) ?? "",
    attendantNationality: kase.attendant?.nationality ?? "",
    attendantPassportNumber: kase.attendant?.passportNumber ?? "",
    attendantPassportExpiry: kase.attendant?.passportExpiry?.slice(0, 10) ?? "",
    attendantPhone: kase.attendant?.phone ?? "",
    attendantRelationToPatient: kase.attendant?.relationToPatient ?? "",
    reachOutType: kase.reachOutType,
    agencyId: kase.agency?.id ?? "",
    assignedToId: kase.assignedTo?.id ?? "",
    notes: kase.notes ?? "",
  };
}

type CaseFormProps =
  | { mode: "create"; onSubmit: (payload: FormData) => Promise<void> }
  | {
      mode: "edit";
      initialCase: Case;
      onSubmit: (payload: Record<string, unknown>) => Promise<void>;
    };

export function CaseForm(props: CaseFormProps) {
  const { mode, onSubmit } = props;
  const toast = useToast();
  const { user: currentUser } = useAuthStore();
  const form = useForm<CaseFormValues>({
    defaultValues: mode === "edit" ? caseToFormValues(props.initialCase) : EMPTY_VALUES,
  });
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(
    mode === "edit"
      ? { ...props.initialCase.patient, hasPassportOnFile: false }
      : null,
  );
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<
    { id: string; firstName: string; lastName: string }[]
  >([]);
  const [patientPassport, setPatientPassport] = useState<File | null>(null);
  const [caseDocument, setCaseDocument] = useState<File | null>(null);
  const [attendantPassport, setAttendantPassport] = useState<File | null>(null);

  const reachOutType = form.watch("reachOutType");
  const showAttendant = form.watch("hasAttendant");
  const patientHasPassportOnFile = selectedPatient?.hasPassportOnFile ?? false;

  useEffect(() => {
    listAgencies()
      .then(setAgencies)
      .catch(() => setAgencies([]));

    // Best-effort: staff without VIEW_USERS simply won't see an assignee picker
    // (the case auto-assigns to them on create instead — see below).
    listUsers({ limit: 100 })
      .then((result) => setAssignableUsers(result.users))
      .catch(() => setAssignableUsers([]));

    if (mode === "create" && currentUser?.id) {
      form.setValue("assignedToId", currentUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = form.handleSubmit(async (values) => {
    const validationError = validateCaseForm(values, {
      selectedPatientId: selectedPatient?.id ?? null,
      mode,
    });
    if (validationError) {
      toast.error("Validation error", validationError);
      return;
    }

    const parsed = caseFormSchema.safeParse(values);
    if (!parsed.success) {
      toast.error(
        "Validation error",
        parsed.error.issues[0]?.message ?? "Fix form errors",
      );
      return;
    }

    if (mode === "create") {
      if (!patientHasPassportOnFile && !patientPassport) {
        toast.error("Validation error", "Patient passport is required");
        return;
      }
      if (!caseDocument) {
        toast.error("Validation error", "Case document is required");
        return;
      }
    }

    const payload =
      mode === "create"
        ? buildCaseCreateFormData(parsed.data, selectedPatient?.id ?? null, {
            patientPassport,
            caseDocument,
            // Ignore a stale attendant passport if the toggle was turned back off
            // after a file was picked — otherwise the backend gets an orphan file.
            attendantPassport: showAttendant ? attendantPassport : null,
          })
        : buildCaseUpdatePayload(parsed.data);

    await onSubmit(payload as FormData & Record<string, unknown>);
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === "create" && (
          <PatientSearch selectedPatient={selectedPatient} onSelect={setSelectedPatient} />
        )}

        {(mode === "edit" || !selectedPatient) && <PatientFields form={form} />}

        <AttendantFields form={form} />

        {mode === "create" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileField
                id="patientPassport"
                label="Patient passport"
                required={!patientHasPassportOnFile}
                value={patientPassport}
                onChange={setPatientPassport}
                hint={
                  patientHasPassportOnFile
                    ? "On file from a previous case — upload only to replace."
                    : undefined
                }
              />
              <FileField
                id="caseDocument"
                label="Case document"
                required
                value={caseDocument}
                onChange={setCaseDocument}
                hint="A document describing the patient's medical situation."
              />
              {showAttendant && (
                <FileField
                  id="attendantPassport"
                  label="Attendant passport (optional now — required before visa processing)"
                  value={attendantPassport}
                  onChange={setAttendantPassport}
                />
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Case details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="reachOutType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reach-out type</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={mode === "edit"}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DIRECT">Direct</SelectItem>
                      <SelectItem value="AGENCY">Agency</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {reachOutType === "AGENCY" && (
              <FormField
                control={form.control}
                name="agencyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select agency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agencies.map((agency) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {assignableUsers.length > 0 && (
              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned to</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assignableUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.firstName} {u.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={(field.value as string) ?? ""} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {mode === "create" ? "Create case" : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
