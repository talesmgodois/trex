// =============================================================================
// Primitives
// =============================================================================

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type EnvVars = Record<string, string | number | boolean>;

// =============================================================================
// Auth
// =============================================================================

export interface BearerAuth {
  type: "bearer";
  token: string; // supports {{env.vars}}
}

export interface BasicAuth {
  type: "basic";
  username: string;
  password: string;
}

export interface ApiKeyAuth {
  type: "apikey";
  key: string;
  value: string;   // supports {{env.vars}}
  in: "header" | "query";
}

export type Auth = BearerAuth | BasicAuth | ApiKeyAuth;

// =============================================================================
// Hooks
// Only available in trex.config.ts — YAML supports hook file paths instead.
// =============================================================================

export interface RequestHooks {
  /** Runs before the request is sent. Can mutate the request config. */
  beforeRequest?: (ctx: HookContext) => Promise<void> | void;
  /** Runs after a response is received. Can mutate or inspect the response. */
  afterResponse?: (ctx: HookContext, response: unknown) => Promise<void> | void;
}

export interface HookContext {
  request: RequestConfig;
  env: EnvVars;
  data: Record<string, unknown>;
}

// =============================================================================
// Request
// =============================================================================

export interface RequestConfig {
  url: string;
  method: HttpMethod;
  description?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean>;
  path?: Record<string, string | number>;
  auth?: Auth;
  hooks?: RequestHooks;

  /**
   * YAML only — paths to hook files that export beforeRequest / afterResponse.
   * Ignored if hooks are provided directly (trex.config.ts takes precedence).
   *
   * @example
   *   hookFiles:
   *     beforeRequest: ./hooks/auth.ts
   *     afterResponse: ./hooks/logger.ts
   */
  hookFiles?: {
    beforeRequest?: string;
    afterResponse?: string;
  };
}

/** Map of request name → its config. */
export type RequestMap = Record<string, RequestConfig>;

// =============================================================================
// Environments
// =============================================================================

export interface Environment {
  vars: EnvVars;
  /** Optional auth applied to all requests in this environment. */
  auth?: Auth;
  /** Optional headers applied to all requests in this environment. */
  headers?: Record<string, string>;
}

/** Map of environment name → its definition. */
export type EnvironmentMap = Record<string, Environment>;

// =============================================================================
// Tooling (YAML only — not meaningful in trex.config.ts)
// =============================================================================

export type Bundler = "bun" | "tsx" | "ts-node";

export interface ToolingConfig {
  /** Bundler used to execute trex.config.ts. Defaults to "bun". */
  bundler?: Bundler;
  /** Path to tsconfig.json. Defaults to "./tsconfig.json". */
  tsconfig?: string;
}

// =============================================================================
// TrexConfig — unified shape for both YAML and trex.config.ts
//
// The engine deserializes trex.config.yml into this shape, then merges the
// export from trex.config.ts on top. Fields from .ts always win on conflict.
// Hooks and typed addHttpFunc() functions are only expressible in .ts.
// =============================================================================

export interface TrexConfig {
  // --- Runtime ---

  /** Default environment to activate on startup. */
  defaultEnv?: string;

  /** Log every request to stdout automatically. */
  logAllRequests?: boolean;

  /** Global request timeout in milliseconds. Defaults to 10_000. */
  timeout?: number;

  // --- Environments ---

  environments?: EnvironmentMap;

  // --- Requests ---

  requests?: RequestMap;

  // --- Paths (primarily YAML) ---

  /**
   * Path to trex.config.ts.
   * Resolved relative to the YAML file location.
   * @default "./trex.config.ts"
   */
  configFile?: string;

  /**
   * Path to the history file.
   * @default "~/.trex/history.json"
   */
  historyFile?: string;

  /**
   * Directory where collections are stored.
   * @default "~/.trex/collections"
   */
  collectionsDir?: string;

  // --- Tooling (primarily YAML) ---

  tooling?: ToolingConfig;
}