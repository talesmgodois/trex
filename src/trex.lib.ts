// trex.lib.ts
import readline from "node:readline";
import jq from 'node-jq';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';


// Define a more specific CallParams using Generics
interface TypedCallParams<TBody, TPath, TQuery> {
    body?: TBody;
    path?: TPath;
    query?: TQuery;
}

interface RequestConfig {
    name: string;
    url: string;
    method: HttpMethod;
    headers?: Record<string, string>;
    body?: any;
    query?: any;
    path?: any;
    description?: string;
}

type CallParams = Partial<Omit<RequestConfig, "name" | "description">>;

interface FunctionConfig {
    name: string;
    description: string;
}

type ReqDefinition = Omit<RequestConfig, "name">;


export type TrexConfig = {
    requests: Map<string, RequestConfig>;
    functions: Map<string, FunctionConfig>;
    data: Record<string, any>;
    currentEnv: string;
    environments: Record<string, any>;
    isReplMode: boolean;
    logAllRequests: false,
}

class TrexEngine {
    private requests: Map<string, RequestConfig> = new Map();
    private functions: Map<string, FunctionConfig> = new Map();
    private environments: Record<string, any> = {};
    private currentEnv: string = "";
    private displayHistory: string[] = [];
    private isReplMode: boolean = false;
    private logAllRequests: boolean = false;
    private isInteractiveMode: boolean = false;
    private data: Record<string, any> = {};

    // Histórico de comandos executados
    private commandHistory: string[] = [];

    // Contexto para o REPL (onde as funções registradas viverão)
    private replContext: Record<string, any> = {
        clear: () => this.displayHistory = [],
    }


    constructor(params?: TrexConfig) {
        if (params) {
            this.requests = params?.requests;
            this.currentEnv = params?.currentEnv;
            this.environments = params?.environments;
            this.isReplMode = params?.isReplMode ?? false;
        }

        this.replContext['jq'] = async (filter: string, data: any) => await this.applyJq(data, filter);
    }


    static build(config: TrexConfig) {
        const engine = new TrexEngine(config);
        return engine;
    }

    // --- REGISTROS ---

    regEnv(name: string, vars: Record<string, any>) {
        this.environments[name] = vars;
        if (!this.currentEnv) this.currentEnv = name;
    }

    env(name?: string) {
        if (name && this.environments[name]) {
            this.currentEnv = name;
            this.log(`🌍 Ambiente alterado para: \x1b[36m${name}\x1b[0m`);
        } else {
            this.log(`🌍 Current env: ${this.currentEnv}`);
            this.log(`---------------------------------`);
            Object.entries(this.environments).forEach(([env, data]) => {
                this.log(`${env}: ${JSON.stringify(data, null, 2)}`);
            })
        }
    }

    getEnv() {
        return this.currentEnv;
    }

    getEnvData() {
        return this.environments[this.getEnv()];
    }

    getData() {
        return this.data;
    }

    /** addReq: Simple static request for Command Mode */
    addReq(name: string, config: ReqDefinition) {
        this.requests.set(name, { ...config, name });
        // Also make it available in REPL for convenience
        this.replContext[name] = () => this.executeRequest(name);
    }

    /**
     * Registra uma função que pode ser chamada via REPL.
     * Ex: const getUser = addFunc("getUser", { method: "GET", url: "{{HOST}}/users/:id" })
     */
    addHttpSimpleFunc(name: string, config: ReqDefinition) {
        const baseConfig = { ...config, name };
        const fn = (params: CallParams = {}) => this.performFetch(baseConfig, params);

        this.replContext[name] = fn;
        this.requests.set(name, baseConfig);
        return fn;
    }

    // Inside TrexEngine class:
    addHttpFunc<TBody = any, TPath = any, TQuery = any, TResponse = any>(
        name: string,
        config: Omit<RequestConfig, 'name'>
    ) {
        const baseConfig = { ...config, name };

        // The returned function is now strictly typed
        const fn = (params: TypedCallParams<TBody, TPath, TQuery> = {}): Promise<TResponse> =>
            this.performFetch(baseConfig, params as CallParams) as Promise<TResponse>;

        this.replContext[name] = fn;
        this.requests.set(name, baseConfig);

        return fn;
    }

