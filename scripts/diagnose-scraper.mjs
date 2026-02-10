import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

// Manual .env loading
const envPath = resolve(process.cwd(), ".env");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const val = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const prisma = new PrismaClient();

function decrypt(encryptedData) {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("No ENCRYPTION_KEY");
  const keyBuffer = Buffer.from(key, "hex");

  const parts = encryptedData.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted data format");

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = Buffer.from(parts[2], "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function main() {
  const record = await prisma.platformCookie.findUnique({
    where: { platform: "BIZBUYSELL" },
  });
  if (!record) {
    console.log("No cookies");
    process.exit(0);
  }

  let cookies;
  try {
    const decrypted = decrypt(record.cookieData);
    cookies = JSON.parse(decrypted);
    console.log("Loaded", cookies.length, "cookies");
    console.log(
      "Domains:",
      [...new Set(cookies.map((c) => c.domain))].join(", ")
    );
  } catch (e) {
    console.error("Decrypt failed:", e.message);
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-position=-2000,-2000",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "America/Denver",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
      "sec-ch-ua":
        '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    },
  });

  // Stealth
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    if (!window.chrome) {
      window.chrome = {
        runtime: {},
        loadTimes: () => ({}),
        csi: () => ({}),
        app: {},
      };
    }
    Object.defineProperty(navigator, "plugins", {
      get: () => {
        const p = [
          { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
          { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
          { name: "Native Client", filename: "internal-nacl-plugin" },
        ];
        p.refresh = () => {};
        return p;
      },
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
  });

  // Load cookies
  const validCookies = cookies
    .filter((c) => c.name && c.value && c.domain)
    .map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
    }));

  try {
    await context.addCookies(validCookies);
    console.log("Added", validCookies.length, "cookies to browser\n");
  } catch (e) {
    console.error("Cookie add failed:", e.message);
  }

  const page = await context.newPage();
  const response = await page.goto(
    "https://www.bizbuysell.com/colorado-businesses-for-sale/",
    { waitUntil: "domcontentloaded", timeout: 30000 }
  );

  await page.waitForTimeout(4000);

  // Mouse move + scroll
  await page.mouse.move(500, 400);
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: "smooth" }));
  await page.waitForTimeout(2000);

  const status = response.status();
  const title = await page.title();
  const url = page.url();
  const bodyText = await page.evaluate(
    () => document.body?.innerText?.substring(0, 1500) || ""
  );

  console.log("HTTP Status:", status);
  console.log("Title:", title);
  console.log("Final URL:", url);
  console.log("\nBody text (first 800 chars):");
  console.log(bodyText.substring(0, 800));

  if (status === 200) {
    const counts = await page.evaluate(() => ({
      totalLinks: document.querySelectorAll("a").length,
      bizLinks: document.querySelectorAll('a[href*="/businesses-for-sale/"]').length,
      h2: document.querySelectorAll("h2").length,
      h3: document.querySelectorAll("h3").length,
      // Try common BizBuySell class patterns
      listing: document.querySelectorAll(".listing").length,
      businessCard: document.querySelectorAll(".businessCard").length,
      searchResult: document.querySelectorAll(".search-result").length,
      bfsListing: document.querySelectorAll(".bfsListing").length,
      article: document.querySelectorAll("article").length,
      card: document.querySelectorAll(".card").length,
      resultAny: document.querySelectorAll('[class*="result"]').length,
      listingAny: document.querySelectorAll('[class*="listing"]').length,
      // Get first 30 unique class names
      topClasses: [
        ...new Set(
          Array.from(document.querySelectorAll("[class]"))
            .flatMap((el) => el.className.split(" ").filter((c) => c.length > 3))
        ),
      ].slice(0, 40),
    }));

    console.log("\nElement counts:", JSON.stringify(counts, null, 2));
  }

  // Take screenshot for debugging
  await page.screenshot({ path: "/tmp/bizbuysell-debug.png", fullPage: false });
  console.log("\nScreenshot saved to /tmp/bizbuysell-debug.png");

  await browser.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
