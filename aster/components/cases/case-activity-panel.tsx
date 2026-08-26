"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
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

function actorName(actor: CaseTimelineItem["actor"]) {
  return actor ? `${actor.firstName} ${actor.lastName}` : "System";
}

function describe(item: CaseTimelineItem): string {
  switch (item.type) {
    case "CASE_STATUS_EVENT":
      if (item.subtype === "CASE_CREATED") return "Case created";
      if (item.subtype === "INQUIRY_STATUS_CHANGED")
        return `Hospital inquiry ${item.toStatus?.toLowerCase()}`;
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
        <div className="flex flex-col gap-2 sm:flex-row">
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
            className="self-end sm:self-auto"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-2">
            {/* Backend returns oldest-first (a natural reading order); reversed here since a feed reads newest-first. */}
            {[...timeline].reverse().map((item, index) => (
              <div key={index} className="rounded-md border p-3 text-sm">
                <p className={item.type === "NOTE" ? "whitespace-pre-wrap" : ""}>
                  {describe(item)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {actorName(item.actor)} · {formatDateTime(item.occurredAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
