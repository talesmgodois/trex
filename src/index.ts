import * as path from "node:path";
import { pathToFileURL } from "node:url";


import { cli } from "./lib/trex.lib";
export * from "./lib/trex.lib";

const args = process.argv.slice(2);

// Optional: load an alternate config file (useful for `samples/`).
// Example: bun run ./src/index.ts --config ./samples/trex.config.ts req getTodo
const configFlag = "--config";
const configIdx = args.indexOf(configFlag);
const configPath = configIdx !== -1 ? args[configIdx + 1] : undefined;
if (configIdx !== -1) args.splice(configIdx, 2);

if (configPath) {
  const resolved = path.resolve(process.cwd(), configPath);
  await import(pathToFileURL(resolved).href);
} else {
  await import("./trex.config");
}

cli(args);

