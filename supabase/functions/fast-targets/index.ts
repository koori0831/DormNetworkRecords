const FAST_TOKEN = "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm";
const FAST_API_URL = "https://api.fast.com/netflix/speedtest/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders }
    );
  }

  const url = new URL(FAST_API_URL);
  url.searchParams.set("https", "true");
  url.searchParams.set("token", FAST_TOKEN);
  url.searchParams.set("urlCount", "5");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Fast.com target lookup failed: ${response.status}`);
    }

    const data = await response.json();

    return Response.json(
      {
        client: data.client,
        targets: (data.targets || []).map((target: { url: string; location?: unknown }) => ({
          url: target.url,
          location: target.location
        }))
      },
      {
        headers: {
          ...corsHeaders,
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: corsHeaders }
    );
  }
});
