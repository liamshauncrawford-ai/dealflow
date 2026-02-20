import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { evaluateTargets, type ScanTarget } from "@/lib/ai/daily-scan";
import { computeFitScore, type FitScoreInput } from "@/lib/scoring/fit-score-engine";
import { requireCronOrAuth } from "@/lib/auth-helpers";

const BATCH_SIZE = 10;

/**
 * POST /api/cron/daily-scan
 * Finds unscored or recently-added listings and runs AI evaluation.
 * Auth: CRON_SECRET (external scheduler) or session cookie (dashboard).
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCronOrAuth(request);
    if (!authResult.authorized) return authResult.error;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured" },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const force = (body as { force?: boolean }).force === true;

    // Create agent run record
    const agentRun = await prisma.aIAgentRun.create({
      data: { agentName: "daily_scan", status: "running" },
    });

    // Find listings needing scoring
    const listings = await prisma.listing.findMany({
      where: force
        ? {} // Re-scan all if forced
        : {
            OR: [
              { compositeScore: null },
              { aiScore: null },
              // Re-evaluate listings scored more than 7 days ago
              { lastScoredAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            ],
            isHidden: false,
          },
      include: {
        opportunity: {
          include: { contacts: { where: { isPrimary: true }, take: 1 } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: BATCH_SIZE * 3, // Fetch more than we need, then batch
    });

    if (listings.length === 0) {
      await prisma.aIAgentRun.update({
        where: { id: agentRun.id },
        data: {
          status: "success",
          summary: "No listings need scoring",
          completedAt: new Date(),
        },
      });
      return NextResponse.json({ message: "No listings to scan", scored: 0 });
    }

    let totalScored = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let apiCalls = 0;

    // Process in batches
    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE);

      // Build scan targets
      const targets: ScanTarget[] = batch.map((l) => ({
        id: l.id,
        businessName: l.businessName,
        title: l.title,
        primaryTrade: l.primaryTrade,
        secondaryTrades: l.secondaryTrades,
        revenue: l.revenue ? Number(l.revenue) : null,
        ebitda: l.ebitda ? Number(l.ebitda) : null,
        sde: l.sde ? Number(l.sde) : null,
        askingPrice: l.askingPrice ? Number(l.askingPrice) : null,
        city: l.city,
        state: l.state,
        established: l.established,
        certifications: l.certifications,
        dcCertifications: l.dcCertifications,
        description: l.description,
        fitScore: l.fitScore,
      }));

      // Call Claude for AI evaluation
      const { evaluations, inputTokens, outputTokens } = await evaluateTargets(targets);
      apiCalls++;
      totalTokens += inputTokens + outputTokens;
      totalCost += (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0;

      // Apply evaluations to listings
      for (const evaluation of evaluations) {
        const listing = batch.find((l) => l.id === evaluation.id);
        if (!listing) continue;

        const primaryContact = listing.opportunity?.contacts?.[0];

        // Also compute deterministic fit score
        const fitInput: FitScoreInput = {
          primaryTrade: listing.primaryTrade,
          secondaryTrades: listing.secondaryTrades,
          revenue: listing.revenue ? Number(listing.revenue) : null,
          established: listing.established,
          state: listing.state,
          metroArea: listing.metroArea,
          certifications: listing.certifications,
          dcCertifications: listing.dcCertifications,
          dcRelevanceScore: listing.dcRelevanceScore,
          askingPrice: listing.askingPrice ? Number(listing.askingPrice) : null,
          ebitda: listing.ebitda ? Number(listing.ebitda) : null,
          inferredEbitda: listing.inferredEbitda ? Number(listing.inferredEbitda) : null,
          targetMultipleLow: null,
          targetMultipleHigh: null,
          estimatedAgeRange: primaryContact?.estimatedAgeRange ?? null,
          keyPersonRisk: null,
          recurringRevenuePct: null,
        };

        const { fitScore } = computeFitScore(fitInput);
        const previousScore = listing.compositeScore;

        // Composite = AI score (since we have the full thesis-weighted eval)
        const compositeScore = evaluation.composite_score;
        const scoreChange = previousScore != null ? compositeScore - previousScore : 0;

        await prisma.listing.update({
          where: { id: evaluation.id },
          data: {
            fitScore,
            compositeScore,
            aiScore: evaluation.composite_score,
            deterministicScore: fitScore,
            thesisAlignment: evaluation.thesis_alignment,
            recommendedAction: evaluation.recommended_action,
            lastScoredAt: new Date(),
            scoreChange,
          },
        });

        // Store the full AI analysis
        await prisma.aIAnalysisResult.create({
          data: {
            listingId: evaluation.id,
            analysisType: "DAILY_SCAN",
            resultData: evaluation as object,
            modelUsed: "claude-sonnet-4-20250514",
            inputTokens,
            outputTokens,
          },
        });

        totalScored++;
        if (previousScore == null) totalCreated++;
        else totalUpdated++;

        // Create notification for high-scoring discoveries
        if (
          evaluation.composite_score >= 70 ||
          evaluation.recommended_action === "pursue_immediately"
        ) {
          await prisma.notification.create({
            data: {
              type: "HIGH_SCORE_DISCOVERY",
              title: `High-Score Target: ${listing.businessName || listing.title}`,
              message: `Score: ${evaluation.composite_score} — ${evaluation.reasoning}`,
              priority: "high",
              listingId: listing.id,
              entityType: "listing",
              entityId: listing.id,
              actionUrl: `/listings/${listing.id}`,
            },
          });
        }

        // Notification for significant score changes
        if (Math.abs(scoreChange) >= 10 && previousScore != null) {
          await prisma.notification.create({
            data: {
              type: "SCORE_CHANGE",
              title: `Score ${scoreChange > 0 ? "increased" : "decreased"}: ${listing.businessName || listing.title}`,
              message: `${previousScore} → ${compositeScore} (${scoreChange > 0 ? "+" : ""}${scoreChange})`,
              priority: "normal",
              listingId: listing.id,
              entityType: "listing",
              entityId: listing.id,
              actionUrl: `/listings/${listing.id}`,
            },
          });
        }
      }
    }

    // Finalize agent run
    await prisma.aIAgentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "success",
        itemsProcessed: listings.length,
        itemsCreated: totalCreated,
        itemsUpdated: totalUpdated,
        apiCallsMade: apiCalls,
        totalTokens,
        totalCost,
        summary: `Scored ${totalScored} listings: ${totalCreated} new, ${totalUpdated} updated`,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Daily scan complete",
      scored: totalScored,
      created: totalCreated,
      updated: totalUpdated,
      cost: `$${totalCost.toFixed(3)}`,
    });
  } catch (error) {
    console.error("Daily scan error:", error);

    // Try to mark the agent run as failed
    try {
      const latestRun = await prisma.aIAgentRun.findFirst({
        where: { agentName: "daily_scan", status: "running" },
        orderBy: { startedAt: "desc" },
      });
      if (latestRun) {
        await prisma.aIAgentRun.update({
          where: { id: latestRun.id },
          data: {
            status: "error",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    return NextResponse.json(
      { error: "Daily scan failed", detail: error instanceof Error ? error.message : undefined },
      { status: 500 },
    );
  }
}
