// Sample config for local testing against a public API.
//
// Run:
//   bun run ./src/index.ts --config ./samples/trex.config.ts req getTodo

import { addFunction, addHttpFunc, env, regEnv, trex } from "../src/trex.lib.ts";

// Register a dedicated environment for this sample config.
regEnv("public", {
  JSON_BASE_URL: "https://jsonplaceholder.typicode.com",
});
env("public");

// --- Public API requests (JSONPlaceholder) ---

export const getTodo = addHttpFunc("getTodo", {
  method: "GET",
  url: "{{JSON_BASE_URL}}/todos/1",
  description: "Fetch todo #1",
});

export const getTodosForUser1 = addHttpFunc("getTodosForUser1", {
  method: "GET",
  url: "{{JSON_BASE_URL}}/todos",
  query: { userId: 1 },
  description: "Fetch todos for userId=1",
});

export const createPostSample = addHttpFunc("createPostSample", {
  method: "POST",
  url: "{{JSON_BASE_URL}}/posts",
  body: {
    title: "trex sample",
    body: "created from trex.config.ts in samples/",
    userId: 1,
  },
  description: "Create a post (JSONPlaceholder)",
});

// --- Pure TS helper to verify REPL/function wiring ---

export const sumParams = addFunction("sumParams", (params: { a: number; b: number }) => {
  return params.a + params.b;
});


export const sum = addFunction("sum", (a: number, b: number) => {
  return a + b;
});


export const hello = addFunction("hello", (name: string) => {
  return `Hello ${name}`;
});


export const testReq = addFunction("testReq", async () => {
  const result = await Promise.all([getTodo(), getTodosForUser1()]);
  trex.log(JSON.stringify(result, null, 2));
});