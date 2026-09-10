import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const server = createServer(async (request, response) => {
  const requested = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const file = normalize(join(root, requested));
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

const port = Number(process.env.BROJECT_PORT ?? 4173);
server.listen(port, "127.0.0.1", () => {
  console.log(`Broject UI available at http://127.0.0.1:${port}`);
});
