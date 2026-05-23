import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Star, GitFork, AlertCircle, ExternalLink, Skull, Sparkles, Terminal, Loader2, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchUser, fetchRepos, scoreRepos, type ScoredRepo, type UserProfile } from "@/lib/github";
import { analyzeRepo, type UnicornAnalysis } from "@/lib/analyze.functions";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} — Graveyard → Unicorn` },
      { name: "description", content: `Monetization analysis of @${params.username}'s GitHub repos.` },
      { property: "og:title", content: `${params.username}'s repos, ranked for unicorn potential` },
    ],
  }),
  component: UserPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <AlertCircle className="mx-auto mb-4 size-10 text-destructive" />
        <h1 className="text-2xl font-bold">Something broke</h1>
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
      <h1 className="text-2xl font-bold">User not found</h1>
      <Button asChild className="mt-6"><Link to="/">← Home</Link></Button>
    </div>
  ),
});

function UserPage() {
  const { username } = Route.useParams();

  const userQ = useQuery({
    queryKey: ["gh-user", username],
    queryFn: () => fetchUser(username),
    retry: 1,
  });

  const reposQ = useQuery({
    queryKey: ["gh-repos", username],
    queryFn: async () => scoreRepos(await fetchRepos(username)),
    retry: 1,
  });

  return (
    <main className="min-h-screen scanline">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-mono text-sm hover:text-primary transition-colors">
          <Terminal className="size-4 text-primary" />
          <span>graveyard</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-gradient-unicorn font-semibold">unicorn</span>
        </Link>
        <Link to="/" className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="size-3.5" /> new analysis
        </Link>
      </nav>

      <section className="mx-auto max-w-6xl px-6 pt-6 pb-12">
        {userQ.isLoading ? (
          <ProfileSkeleton />
        ) : userQ.data ? (
          <ProfileHeader user={userQ.data} />
        ) : null}
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
              // top monetizable repos
            </h2>
            <p className="mt-1 text-xs font-mono text-muted-foreground/70">
              heuristic pre-ranking · click ⚡ for AI unicorn verdict
            </p>
          </div>
          {reposQ.data && (
            <span className="font-mono text-xs text-muted-foreground">
              {reposQ.data.length} repos scanned
            </span>
          )}
        </div>

        {reposQ.isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card/40 py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              raiding the graveyard…
            </p>
          </div>
        ) : reposQ.data && reposQ.data.length > 0 ? (
          <div className="grid gap-3">
            {reposQ.data.slice(0, 10).map((repo, i) => (
              <RepoRow key={repo.id} repo={repo} rank={i + 1} owner={username} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card/40 py-16 text-center">
            <Skull className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-mono text-sm text-muted-foreground">
              no public non-fork repos found
            </p>
          </div>
        )}
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

function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-5">
      <div className="size-20 animate-pulse rounded-full bg-card" />
      <div className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded bg-card" />
        <div className="h-4 w-64 animate-pulse rounded bg-card" />
      </div>
    </div>
  );
}

function ProfileHeader({ user }: { user: UserProfile }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <img
        src={user.avatar_url}
        alt={user.login}
        className="size-20 rounded-full border border-border bg-card"
      />
      <div className="flex-1">
        <h1 className="text-2xl font-bold">
          {user.name || user.login}
          <a
            href={user.html_url}
            target="_blank"
            rel="noreferrer"
            className="ml-2 inline-flex font-mono text-sm font-normal text-muted-foreground hover:text-primary transition-colors"
          >
            @{user.login} <ExternalLink className="ml-0.5 inline size-3" />
          </a>
        </h1>
        {user.bio && <p className="mt-1 text-sm text-muted-foreground">{user.bio}</p>}
        <div className="mt-3 flex gap-4 font-mono text-xs text-muted-foreground">
          <span><span className="text-foreground">{user.public_repos}</span> repos</span>
          <span><span className="text-foreground">{user.followers}</span> followers</span>
          <span><span className="text-foreground">{user.following}</span> following</span>
        </div>
      </div>
    </div>
  );
}

function RepoRow({ repo, rank, owner }: { repo: ScoredRepo; rank: number; owner: string }) {
  const analyzeFn = useServerFn(analyzeRepo);
  const m = useMutation({
    mutationFn: () =>
      analyzeFn({
        data: {
          repo: {
            name: repo.name,
            description: repo.description,
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            topics: repo.topics ?? [],
            daysSincePush: repo.daysSincePush,
            owner,
          },
        },
      }),
  });

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur transition-all hover:border-primary/50">
      <div className="flex items-start gap-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-sm font-bold text-primary">
          {rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <a
              href={repo.html_url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-baseline gap-1.5 truncate font-mono text-base font-semibold text-foreground hover:text-primary transition-colors"
            >
              <span className="truncate">{repo.name}</span>
              <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              score <span className="text-accent">{repo.score}</span>
            </span>
          </div>
          {repo.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{repo.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs text-muted-foreground">
            {repo.language && (
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-accent" /> {repo.language}
              </span>
            )}
            <span className="flex items-center gap-1"><Star className="size-3" /> {repo.stargazers_count}</span>
            <span className="flex items-center gap-1"><GitFork className="size-3" /> {repo.forks_count}</span>
            <span>pushed {formatDays(repo.daysSincePush)}</span>
            {repo.signals.map((s) => (
              <span
                key={s}
                className={`rounded border px-1.5 py-px text-[10px] uppercase tracking-wider ${signalClass(s)}`}
              >
                {s}
              </span>
            ))}
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              variant={m.data ? "outline" : "default"}
              onClick={() => m.mutate()}
              disabled={m.isPending}
              className="h-7 gap-1.5 font-mono text-xs"
            >
              {m.isPending ? (
                <><Loader2 className="size-3 animate-spin" /> analyzing…</>
              ) : m.data ? (
                <><Zap className="size-3" /> re-analyze</>
              ) : (
                <><Zap className="size-3" /> analyze with AI</>
              )}
            </Button>
          </div>
          {m.error && (
            <p className="mt-2 font-mono text-xs text-destructive">{(m.error as Error).message}</p>
          )}
          {m.data && <AnalysisPanel a={m.data} />}
        </div>
      </div>
    </div>
  );
}

function AnalysisPanel({ a }: { a: UnicornAnalysis }) {
  const tier =
    a.unicornScore >= 70 ? "text-primary border-primary/40"
    : a.unicornScore >= 40 ? "text-accent border-accent/40"
    : "text-muted-foreground border-border";
  return (
    <div className="mt-3 rounded-md border border-border bg-background/40 p-3 text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <Sparkles className="size-3 text-accent" /> unicorn verdict
        </div>
        <div className={`rounded border px-2 py-0.5 font-mono text-xs ${tier}`}>
          {a.unicornScore}/100
        </div>
      </div>
      <p className="mt-2 font-semibold text-foreground">{a.verdict}</p>
      <p className="mt-2 text-muted-foreground">{a.thesis}</p>
      <div className="mt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-accent">monetization</span>
        <p className="mt-0.5 text-muted-foreground">{a.monetization}</p>
      </div>
      <div className="mt-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-destructive">risks</span>
        <ul className="mt-1 space-y-1">
          {a.risks.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3 shrink-0 text-destructive/70" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function formatDays(d: number) {
  if (d < 1) return "today";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function signalClass(s: string) {
  switch (s) {
    case "viral":
    case "traction":
      return "border-primary/40 text-primary";
    case "graveyard":
      return "border-destructive/40 text-destructive";
    case "active":
      return "border-accent/40 text-accent";
    default:
      return "border-border text-muted-foreground";
  }
}
