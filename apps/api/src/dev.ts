import { serve } from "@hono/node-server";
import app from "@/index";

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`SI SARPRAS API siap di http://localhost:${info.port}`);
});
