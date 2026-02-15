"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, FileText, Sparkles, Loader2 } from "lucide-react";
import { useEmailTemplates, useGenerateTemplate } from "@/hooks/use-email-templates";

const CATEGORY_LABELS: Record<string, string> = {
  CIM_REQUEST: "CIM Request",
  NDA_REQUEST: "NDA Request",
  INTRODUCTION: "Introduction",
  FOLLOW_UP: "Follow-up",
  LOI: "Letter of Intent",
  GENERAL: "General",
};

const CATEGORY_ORDER = [
  "CIM_REQUEST",
  "NDA_REQUEST",
  "INTRODUCTION",
  "FOLLOW_UP",
  "LOI",
  "GENERAL",
];

interface TemplateSelectorProps {
  dealTitle: string;
  onApply: (subject: string, bodyHtml: string) => void;
}

export function TemplateSelector({ dealTitle, onApply }: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [generatingCategory, setGeneratingCategory] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: templatesData } = useEmailTemplates();
  const generateMutation = useGenerateTemplate();

  const templates = templatesData?.templates ?? [];

  // Group templates by category
  const grouped: Record<string, typeof templates> = {};
  for (const cat of CATEGORY_ORDER) {
    const catTemplates = templates.filter((t) => t.category === cat);
    if (catTemplates.length > 0) {
      grouped[cat] = catTemplates;
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleGenerate = async (category: string) => {
    setGeneratingCategory(category);
    try {
      const result = await generateMutation.mutateAsync({
        category,
        context: dealTitle ? `Deal: ${dealTitle}` : undefined,
      });
      onApply(result.subject, result.bodyHtml);
      setIsOpen(false);
    } finally {
      setGeneratingCategory(null);
    }
  };

  const handleSelectTemplate = (template: { subject: string; bodyHtml: string }) => {
    onApply(template.subject, template.bodyHtml);
    setIsOpen(false);
  };

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 rounded border bg-background px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
      >
        <FileText className="h-3 w-3" />
        Use Template
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border bg-background shadow-lg max-h-80 overflow-y-auto">
          {/* Saved templates grouped by category */}
          {Object.keys(grouped).length > 0 && (
            <div className="p-1">
              {Object.entries(grouped).map(([cat, catTemplates]) => (
                <div key={cat}>
                  <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {CATEGORY_LABELS[cat] || cat}
                  </p>
                  {catTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleSelectTemplate(template)}
                      className="w-full text-left rounded px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium">{template.name}</span>
                      <span className="block text-[10px] text-muted-foreground truncate">
                        {template.subject}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Divider */}
          {Object.keys(grouped).length > 0 && (
            <div className="border-t my-1" />
          )}

          {/* AI generate section */}
          <div className="p-1">
            <p className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-2.5 w-2.5" />
              Generate with AI
            </p>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                onClick={() => handleGenerate(cat)}
                disabled={generatingCategory !== null}
                className="w-full text-left rounded px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {generatingCategory === cat ? (
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-3 w-3 text-primary" />
                )}
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* No templates hint */}
          {Object.keys(grouped).length === 0 && (
            <div className="px-3 py-2 border-t">
              <p className="text-[10px] text-muted-foreground">
                No saved templates yet. Use &ldquo;Generate with AI&rdquo; or save an
                email as a template after composing it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
