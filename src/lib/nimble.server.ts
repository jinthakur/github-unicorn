// Server-only Nimble SERP wrapper. Imported by gtm.functions.ts.

export type SerpResult = {
  position: number;
  title: string;
  url: string;
  domain: string;
  snippet: string;
};

export async function nimbleSerp(query: string, limit = 8): Promise<SerpResult[]> {
  const apiKey = process.env.NIMBLE_API_KEY;
  if (!apiKey) throw new Error("NIMBLE_API_KEY is not configured");

  const res = await fetch("https://sdk.nimbleway.com/v1/serp", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      search_engine: "google_search",
      query,
      locale: "en",
      parsing_type: "plain",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Nimble rate limit — try again shortly.");
    if (res.status === 402) throw new Error("Nimble credits exhausted.");
    throw new Error(`Nimble error [${res.status}]: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    data?: { parsing?: { entities?: { OrganicResult?: Array<{
      position: number;
      title: string;
      url: string;
      cleaned_domain: string;
      snippet: string;
    }> } } };
  };

  const organic = json.data?.parsing?.entities?.OrganicResult ?? [];
  return organic.slice(0, limit).map((r) => ({
    position: r.position,
    title: r.title,
    url: r.url,
    domain: r.cleaned_domain,
    snippet: r.snippet,
  }));
}
