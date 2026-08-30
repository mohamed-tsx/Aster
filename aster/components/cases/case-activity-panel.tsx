"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRightLeft,
  Banknote,
  Building2,
  Loader2,
  MessageSquare,
  Plus,
  Receipt,
  Repeat,
  Send,
  Undo2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getCaseTimeline, createCaseNote, getErrorMessage } from "@/services/cases";
import type { CaseTimelineItem } from "@/types/timeline";

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}

function actorName(actor: CaseTimelineItem["actor"]) {
  return actor ? `${actor.firstName} ${actor.lastName}` : "System";
}

function describe(item: CaseTimelineItem): string {
  switch (item.type) {
    case "CASE_STATUS_EVENT":
      if (item.subtype === "CASE_CREATED") return "Case created";
      if (item.subtype === "INQUIRY_STATUS_CHANGED")
        return `Hospital inquiry ${item.toStatus?.toLowerCase()}`;
      // These two carry fromStatus: null / toStatus: "ACCEPTED", which reads as
      // "Status changed: — → ACCEPTED" if they fall through to the generic branch.
      if (item.subtype === "HOSPITAL_CHOSEN")
        return item.hospitalName ? `Hospital chosen: ${item.hospitalName}` : "Hospital chosen";
      if (item.subtype === "HOSPITAL_CHANGED")
        return item.hospitalName
          ? `Chosen hospital changed to ${item.hospitalName}`
          : "Chosen hospital changed";
      return `Status changed: ${item.fromStatus?.replace(/_/g, " ") ?? "—"} → ${item.toStatus?.replace(/_/g, " ")}`;
    case "NOTE":
      return item.body ?? "";
    case "PAYMENT_RECEIVED":
      return `Fee payment received (${item.travelerType}): ${item.amount} ${item.currency}`;
    case "EXPENSE_PAID":
      return `Expense recorded: ${item.category} — ${item.amount} ${item.currency}`;
    case "REFUND_ISSUED":
      return `Refund issued (${item.travelerType}): ${item.amount} — ${item.reason}`;
    case "DOCUMENT_UPLOADED":
      return `Document uploaded: ${item.fileName}`;
    default:
      return "";
  }
}

function iconFor(item: CaseTimelineItem): LucideIcon {
  switch (item.type) {
    case "CASE_STATUS_EVENT":
      if (item.subtype === "CASE_CREATED") return Plus;
      if (item.subtype === "HOSPITAL_CHOSEN") return Building2;
      if (item.subtype === "HOSPITAL_CHANGED") return Repeat;
      return ArrowRightLeft;
    case "NOTE":
      return MessageSquare;
    case "PAYMENT_RECEIVED":
      return Banknote;
    case "EXPENSE_PAID":
      return Receipt;
    case "REFUND_ISSUED":
      return Undo2;
    case "DOCUMENT_UPLOADED":
      return Upload;
    default:
      return MessageSquare;
  }
}

type CaseActivityPanelProps = { caseId: string };

export function CaseActivityPanel({ caseId }: CaseActivityPanelProps) {
  const toast = useToast();
  const [timeline, setTimeline] = useState<CaseTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteBody, setNoteBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      setTimeline(await getCaseTimeline(caseId));
    } catch (error) {
      toast.error("Failed to load activity", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const handleAddNote = async () => {
    const body = noteBody.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      await createCaseNote(caseId, body);
      setNoteBody("");
      toast.success("Note added");
      fetchTimeline();
    } catch (error) {
      toast.error("Could not add note", getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Add a note..."
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={2}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={handleAddNote}
            disabled={submitting || !noteBody.trim()}
            className="self-end"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Add note
              </>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <Skeleton className="h-10 flex-1" />
              </div>
            ))}
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="relative space-y-5">
            {/* Backend returns oldest-first (a natural reading order); reversed here since a feed reads newest-first. */}
            {[...timeline].reverse().map((item, index, list) => {
              const Icon = iconFor(item);
              const isStatus = item.type === "CASE_STATUS_EVENT";
              const isNote = item.type === "NOTE";
              const isLast = index === list.length - 1;
              return (
                <li key={index} className="relative flex gap-3">
                  {!isLast && (
                    <span
                      className="absolute left-[13px] top-7 bottom-[-20px] w-px bg-border"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background",
                      isStatus
                        ? "border-primary/30 text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-sm font-medium leading-tight">
                      {actorName(item.actor)}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-sm text-muted-foreground",
                        isNote && "whitespace-pre-wrap text-foreground",
                      )}
                    >
                      {describe(item)}
                    </p>
                    <p
                      className="mt-1 text-xs text-muted-foreground"
                      title={formatDateTime(item.occurredAt)}
                    >
                      {formatRelative(item.occurredAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