    /**
     * Registers a pure JS/TS function into the REPL context.
     * Useful for helpers, math, or complex data transformations.
     */
    addFunction<T extends Function>(name: string, fn: T): T {
        this.replContext[name] = fn;
        // We add a dummy request entry so it shows up in 'list'
        this.functions.set(name, {
            name,
            description: 'Custom TS logic'
        } as any);

        return fn;
    }

    // --- HELPERS ---

    private replaceVars(text: string): string {
        const envVars = this.environments[this.currentEnv] || {};

        // 1. Handle Environment Variables {{env.path}}
        let result = text.replace(/\{\{(.*?)\}\}/g, (_, path) => {
            const value = this.getNestedValue(envVars, path);
            return value !== undefined ? String(value) : `{{${path}}}`;
        });

        // 2. Handle Runtime Data [[data.path]]
        result = result.replace(/\[\[(.*?)\]\]/g, (_, path) => {
            const value = this.getNestedValue(this.data, path);
            return value !== undefined ? String(value) : `[[${path}]]`;
        });

        return result;
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    }

    private define(func?: string) {
        if (!func) {
            return this.log(`❌ Função "${func}" não encontrada.`)
        }
        const config = this.requests.get(func);
        if (config) {
            this.log(`\x1b[1m[${func}]\x1b[0m ${config.method} ${config.url}`);
            if (config.headers) this.log(`Headers: ${JSON.stringify(config.headers)}`);
        } else {
            const config = this.functions.get(func);
            if (config) {
                this.log(`\x1b[1m[${func}]\x1b[0m ${config?.name} ${config?.description}`);
            } else {
                this.log(`❌ Função "${func}" não encontrada.`);
            }
        }
    }

    private highlightVars(text: string): string {
        return text.replace(/(\{\{.*?\}\})/g, "\x1b[33m$1\x1b[0m");
    }

    public log(msg: string) {
        if (!this.isInteractiveMode) {
            console.log(msg);
            return;
        }
        this.displayHistory.push(msg);
        // Limita o histórico para não pesar a memória
        if (this.displayHistory.length > 100) this.displayHistory.shift();
    }

    public logJson(obj: any) {
        this.log(this.formatJson(obj));
    }

    public customFetch(params: CallParams) {
        return this.performFetch({ name: "", url: params.method, method: params.method } as RequestConfig, params);
    }

    private async performFetch(config: RequestConfig, params: CallParams = {}) {
        // 1. Injeção de variáveis de ambiente na URL base
        let finalUrl = this.replaceVars(params?.url ?? config.url);

        const commonHeaders = { 'Content-Type': 'application/json' }
        const incomingHeaders = (params?.headers ?? config?.headers);
        let headers: Record<string, string> = { ...commonHeaders, ...incomingHeaders };

        let queryParams = params?.query ?? config.query ?? null;
        let body = params?.body ?? config?.body ?? null;
        let pathParams = params?.path ?? config?.path ?? null;

        // 2. Processar Path Params (:id)
        if (pathParams) {
            for (const [key, value] of Object.entries(pathParams)) {

                finalUrl = finalUrl.replace(`:${key}`, String(value));
            }
        }

        // Validação de segurança para Path Params
        if (finalUrl.includes("/:")) {
            const missing = finalUrl.match(/:[a-zA-Z0-9]+/g);
            this.log(`\x1b[31m❌ Erro: Path params ausentes: ${missing?.join(", ")}\x1b[0m`);
            return { error: "Missing path params", missing };
        }

        // 3. Processar Query Params
        if (queryParams) {
            const searchParams = new URLSearchParams();
            for (const [k, v] of Object.entries(queryParams)) {
                searchParams.append(k, this.replaceVars(String(v)));
            }
            finalUrl += (finalUrl.includes("?") ? "&" : "?") + searchParams.toString();
        }

        if (body) {
            for (const [k, v] of Object.entries(body)) {
                body = { ...body, [k]: this.replaceVars(v as string) }
            }
        }


        // 4. Preparar Headers (Mesclando config fixa + injeção de env)

        if (headers) {
            for (const [k, v] of Object.entries(headers)) {
                headers[k] = this.replaceVars(v);
            }
        }


        this.log(`\x1b[34m🚀 [${config.method}] ${config.name} -> ${finalUrl}\x1b[0m`);

        try {
            const response = await fetch(finalUrl, {
                method: config.method,
                headers,
                body: body ? JSON.stringify(body) : undefined
            });

            const statusColor = response.ok ? "\x1b[32m" : "\x1b[31m";
            this.log(`${statusColor}● ${response.status} ${response.statusText}\x1b[0m`);

            const data = await response.json().catch(() => ({ msg: "Non-JSON response" }));
            this.data[config.name] = data;
            return data;
        } catch (err: any) {
            this.log(`\x1b[31m❌ Erro: ${err.message}\x1b[0m`);
            return { error: err.message };
        }
    }


