import * as XLSX from "xlsx";
import mammoth from "mammoth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewResult {
  html: string;
  sheetNames: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ROWS = 500;

const PREVIEW_STYLES = `
* { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 16px;
  margin: 0;
  color: #1a1a2e;
  background: #fff;
  font-size: 13px;
  line-height: 1.5;
}

/* ── Spreadsheet tables ── */
table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
  margin-bottom: 12px;
}
th {
  background: #f1f5f9;
  font-weight: 600;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
}
th, td {
  border: 1px solid #e2e8f0;
  padding: 5px 8px;
  white-space: nowrap;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
}
tr:nth-child(even) { background: #f8fafc; }
tr:hover { background: #eef2ff; }

/* ── Sheet tabs ── */
.sheet-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 12px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0;
  overflow-x: auto;
}
.sheet-tab {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  margin-bottom: -2px;
}
.sheet-tab:hover { background: #f1f5f9; color: #334155; }
.sheet-tab.active {
  background: #fff;
  color: #1e40af;
  border-color: #e2e8f0;
  border-bottom: 2px solid #fff;
  font-weight: 600;
}

.sheet-container { display: none; }
.sheet-container.active { display: block; }

.truncated-note {
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 6px;
  font-size: 12px;
  color: #92400e;
}

/* ── DOCX content ── */
p { margin: 0.4em 0; }
h1 { font-size: 1.6em; margin-top: 1em; color: #1e293b; }
h2 { font-size: 1.3em; margin-top: 0.8em; color: #334155; }
h3 { font-size: 1.1em; margin-top: 0.6em; color: #475569; }
ul, ol { padding-left: 1.5em; }
img { max-width: 100%; height: auto; }
blockquote {
  border-left: 3px solid #cbd5e1;
  margin: 0.5em 0;
  padding: 0.3em 1em;
  color: #64748b;
}
`;

const SHEET_SWITCH_SCRIPT = `
<script>
function switchSheet(idx) {
  document.querySelectorAll('.sheet-container').forEach(function(el, i) {
    el.classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.sheet-tab').forEach(function(el, i) {
    el.classList.toggle('active', i === idx);
  });
}
</script>
`;

// ---------------------------------------------------------------------------
// Sanitizer — strip script tags and on* event attributes from HTML
// ---------------------------------------------------------------------------

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, "");
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function renderSpreadsheet(buffer: Buffer): PreviewResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames;
  const sheetHtmls: string[] = [];

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    // Check row count and cap if needed
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    const totalRows = range.e.r - range.s.r + 1;
    let truncated = false;

    let htmlOptions: XLSX.Sheet2HTMLOpts = {};
    if (totalRows > MAX_ROWS) {
      truncated = true;
      // Limit the range
      const limitedRange = { ...range, e: { ...range.e, r: range.s.r + MAX_ROWS - 1 } };
      htmlOptions = { header: "", footer: "" };
      // Set the display range
      sheet["!ref"] = XLSX.utils.encode_range(limitedRange);
    }

    let tableHtml = XLSX.utils.sheet_to_html(sheet, htmlOptions);

    // Restore original range if we truncated
    if (truncated) {
      sheet["!ref"] = XLSX.utils.encode_range(range);
    }

    let sheetContent = tableHtml;
    if (truncated) {
      sheetContent += `<div class="truncated-note">Showing first ${MAX_ROWS} of ${totalRows} rows. Download the file for full data.</div>`;
    }

    sheetHtmls.push(sheetContent);
  }

  // Build body
  let body = "";

  if (sheetNames.length > 1) {
    // Tab navigation
    body += '<div class="sheet-tabs">';
    sheetNames.forEach((name, i) => {
      body += `<button class="sheet-tab${i === 0 ? " active" : ""}" onclick="switchSheet(${i})">${escapeHtml(name)}</button>`;
    });
    body += "</div>";
  }

  sheetHtmls.forEach((html, i) => {
    body += `<div class="sheet-container${i === 0 ? " active" : ""}">${html}</div>`;
  });

  const fullHtml = wrapHtml(body, sheetNames.length > 1);
  return { html: fullHtml, sheetNames };
}

async function renderDocx(buffer: Buffer): Promise<PreviewResult> {
  const result = await mammoth.convertToHtml({ buffer });
  const cleanHtml = sanitizeHtml(result.value);
  const fullHtml = wrapHtml(cleanHtml, false);
  return { html: fullHtml, sheetNames: [] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHtml(bodyContent: string, includeSheetScript: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${PREVIEW_STYLES}</style>
</head>
<body>
${bodyContent}
${includeSheetScript ? SHEET_SWITCH_SCRIPT : ""}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const SPREADSHEET_MIMES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  "application/vnd.ms-excel",
  "text/csv",
];

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function renderDocumentPreview(
  fileData: Buffer,
  mimeType: string,
): Promise<PreviewResult> {
  if (SPREADSHEET_MIMES.includes(mimeType)) {
    return renderSpreadsheet(fileData);
  }

  if (mimeType === DOCX_MIME) {
    return renderDocx(fileData);
  }

  throw new Error(`Preview not supported for mime type: ${mimeType}`);
}

export function isPreviewableMime(mimeType: string): boolean {
  return (
    SPREADSHEET_MIMES.includes(mimeType) ||
    mimeType === DOCX_MIME
  );
}
