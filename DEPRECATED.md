# Deprecated Documentation

> **Date**: 2026-02-26
> **Reason**: Thesis broadened from data-center-focused to multi-trade commercial services

## What Changed

The DealFlow CRM was originally built around a **data center infrastructure / low-voltage cabling** acquisition thesis. As of February 2026, the thesis has been broadened to target **all commercial service contractors** across 11 trade categories (electrical, HVAC/mechanical, plumbing, security/fire alarm, structured cabling, framing/drywall, painting, concrete/masonry, roofing, site work, and general commercial).

## Removed Features

The following DC-specific features have been removed from the codebase:

- **DC Operator tracking** (DataCenterOperator, DCFacility models)
- **General Contractor tracker** (GeneralContractor model)
- **Cabling Pipeline** (CablingOpportunity model)
- **DC-specific scoring fields** (dcRelevanceScore, dcExperience, dcCertifications, dcClients)
- **Market metrics** MW/cabling fields (totalMwOperating, estimatedCablingTam, etc.)
- **DC proximity engine** and facility mapping
- **DC-specific API routes** (operators, gcs, facilities, opportunities, network, proximity)

## Historical Reference

The original spec documents in `/docs/` (if any remain) reflect the **old** data-center-focused thesis and should not be used for new development. The current thesis is defined in:

- `src/lib/constants.ts` — PRIMARY_TRADES, TARGET_TRADES, FIT_SCORE_WEIGHTS
- `src/lib/thesis-defaults.ts` — ThesisConfig interface and defaults
- `AUDIT_REPORT.md` — Full audit of what was removed and why

## Migration Details

- **Schema changes**: Prisma `db push` applied to both local and Railway production databases
- **PrimaryTrade enum**: Changed from 9 DC-specific values to 11 broadened commercial trade values
- **Data migration**: Old enum values remapped (e.g., SECURITY_SURVEILLANCE → SECURITY_FIRE_ALARM, BUILDING_AUTOMATION_BMS → HVAC_MECHANICAL)
- **Seed data**: Updated to reflect broadened thesis companies and search keywords
