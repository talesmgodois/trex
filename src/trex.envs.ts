// trex.ts
import { regEnv, env } from "./lib/trex.lib.ts";

const envs = {
    dev: "dev",
    staging: "staging",
}

const commonEnv = {
    authorizationService: "presence",
    authorizationDuration: 120,
    integrationBackendUrl: "http://localhost:8080",
}

// Registrar Ambientes
regEnv(envs.staging, {
    ...commonEnv,
    PORTAL_BACKEND_URL: "https://www.myglance.net",
    PORTAL_BACKEND_USER_ADDRESS: process.env.PORTAL_BACKEND_USER_ADDRESS,
    PORTAL_BACKEND_USER_PASSWORD: process.env.PORTAL_BACKEND_USER_PASSWORD,
    GROUP_ID: process.env.PORTAL_BACKEND_GROUP_ID,
    PORTAL_BACKEND_ADMIN_USER_ADDRESS: 'tales25562admin.glance.net',
    PORTAL_BACKEND_ADMIN_USER_PASSWORD: '11glance67',
    authorizationSite: "staging",
});

regEnv(envs.dev, {
    ...commonEnv,
    PORTAL_BACKEND_URL: "https://dev-www.myglance.org",
    PORTAL_BACKEND_USER_ADDRESS: "tales25685.glance.net",
    PORTAL_BACKEND_USER_PASSWORD: "glance1167!!",
    GROUP_ID: 25685,
    authorizationSite: "dev",
});

env(process.env.NODE_ENV ?? envs.dev);
