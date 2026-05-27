import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { candidateName, phone } = await req.json();

    if (!candidateName || !phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: candidateName, phone" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const apiKey   = Deno.env.get("BOLNA_API_KEY");
    const agentId  = Deno.env.get("BOLNA_AGENT_ID");

    if (!apiKey || !agentId) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Bolna credentials" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const bolnaRes = await fetch("https://api.bolna.ai/call", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        recipient_phone_number: phone,
        user_data: {
          candidate_name: candidateName,
        },
      }),
    });

    const data = await bolnaRes.json();

    return new Response(JSON.stringify(data), {
      status: bolnaRes.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
