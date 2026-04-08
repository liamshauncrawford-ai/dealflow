/**
 * SIC and NAICS code descriptions for BVR query guidance.
 * Organized by target rank.
 */

export interface CodeDescription {
  code: string;
  description: string;
}

export interface RankQueryGuide {
  rank: number;
  label: string;
  color: string;
  sicCodes: CodeDescription[];
  naicsCodes: CodeDescription[];
  dateRangeAdvice: string;
  searchTips: string[];
}

export const RANK_QUERY_GUIDES: RankQueryGuide[] = [
  {
    rank: 1,
    label: "MSP",
    color: "blue",
    sicCodes: [
      { code: "7376", description: "Computer Facilities Management Services" },
      { code: "7379", description: "Computer Related Services, NEC" },
      { code: "7374", description: "Computer Processing & Data Preparation" },
    ],
    naicsCodes: [
      { code: "541512", description: "Computer Systems Design Services" },
      { code: "541513", description: "Computer Facilities Management Services" },
      { code: "541519", description: "Other Computer Related Services" },
      { code: "518210", description: "Data Processing, Hosting & Related Services" },
    ],
    dateRangeAdvice: "Last 3\u20135 years for statistical significance",
    searchTips: [
      "In DealStats, search by SIC Code first \u2014 it yields the most relevant results",
      "Filter revenue to your soft target range to focus on comparable-sized deals",
      "Export all columns \u2014 the import module will filter to relevant fields",
    ],
  },
  {
    rank: 2,
    label: "UCaaS",
    color: "purple",
    sicCodes: [
      { code: "4813", description: "Telephone Communications (No Radiotelephone)" },
      { code: "7372", description: "Prepackaged Software" },
      { code: "7379", description: "Computer Related Services, NEC" },
      { code: "4899", description: "Communications Services, NEC" },
    ],
    naicsCodes: [
      { code: "517312", description: "Wireless Telecommunications Carriers" },
      { code: "517911", description: "Telecommunications Resellers" },
      { code: "541512", description: "Computer Systems Design Services" },
      { code: "519190", description: "All Other Information Services" },
    ],
    dateRangeAdvice: "Last 3\u20135 years for statistical significance",
    searchTips: [
      "UCaaS transactions may appear under telecom SIC codes \u2014 check 4813 and 4899",
      "BizComps may have more small UCaaS deals than DealStats",
      "Filter by employee count 5\u201350 to match your target size",
    ],
  },
  {
    rank: 3,
    label: "Security Integration",
    color: "amber",
    sicCodes: [
      { code: "7382", description: "Home Health Care Services / Security Systems" },
      { code: "7381", description: "Investigation & Security Services" },
      { code: "1731", description: "Electrical Work" },
      { code: "5065", description: "Electronic Parts & Equipment (Wholesale)" },
    ],
    naicsCodes: [
      { code: "561621", description: "Security Systems Services (except Locksmiths)" },
      { code: "238210", description: "Electrical Contractors & Other Wiring" },
      { code: "423690", description: "Other Electronic Parts & Equipment (Wholesale)" },
    ],
    dateRangeAdvice: "Last 3\u20135 years for statistical significance",
    searchTips: [
      "Security integration overlaps with alarm monitoring \u2014 check both 7382 and 561621",
      "Commercial-only deals may need manual filtering after export",
      "Look for \u2018monitoring contracts\u2019 or \u2018RMR\u2019 in deal descriptions for recurring revenue",
    ],
  },
  {
    rank: 4,
    label: "Structured Cabling",
    color: "emerald",
    sicCodes: [
      { code: "1731", description: "Electrical Work" },
      { code: "1799", description: "Special Trade Contractors, NEC" },
      { code: "1711", description: "Plumbing, Heating & Air-Conditioning" },
    ],
    naicsCodes: [
      { code: "238210", description: "Electrical Contractors & Other Wiring" },
      { code: "238290", description: "Other Building Equipment Contractors" },
      { code: "561990", description: "All Other Support Services" },
    ],
    dateRangeAdvice: "Last 5 years \u2014 cabling deals are less frequent",
    searchTips: [
      "Cabling is often categorized under general electrical (SIC 1731) \u2014 expect mixed results",
      "Filter by revenue $500K\u2013$3M to match target range",
      "BizComps may have more cabling deals than DealStats due to smaller transaction sizes",
    ],
  },
];
