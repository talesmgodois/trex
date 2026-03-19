import nodePlop from 'node-plop';
import path from "path";

async function runGenerator() {
  // 1. Resolve o caminho usando a API nativa do Bun
  // Bun.path.resolve substitui o path.resolve do Node
  const plopfilePath = path.resolve(import.meta.dir, '../plopfile.ts');

  // 2. Carrega o plopfile
  const plop = await nodePlop(plopfilePath);

  const generators = plop.getGeneratorList();
  if (generators.length === 0) {
    console.error('❌ Nenhum gerador encontrado.');
    return;
  }

  // 3. Pega o nome do gerador dos argumentos da CLI (ex: bun gen.ts init)
  const generatorName = Bun.argv[2] || generators?.[0]?.name;
  if(!generatorName) throw new Error("Generator not found");
  const generator = plop.getGenerator(generatorName);

  console.log(`\n🦖 Trex Generator: \x1b[34m${generatorName}\x1b[0m\n`);

  try {
    // 4. Executa
    const answers = await generator.runPrompts();
    const results = await generator.runActions(answers);

    // Feedback visual usando console nativo do Bun
    if (results.changes.length > 0) {
        for (const change of results.changes) {
            console.log(`\x1b[32m✔\x1b[0m ${change.path}`);
        }
    }
    
    if (results.failures.length > 0) {
        for (const fail of results.failures) {
            console.error(`\x1b[31m✘\x1b[0m ${fail.error}`);
        }
    }
  } catch (err: any) {
    console.error('\x1b[31m❌ Erro na execução:\x1b[0m', err.message);
  }
}

runGenerator();