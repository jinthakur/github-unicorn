import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const JudgeInput = z.object({
  repo: z.object({
    name: z.string().min(1).max(255),
    owner: z.string().min(1).max(120),
    description: z.string().nullable(),
    language: z.string().nullable(),
    stars: z.number().int().min(0),
    daysSincePush: z.number().int().min(0),
  }),
  analysis: z.object({
    unicornScore: z.number(),
    verdict: z.string(),
    thesis: z.string(),
    monetization: z.string(),
    risks: z.array(z.string()),
  }),
  gtm: z.object({
    positioning: z.string(),
    pricing: z.string(),
    icp: z.string(),
    competitors: z.array(z.object({
      name: z.string(),
      domain: z.string(),
      angle: z.string(),
    })),
    thirtyDay: z.array(z.string()),
    sixtyDay: z.array(z.string()),
    ninetyDay: z.array(z.string()),
  }),
  persona: z.object({
    name: z.string().min(1).max(120),
    systemPrompt: z.string().min(1).max(4000),
  }).optional(),
});

export type JudgeInputType = z.infer<typeof JudgeInput>;

export type VcVerdict = {
  recommendation: "pass" | "explore" | "term_sheet";
  conviction: number; // 0-100
  oneLiner: string;
  objections: string[];
  diligence: string[];
  changeMyMind: string;
};

export const judgeRepo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => JudgeInput.parse(data))
  .handler(async ({ data }): Promise<VcVerdict> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { repo, analysis, gtm, persona } = data;

    const systemPrompt = persona?.systemPrompt
      ?? `You are a Tier-1 VC partner (think Benchmark / a16z) with 15 years of seed and Series A experience. You've seen 10,000 pitches and funded 40. You are blunt, intellectually honest, and allergic to hype. You write the way Bill Gurley tweets — tight, opinionated, citation-grade. You do not pander. You judge what is in front of you, not what could theoretically be built.`;

    const userPrompt = `An analyst pitched you this open-source repo as a potential venture investment. Below is their unicorn thesis AND a proposed 30/60/90 GTM plan. Render your verdict.

REPO
${repo.owner}/${repo.name} · ${repo.stars}★ · last pushed ${repo.daysSincePush}d ago · ${repo.language ?? "unknown"}
${repo.description ?? "(no description)"}

ANALYST UNICORN VERDICT (score ${analysis.unicornScore}/100)
> ${analysis.verdict}
Thesis: ${analysis.thesis}
Monetization: ${analysis.monetization}
Risks: ${analysis.risks.join(" · ")}

PROPOSED GTM
Positioning: ${gtm.positioning}
Pricing: ${gtm.pricing}
ICP: ${gtm.icp}
Competitors: ${gtm.competitors.map(c => `${c.name} (${c.domain})`).join(", ")}
30d: ${gtm.thirtyDay.join(" | ")}
60d: ${gtm.sixtyDay.join(" | ")}
90d: ${gtm.ninetyDay.join(" | ")}

Decide: PASS / EXPLORE / TERM SHEET. Be honest — most repos are a pass. A "term sheet" call should be rare and earned. Your one-liner is what you'd write in the partner meeting Slack. Your objections are the sharpest holes in the analyst's case. Your diligence questions are the ones whose answers would actually change your mind.`;

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
              name: "vc_verdict",
              description: "Return a structured VC partner-style verdict.",
              parameters: {
                type: "object",
                properties: {
                  recommendation: {
                    type: "string",
                    enum: ["pass", "explore", "term_sheet"],
                    description: "Your call. Be ruthless — term_sheet is rare.",
                  },
                  conviction: {
                    type: "number",
                    minimum: 0,
                    maximum: 100,
                    description: "How strongly you hold this view (0=coin flip, 100=bet the fund).",
                  },
                  oneLiner: {
                    type: "string",
                    description: "What you'd type in the partner Slack. One sentence, opinionated.",
                  },
                  objections: {
                    type: "array",
                    minItems: 2,
                    maxItems: 3,
                    items: { type: "string" },
                    description: "Sharpest holes in the analyst's case. Each ≤ 25 words.",
                  },
                  diligence: {
                    type: "array",
                    minItems: 2,
                    maxItems: 3,
                    items: { type: "string" },
                    description: "Questions the founder MUST answer. Each ≤ 25 words.",
                  },
                  changeMyMind: {
                    type: "string",
                    description: "One sentence: what specific evidence would flip your verdict.",
                  },
                },
                required: ["recommendation", "conviction", "oneLiner", "objections", "diligence", "changeMyMind"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "vc_verdict" } },
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
      throw new Error("AI returned no structured VC verdict");
    }

    return JSON.parse(toolCall.function.arguments) as VcVerdict;
  });
