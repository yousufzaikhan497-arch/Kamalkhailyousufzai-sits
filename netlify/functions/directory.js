import { getStore } from "@netlify/blobs";

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

  if (req.method === "GET" && countOnly) {
    const { blobs } = await store.list();
    return new Response(JSON.stringify({ count: blobs.length }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "You must be logged in to access the directory." }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Try the officially-provided Identity URL first (from Netlify's own context),
  // falling back to building it from the request host if that's not present.
  const officialIdentityUrl = context.clientContext && context.clientContext.identity && context.clientContext.identity.url;
  const fallbackIdentityUrl = `https://${req.headers.get("host")}/.netlify/identity`;
  const baseIdentityUrl = officialIdentityUrl || fallbackIdentityUrl;
  const identityUrl = `${baseIdentityUrl}/user`;

  let user;
  let identityRes;
  let identityBodyText;
  try {
    identityRes = await fetch(identityUrl, {
      headers: { Authorization: authHeader },
    });
    identityBodyText = await identityRes.text();
    if (!identityRes.ok) {
      return new Response(JSON.stringify({
        error: `DEBUG2: source=${officialIdentityUrl ? "official" : "fallback"} | URL: ${identityUrl} | Status: ${identityRes.status} | Body: ${identityBodyText.slice(0, 300)}`
      }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    user = JSON.parse(identityBodyText);
  } catch (err) {
    return new Response(JSON.stringify({
      error: `DEBUG2: threw an error. source=${officialIdentityUrl ? "official" : "fallback"} | URL: ${identityUrl} | Message: ${err.message}`
    }), {
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