    private async executeRequest(name: string) {
        const config = this.requests.get(name);
        if (!config) return this.log(`\x1b[31m❌ Request "${name}" not found.\x1b[0m`);

        const result = await this.performFetch(config, {
            body: config.body,
            path: config.path,
            query: config.query,
        });

        return result;
    }

    public async applyJq(data: any, filter: string = ".") {
        try {
            // O jq.run aceita o filtro, o objeto (como string ou path) e opções
            const result = await jq.run(filter.replaceAll(/^\'|\'$/g, "").replaceAll(/^\"|\"$/g, ""), data, { input: 'json', output: 'json' });
            return result;
        } catch (e) {
            return { error: "Invalid JQ filter", details: e };
        }
    }

    // Um formatador simples para o Trex
    private formatJson(obj: any): string {
        const json = JSON.stringify(obj, null, 2);
        return json.replace(
            /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
            (match) => {
                let cls = "\x1b[32m"; // verde para números
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) cls = "\x1b[34m"; // azul para chaves
                    else cls = "\x1b[33m"; // amarelo para strings
                } else if (/true|false/.test(match)) {
                    cls = "\x1b[35m"; // roxo para booleans
                } else if (/null/.test(match)) {
                    cls = "\x1b[31m"; // vermelho para null
                }
                return cls + match + "\x1b[0m";
            }
        );
    }


    // --- UI RENDER ---

    private render() {
        console.clear();
        const cols = process.stdout.columns || 80;
        const rows = process.stdout.rows || 24;

        // Header
        const modeLabel = this.isReplMode ? "\x1b[44m BUN TS REPL \x1b[0m" : "\x1b[42m COMMAND MODE \x1b[0m";
        console.log(`\x1b[1m🦖 TREX CLI ${modeLabel}\x1b[0m` + " ".repeat(cols - 35) + `Env: \x1b[36m${this.currentEnv}\x1b[0m`);
        console.log("\x1b[2m─".repeat(cols) + "\x1b[0m");

        // Espaço do Histórico
        const historyHeight = rows - 8;
        const view = this.displayHistory.slice(-historyHeight);
        while (view.length < historyHeight) view.unshift("");

        view.forEach(line => console.log(this.highlightVars(line)));

        // Footer
        console.log("\x1b[2m─".repeat(cols) + "\x1b[0m");
        if (this.isReplMode) {
            console.log("\x1b[2mDigite TS. Ex: await getPost({ path: { id: 1 } }) | 'exit' para voltar\x1b[0m");
        } else {
            console.log("\x1b[2mComandos: list | define <name> | tsrepl | env <name> | clear | exit\x1b[0m");
        }
    }


    private list() {
        this.log(""); // Espaço inicial para respiro

        // 1. Listar Http Functions (addReq / addFunc)
        this.log("📦 \x1b[1mHTTP FUNCTIONS\x1b[0m");
        const reqKeys = Array.from(this.requests.keys());
        if (reqKeys.length > 0) {
            reqKeys.forEach(name => this.log(`  • ${name}`));
        } else {
            this.log("  \x1b[2m(No http functions registered)\x1b[0m");
        }

        this.log(""); // Divisor

        // 2. Listar TS Functions (addLogic)
        this.log("λ \x1b[1mTS LOGIC FUNCTIONS\x1b[0m");
        const funcKeys = Array.from(this.functions.keys());
        if (funcKeys.length > 0) {
            funcKeys.forEach(name => this.log(`  • ${name}`));
        } else {
            this.log("  \x1b[2m(No logic functions registered)\x1b[0m");
        }

        this.log(""); // Divisor

        // 3. Listar Ambientes
        this.log("🌍 \x1b[1mENVIRONMENTS\x1b[0m");
        const envKeys = Object.keys(this.environments);
        if (envKeys.length > 0) {
            envKeys.forEach(name => {
                const isActive = name === this.currentEnv;
                const prefix = isActive ? "  \x1b[32m→" : "    ";
                const suffix = isActive ? " (active)\x1b[0m" : "";
                this.log(`${prefix} ${name}${suffix}`);
            });
        } else {
            this.log("  \x1b[2m(No environments defined)\x1b[0m");
        }

        this.log(""); // Espaço final
    }

