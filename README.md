# trex

## Install
```bash
bun install
```

## Run
Trex starts a small CLI from `src/index.ts`.

Examples:
```bash
# list registered requests/functions (from config)
bun run ./src/index.ts list

# execute a request by name
bun run ./src/index.ts req getTodo

# run with a jq filter (jq syntax)
bun run ./src/index.ts req getTodo --filter .title
```

## Configuration (`trex.config.ts`)
Trex loads a config file on startup and executes it once.

- Default config location: `src/trex.config.ts`
- Custom config: pass `--config <path>`
  - `bun run ./src/index.ts --config ./samples/trex.config.ts req getTodo`

### What you put in `trex.config.ts`
Your config should register:

1. Environments
```ts
import { env, regEnv } from "../src/trex.lib.ts";

regEnv("public", { JSON_BASE_URL: "https://jsonplaceholder.typicode.com" });
env("public"); // selects the active env
```

2. HTTP requests (public APIs, etc.)
Use `addHttpFunc()` (recommended for testing):
```ts
import { addHttpFunc } from "../src/trex.lib.ts";

addHttpFunc("getTodo", {
  method: "GET",
  url: "{{JSON_BASE_URL}}/todos/1",
});
```

3. Pure TS/JS functions (optional)
```ts
import { addFunction } from "../src/trex.lib.ts";

export const sum = addFunction("sum", ({ a, b }: { a: number; b: number }) => a + b);
```

### Templates
The engine supports:

- `{{VAR_NAME}}` -> replaced from the active environment vars
- `[[requestName.path]]` -> replaced from the data saved by a previous request (after `req <requestName>`)

## Samples
This repo includes `samples/trex.config.ts`, which hits JSONPlaceholder (public test API).

Run it:
```bash
bun run ./src/index.ts --config ./samples/trex.config.ts list
bun run ./src/index.ts --config ./samples/trex.config.ts req getTodo
bun run ./src/index.ts --config ./samples/trex.config.ts req getTodosForUser1
bun run ./src/index.ts --config ./samples/trex.config.ts req createPostSample
```

Tip: try `--filter` too:
```bash
bun run ./src/index.ts --config ./samples/trex.config.ts req getTodo --filter .title
```
