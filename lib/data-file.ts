import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";

// Data files live outside public/ so the worker can refresh them while the server runs.
// DATA_DIR is the shared Docker volume; data-seed/ is the copy baked into the image.
const dataDir = () => process.env.DATA_DIR || path.join(process.cwd(), "data");
const seedDir = () => path.join(process.cwd(), "data-seed");

export async function serveDataFile(name: string): Promise<Response> {
  await connection(); // always read at request time, never prerender
  for (const dir of [dataDir(), seedDir()]) {
    try {
      const body = await readFile(path.join(dir, name));
      return new Response(body, {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    } catch {
      // try the next location
    }
  }
  return Response.json({ error: `${name} not found` }, { status: 404, headers: { "Cache-Control": "no-store" } });
}
