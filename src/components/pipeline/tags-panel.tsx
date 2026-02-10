"use client";

interface TagsPanelProps {
  tags: Array<{ tag: { id: string; name: string; color: string | null } }> | null;
}

export function TagsPanel({ tags }: TagsPanelProps) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Tags</h2>
      </div>
      <div className="flex flex-wrap gap-1.5 p-4">
        {tags.map((t) => (
          <span
            key={t.tag.id}
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: t.tag.color ? `${t.tag.color}20` : undefined,
              color: t.tag.color ?? undefined,
            }}
          >
            {t.tag.name}
          </span>
        ))}
      </div>
    </div>
  );
}
