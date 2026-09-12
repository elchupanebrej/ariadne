import { existsSync } from "node:fs";
import { join } from "node:path";

// npm scripts expose their actual JS entry. Standalone Windows invocations
// instead find npm's entry beside the PATH shim; never execFile a .cmd file.
export function npmRunner(env = process.env, platform = process.platform) {
  if (env.npm_execpath?.endsWith("npm-cli.js") && existsSync(env.npm_execpath)) {
    return { cmd: process.execPath, prefixArgs: [env.npm_execpath] };
  }
  if (platform !== "win32") return { cmd: "npm", prefixArgs: [] };
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path");
  for (const directory of (env[pathKey] ?? "").split(";").filter(Boolean)) {
    const entry = join(directory.replace(/^"|"$/g, ""), "node_modules", "npm", "bin", "npm-cli.js");
    if (existsSync(entry)) return { cmd: process.execPath, prefixArgs: [entry] };
  }
  throw new Error("Cannot locate the npm JavaScript entry; run this check through npm run pack:smoke.");
}
