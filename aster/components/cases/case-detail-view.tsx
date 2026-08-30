import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Case, CaseStatus } from "@/types/case";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

const STATUS_VARIANT: Record<CaseStatus, "default" | "secondary" | "destructive" | "outline"> = {
  NEW: "secondary",
  HOSPITAL_MATCHING: "outline",
  HOSPITAL_ACCEPTED: "default",
  HOSPITAL_DECLINED: "destructive",
  VISA_PROCESSING: "default",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

export function CaseDetailView({ kase }: { kase: Case }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Case</CardTitle>
          <Badge variant={STATUS_VARIANT[kase.status]}>
            {kase.status.replace(/_/g, " ")}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Case number" value={kase.caseNumber} />
          <Field
            label="Reach-out type"
            value={
              kase.reachOutType === "AGENCY"
                ? `Agency: ${kase.agency?.name ?? ""}`
                : "Direct"
            }
          />
          <Field
            label="Assigned to"
            value={
              kase.assignedTo
                ? `${kase.assignedTo.firstName} ${kase.assignedTo.lastName}`
                : "Unassigned"
            }
          />
          <Field label="Created" value={formatDate(kase.createdAt)} />
          {kase.notes && <Field label="Notes" value={kase.notes} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patient</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" value={`${kase.patient.firstName} ${kase.patient.lastName}`} />
          <Field label="Gender" value={kase.patient.gender} />
          <Field label="Date of birth" value={formatDate(kase.patient.dateOfBirth)} />
          <Field label="Nationality" value={kase.patient.nationality} />
          <Field label="Passport number" value={kase.patient.passportNumber} />
          <Field
            label="Passport expiry"
            value={kase.patient.passportExpiry ? formatDate(kase.patient.passportExpiry) : "—"}
          />
          <Field label="Phone" value={kase.patient.phone} />
          <Field label="Email" value={kase.patient.email} />
          <Field label="Address" value={kase.patient.address} />
        </CardContent>
      </Card>

      {kase.attendant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendant</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Name"
              value={`${kase.attendant.firstName} ${kase.attendant.lastName}`}
            />
            <Field label="Relation to patient" value={kase.attendant.relationToPatient} />
            <Field label="Gender" value={kase.attendant.gender} />
            <Field label="Date of birth" value={formatDate(kase.attendant.dateOfBirth)} />
            <Field label="Nationality" value={kase.attendant.nationality} />
            <Field label="Passport number" value={kase.attendant.passportNumber} />
            <Field
              label="Passport expiry"
              value={
                kase.attendant.passportExpiry
                  ? formatDate(kase.attendant.passportExpiry)
                  : "—"
              }
            />
            <Field label="Phone" value={kase.attendant.phone} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
