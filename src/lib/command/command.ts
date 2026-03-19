import type {
  Flag,
  FlagDefinition,
  FlagMap,
  ParsedArgs,
  RunMode,
  CliHandler,
  TuiHandler,
  CommandConfig,
} from "../types/command";

export type CommandInstanceMap = Record<string, Command>;

export class Command {
  readonly name: string;
  readonly description: string;
  readonly aliases: string[];
  readonly flags: FlagMap;
  readonly commands: CommandInstanceMap;

  readonly #handlerCli: CliHandler | undefined;
  readonly #handlerTui: TuiHandler | undefined;

  private constructor(
    config: CommandConfig,
    commands: CommandInstanceMap = {}
  ) {
    this.name         = config.name;
    this.description  = config.description;
    this.aliases      = config.aliases ?? [];
    this.flags        = config.flags   ?? {};
    this.#handlerCli  = config.handlerCli;
    this.#handlerTui  = config.handlerTui;

    this.commands = Object.keys(commands).length > 0
      ? commands
      : Object.fromEntries(
          Object.entries(config.commands ?? {}).map(([key, sub]) => [
            key,
            Command.build(sub),
          ])
        );
  }

  // -------------------------------------------------------------------------
  // Factory — config literal
  // -------------------------------------------------------------------------

  static build(config: CommandConfig): Command {
    Command.validate(config);
    return new Command(config);
  }

  // -------------------------------------------------------------------------
  // Factory — fluent DSL
  // -------------------------------------------------------------------------

  /**
   * Returns a fresh CommandBuilder to construct a Command fluently.
   *
   * @example
   * const cmd = Command.create()
   *   .name("get")
   *   .description("Send a GET request")
   *   .alias("g")
   *   .flag({ name: "verbose", type: "boolean", description: "Verbose output", aliases: ["v"] })
   *   .addFlag("timeout", { type: "number", description: "Timeout in ms", default: 5000 })
   *   .handlerCli(async (args) => { ... })
   *   .handlerTui(async (args) => { ... })
   *   .cmd(subCmd)
   *   .addCmd("inline", { description: "Inline subcommand", handlerCli: async () => {} })
   *   .build()
   */
  static create(): import("./command-builder.ts").CommandBuilder {
    const { CommandBuilder } = require("./command-builder");
    return new CommandBuilder();
  }

