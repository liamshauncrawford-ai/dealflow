"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import {
  LinkedListingCard,
  NoListingPlaceholder,
  DealAnalysisPanel,
  AIRiskPanel,
  NotesSection,
  TasksPanel,
  ContactsPanel,
  DocumentsSection,
  EmailsPanel,
  StageHistoryPanel,
  AuditLogPanel,
  KeyDatesPanel,
  TagsPanel,
} from "@/components/pipeline";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface OverviewTabContentProps {
  opportunity: any;
}

export function OverviewTabContent({ opportunity }: OverviewTabContentProps) {
  const listing = opportunity.listing;

  return (
    <>
      {/* Deal Analysis — full width */}
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
            <DocumentsSection
              opportunityId={opportunity.id}
              documents={opportunity.documents ?? []}
            />
          </ErrorBoundary>

          <ErrorBoundary>
            <EmailsPanel
              opportunityId={opportunity.id}
              emails={opportunity.emails}
              dealTitle={opportunity.title}
              contacts={
                opportunity.contacts?.map(
                  (c: { name: string; email: string | null }) => ({
                    name: c.name,
                    email: c.email,
                  })
                ) ?? []
              }
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
    </>
  );
}
