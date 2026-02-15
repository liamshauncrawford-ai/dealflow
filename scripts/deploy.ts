#!/usr/bin/env tsx
/**
 * DealFlow Railway Deployment Trigger
 *
 * Triggers a redeploy of the DealFlow service on Railway via their GraphQL API.
 *
 * Usage:
 *   npx tsx scripts/deploy.ts
 *
 * Environment Variables:
 *   RAILWAY_TOKEN      - Railway API token (from Account Settings > Tokens)
 *   RAILWAY_SERVICE_ID - Railway service ID for DealFlow
 */

async function deploy() {
  const token = process.env.RAILWAY_TOKEN;
  const serviceId = process.env.RAILWAY_SERVICE_ID;

  if (!token) {
    console.error("RAILWAY_TOKEN environment variable is required");
    console.error(
      "Get it from: Railway Dashboard > Account Settings > Tokens"
    );
    process.exit(1);
  }

  if (!serviceId) {
    console.error("RAILWAY_SERVICE_ID environment variable is required");
    console.error(
      "Get it from: Railway Dashboard > Project > Service > Settings"
    );
    process.exit(1);
  }

  console.log("Triggering Railway deployment...");

  const query = `
    mutation {
      serviceInstanceRedeploy(serviceId: "${serviceId}")
    }
  `;

  const response = await fetch("https://backboard.railway.com/graphql/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  const result = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message: string }>;
  };

  if (result.errors) {
    console.error("Deployment failed:");
    for (const err of result.errors) {
      console.error(`  - ${err.message}`);
    }
    process.exit(1);
  }

  console.log("Deployment triggered successfully!");
  console.log(
    "Monitor at: https://dealflow-production-0240.up.railway.app"
  );
  console.log("Railway dashboard: https://railway.app/dashboard");
}

deploy().catch((err) => {
  console.error("Deploy error:", err.message);
  process.exit(1);
});
