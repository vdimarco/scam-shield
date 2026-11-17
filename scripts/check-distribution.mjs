import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { loadEnv } from "vite";

const mode = process.argv[2] || "judge";
const tokens = [loadEnv(mode, process.cwd(), "").VITE_APPCHECK_DEBUG_TOKEN, process.env.VITE_APPCHECK_DEBUG_TOKEN].filter(Boolean);
const debugTokenShape = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await check(path);
    } else {
      const output = await readFile(path);
      if (debugTokenShape.test(output.toString("utf8")) || tokens.some(token => output.includes(Buffer.from(token)))) {
        throw new Error(`A possible App Check debug token was found in ${path}. Do not distribute this build.`);
      }
    }
  }
}

await check("dist");
console.log("Distribution check passed: no App Check debug token literal found in dist.");
