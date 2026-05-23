import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Star, GitFork, Sparkles, Rocket, Gavel, Target, DollarSign, Users, AlertTriangle, ThumbsDown, ThumbsUp, HelpCircle, Lightbulb, Terminal, Share2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeRepo, type UnicornAnalysis } from "@/lib/analyze.functions";
import { generateGtm, type GtmPlan } from "@/lib/gtm.functions";
import { judgeRepo, type VcVerdict } from "@/lib/judge.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useState } from "react";

type Repo = {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  pushed_at: string;
  html_url: string;
};

const memoInput = z.object({
  username: z.string().min(1).max(120),
  repo: z.string().min(1).max(255),
});

export type MemoData = {
  repo: {
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    daysSincePush: number;
    html_url: string;
  };
  analysis: UnicornAnalysis;
  gtm: GtmPlan;
  verdict: VcVerdict;
};

export const buildMemo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => memoInput.parse(d))
  .handler(async ({ data }): Promise<MemoData> => {
    const { username, repo: repoName } = data;
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (res.status === 404) throw new Error("Repo not found");
    if (!res.ok) throw new Error(`GitHub error ${res.status}`);
    const r = (await res.json()) as Repo;
    const daysSincePush = Math.floor((Date.now() - new Date(r.pushed_at).getTime()) / 86400000);

    const repoMeta = {
      name: r.name,
      owner: username,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      daysSincePush,
      html_url: r.html_url,
    };

    const [analysis, gtm] = await Promise.all([
      analyzeRepo({
        data: {
          repo: {
            name: r.name,
            description: r.description,
            language: r.language,
            stars: r.stargazers_count,
            forks: r.forks_count,
            topics: r.topics ?? [],
            daysSincePush,
            owner: username,
          },
        },
      }),
      generateGtm({
        data: {
          repo: {
            name: r.name,
            description: r.description,
            language: r.language,
            topics: r.topics ?? [],
            owner: username,
          },
        },
      }),
    ]);

    const verdict = await judgeRepo({
      data: {
        repo: {
          name: r.name,
          owner: username,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          daysSincePush,
        },
        analysis,
        gtm,
      },
    });

    return { repo: repoMeta, analysis, gtm, verdict };
  });

export const Route = createFileRoute("/u/$username/$repo")({
  loader: ({ params }) => buildMemo({ data: { username: params.username, repo: params.repo } }),
  head: ({ params, loaderData }) => {
    const v = loaderData?.verdict;
    const a = loaderData?.analysis;
    const title = v
      ? `${params.username}/${params.repo}: ${v.recommendation.replace("_", " ").toUpperCase()} (${a?.unicornScore}/100)`
      : `${params.username}/${params.repo} — VC Memo`;
    const desc = v?.oneLiner ?? `AI-generated VC investment memo for ${params.username}/${params.repo}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/u/${params.username}/${params.repo}` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: `/u/${params.username}/${params.repo}` }],
    };
  },
  pendingComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-primary" />
      <p className="mt-4 font-mono text-sm text-muted-foreground">convening the partner meeting…</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground/60">analyzing · planning GTM · judging (≈ 20s)</p>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <AlertCircle className="mx-auto mb-4 size-10 text-destructive" />
        <h1 className="text-2xl font-bold">Memo failed</h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => { router.invalidate(); reset(); }}>Retry</Button>
          <Button variant="outline" asChild><Link to="/">← Home</Link></Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">Memo not found</h1>
      <Button asChild className="mt-6"><Link to="/">← Home</Link></Button>
    </div>
  ),
  component: MemoPage,
});

