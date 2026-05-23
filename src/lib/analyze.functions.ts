import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RepoInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  language: z.string().nullable(),
  stars: z.number().int().min(0).max(1_000_000),
  forks: z.number().int().min(0).max(1_000_000),
  topics: z.array(z.string().max(80)).max(30),
  daysSincePush: z.number().int().min(0).max(20000),
  owner: z.string().min(1).max(120),
});

const analyzeInput = z.object({ repo: RepoInput });

export type AnalyzeInput = z.infer<typeof analyzeInput>;

export type UnicornAnalysis = {
  unicornScore: number;
  verdict: string;
  thesis: string;
  monetization: string;
  risks: string[];
};

export const analyzeRepo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => analyzeInput.parse(data))
  .handler(async ({ data }): Promise<UnicornAnalysis> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { repo } = data;

    const systemPrompt = `You are a sharp, contrarian VC analyst who hunts for hidden unicorns in abandoned GitHub repos. You are cynical about hype, generous about real signal. You write tight, punchy prose with zero corporate fluff.`;

    const userPrompt = `Analyze this GitHub repo's unicorn potential — could a founder turn this into a venture-scale business?

Repo: ${repo.owner}/${repo.name}
Description: ${repo.description ?? "(none)"}
Language: ${repo.language ?? "unknown"}
Stars: ${repo.stars} · Forks: ${repo.forks}
Topics: ${repo.topics.join(", ") || "(none)"}
Last pushed: ${repo.daysSincePush} days ago

Score 0-100 (0=zombie, 100=YC-ready). Be ruthless — most repos score 10-35.`;

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
              name: "unicorn_verdict",
              description: "Return a structured unicorn-potential verdict.",
              parameters: {
                type: "object",
                properties: {
                  unicornScore: { type: "number", minimum: 0, maximum: 100 },
                  verdict: { type: "string", description: "One sharp sentence." },
                  thesis: { type: "string", description: "2-3 sentences on why this could (or couldn't) scale." },
                  monetization: { type: "string", description: "Concrete revenue angle in 1-2 sentences." },
                  risks: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 1,
                    maxItems: 3,
                    description: "Top 1-3 risks or blockers.",
                  },
                },
                required: ["unicornScore", "verdict", "thesis", "monetization", "risks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "unicorn_verdict" } },
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
      throw new Error("AI returned no structured output");
    }

    const parsed = JSON.parse(toolCall.function.arguments) as UnicornAnalysis;
    return parsed;
  });
