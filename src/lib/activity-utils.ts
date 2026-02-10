import { formatRelativeDate } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Get the most recent activity date for an opportunity.
 * Checks updatedAt, latest note, latest linked email.
 */
export function getLastActivityDate(opp: any): Date {
  const dates: Date[] = [new Date(opp.updatedAt)];

  // Check notes
  if (opp.notes && opp.notes.length > 0) {
    dates.push(new Date(opp.notes[0].createdAt));
  }

  // Check linked emails
  if (opp.emails && opp.emails.length > 0) {
    const emailDate = opp.emails[0]?.email?.sentAt;
    if (emailDate) dates.push(new Date(emailDate));
  }

  // Check stage history
  if (opp.stageHistory && opp.stageHistory.length > 0) {
    dates.push(new Date(opp.stageHistory[0].createdAt));
  }

  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

/**
 * Group an activity date into a human-readable category.
 */
export function getActivityGroup(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return "Today";
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return "Older";
}

/**
 * Get a human-readable description of the latest activity on an opportunity.
 */
export function getActivityDescription(opp: any): string {
  const emailDate = opp.emails?.[0]?.email?.sentAt;
  const noteDate = opp.notes?.[0]?.createdAt;
  const stageDate = opp.stageHistory?.[0]?.createdAt;
  const updateDate = opp.updatedAt;

  const dates = [
    { type: "email", date: emailDate ? new Date(emailDate) : null },
    { type: "note", date: noteDate ? new Date(noteDate) : null },
    { type: "stage", date: stageDate ? new Date(stageDate) : null },
    { type: "update", date: new Date(updateDate) },
  ]
    .filter((d) => d.date !== null)
    .sort((a, b) => b.date!.getTime() - a.date!.getTime());

  const latest = dates[0];
  if (!latest) return "No activity";

  switch (latest.type) {
    case "email":
      return `Email ${formatRelativeDate(latest.date!.toISOString())}`;
    case "note":
      return `Note added ${formatRelativeDate(latest.date!.toISOString())}`;
    case "stage":
      return `Stage changed ${formatRelativeDate(latest.date!.toISOString())}`;
    default:
      return `Updated ${formatRelativeDate(latest.date!.toISOString())}`;
  }
}

/**
 * Determine follow-up urgency for an opportunity.
 */
export function getFollowUpStatus(opp: any): "overdue" | "due" | "ok" {
  const lastActivity = getLastActivityDate(opp);
  const diffMs = Date.now() - lastActivity.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > 3) return "overdue";
  if (diffDays > 1) return "due";
  return "ok";
}
