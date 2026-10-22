// Builds the site into dist/: copies the app files and bundles WebLLM into same-origin files.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, readFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const f of ["index.html", "sw.js", "icon.png"]) cpSync(`src/${f}`, `dist/${f}`);

const common = {
  bundle: true, format: "esm", platform: "browser", target: "es2022", minify: true, logLevel: "info",
  // WebLLM/TVM reference Node-only modules behind runtime checks; they are never loaded in a browser.
  external: ["perf_hooks", "fs", "path", "url", "crypto", "ws", "child_process", "os", "util", "module"],
};
await build({ ...common, entryPoints: ["src/webllm-entry.js"], outfile: "dist/webllm.js" });
await build({ ...common, entryPoints: ["src/worker-entry.js"], outfile: "dist/worker.js" });

// The worker must be self-contained: an import left in it would need the network when offline.
const worker = readFileSync("dist/worker.js", "utf8");
const leftover = worker.match(/(?:^|[;}\s])import\s*(?:[\w*{][^;]*?from\s*)?["'][^"']+["']/m);
if (leftover) throw new Error("worker.js still imports a module: " + leftover[0]);
