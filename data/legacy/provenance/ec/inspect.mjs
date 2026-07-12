import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

const path = process.argv[2];
const pageNums = process.argv.slice(3).map(Number);

const data = new Uint8Array(readFileSync(path));
const doc = await getDocument({ data, disableWorker: true }).promise;

for (const pn of pageNums) {
  const page = await doc.getPage(pn);
  const content = await page.getTextContent();
  console.log(`\n=== PAGE ${pn} (${content.items.length} items) ===`);
  for (const item of content.items) {
    const x = item.transform[4].toFixed(1);
    const y = item.transform[5].toFixed(1);
    console.log(`x=${x}\ty=${y}\t"${item.str}"`);
  }
}
