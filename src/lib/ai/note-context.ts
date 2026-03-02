import { prisma } from "@/lib/db";

/**
 * Fetches all notes for an opportunity and formats them as a context string
 * for inclusion in AI analysis prompts.
 */
export async function getOpportunityNotesContext(opportunityId: string): Promise<string> {
  const notes = await prisma.note.findMany({
    where: { opportunityId },
    orderBy: { createdAt: "desc" },
    select: { content: true, title: true, noteType: true, createdAt: true },
  });

  if (notes.length === 0) return "";

  const sections = notes.map((n) => {
    const header = [
      n.title || "Note",
      `(${n.noteType})`,
      `— ${n.createdAt.toISOString().slice(0, 10)}`,
    ].join(" ");
    return `### ${header}\n${n.content}`;
  });

  return `\n\n## Research Notes & Due Diligence\nThe following notes have been collected for this opportunity:\n\n${sections.join("\n\n---\n\n")}`;
}