    private getHelpMap() {
        return {
            "list": "List all registered requests and environments.",
            "req <name>": "Execute a mapped request (Command Mode).",
            "define <name>": "Show technical details/documentation of a request.",
            "env <name>": "Switch the active environment (e.g., dev, prod).",
            "tsrepl": "Enter REPL mode for dynamic TypeScript calls.",
            "history": "Show the command history of the current session.",
            "clear": "Clear the history display.",
            "help": "Display this help guide.",
            "exit": "Close the program.",
        };
    }

    private getFlagsMap() {
        return {
            "--env <name>": "Set the starting environment (e.g., --env prod).",
            "-i, --tui": "Launch the interactive TUI interface.",
            "--interactive": "Launch the interactive TUI interface.",
            "--filter": "Uses Jq json filter"
        };
    }

    private showHelpTui() {
        this.log("\n📖 \x1b[AVAILABLE COMMANDS\x1b[0m");

        const helpMap = this.getHelpMap();
        Object.entries(helpMap).forEach(([cmd, desc]) => {
            this.log(`  \x1b[32m${cmd.padEnd(15)}\x1b[0m ${desc}`);
        });


        this.log("\n📖 \x1b[1mAVAILABLE FLAGS\x1b[0m");
        const flagsMap = this.getFlagsMap();
        Object.entries(flagsMap).forEach(([cmd, desc]) => {
            this.log(`  \x1b[32m${cmd.padEnd(15)}\x1b[0m ${desc}`);
        });

        this.log("");
    }

    private showHelp() {
        this.log("\n📖 \x1b[1mCOMANDOS DISPONÍVEIS\x1b[0m");
        const cliCmds = new Set(["list", "define", "env", "req", "help"]);

        const helpMap = { ...this.getHelpMap(), "-i, --interactive, --tui": "Enters interactive mode to make requests" };
        Object.entries(helpMap).forEach(([cmd, desc]) => {
            const cmdName = cmd.split(" ")[0] ?? "";
            if (cliCmds.has(cmdName)) {
                this.log(`  \x1b[32m${cmd.padEnd(15)}\x1b[0m ${desc}`);
            }
        });

        this.log("\n📖 \x1b[1mAVAILABLE FLAGS\x1b[0m");
        const flagsMap = this.getFlagsMap();
        Object.entries(flagsMap).forEach(([cmd, desc]) => {
            this.log(`  \x1b[32m${cmd.padEnd(15)}\x1b[0m ${desc}`);
        });
        this.log("");
    }

    // --- MAIN LOOP ---

