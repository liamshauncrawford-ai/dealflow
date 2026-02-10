import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = browser.contexts()[0] || await browser.newContext();
const page = await ctx.newPage();

await page.goto("https://www.bizbuysell.com/colorado-businesses-for-sale/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(5000);

// Get listing-related elements
const listingInfo = await page.evaluate(() => {
  const els = document.querySelectorAll('[class*="listing"]');
  return Array.from(els).slice(0, 15).map(el => ({
    tag: el.tagName,
    cls: el.className.substring(0, 100),
    text: (el.innerText || "").substring(0, 80),
    kids: el.children.length,
    hasLink: !!el.querySelector("a"),
  }));
});
console.log("Listing-class elements:");
listingInfo.forEach((el, i) => console.log(`  ${i}: <${el.tag}> .${el.cls} | hasLink=${el.hasLink} | "${el.text.substring(0, 50)}"`));

// Get first real listing card HTML
const cardHTML = await page.evaluate(() => {
  const cards = document.querySelectorAll('[class*="listing"]');
  for (const card of cards) {
    if (card.querySelector("a") && (card.innerText || "").length > 50) {
      return card.outerHTML.substring(0, 4000);
    }
  }
  return "No listing card found";
});
console.log("\n--- CARD HTML (first match) ---");
console.log(cardHTML.substring(0, 2500));

// Count links with /detail/
const detailLinks = await page.evaluate(() => {
  return Array.from(document.querySelectorAll("a"))
    .filter(a => a.href.includes("/detail/") || a.href.includes("ClosingCorp"))
    .slice(0, 5)
    .map(a => ({ href: a.href, text: (a.innerText || "").substring(0, 60) }));
});
console.log("\nDetail links:", JSON.stringify(detailLinks, null, 2));

// Get all link patterns
const linkPatterns = await page.evaluate(() => {
  const patterns = {};
  Array.from(document.querySelectorAll("a[href]")).forEach(a => {
    try {
      const url = new URL(a.href);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const pattern = pathParts.slice(0, 2).join("/");
      if (!patterns[pattern]) patterns[pattern] = 0;
      patterns[pattern]++;
    } catch {}
  });
  return Object.entries(patterns).sort((a, b) => b[1] - a[1]).slice(0, 15);
});
console.log("\nLink patterns:", JSON.stringify(linkPatterns));

await page.close();
