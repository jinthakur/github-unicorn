import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Skull, Sparkles, Terminal, Search, TrendingUp, Gavel, Download } from "lucide-react";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Graveyard → Unicorn — Turn dead GitHub repos into pitch-ready startups" },
      {
        name: "description",
        content:
          "Multi-agent system that ranks your repos by monetization potential, builds a GTM plan with live competitor intel, and stress-tests it against AI VC judges.",
      },
      { property: "og:title", content: "Graveyard → Unicorn" },
      { property: "og:description", content: "Turn your GitHub graveyard into a unicorn." },
    ],
  }),
  component: Landing,
});

function parseUsername(raw: string): string {
  let s = raw.trim().replace(/^@/, "");
  const m = s.match(/github\.com\/([^/?#\s]+)/i);
  if (m) s = m[1];
  return s.replace(/[^a-zA-Z0-9-]/g, "");
}

function Landing() {
  const [username, setUsername] = useState("");
  const navigate = useNavigate();

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const u = parseUsername(username);
    if (!u) return;
    navigate({ to: "/u/$username", params: { username: u } });
  };



  return (
    <main className="min-h-screen scanline">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-mono text-sm">
          <Terminal className="size-4 text-primary" />
          <span className="text-foreground">graveyard</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-gradient-unicorn font-semibold">unicorn</span>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 font-mono text-xs">
            <a href="/pitch-deck.pptx" download="graveyard-to-unicorn-pitch.pptx">
              <Download className="size-3.5" /> Download pitch deck
            </a>
          </Button>
          <a
            href="https://github.com/panforrest"
            target="_blank"
            rel="noreferrer"
            className="hidden text-xs font-mono text-muted-foreground hover:text-primary transition-colors sm:inline"
          >
            built @ nyc agent hack 2026
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            multi-agent · monetize · gtm · vc stress-test
          </div>

          <h1 className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Turn your <span className="text-graveyard line-through decoration-destructive/60">GitHub graveyard</span>
            <br />
            into a <span className="text-gradient-unicorn">unicorn.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            Drop a GitHub username. Three agents rank your top 10 repos by monetization potential, build
            a 30/60/90 GTM plan with live competitor intel, then put it on trial against AI twins of the
            actual hackathon judges.
          </p>

          {/* Input */}
          <form onSubmit={handleAnalyze} className="mt-10 w-full max-w-xl">
            <div className="group flex items-center gap-2 rounded-lg border border-border bg-card/80 p-2 backdrop-blur transition-colors focus-within:border-primary focus-within:border-glow">
              <span className="pl-3 font-mono text-sm text-muted-foreground">github.com/</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="forrestpan"
                className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                autoFocus
              />
              <Button type="submit" size="sm" className="gap-1.5">
                Resurrect <ArrowRight className="size-3.5" />
              </Button>
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              ~45s · streams results live · no signup
            </p>
          </form>

          {/* Sample chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 font-mono text-xs">
            <span className="text-muted-foreground">try:</span>
            {["forrestpan", "torvalds", "sindresorhus", "tj"].map((u) => (
              <button
                key={u}
                onClick={() => navigate({ to: "/u/$username", params: { username: u } })}
                className="rounded border border-border bg-card/40 px-2 py-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Agents */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-10 text-center font-mono text-sm uppercase tracking-widest text-muted-foreground">
          // three agents · one verdict
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <AgentCard
            icon={<TrendingUp className="size-5" />}
            tag="01 / monetize"
            title="Repo Ranker"
            desc="Scores every repo on revenue potential, market size, moat, and time-to-MRR. Returns top 10."
          />
          <AgentCard
            icon={<Search className="size-5" />}
            tag="02 / gtm"
            title="Go-to-Market"
            desc="Live competitor scan via Nimble. Builds 30/60/90 plan: launch → growth → scale."
          />
          <AgentCard
            icon={<Gavel className="size-5" />}
            tag="03 / vc"
            title="Judge Twin"
            desc="Stress-tests the pitch as AI twins of the actual hackathon judges. Spawn your own twin too."
          />
        </div>
      </section>

      {/* Sponsor strip */}
      <section className="border-t border-border/50 bg-card/30 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            powered by
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 font-mono text-sm text-muted-foreground">
            <span>Lovable AI</span>
            <span className="text-border">·</span>
            <span>Nimble</span>
            <span className="text-border">·</span>
            <span>ClickHouse</span>
            <span className="text-border">·</span>
            <span>Senso</span>
            <span className="text-border">·</span>
            <span>GitHub API</span>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 font-mono text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Skull className="size-3" /> RIP {new Date().getFullYear()} dead repos
        </span>
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3 text-accent" /> long live the unicorns
        </span>
      </footer>
    </main>
  );
}

function AgentCard({
  icon,
  tag,
  title,
  desc,
}: {
  icon: React.ReactNode;
  tag: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border bg-card/60 p-6 backdrop-blur transition-all hover:border-primary/50 hover:bg-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {tag}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
      <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );
}
