"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
    CheckCircle2,
    Clock,
    Send,
    ShieldCheck,
    Archive,
    ChevronDown,
    Loader2,
    FileEdit
} from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowStatus = "DRAFT" | "SUBMITTED" | "VERIFIED" | "APPROVED" | "ARCHIVED";

interface WorkflowStatusCardProps {
    currentStatus: WorkflowStatus;
    onStatusChange?: (newStatus: WorkflowStatus) => Promise<void>;
    isLoading?: boolean;
    canEdit?: boolean;
}

const WORKFLOW_STEPS: { status: WorkflowStatus; label: string; icon: React.ReactNode; color: string }[] = [
    { status: "DRAFT", label: "Draft", icon: <FileEdit className="h-4 w-4" />, color: "text-gray-500 bg-gray-500/10 border-gray-500/20" },
    { status: "SUBMITTED", label: "Submitted", icon: <Send className="h-4 w-4" />, color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { status: "VERIFIED", label: "Verified", icon: <ShieldCheck className="h-4 w-4" />, color: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
    { status: "APPROVED", label: "Approved", icon: <CheckCircle2 className="h-4 w-4" />, color: "text-green-500 bg-green-500/10 border-green-500/20" },
    { status: "ARCHIVED", label: "Archived", icon: <Archive className="h-4 w-4" />, color: "text-purple-500 bg-purple-500/10 border-purple-500/20" }
];

const getNextAllowedStatuses = (current: WorkflowStatus): WorkflowStatus[] => {
    const transitions: Record<WorkflowStatus, WorkflowStatus[]> = {
        DRAFT: ["SUBMITTED"],
        SUBMITTED: ["VERIFIED", "DRAFT"],
        VERIFIED: ["APPROVED", "SUBMITTED"],
        APPROVED: ["ARCHIVED", "VERIFIED"],
        ARCHIVED: ["APPROVED"]
    };
    return transitions[current] || [];
};

export function WorkflowStatusCard({
    currentStatus,
    onStatusChange,
    isLoading = false,
    canEdit = true
}: WorkflowStatusCardProps) {
    const [isChanging, setIsChanging] = useState(false);

    const currentStep = WORKFLOW_STEPS.find(s => s.status === currentStatus) || WORKFLOW_STEPS[0];
    const currentIndex = WORKFLOW_STEPS.findIndex(s => s.status === currentStatus);
    const nextStatuses = getNextAllowedStatuses(currentStatus);

    const handleStatusChange = async (newStatus: WorkflowStatus) => {
        if (!onStatusChange) return;
        setIsChanging(true);
        try {
            await onStatusChange(newStatus);
        } finally {
            setIsChanging(false);
        }
    };

    return (
        <Card className="bg-background border-border">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Workflow Status</span>
                    <Badge className={cn("flex items-center gap-1.5", currentStep.color)}>
                        {currentStep.icon}
                        {currentStep.label}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Progress Visualization */}
                <div className="relative">
                    <div className="flex items-center justify-between">
                        {WORKFLOW_STEPS.map((step, index) => {
                            const isCompleted = index < currentIndex;
                            const isCurrent = index === currentIndex;

                            return (
                                <div key={step.status} className="flex flex-col items-center relative z-10">
                                    <div
                                        className={cn(
                                            "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all",
                                            isCompleted
                                                ? "bg-primary border-primary text-primary-foreground"
                                                : isCurrent
                                                    ? "bg-primary/10 border-primary text-primary"
                                                    : "bg-muted border-border text-muted-foreground"
                                        )}
                                    >
                                        {isCompleted ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                            step.icon
                                        )}
                                    </div>
                                    <span className={cn(
                                        "text-[9px] font-semibold mt-1 uppercase tracking-wide",
                                        isCurrent ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    {/* Connecting Lines */}
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-border z-0 mx-4">
                        <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${(currentIndex / (WORKFLOW_STEPS.length - 1)) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                {canEdit && nextStatuses.length > 0 && onStatusChange && (
                    <div className="pt-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between"
                                    disabled={isLoading || isChanging}
                                >
                                    {isChanging ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            Change Status
                                            <ChevronDown className="h-4 w-4 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                {nextStatuses.map((status) => {
                                    const stepInfo = WORKFLOW_STEPS.find(s => s.status === status)!;
                                    return (
                                        <DropdownMenuItem
                                            key={status}
                                            onClick={() => handleStatusChange(status)}
                                            className="cursor-pointer"
                                        >
                                            <span className={cn("mr-2", stepInfo.color.split(" ")[0])}>
                                                {stepInfo.icon}
                                            </span>
                                            Move to {stepInfo.label}
                                        </DropdownMenuItem>
                                    );
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
