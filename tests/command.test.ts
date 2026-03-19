import { describe, it, expect, mock } from "bun:test";
import { Command } from "../src/lib/command/command";
import type { Flag } from "../src/lib/types/command";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = async () => {};

const baseConfig = (overrides = {}) => ({
  name: "get",
  description: "Send a GET request",
  handlerCli: noop,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Command.build
// ---------------------------------------------------------------------------

describe("Command.build", () => {
  it("creates a command with required fields", () => {
    const cmd = Command.build(baseConfig());
    expect(cmd.name).toBe("get");
    expect(cmd.description).toBe("Send a GET request");
    expect(cmd.aliases).toEqual([]);
    expect(cmd.flags).toEqual({});
    expect(cmd.commands).toEqual({});
  });

  it("throws when name is empty", () => {
    expect(() => Command.build(baseConfig({ name: "" }))).toThrow();
  });

  it("throws when description is empty", () => {
    expect(() => Command.build(baseConfig({ description: "" }))).toThrow();
  });

  it("throws when no handler and no subcommands", () => {
    expect(() =>
      Command.build({ name: "get", description: "desc" })
    ).toThrow(/must provide handlerCli, handlerTui, or at least one subcommand/);
  });

  it("accepts a command with only handlerTui", () => {
    const cmd = Command.build({ name: "get", description: "desc", handlerTui: noop });
    expect(cmd.hasTuiHandler).toBe(true);
    expect(cmd.hasCliHandler).toBe(false);
  });

  it("accepts a command with subcommands and no handler", () => {
    const cmd = Command.build({
      name: "root",
      description: "Root",
      commands: {
        sub: { name: "sub", description: "Sub", handlerCli: noop },
      },
    });
    expect(Object.keys(cmd.commands)).toHaveLength(1);
  });

  it("throws on duplicate flag alias", () => {
    expect(() =>
      Command.build(baseConfig({
        flags: {
          header: { description: "Header", type: "string", aliases: ["h"] },
          host:   { description: "Host",   type: "string", aliases: ["h"] },
        },
      }))
    ).toThrow(/duplicate alias/);
  });

  it("throws when subcommand name collides with flag name", () => {
    expect(() =>
      Command.build(baseConfig({
        flags: {
          output: { description: "Output", type: "string" },
        },
        commands: {
          output: { name: "output", description: "Output cmd", handlerCli: noop },
        },
      }))
    ).toThrow(/conflicts with a flag/);
  });
});

// ---------------------------------------------------------------------------
// Execution — handlerCli / handlerTui / run
// ---------------------------------------------------------------------------

describe("Command#handlerCli", () => {
  it("calls the cli handler with args", async () => {
    const handler = mock(noop);
    const cmd = Command.build({ name: "get", description: "desc", handlerCli: handler });
    await cmd.handlerCli({ verbose: true });
    expect(handler).toHaveBeenCalledWith({ verbose: true });
  });

  it("throws when no handlerCli was provided", async () => {
    const cmd = Command.build({ name: "get", description: "desc", handlerTui: noop });
    await expect(cmd.handlerCli({})).rejects.toThrow(/does not have a handlerCli/);
  });
});

describe("Command#handlerTui", () => {
  it("calls the tui handler with args", async () => {
    const handler = mock(noop);
    const cmd = Command.build({ name: "get", description: "desc", handlerTui: handler });
    await cmd.handlerTui({ format: "json" });
    expect(handler).toHaveBeenCalledWith({ format: "json" });
  });

  it("throws when no handlerTui was provided", async () => {
    const cmd = Command.build({ name: "get", description: "desc", handlerCli: noop });
    await expect(cmd.handlerTui({})).rejects.toThrow(/does not have a handlerTui/);
  });
});

describe("Command#run", () => {
  it("dispatches to handlerCli when --tui is absent", async () => {
    const cli = mock(noop);
    const tui = mock(noop);
    const cmd = Command.build({ name: "get", description: "desc", handlerCli: cli, handlerTui: tui });
    await cmd.run({ verbose: true });
    expect(cli).toHaveBeenCalledTimes(1);
    expect(tui).toHaveBeenCalledTimes(0);
  });

  it("dispatches to handlerTui when args.tui === true", async () => {
    const cli = mock(noop);
    const tui = mock(noop);
    const cmd = Command.build({ name: "get", description: "desc", handlerCli: cli, handlerTui: tui });
    await cmd.run({ tui: true });
    expect(tui).toHaveBeenCalledTimes(1);
    expect(cli).toHaveBeenCalledTimes(0);
  });

  it("throws when mode is tui but no handlerTui exists", async () => {
    const cmd = Command.build({ name: "get", description: "desc", handlerCli: noop });
    await expect(cmd.run({ tui: true })).rejects.toThrow(/does not have a handlerTui/);
  });

  it("throws when mode is cli but no handlerCli exists", async () => {
    const cmd = Command.build({ name: "get", description: "desc", handlerTui: noop });
    await expect(cmd.run({})).rejects.toThrow(/does not have a handlerCli/);
  });
});

// ---------------------------------------------------------------------------
// Command.create — DSL
// ---------------------------------------------------------------------------

describe("Command.create — flag() vs addFlag()", () => {
  const verboseFlag: Flag = {
    name: "verbose",
    type: "boolean",
    description: "Verbose output",
    aliases: ["v"],
  };

  it("flag() accepts a Flag instance with name", () => {
    const cmd = Command.create()
      .name("get").description("desc")
      .flag(verboseFlag)
      .handlerCli(noop)
      .build();

    expect(cmd.flags).toHaveProperty("verbose");
    expect(cmd.flags["verbose"]?.aliases).toContain("v");
  });

  it("addFlag() accepts name + definition separately", () => {
    const cmd = Command.create()
      .name("get").description("desc")
      .addFlag("timeout", { type: "number", description: "Timeout", default: 5000 })
      .handlerCli(noop)
      .build();

    expect(cmd.flags).toHaveProperty("timeout");
    expect(cmd.flags["timeout"]?.default).toBe(5000);
  });

  it("flag() and addFlag() can be mixed freely", () => {
    const cmd = Command.create()
      .name("get").description("desc")
      .flag(verboseFlag)
      .addFlag("timeout", { type: "number", description: "Timeout" })
      .addFlag("output",  { type: "string", description: "Output format" })
      .handlerCli(noop)
      .build();

    expect(Object.keys(cmd.flags)).toHaveLength(3);
  });
});

describe("Command.create — cmd() vs addCmd()", () => {
  it("cmd() accepts a pre-built Command instance", () => {
    const headers = Command.create()
      .name("headers").description("Manage headers")
      .handlerCli(noop).build();

    const cmd = Command.create()
      .name("request").description("HTTP requests")
      .cmd(headers).build();

    expect(cmd.commands.headers).toBeInstanceOf(Command);
  });

  it("addCmd() accepts name + config literal", () => {
    const cmd = Command.create()
      .name("request").description("HTTP requests")
      .addCmd("body", { name: "body", description: "Set body", handlerCli: noop })
      .build();

    expect(cmd.commands.body).toBeInstanceOf(Command);
    expect(cmd.commands["body"]?.name).toBe("body");
  });

  it("cmd() and addCmd() can be mixed freely", () => {
    const headers = Command.create()
      .name("headers").description("Manage headers")
      .handlerCli(noop).build();

    const cmd = Command.create()
      .name("request").description("HTTP requests")
      .cmd(headers)
      .addCmd("body", { name: "body", description: "Set body", handlerCli: noop })
      .addCmd("auth", { name: "auth", description: "Set auth", handlerCli: noop })
      .build();

    expect(Object.keys(cmd.commands)).toHaveLength(3);
  });
});

describe("Command.create — handlerCli / handlerTui", () => {
  it("sets both handlers", () => {
    const cmd = Command.create()
      .name("get").description("desc")
      .handlerCli(noop)
      .handlerTui(noop)
      .build();

    expect(cmd.hasCliHandler).toBe(true);
    expect(cmd.hasTuiHandler).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

describe("Command#findFlag", () => {
  const cmd = Command.build(baseConfig({
    flags: {
      verbose: { description: "Verbose", type: "boolean", aliases: ["v"] },
    },
  }));

  it("finds by --long form",     () => expect(cmd.findFlag("--verbose")?.[0]).toBe("verbose"));
  it("finds by -alias",          () => expect(cmd.findFlag("-v")?.[0]).toBe("verbose"));
  it("returns undefined unknown",() => expect(cmd.findFlag("--unknown")).toBeUndefined());
});

describe("Command#findCommand", () => {
  const cmd = Command.build({
    name: "request", description: "HTTP requests",
    commands: {
      headers: { name: "headers", description: "Headers", aliases: ["h"], handlerCli: noop },
    },
  });

  it("finds by name",            () => expect(cmd.findCommand("headers")).toBeInstanceOf(Command));
  it("finds by alias",           () => expect(cmd.findCommand("h")?.name).toBe("headers"));
  it("returns undefined unknown",() => expect(cmd.findCommand("unknown")).toBeUndefined());
});

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

describe("Command#toJSON", () => {
  it("excludes handlers but preserves all other fields", () => {
    const cmd = Command.build({
      name: "get", description: "Send a GET request",
      aliases: ["g"],
      handlerCli: noop,
      handlerTui: noop,
      flags: { verbose: { description: "Verbose", type: "boolean" as const } },
      commands: { send: { name: "send", description: "Execute", handlerCli: noop } },
    });
    const json = cmd.toJSON();
    expect(json).not.toHaveProperty("handlerCli");
    expect(json).not.toHaveProperty("handlerTui");
    expect(json.name).toBe("get");
    expect(json.flags).toHaveProperty("verbose");
    expect(json.commands).toHaveProperty("send");
  });
});