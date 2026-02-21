import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

async function test() {
  const prisma = new PrismaClient();
  const doc = await prisma.dealDocument.findUnique({
    where: { id: "cmll76pp5000jkx4bc4uy6kpg" },
    select: { fileName: true, fileData: true },
  });

  if (!doc || !doc.fileData) {
    console.log("No doc or no fileData");
    await prisma.$disconnect();
    return;
  }

  console.log("fileData type:", typeof doc.fileData);
  console.log("fileData constructor:", doc.fileData.constructor.name);
  console.log("fileData length:", doc.fileData.length);

  try {
    const buffer = Buffer.from(doc.fileData);
    console.log("Buffer length:", buffer.length);
    console.log("First 4 bytes (hex):", buffer.subarray(0, 4).toString("hex"));
    // xlsx files start with PK (50 4b) — zip signature
    console.log("Looks like zip?", buffer[0] === 0x50 && buffer[1] === 0x4b);

    const workbook = XLSX.read(buffer, { type: "buffer" });
    console.log("Sheet names:", workbook.SheetNames);

    for (const name of workbook.SheetNames) {
      const rows: string[][] = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: "",
        raw: false,
      });
      console.log(`Sheet: "${name}" - rows: ${rows.length}`);
      if (rows.length > 0) {
        console.log("  First row:", rows[0].slice(0, 5));
        // Show total text output length
        const text = rows
          .map((r) => r.map((c) => String(c ?? "").trim()).join(" | "))
          .filter((l) => l.replace(/\s*\|\s*/g, "").length > 0)
          .join("\n");
        console.log(`  Text output length: ${text.length} chars`);
        console.log(`  First 200 chars:\n${text.substring(0, 200)}`);
      }
    }
  } catch (err: any) {
    console.error("XLSX parse error:", err.message);
    console.error("Stack:", err.stack);
  }

  await prisma.$disconnect();
}
test();
