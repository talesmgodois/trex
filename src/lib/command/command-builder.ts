import type {
  Flag,
  FlagDefinition,
  FlagMap,
  CliHandler,
  TuiHandler,
  CommandConfig,
} from "../types/command";
import { Command } from "./command";

/**
 * Fluent builder for Command instances.
 * Obtained via Command.create() — never instantiated directly.
 *
 * Two ways to add flags:
 *   .flag(instance)          — accepts a Flag object with name included
 *   .addFlag(name, definition) — accepts name + FlagDefinition separately
 *
 * Two ways to add subcommands:
 *   .cmd(instance)           — accepts a fully built Command
 *   .addCmd(name, config)    — accepts name + CommandConfig (built internally)
 *
 * @example
 * const verboseFlag: Flag = { name: "verbose", type: "boolean", description: "Verbose output", aliases: ["v"] }
 *
 * const sub = Command.create()
 *   .name("headers")
 *   .description("Manage request headers")
 *   .handlerCli(async (args) => { ... })
 *   .build()
 *
 * const cmd = Command.create()
 *   .name("request")
 *   .description("Send HTTP requests")
 *   .alias("req")
 *   .flag(verboseFlag)
 *   .addFlag("timeout", { type: "number", description: "Timeout in ms", default: 5000 })
 *   .handlerCli(async (args) => { ... })
 *   .handlerTui(async (args) => { ... })
 *   .cmd(sub)
 *   .addCmd("body", { name: "body", description: "Set body", handlerCli: async () => {} })
 *   .build()
 */
export class CommandBuilder {
  #name: string = "";
  #description: string = "";
  #aliases: string[] = [];
  #flags: FlagMap = {};
  #commands: Record<string, Command> = {};
  #handlerCli: CliHandler | undefined;
  #handlerTui: TuiHandler | undefined;

  /** @internal — use Command.create() instead. */
  constructor() {}

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  name(value: string): this {
    this.#name = value;
    return this;
  }

  description(value: string): this {
    this.#description = value;
    return this;
  }

  /**
   * Adds a single alias. Chainable for multiple aliases.
   * @example .alias("req").alias("r")
   */
  alias(value: string): this {
    this.#aliases.push(value);
    return this;
  }

  // -------------------------------------------------------------------------
  // Flags
  // -------------------------------------------------------------------------

  /**
   * Adds a flag from a self-contained Flag instance (name included).
   * @example .flag({ name: "verbose", type: "boolean", description: "Verbose output" })
   */
  flag(instance: Flag): this {
    const { name, ...definition } = instance;
    this.#flags[name] = definition;
    return this;
  }

  /**
   * Adds a flag by explicit name + definition.
   * @example .addFlag("verbose", { type: "boolean", description: "Verbose output", aliases: ["v"] })
   */
  addFlag(name: string, definition: FlagDefinition): this {
    this.#flags[name] = definition;
    return this;
  }

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  /** Sets the CLI execution handler. */
  handlerCli(handler: CliHandler): this {
    this.#handlerCli = handler;
    return this;
  }

  /** Sets the TUI execution handler. */
  handlerTui(handler: TuiHandler): this {
    this.#handlerTui = handler;
    return this;
  }

  // -------------------------------------------------------------------------
  // Subcommands
  // -------------------------------------------------------------------------

  /**
   * Adds a pre-built Command instance as a subcommand.
   * @example .cmd(headersCmd).cmd(bodyCmd)
   */
  cmd(command: Command): this {
    this.#commands[command.name] = command;
    return this;
  }

  /**
   * Builds and adds a subcommand from a config literal.
   * @example .addCmd("body", { name: "body", description: "Set body", handlerCli: async () => {} })
   */
  addCmd(name: string, config: CommandConfig): this {
    this.#commands[name] = Command.build({ ...config, name });
    return this;
  }

  // -------------------------------------------------------------------------
  // Terminal
  // -------------------------------------------------------------------------

  /**
   * Validates the accumulated state and returns a Command instance.
   */
  build(): Command {
    return Command._fromBuilder(
      {
        name:        this.#name,
        description: this.#description,
        aliases:     this.#aliases,
        flags:       this.#flags,
        handlerCli:  this.#handlerCli,
        handlerTui:  this.#handlerTui,
      },
      this.#commands
    );
  }
}