function MemoPage() {
  const { repo, analysis, gtm, verdict } = Route.useLoaderData() as MemoData;
  const { username } = Route.useParams();
  const [copied, setCopied] = useState(false);


  const rec = verdict.recommendation;
  const recMeta =
    rec === "term_sheet"
      ? { label: "TERM SHEET", className: "border-primary/60 bg-primary/15 text-primary", icon: <ThumbsUp className="size-4" /> }
      : rec === "explore"
      ? { label: "EXPLORE", className: "border-accent/60 bg-accent/15 text-accent", icon: <HelpCircle className="size-4" /> }
      : { label: "PASS", className: "border-destructive/60 bg-destructive/15 text-destructive", icon: <ThumbsDown className="size-4" /> };

  const tier =
    analysis.unicornScore >= 70 ? "text-primary border-primary/40"
    : analysis.unicornScore >= 40 ? "text-accent border-accent/40"
    : "text-muted-foreground border-border";

  const onShare = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

  return (
    <main className="min-h-screen scanline">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-mono text-sm hover:text-primary transition-colors">
          <Terminal className="size-4 text-primary" />
          <span>graveyard</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-gradient-unicorn font-semibold">unicorn</span>
        </Link>
        <Link to="/u/$username" params={{ username }} className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="size-3.5" /> back to @{username}
        </Link>
      </nav>

      <article className="mx-auto max-w-4xl px-6 pb-24">
        {/* HEADER */}
        <header className="mt-4">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">// investment memo</p>
          <h1 className="mt-2 font-mono text-3xl sm:text-4xl font-bold">
            {repo.owner}<span className="text-muted-foreground">/</span>{repo.name}
          </h1>
          {repo.description && (
            <p className="mt-2 text-base text-muted-foreground">{repo.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs text-muted-foreground">
            {repo.language && <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-accent" /> {repo.language}</span>}
            <span className="flex items-center gap-1"><Star className="size-3" /> {repo.stars}</span>
            <span className="flex items-center gap-1"><GitFork className="size-3" /> {repo.forks}</span>
            <span>pushed {formatDays(repo.daysSincePush)}</span>
            <a href={repo.html_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 hover:text-primary transition-colors">
              github <ExternalLink className="size-3" />
            </a>
          </div>
        </header>

        {/* VERDICT HERO */}
        <section className={`mt-8 rounded-lg border p-5 ${recMeta.className}`}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded border border-current px-2 py-1 font-mono text-sm font-bold">
              {recMeta.icon} {recMeta.label}
            </span>
            <span className={`rounded border px-2 py-1 font-mono text-sm ${tier}`}>
              unicorn score {analysis.unicornScore}/100
            </span>
            <span className="rounded border border-border/60 px-2 py-1 font-mono text-xs text-muted-foreground">
              conviction {verdict.conviction}/100
            </span>
            <Button size="sm" variant="outline" onClick={onShare} className="ml-auto h-8 gap-1.5 font-mono text-xs">
              <Share2 className="size-3.5" /> {copied ? "copied!" : "share memo"}
            </Button>
          </div>
          <p className="mt-4 text-xl sm:text-2xl font-semibold leading-snug text-foreground">
            &ldquo;{verdict.oneLiner}&rdquo;
          </p>
        </section>

        {/* THESIS */}
        <Section icon={<Sparkles className="size-4 text-accent" />} title="thesis">
          <p className="font-semibold text-foreground">{analysis.verdict}</p>
          <p className="mt-2 text-muted-foreground">{analysis.thesis}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label color="accent">monetization</Label>
              <p className="mt-1 text-sm text-muted-foreground">{analysis.monetization}</p>
            </div>
            <div>
              <Label color="destructive">risks</Label>
              <ul className="mt-1 space-y-1 text-sm">
                {analysis.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0 text-destructive/70" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* GTM */}
        <Section icon={<Rocket className="size-4 text-primary" />} title="go-to-market plan">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field icon={<Target className="size-3" />} label="positioning" value={gtm.positioning} />
            <Field icon={<DollarSign className="size-3" />} label="pricing" value={gtm.pricing} />
            <Field icon={<Users className="size-3" />} label="ideal customer" value={gtm.icp} className="sm:col-span-2" />
          </div>

          <div className="mt-5">
            <Label color="accent">competitors (live SERP)</Label>
            <ul className="mt-2 space-y-2">
              {gtm.competitors.map((c, i) => (
                <li key={i} className="text-sm">
                  <a href={c.url} target="_blank" rel="noreferrer" className="font-mono font-semibold text-foreground hover:text-primary transition-colors">
                    {c.name} <span className="text-muted-foreground">· {c.domain}</span>
                    <ExternalLink className="ml-1 inline size-2.5" />
                  </a>
                  <p className="mt-0.5 text-muted-foreground">{c.angle}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Timeline label="30 days" items={gtm.thirtyDay} />
            <Timeline label="60 days" items={gtm.sixtyDay} />
            <Timeline label="90 days" items={gtm.ninetyDay} />
          </div>
        </Section>

        {/* VC VERDICT DETAIL */}
        <Section icon={<Gavel className="size-4 text-accent" />} title="partner verdict">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label color="destructive"><ThumbsDown className="size-3" /> objections</Label>
              <ul className="mt-2 space-y-1.5 text-sm">
                {verdict.objections.map((o, i) => (
                  <li key={i} className="flex gap-1.5 text-muted-foreground">
                    <span className="mt-0.5 font-mono text-[10px] text-destructive/70">{String(i + 1).padStart(2, "0")}</span>
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Label color="primary"><HelpCircle className="size-3" /> diligence questions</Label>
              <ul className="mt-2 space-y-1.5 text-sm">
                {verdict.diligence.map((d, i) => (
                  <li key={i} className="flex gap-1.5 text-muted-foreground">
                    <span className="mt-0.5 font-mono text-[10px] text-primary/70">Q{i + 1}</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 rounded border border-border/60 bg-background/40 p-3">
            <Label color="accent"><Lightbulb className="size-3" /> change my mind</Label>
            <p className="mt-1 text-sm text-muted-foreground">{verdict.changeMyMind}</p>
          </div>
        </Section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-6 font-mono text-xs text-muted-foreground">
          <span>generated by graveyard → unicorn · AI is opinionated, not omniscient</span>
          <Button size="sm" variant="ghost" onClick={onShare} className="h-7 gap-1.5 font-mono text-xs">
            <Share2 className="size-3" /> {copied ? "copied!" : "copy link"}
          </Button>
        </footer>
      </article>
    </main>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 rounded-lg border border-border bg-card/40 p-5 backdrop-blur">
      <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {icon} // {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Label({ color, children }: { color: "primary" | "accent" | "destructive"; children: React.ReactNode }) {
  const cls =
    color === "primary" ? "text-primary"
    : color === "accent" ? "text-accent"
    : "text-destructive";
  return (
    <span className={`flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

function Field({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-accent">
        {icon} {label}
      </span>
      <p className="mt-1 text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function Timeline({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded border border-border/50 bg-background/40 p-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-primary">// {label}</span>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <span className="mt-0.5 font-mono text-[9px] text-primary/60">{String(i + 1).padStart(2, "0")}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDays(d: number) {
  if (d < 1) return "today";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}
