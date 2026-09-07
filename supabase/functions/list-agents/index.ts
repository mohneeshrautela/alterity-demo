import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Only these agents are surfaced on the demo page for now, with hand-written
// copy grounded in each agent's actual system prompt.
const AGENT_META: Record<string, { description: string; icon: string }> = {
  "7e0977fd-18bc-4c55-a36d-5b64db4c8889": { // EdTech Agent
    description: "Calls a candidate as \"Krishna\", an exam consultant, to verify their exam registration and guide them toward a counselling session.",
    icon: "🎓",
  },
  "8b63284e-34ee-4570-85f0-b00e9bc5b818": { // FNOL Agent
    description: "Calls as \"Krishna\", a claims assistant for Lotus Insurance, to register a First Notice of Loss and collect incident details for a new motor claim.",
    icon: "🚗",
  },
  "ef06dbd1-4452-4abc-a754-5817c773c8fd": { // Borrower Verification
    description: "Calls as \"Neha\", a tele-verification officer from Shriram Finance, to confirm a borrower's identity details before loan processing continues.",
    icon: "🏦",
  },
  "3cd09541-29d6-4cf9-bc8f-0db10ca86cd4": { // Loan Recovery Agent
    description: "Calls as \"Monica\", a collections officer from Alterity Credit Card Services, to inform a customer of their outstanding balance and secure a repayment plan.",
    icon: "💳",
  },
};

const ALLOWED_AGENT_IDS = new Set(Object.keys(AGENT_META));

// Pulls {{variable}} / {variable} placeholders out of every string value
// found anywhere inside an agent's prompt config.
function extractVariables(value: unknown, found: Set<string>) {
  if (typeof value === "string") {
    const matches = value.matchAll(/\{\{?\s*([a-zA-Z0-9_.]+)\s*\}?\}/g);
    for (const m of matches) found.add(m[1]);
  } else if (Array.isArray(value)) {
    for (const item of value) extractVariables(item, found);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) extractVariables(v, found);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const apiKey = Deno.env.get("BOLNA_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Bolna credentials" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const bolnaRes = await fetch("https://api.bolna.ai/v2/agent/all", {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}` },
    });

    const data = await bolnaRes.json();

    if (!bolnaRes.ok) {
      return new Response(JSON.stringify(data), {
        status: bolnaRes.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const agents = (Array.isArray(data) ? data : [])
      .filter((agent: Record<string, unknown>) => ALLOWED_AGENT_IDS.has(agent.id as string))
      .map((agent: Record<string, unknown>) => {
        const found = new Set<string>();
        extractVariables(agent.agent_prompts, found);
        const meta = AGENT_META[agent.id as string];

        return {
          id: agent.id,
          name: agent.agent_name,
          status: agent.agent_status,
          variables: Array.from(found).sort(),
          description: meta.description,
          icon: meta.icon,
        };
      });

    return new Response(JSON.stringify({ agents }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