  /** @internal — used by CommandBuilder to inject pre-built subcommands. */
  static _fromBuilder(
    config: CommandConfig,
    commands: CommandInstanceMap
  ): Command {
    Command.validate(config, commands);
    return new Command(config, commands);
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  /**
   * Executes the CLI handler directly.
   * Throws if no handlerCli was provided.
   */
  async handlerCli(args: ParsedArgs): Promise<void> {
    if (!this.#handlerCli) {
      throw new Error(`Command "${this.name}" does not have a handlerCli.`);
    }
    await this.#handlerCli(args);
  }

  /**
   * Executes the TUI handler directly.
   * Throws if no handlerTui was provided.
   */
  async handlerTui(args: ParsedArgs): Promise<void> {
    if (!this.#handlerTui) {
      throw new Error(`Command "${this.name}" does not have a handlerTui.`);
    }
    await this.#handlerTui(args);
  }

  /**
   * Resolves the execution mode from args and dispatches to the
   * appropriate handler.
   *
   * Mode is determined by the presence of --tui in the parsed args:
   *   args.tui === true  → TUI mode
   *   otherwise          → CLI mode
   *
   * Throws if the resolved mode has no handler.
   */
  async run(args: ParsedArgs): Promise<void> {
    const mode: RunMode = args.tui === true ? "tui" : "cli";

    if (mode === "tui") {
      await this.handlerTui(args);
    } else {
      await this.handlerCli(args);
    }
  }

  get hasCliHandler(): boolean { return this.#handlerCli !== undefined; }
  get hasTuiHandler(): boolean { return this.#handlerTui !== undefined; }

  // -------------------------------------------------------------------------
  // Lookup
  // -------------------------------------------------------------------------

  /**
   * Returns the [flagName, FlagDefinition] pair that matches a raw arg token.
   * Accepts both long form (--name) and short aliases (-n).
   */
  findFlag(token: string): [string, FlagDefinition] | undefined {
    const key = token.replace(/^-{1,2}/, "");
    if (key in this.flags) return [key, this.flags[key]!];
    for (const [name, def] of Object.entries(this.flags)) {
      if ((def.aliases ?? []).includes(key)) return [name, def];
    }
    return undefined;
  }

  /**
   * Returns the subcommand instance that matches a given token,
   * considering both names and aliases.
   */
  findCommand(token: string): Command | undefined {
    if (token in this.commands) return this.commands[token];
    for (const sub of Object.values(this.commands)) {
      if (sub.aliases.includes(token)) return sub;
    }
    return undefined;
  }

  matches(token: string): boolean {
    return this.name === token || this.aliases.includes(token);
  }

  // -------------------------------------------------------------------------
  // Help
  // -------------------------------------------------------------------------

  help(): string {
    const lines: string[] = [`${this.name} — ${this.description}`];

    if (this.aliases.length > 0) {
      lines.push(`Aliases: ${this.aliases.join(", ")}`);
    }

    const modes: string[] = [];
    if (this.hasCliHandler) modes.push("cli");
    if (this.hasTuiHandler) modes.push("tui");
    if (modes.length > 0) lines.push(`Modes: ${modes.join(", ")}`);

    const flagEntries = Object.entries(this.flags);
    if (flagEntries.length > 0) {
      lines.push("", "Flags:");
      for (const [name, def] of flagEntries) {
        const alias  = def.aliases?.length ? `, -${def.aliases.join(", -")}` : "";
        const defVal = def.default !== undefined ? ` (default: ${def.default})` : "";
        const req    = def.required ? " [required]" : "";
        lines.push(`  --${name}${alias}  <${def.type}>  ${def.description}${defVal}${req}`);
      }
    }

    const subEntries = Object.entries(this.commands);
    if (subEntries.length > 0) {
      lines.push("", "Subcommands:");
      for (const [name, sub] of subEntries) {
        const alias = sub.aliases.length > 0 ? `  (${sub.aliases.join(", ")})` : "";
        lines.push(`  ${name}${alias}  ${sub.description}`);
      }
    }

    return lines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------------------------

  toJSON(): Omit<CommandConfig, "handlerCli" | "handlerTui"> {
    return {
      name:        this.name,
      description: this.description,
      aliases:     this.aliases,
      flags:       this.flags,
      commands:    Object.fromEntries(
        Object.entries(this.commands).map(([key, sub]) => [key, sub.toJSON()])
      ),
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private static validate(
    config: CommandConfig,
    commands: CommandInstanceMap = {}
  ): void {
    if (!config.name || config.name.trim() === "") {
      throw new Error("Command: 'name' is required and cannot be empty.");
    }

    if (!config.description || config.description.trim() === "") {
      throw new Error("Command: 'description' is required and cannot be empty.");
    }

    const hasSubcommands =
      Object.keys(commands).length > 0 ||
      Object.keys(config.commands ?? {}).length > 0;

    if (!hasSubcommands && !config.handlerCli && !config.handlerTui) {
      throw new Error(
        `Command "${config.name}" must provide handlerCli, handlerTui, or at least one subcommand.`
      );
    }

    // Alias collisions across flags
    const allAliases = new Set<string>();
    for (const [name, def] of Object.entries(config.flags ?? {})) {
      for (const alias of def.aliases ?? []) {
        if (allAliases.has(alias)) {
          throw new Error(
            `Command "${config.name}": duplicate alias "${alias}" in flags.`
          );
        }
        allAliases.add(alias);
      }
      if (allAliases.has(name)) {
        throw new Error(
          `Command "${config.name}": alias "${name}" conflicts with a flag name.`
        );
      }
    }

    // Subcommand name must not collide with a flag name
    const flagNames = new Set(Object.keys(config.flags ?? {}));
    const subNames  = [
      ...Object.keys(commands),
      ...Object.keys(config.commands ?? {}),
    ];
    for (const subName of subNames) {
      if (flagNames.has(subName)) {
        throw new Error(
          `Command "${config.name}": subcommand "${subName}" conflicts with a flag name.`
        );
      }
    }
  }
}