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
    <div className="mx-auto max-w-5xl space-y-6">
      <ErrorBoundary>
        <DealHeader opportunity={opportunity} />
      </ErrorBoundary>

      <ErrorBoundary>
        <StagePriorityBar opportunity={opportunity} />
      </ErrorBoundary>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
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
            <DocumentsSection opportunityId={opportunity.id} documents={opportunity.documents ?? []} />
          </ErrorBoundary>

          <ErrorBoundary>
            <NotesSection
              opportunityId={opportunity.id}
              notes={opportunity.notes}
            />
          </ErrorBoundary>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          <ErrorBoundary>
            <TasksPanel opportunityId={opportunity.id} />
          </ErrorBoundary>

          <ErrorBoundary>
            <DealAnalysisPanel opportunity={opportunity} />
          </ErrorBoundary>

          <ErrorBoundary>
            <StageHistoryPanel
              opportunityId={opportunity.id}
              stageHistory={opportunity.stageHistory}
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <KeyDatesPanel opportunity={opportunity} />
          </ErrorBoundary>

          <ErrorBoundary>
            <TagsPanel tags={opportunity.tags} />
          </ErrorBoundary>

          <ErrorBoundary>
            <ContactsPanel opportunityId={opportunity.id} />
          </ErrorBoundary>

          <ErrorBoundary>
            <EmailsPanel
              opportunityId={opportunity.id}
              emails={opportunity.emails}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
