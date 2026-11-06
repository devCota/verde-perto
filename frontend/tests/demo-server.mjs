// Servidor estático de teste: subdiretório como no Pages, sem fallback de SPA/API.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("dist/demo/browser");
const prefix = "/verde-perto/";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png",
  ".woff2": "font/woff2", ".woff": "font/woff", ".json": "application/json" };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const path = resolve(root, pathname.slice(prefix.length) || "index.html");
    if (!path.startsWith(root + sep)) { response.writeHead(404).end(); return; }
    const data = await readFile(path);
    response.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
    response.end(data);
  } catch { response.writeHead(404).end(); }
}).listen(4300, "127.0.0.1");
