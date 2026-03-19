export type FlagType = "string" | "boolean" | "number";

/**
 * Flag definition without its name.
 * Used as the value type in FlagMap and as the second param of addFlag().
 */
export interface FlagDefinition {
  description: string;
  type: FlagType;
  default?: string | boolean | number;
  aliases?: string[];
  required?: boolean;
}

/**
 * A fully self-contained flag — carries its own name.
 * Used as the argument to the builder's flag() method.
 */
export interface Flag extends FlagDefinition {
  name: string;
}

/** Map of flag name → its definition (name is the key, not repeated inside). */
export type FlagMap = Record<string, FlagDefinition>;

/**
 * Map of subcommand name → its config.
 * Recursive: each entry is itself a full CommandConfig.
 */
export type CommandMap = Record<string, CommandConfig>;

/**
 * Resolved flag values after arg parsing — what handlers receive at runtime.
 * Keys are flag names; values are the parsed and coerced primitives.
 * The special key "tui" is reserved for mode detection.
 */
export type ParsedArgs = Record<string, string | boolean | number>;

/** Handler signature for CLI mode. */
export type CliHandler = (args: ParsedArgs) => Promise<void>;

/** Handler signature for TUI mode. */
export type TuiHandler = (args: ParsedArgs) => Promise<void>;

/** Execution mode, derived from the presence of --tui in ParsedArgs. */
export type RunMode = "cli" | "tui";

export interface CommandConfig {
  name: string;
  description: string;
  aliases?: string[];
  flags?: FlagMap;
  commands?: CommandMap;
  handlerCli?: CliHandler;
  handlerTui?: TuiHandler;
  examples?: never; // reserved for future use
  hidden?: never;   // reserved for future use
}