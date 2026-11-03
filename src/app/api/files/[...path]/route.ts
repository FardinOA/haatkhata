import { readLocalFile } from "@/server/storage";

/** Serves locally stored uploads (STORAGE_DRIVER=local). */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const { path } = await ctx.params;
  try {
    const { body, mime } = await readLocalFile(path.join("/"));
    return new Response(new Uint8Array(body), { headers: { "content-type": mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
