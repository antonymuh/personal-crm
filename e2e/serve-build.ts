// Starts the production build the same way the Docker image does (see
// Dockerfile): the standalone server with static files and public/ next to it.
import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const standalone = resolve(".next/standalone");
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
cpSync("public", `${standalone}/public`, { recursive: true });

await import(pathToFileURL(`${standalone}/server.js`).href);
