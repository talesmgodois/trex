import type { NodePlopAPI, ActionType } from "plop";
import { config } from "../../config";

export const initPlop = (plop: NodePlopAPI, name: string) => {
  plop.setGenerator(name, {
    description: "Gerador inteligente de arquivos Trex",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Nome do projeto/módulo (opcional):",
      },
      {
        type: "input",
        name: "path",
        message: "Caminho de destino (opcional, default é o atual):",
      },

      {
        type: "input",
        name: "run-time",
        message: "bun or node",
      },
    ],
    // Transformamos actions em uma função que recebe os dados dos prompts
    actions: (data: any) => {
      const actions: ActionType[] = [];
      //@ts-ignore
      const tmplData = config.templates[name] ?? {};

      let targetPath = "";

      // Lógica de decisão de diretório:
      if (data?.path) {
        // Se tem path, usa o path (independente de ter name ou não)
        targetPath = data.path;
      } else if (data?.name) {
        // Se não tem path, mas tem name, cria uma pasta com o nome
        targetPath = `{{kebabCase name}}`;
      } else {
        // Se não tem nada, usa o diretório atual (.)
        targetPath = ".";
      }

      if (data?.["run-time"]) {
        tmplData["runTime"] = data["run-time"];
      }

      Object.assign(data, tmplData);

      // Adiciona as ações usando o path calculado
      actions.push({
        type: "add",
        path: `${targetPath}/trex.config.ts`,
        templateFile: `${__dirname}/tmpls/trex.config.ts.hbs`,
        skipIfExists: true,
      });

      actions.push({
        type: "add",
        path: `${targetPath}/trex.envs.ts`,
        templateFile: `${__dirname}/tmpls/trex.envs.ts.hbs`,
        skipIfExists: true,
      });

      actions.push({
        type: "add",
        path: `${targetPath}/package.json`,
        templateFile: `${__dirname}/tmpls/package.json.hbs`,
        skipIfExists: true,
      });

      console.log("data", data);

      return actions;
    },
  });
};
