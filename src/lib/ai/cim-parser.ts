/**
 * AI-powered CIM (Confidential Information Memorandum) parser.
 *
 * Sends extracted PDF text to Claude Sonnet 4.5 for structured extraction
 * of financials, business details, contacts, and risk indicators.
 *
 * Cost: ~$0.15-0.25 per CIM depending on document length.
 */

import { callClaude, safeJsonParse } from "./claude-client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CIMFinancialYear {
  year: number | null;
  revenue: number | null;
  ebitda: number | null;
  ebitdaMargin: number | null; // Decimal 0-1
  sde: number | null;
  grossProfit: number | null;
  grossMargin: number | null; // Decimal 0-1
  netIncome: number | null;
}

export interface AICIMExtractionResult {
  // Business Overview
  businessName: string | null;
  dbaName: string | null;
  description: string | null;
  industry: string | null;
  subIndustry: string | null;
  yearEstablished: number | null;
  city: string | null;
  state: string | null;
  website: string | null;

  // Financials
  askingPrice: number | null;
  financials: CIMFinancialYear[];
  latestRevenue: number | null;
  latestEbitda: number | null;
  latestEbitdaMargin: number | null; // Decimal 0-1
  latestSde: number | null;
  employees: number | null;
  recurringRevenuePct: number | null; // Decimal 0-1

  // Services & Clients
  serviceLines: string[];
  keyClients: string[];
  customerConcentrationPct: number | null; // Decimal 0-1 (top client %)
  certifications: string[];

  // Ownership & Contact
  ownerName: string | null;
  ownerRole: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  brokerName: string | null;
  brokerCompany: string | null;
  brokerEmail: string | null;
  brokerPhone: string | null;
  reasonForSale: string | null;

  // Risk Indicators
  riskFlags: string[];

  // Generated Narratives
  dealStructureSummary: string; // Human-readable, matching PMS/AES format
  thesisFitAssessment: string; // How well it fits Colorado data center trades thesis

  // Extraction metadata
  confidence: number; // 0-1
  fieldsExtracted: string[];
}

// ─────────────────────────────────────────────
// System Prompt
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior M&A analyst specializing in lower middle-market acquisitions of IT infrastructure and trades companies. You are supporting a buy-side search focused on a Colorado-based data center trades roll-up thesis targeting structured cabling, electrical, mechanical, security/surveillance, and fire protection companies.

Your task is to extract structured data from a Confidential Information Memorandum (CIM) or business summary document. Extract every available data point with precision. When a value is not present in the document, use null — never guess or fabricate values.

Financial values should be in raw numbers (e.g., 2700000 not "2.7M" or "$2.7 million"). Percentages should be decimals between 0 and 1 (e.g., 0.12 for 12%). Years should be four-digit integers.

For the "dealStructureSummary" field, write a concise 2-4 sentence summary of the deal in plain English, similar to this style:
"Commercial electrical and structured cabling contractor. $2.7M revenue, $322K EBITDA (11.9% margin), 15 employees. Asking $900K (2.8x EBITDA). Owner retiring after 22 years."

For the "thesisFitAssessment" field, evaluate how well this business fits the Colorado data center trades roll-up thesis. Consider: service line overlap, geography, recurring revenue potential, customer base (data centers, enterprise), scalability, and integration potential.

For "riskFlags", identify concrete risks: customer concentration, key person dependency, declining trends, certification requirements, regulatory exposure, etc.

Respond ONLY with a valid JSON object matching the required schema. No markdown, no explanations.`;

// ─────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────

const MAX_TEXT_CHARS = 100_000; // ~25K tokens

export async function parseCIMWithAI(
  pdfText: string,
): Promise<{
  result: AICIMExtractionResult;
  inputTokens: number;
  outputTokens: number;
  modelUsed: string;
}> {
  // Cap text length to stay within context limits
  const truncatedText =
    pdfText.length > MAX_TEXT_CHARS
      ? pdfText.slice(0, MAX_TEXT_CHARS) + "\n\n[... document truncated at 100K characters ...]"
      : pdfText;

  const userMessage = `Extract all available data from the following CIM/business document. Return a JSON object with these exact fields:

{
  "businessName": string | null,
  "dbaName": string | null,
  "description": string | null,
  "industry": string | null,
  "subIndustry": string | null,
  "yearEstablished": number | null,
  "city": string | null,
  "state": string | null,
  "website": string | null,
  "askingPrice": number | null,
  "financials": [{ "year": number|null, "revenue": number|null, "ebitda": number|null, "ebitdaMargin": number|null, "sde": number|null, "grossProfit": number|null, "grossMargin": number|null, "netIncome": number|null }],
  "latestRevenue": number | null,
  "latestEbitda": number | null,
  "latestEbitdaMargin": number | null,
  "latestSde": number | null,
  "employees": number | null,
  "recurringRevenuePct": number | null,
  "serviceLines": string[],
  "keyClients": string[],
  "customerConcentrationPct": number | null,
  "certifications": string[],
  "ownerName": string | null,
  "ownerRole": string | null,
  "ownerEmail": string | null,
  "ownerPhone": string | null,
  "brokerName": string | null,
  "brokerCompany": string | null,
  "brokerEmail": string | null,
  "brokerPhone": string | null,
  "reasonForSale": string | null,
  "riskFlags": string[],
  "dealStructureSummary": string,
  "thesisFitAssessment": string,
  "confidence": number,
  "fieldsExtracted": string[]
}

DOCUMENT TEXT:
${truncatedText}`;

  const modelUsed = "claude-sonnet-4-5";

  const response = await callClaude({
    model: "sonnet",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
    maxTokens: 4096,
    temperature: 0,
  });

  const result = safeJsonParse<AICIMExtractionResult>(response.text);

  // Ensure arrays exist even if Claude returns null
  result.financials = result.financials || [];
  result.serviceLines = result.serviceLines || [];
  result.keyClients = result.keyClients || [];
  result.certifications = result.certifications || [];
  result.riskFlags = result.riskFlags || [];
  result.fieldsExtracted = result.fieldsExtracted || [];

  return {
    result,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    modelUsed,
  };
}
