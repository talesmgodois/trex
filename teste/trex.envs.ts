// trex.envs.ts
import { regEnv, env } from "@talesmgodois/trex";

const envs = {
    dev: "dev",
};

regEnv(envs.dev, {
    BASE_URL: "http://localhost:3000",
});

env(process.env.NODE_ENV ?? envs.dev);
