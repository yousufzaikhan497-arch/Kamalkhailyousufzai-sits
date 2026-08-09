import { getStore } from "@netlify/blobs";

// This function is reachable at /.netlify/functions/directory
// GET  -> returns every member entry as a JSON array
// POST -> saves/updates one member entry, keyed by their email

export default async (req, context) => {
  const store = getStore({ name: "family-directory", consistency: "strong" });

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const entries = [];
    for (const item of blobs) {
      const data = await store.get(item.key, { type: "json" });
      if (data) entries.push(data);
    }
    return new Response(JSON.stringify(entries), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (req.method === "POST") {
    const body = await req.json();

    if (!body.email || !body.name) {
      return new Response(JSON.stringify({ error: "Missing name or email" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    await store.setJSON(body.email, body);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
};

export const config = {
  path: "/api/directory",
};
