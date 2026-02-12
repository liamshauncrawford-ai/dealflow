/**
 * Email categorization utility for deal pipeline automation
 * Auto-classifies emails into deal-stage categories based on content patterns
 */

export const TARGET_DOMAINS = [
  'structuredplus.com',
  'intsysinst.com',
  'msicolorado.com',
  'colorado-controls.com',
  'anchornetworksolutions.com',
] as const;

export const BROKER_DOMAINS = [
  'sunbeltnetwork.com',
  'tworld.com',
  'murphybusiness.com',
  'linkbusiness.com',
] as const;

interface EmailCategorizerConfig {
  userDomain: string;
  targetDomains: string[];
  brokerDomains: string[];
}

interface EmailInput {
  fromAddress: string;
  toAddresses: string[];
  subject: string | null;
  bodyPreview: string | null;
}

export type EmailCategory =
  | 'COLD_OUTREACH'
  | 'WARM_INTRODUCTION'
  | 'INITIAL_RESPONSE'
  | 'DISCOVERY_CALL'
  | 'LOI_TERM_SHEET'
  | 'DUE_DILIGENCE'
  | 'CLOSING'
  | 'DEAD_PASSED'
  | 'BROKER_UPDATE';

/**
 * Categorizes an email based on content patterns and sender/recipient analysis
 * @param email - Email object with from/to addresses, subject, and body preview
 * @param config - Configuration with user domain and target/broker domains
 * @returns EmailCategory string or null if no match
 */
export function categorizeEmail(
  email: EmailInput,
  config: EmailCategorizerConfig
): EmailCategory | null {
  const { fromAddress, toAddresses, subject, bodyPreview } = email;
  const { userDomain, targetDomains, brokerDomains } = config;

  // Combine subject and body for text matching (case-insensitive)
  const combinedText = [subject, bodyPreview]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // Helper: check if email domain matches any in list
  const getDomain = (email: string): string => {
    const match = email.match(/@(.+)$/);
    return match ? match[1].toLowerCase() : '';
  };

  const fromDomain = getDomain(fromAddress);
  const toDomains = toAddresses.map(getDomain);

  const isFromUser = fromDomain === userDomain.toLowerCase();
  const isFromTarget = targetDomains.some(
    (domain) => fromDomain === domain.toLowerCase()
  );
  const isFromBroker = brokerDomains.some(
    (domain) => fromDomain === domain.toLowerCase()
  );
  const isToTarget = toAddresses.some((toAddr) =>
    targetDomains.some(
      (domain) => getDomain(toAddr) === domain.toLowerCase()
    )
  );

  // Priority order: DEAD_PASSED > LOI_TERM_SHEET > DUE_DILIGENCE > CLOSING >
  // DISCOVERY_CALL > WARM_INTRODUCTION > BROKER_UPDATE > COLD_OUTREACH > INITIAL_RESPONSE

  // 1. DEAD_PASSED
  if (
    /not interested|not selling|pass|decline/i.test(combinedText)
  ) {
    return 'DEAD_PASSED';
  }

  // 2. LOI_TERM_SHEET
  if (
    /letter of intent|(?:^|\s)loi(?:\s|$)|term sheet|offer/i.test(combinedText)
  ) {
    return 'LOI_TERM_SHEET';
  }

  // 3. DUE_DILIGENCE
  if (
    /due diligence|financial statements?|p&l|tax returns?/i.test(combinedText)
  ) {
    return 'DUE_DILIGENCE';
  }

  // 4. CLOSING
  if (
    /purchase agreement|closing|wire|escrow/i.test(combinedText)
  ) {
    return 'CLOSING';
  }

  // 5. DISCOVERY_CALL
  // Contains calendar/meeting/call/zoom + date/time patterns
  const hasSchedulingKeyword = /calendar|meeting|call|zoom/i.test(combinedText);
  const hasDateTimePattern = /\d{1,2}:\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{1,2}/i.test(
    combinedText
  );
  if (hasSchedulingKeyword && hasDateTimePattern) {
    return 'DISCOVERY_CALL';
  }

  // 6. WARM_INTRODUCTION
  if (
    /introduction|connecting you with|referred by/i.test(combinedText)
  ) {
    return 'WARM_INTRODUCTION';
  }

  // 7. BROKER_UPDATE
  if (isFromBroker) {
    return 'BROKER_UPDATE';
  }

  // 8. COLD_OUTREACH
  // Emails FROM user's domain TO target company domains
  if (isFromUser && isToTarget) {
    return 'COLD_OUTREACH';
  }

  // 9. INITIAL_RESPONSE
  // Emails FROM target company domains (first reply)
  if (isFromTarget) {
    return 'INITIAL_RESPONSE';
  }

  return null;
}
