import { getStore } from "@netlify/blobs";

// This function is reachable at /.netlify/functions/directory
// GET  -> returns every member entry as a JSON array (LOGGED-IN MEMBERS ONLY)
// POST -> saves/updates one member entry, keyed by their email (LOGGED-IN MEMBERS ONLY)
//
// Security: both GET and POST require a valid Netlify Identity login.
// The browser must send the user's Identity token in the Authorization header
// (the updated index.html does this automatically).

export default async (req, context) => {
  const store = getStore({ name: "family-directory", consistency: "strong" });

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const countOnly = url.searchParams.get("countOnly") === "1";

  // Public count-only mode: no login required, reveals only a number, no personal data
  if (req.method === "GET" && countOnly) {
    const { blobs } = await store.list();
    return new Response(JSON.stringify({ count: blobs.length }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Require a logged-in, verified Netlify Identity user for everything below
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "You must be logged in to access the directory." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
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

    // A member can only save/edit their OWN entry, never someone else's
    if (body.email !== user.email) {
      return new Response(JSON.stringify({ error: "You can only edit your own profile." }), {
        status: 403,
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
