import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Turns { "customer.name": "Caroline" } into { customer: { name: "Caroline" } }
// so dot-notation variable names map onto Bolna's nested user_data lookup.
function setNested(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let cursor = target;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (typeof cursor[key] !== "object" || cursor[key] === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { agentId, phone, variables } = await req.json();

    if (!agentId || !phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: agentId, phone" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("BOLNA_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Bolna credentials" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const userData: Record<string, unknown> = {};
    if (variables && typeof variables === "object") {
      for (const [key, value] of Object.entries(variables)) {
        if (typeof value === "string" && value.trim() === "") continue;
        setNested(userData, key, value);
      }
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
        user_data: userData,
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
