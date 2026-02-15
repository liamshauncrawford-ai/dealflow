"use client";

import { use } from "react";
import Link from "next/link";
import { useOpportunity } from "@/hooks/use-pipeline";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  DealHeader,
  StagePriorityBar,
  LinkedListingCard,
  NoListingPlaceholder,
  DocumentsSection,
  NotesSection,
  StageHistoryPanel,
  KeyDatesPanel,
  TagsPanel,
  ContactsPanel,
  EmailsPanel,
  TasksPanel,
  DealAnalysisPanel,
  AIRiskPanel,
  AuditLogPanel,
} from "@/components/pipeline";

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: opportunity, isLoading, error } = useOpportunity(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Loading deal details">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="py-12 text-center">
        <p className="text-destructive">Failed to load opportunity</p>
        <Link href="/pipeline" className="mt-2 text-sm text-primary hover:underline">
          Back to pipeline
        </Link>
      </div>
    );
  }

  const listing = opportunity.listing;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ErrorBoundary>
        <DealHeader opportunity={opportunity} />
      </ErrorBoundary>

      <ErrorBoundary>
        <StagePriorityBar opportunity={opportunity} />
      </ErrorBoundary>

      {/* Deal Analysis — full width below stage bar */}
      <ErrorBoundary>
        <DealAnalysisPanel opportunity={opportunity} />
      </ErrorBoundary>

      {/* Two-column layout — left column wider for detailed content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left column — detailed content */}
        <div className="space-y-6">
          <ErrorBoundary>
            {listing ? (
              <LinkedListingCard
                listing={listing}
                offerPrice={opportunity.offerPrice}
                offerTerms={opportunity.offerTerms}
                industryMultiples={opportunity.industryMultiples}
              />
            ) : (
              <NoListingPlaceholder />
            )}
          </ErrorBoundary>

          <ErrorBoundary>
            <AIRiskPanel opportunityId={opportunity.id} />
          </ErrorBoundary>

          <ErrorBoundary>
            <NotesSection
              opportunityId={opportunity.id}
              notes={opportunity.notes}
            />
          </ErrorBoundary>
        </div>

        {/* Right column — compact panels */}
        <div className="space-y-6">
          <ErrorBoundary>
            <TasksPanel opportunityId={opportunity.id} />
          </ErrorBoundary>

          <ErrorBoundary>
            <ContactsPanel opportunityId={opportunity.id} />
          </ErrorBoundary>

          <ErrorBoundary>
            <DocumentsSection opportunityId={opportunity.id} documents={opportunity.documents ?? []} />
          </ErrorBoundary>

          <ErrorBoundary>
            <EmailsPanel
              opportunityId={opportunity.id}
              emails={opportunity.emails}
              dealTitle={opportunity.title}
              contacts={opportunity.contacts?.map((c: { name: string; email: string | null }) => ({ name: c.name, email: c.email })) ?? []}
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <StageHistoryPanel
              opportunityId={opportunity.id}
              stageHistory={opportunity.stageHistory}
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <AuditLogPanel opportunityId={opportunity.id} />
          </ErrorBoundary>

          <ErrorBoundary>
            <KeyDatesPanel opportunity={opportunity} />
          </ErrorBoundary>

          <ErrorBoundary>
            <TagsPanel tags={opportunity.tags} />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
