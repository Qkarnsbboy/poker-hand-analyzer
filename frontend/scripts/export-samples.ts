// Writes the sample hands to backend/sample_hands.json, so the backend can add them
// for new users. Run after changing src/data/sample-hands.ts:
//   npx vite-node scripts/export-samples.ts
import { writeFileSync } from "node:fs";
import { SAMPLE_HANDS } from "../src/data/sample-hands";

const out = new URL("../../backend/sample_hands.json", import.meta.url);
writeFileSync(out, JSON.stringify(SAMPLE_HANDS, null, 2) + "\n");
console.log(`Wrote ${SAMPLE_HANDS.length} sample hands to backend/sample_hands.json`);
