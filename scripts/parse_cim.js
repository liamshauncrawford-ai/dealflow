const { PDFParse } = require('pdf-parse');
const fs = require('fs');

async function main() {
  const buf = fs.readFileSync('/tmp/38051_AES_CIM_10.23.25.pdf');
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const parser = new PDFParse(data);

  // Load first
  await parser.load();

  const info = await parser.getInfo();
  console.log('Pages:', info.numPages || info.pages);
  console.log('Info:', JSON.stringify(info).substring(0, 500));

  // Get all text
  const text = await parser.getText();
  console.log('=== FULL TEXT ===');
  console.log(text);
}

main().catch(e => console.error('Error:', e.message, e.stack));
