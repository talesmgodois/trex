# trex CLI - Comandos e Flags

Este documento lista **todas** as possibilidades de comandos suportadas pela CLI do `trex`, considerando:
1. modo “normal” (passando argumentos na linha de comando),
2. modo interativo/TUI (prompt dentro do terminal),
3. modo REPL (avaliação de expressão TS no prompt).

## Como executar

Formas comuns (dependendo do seu setup):

- via Bun (repositório): `bun run ./src/index.ts [GLOBAL FLAGS] <comando> [args...]`
- via bin instalado: `trex [GLOBAL FLAGS] <comando> [args...]`

## Flags globais (antes do comando)

Estas flags são processadas no entrypoint `src/index.ts` e/ou pela engine:

- `--config <path>`: carrega um arquivo de configuração alternativo (ex.: `samples/trex.config.ts`)
- `--env <name>`: define o ambiente ativo no modo normal (só funciona se o ambiente estiver registrado na config)
- `--tui`, `-i`, `--interactive`: inicia o modo interativo/TUI

## Modo Normal (Command Mode)

No modo normal, o primeiro argumento define o comando.
Comportamento geral: se o comando não existir, a CLI exibe ajuda.

### Comandos suportados

- `list`
- `req <name> [--filter <jq>]`
- `define <name>`
- `init [--path <dir>] [--run-time bun|node] [--<key> <value> ...]`
- `help`

### Detalhes do comando `req`

Formato:

- `req <name> --filter <jq>`

Notas:

- `--filter` usa sintaxe do `jq` (biblioteca `node-jq`)
- se `--filter` não for passado, o resultado do request é impresso “como está” (sem jq)

## Modo Interativo (TUI)

Inicia com uma das flags abaixo:

- `--tui`
- `-i`
- `--interactive`

Ao entrar no TUI, você verá um prompt de comandos e pode digitar comandos abaixo (um por vez).

### Prompt de comandos

- prompt: `(trex)>`
- comandos disponíveis no prompt (um por vez):
- `list`
- `req <name> [--filter <jq>]`
- `define <name>`
- `env <name>` (altera o ambiente ativo)
- `tsrepl` (entra no REPL)
- `history` (mostra o histórico desta sessão)
- `clear` (limpa o histórico exibido)
- `help` (mostra ajuda no TUI)
- `exit` (sair/encerrar)

Detalhe do `req` no TUI:

- se `--filter` não for passado no comando `req`, o filtro padrão é `.` (jq “identidade”)

### Prompt REPL

- prompt: `(ts)>`
- como funciona: você digita uma **expressão TS/JavaScript** (com suporte a `await`) avaliada no contexto que inclui as funções registradas (HTTP requests mapeadas e funções TS/JS adicionadas), variáveis do ambiente ativo e `env` (nome do ambiente ativo).
- comandos no REPL: `exit` volta do REPL para o prompt de comandos `(trex)>`

## Comando `init`

O comando `init` cria um “scaffold” de um projeto com `trex`:
ele cria/usa a pasta alvo, inicializa `package.json`, instala a dependência do `trex` e gera:
`trex.config.ts` e `trex.envs.ts`.

Formato:

- `init [--path <dir>] [--run-time bun|node] [--<key> <value> ...]`

Flags/reservadas:

- `--path <dir>`: diretório onde será criado o projeto (default: `process.cwd()`)
- `--run-time bun|node`: runtime usado para inicializar/instalar (default: `node`)

Variáveis adicionais:

- qualquer flag adicional no formato `--<key> <value>` (exceto `--path` e `--run-time`) vira “template var” usada durante a renderização dos templates

Campos com significado explícito nos templates:

- `--name <name>`: define o `package.json.name` gerado
- `--description <text>`: define o `package.json.description` gerado

