import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { nimbleSerp, type SerpResult } from "./nimble.server";

const GtmInput = z.object({
  repo: z.object({
    name: z.string().min(1).max(255),
    description: z.string().nullable(),
    language: z.string().nullable(),
    topics: z.array(z.string().max(80)).max(30),
    owner: z.string().min(1).max(120),
  }),
  revisionNote: z.string().min(1).max(1000).optional(),
});

export type GtmInputType = z.infer<typeof GtmInput>;

export type GtmCompetitor = {
  name: string;
  url: string;
  domain: string;
  angle: string; // short why-it-matters from the LLM
};

export type GtmPlan = {
  positioning: string;
  pricing: string;
  icp: string;
  competitors: GtmCompetitor[];
  thirtyDay: string[];
  sixtyDay: string[];
  ninetyDay: string[];
};

function buildQuery(repo: GtmInputType["repo"]): string {
  // Prefer description (most signal). Strip emojis/links, cap length.
  const seed = repo.description?.replace(/https?:\/\/\S+/g, "").trim() || repo.name;
  const topics = repo.topics.slice(0, 3).join(" ");
  return [seed, topics].filter(Boolean).join(" ").slice(0, 180);
}

export const generateGtm = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => GtmInput.parse(data))
  .handler(async ({ data }): Promise<GtmPlan> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { repo } = data;

    // 1) Pull live competitors via Nimble SERP
    let serp: SerpResult[] = [];
    try {
      serp = await nimbleSerp(buildQuery(repo), 8);
    } catch (e) {
      // Don't kill the whole flow if SERP fails — let LLM work without it.
      console.error("Nimble SERP failed:", e);
    }

    const competitorContext = serp.length
      ? serp.map((r, i) => `[${i + 1}] ${r.title} — ${r.domain} — ${r.url}\n    ${r.snippet}`).join("\n")
      : "(no live competitor data available)";

    // 2) Hand both to the LLM for a structured GTM plan
    const systemPrompt = `You are a tactical GTM operator who has launched 20+ dev tools. You turn open-source repos into venture-scale plays. You write tight, founder-grade plans — concrete actions, real numbers, no fluff. You always ground competitor claims in the SERP data provided; never invent companies.`;

    const userPrompt = `Build a 30/60/90 GTM plan for this GitHub repo.

REPO
${repo.owner}/${repo.name}
${repo.description ?? "(no description)"}
Language: ${repo.language ?? "unknown"} · Topics: ${repo.topics.join(", ") || "(none)"}

LIVE COMPETITOR SEARCH (Google SERP via Nimble)
${competitorContext}

Pick 3-5 REAL competitors from the SERP above (use their actual URL + domain). Skip generic listicles, Wikipedia, GitHub itself, NYC Open Data portals, and government data sources. For each, give a one-line angle on why they matter to this repo's GTM.

Pricing must be specific: $X/mo tier OR usage-based with a unit price OR free + paid add-on. No "freemium TBD".

Each 30/60/90 item must be a concrete action a solo founder can execute next Monday. No "build community" or "create content" — say WHERE and HOW.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "gtm_plan",
              description: "Return a structured GTM plan grounded in the provided competitor SERP.",
              parameters: {
                type: "object",
                properties: {
                  positioning: { type: "string", description: "One sentence: who it's for and what wedge." },
                  pricing: { type: "string", description: "Concrete pricing hypothesis with $ amounts." },
                  icp: { type: "string", description: "Ideal customer profile in 1 sentence — role + company shape." },
                  competitors: {
                    type: "array",
                    minItems: 2,
                    maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        url: { type: "string" },
                        domain: { type: "string" },
                        angle: { type: "string", description: "One line on why this competitor matters." },
                      },
                      required: ["name", "url", "domain", "angle"],
                      additionalProperties: false,
                    },
                  },
                  thirtyDay: {
                    type: "array",
                    minItems: 3,
                    maxItems: 5,
                    items: { type: "string" },
                    description: "Concrete day-1-to-30 actions.",
                  },
                  sixtyDay: {
                    type: "array",
                    minItems: 3,
                    maxItems: 5,
                    items: { type: "string" },
                  },
                  ninetyDay: {
                    type: "array",
                    minItems: 3,
                    maxItems: 5,
                    items: { type: "string" },
                  },
                },
                required: ["positioning", "pricing", "icp", "competitors", "thirtyDay", "sixtyDay", "ninetyDay"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "gtm_plan" } },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (response.status === 429) throw new Error("Rate limit hit — try again in a moment.");
      if (response.status === 402) throw new Error("AI credits exhausted — add funds in workspace settings.");
      throw new Error(`AI gateway error [${response.status}]: ${body.slice(0, 200)}`);
    }

    const json = await response.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI returned no structured GTM output");
    }

    return JSON.parse(toolCall.function.arguments) as GtmPlan;
  });