    async startTui() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
            historySize: 100
        });

        const loop = () => {
            this.render();
            const prompt = this.isReplMode ? "\x1b[34m(ts)>\x1b[0m " : "\x1b[32m(trex)>\x1b[0m ";

            rl.question(prompt, async (input) => {
                const line = input.trim();
                if (!line) return loop();

                if (this.isReplMode) {
                    if (line === 'exit') {
                        this.isReplMode = false;
                    } else {
                        try {
                            // Engine REPL: Injeta as funções e variáveis no escopo
                            const context = { ...this.replContext, ...this.environments[this.currentEnv], env: this.currentEnv };

                            // Usando Async Function para permitir 'await' direto no console
                            const result = await (async () => {
                                const fn = new Function('ctx', `with(ctx) { return (async () => { return ${line} })() }`);
                                return await fn(context);
                            })();

                            if (result !== undefined) {
                                this.log(`\x1b[90m=> ${JSON.stringify(result, null, 2)}\x1b[0m`);
                            }
                        } catch (err: any) {
                            this.log(`\x1b[31mREPL Error: ${err.message}\x1b[0m`);
                        }
                    }
                } else {
                    // Processamento de Comandos Simples
                    const [cmd, ...args] = line.split(" ");
                    this.commandHistory.push(line);
                    const arg = args.join(" ");

                    if (!cmd) return this.log("❌ No command");
                    switch (cmd) {
                        case 'tsrepl':
                            this.isReplMode = true;
                            break;
                        case 'history':
                            this.log("📜 Command History:");
                            this.commandHistory.forEach((c, i) => this.log(` ${i + 1}. ${c}`));
                            break;
                        case 'list':
                            this.list();
                            break;
                        case 'env':
                            this.env(arg);
                            break;
                        case 'help':
                            this.showHelpTui();
                            break;
                        case 'define':
                            this.define(arg);
                            break;
                        case 'req':
                            if (!arg) {
                                console.error(`❌ Request "${arg}" não encontrada.`);
                                break;
                            }

                            const filterIdx = args.indexOf('--filter');
                            let filter = ".";
                            if (filterIdx !== -1) {
                                filter = args[filterIdx + 1] ?? "";
                                args.splice(filterIdx, 2);
                            }

                            const res = await this.executeRequest(args[0] ?? "");
                            if(!res) break;
                            const filtered = await this.applyJq(res, filter);
                            this.log(this.formatJson(filtered));
                            break;

                        case 'clear':
                            this.displayHistory = [];
                            break;
                        case 'exit':
                            rl.close();
                            return;
                        default:
                            this.log(`❓ Comando desconhecido. Tente 'list' ou 'tsrepl'.`);
                    }
                }
                loop();
            });
        };

        loop();

        rl.on("close", () => {
            console.log("\n\x1b[35m🦖 Trex finalizado.\x1b[0m");
            process.exit(0);
        });
    }
    // --- LÓGICA CLI (DEFAULT) ---
    async handleCliArgs(args: string[]) {


        // 1. Extrair --env se existir
        const envIdx = args.indexOf('--env');
        if (envIdx !== -1 && args[envIdx + 1]) {
            const targetEnv = args[envIdx + 1];
            if (targetEnv && this.environments[targetEnv]) {
                this.currentEnv = targetEnv;
            }
            // Remove o --env e o valor da lista de argumentos para não sujar o comando
            args.splice(envIdx, 2);
        }
        const isInteractive = args.some(arg => ['--tui', '--interactive', '-i'].includes(arg));

        if (isInteractive) {
            this.isInteractiveMode = true;
            await this.startTui();
            return;
        }

        const [cmd, arg1] = args;


        switch (cmd) {
            case 'list':
                this.list();
                break;
            // case 'req':
            //     if (arg1) {
            //         await this.executeRequest(arg1);
            //     } else console.error(`❌ Request "${arg1}" não encontrada.`);
            //     break;
            case 'req':
                if (!arg1) {
                    console.error(`❌ Request "${arg1}" não encontrada.`);
                    break;
                }

                const filterIdx = args.indexOf('--filter');
                let filter;
                if (filterIdx !== -1) {
                    filter = args[filterIdx + 1] ?? "";
                    args.splice(filterIdx, 2);
                }

                const res = await this.executeRequest(arg1);
                if(!res) break;

                const filtered = filter ? await this.applyJq(res, filter) : res;
                this.log(this.formatJson(filtered));
                break;
            case 'define':
                this.define(arg1);
                break;
            case 'help':
            default:
                this.showHelp();
                this.displayHistory.forEach(line => this.log(line));
                break;
        }
    }
}

const engine = new TrexEngine();
export const trex = engine;

export const addReq = engine.addReq.bind(engine);
export const addFunction = engine.addFunction.bind(engine);
export const addHttpFunc = engine.addHttpFunc.bind(engine);
export const regEnv = engine.regEnv.bind(engine);
export const env = engine.env.bind(engine);
export const getEnv = engine.getEnv.bind(engine);
export const getEnvData = engine.getEnvData.bind(engine);
export const startTui = engine.startTui.bind(engine);

export const cli = (args: string[]) => engine.handleCliArgs(args);