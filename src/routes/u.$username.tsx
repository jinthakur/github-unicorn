import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, Star, GitFork, AlertCircle, ExternalLink, Skull, Sparkles, Terminal, Loader2, Zap, AlertTriangle, Rocket, Target, DollarSign, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchUser, fetchRepos, scoreRepos, type ScoredRepo, type UserProfile } from "@/lib/github";
import { analyzeRepo, type UnicornAnalysis } from "@/lib/analyze.functions";
import { generateGtm, type GtmPlan } from "@/lib/gtm.functions";

type AnalysisState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "done"; data: UnicornAnalysis }
  | { status: "error"; message: string };

type GtmState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "done"; data: GtmPlan }
  | { status: "error"; message: string };

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
    const is404 = /not found|404/i.test(error.message);
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        {is404 ? <Skull className="mx-auto mb-4 size-10 text-muted-foreground" /> : <AlertCircle className="mx-auto mb-4 size-10 text-destructive" />}
        <h1 className="text-2xl font-bold">{is404 ? "Ghost username" : "Something broke"}</h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {is404 ? "No GitHub user by that name. Check the spelling?" : error.message}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {!is404 && <Button onClick={() => { router.invalidate(); reset(); }}>Retry</Button>}
          <Button variant="outline" asChild><Link to="/">← Try another username</Link></Button>
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

const CONCURRENCY = 3;
const TOP_N = 10;

function UserPage() {
  const { username } = Route.useParams();
  const analyzeFn = useServerFn(analyzeRepo);

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

  const [analyses, setAnalyses] = useState<Record<number, AnalysisState>>({});
  const [batchRunning, setBatchRunning] = useState(false);

  const runOne = useCallback(
    async (repo: ScoredRepo) => {
      setAnalyses((s) => ({ ...s, [repo.id]: { status: "pending" } }));
      try {
        const data = await analyzeFn({
          data: {
            repo: {
              name: repo.name,
              description: repo.description,
              language: repo.language,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              topics: repo.topics ?? [],
              daysSincePush: repo.daysSincePush,
              owner: username,
            },
          },
        });
        setAnalyses((s) => ({ ...s, [repo.id]: { status: "done", data } }));
      } catch (e) {
        setAnalyses((s) => ({
          ...s,
          [repo.id]: { status: "error", message: e instanceof Error ? e.message : "failed" },
        }));
      }
    },
    [analyzeFn, username],
  );

  const topRepos = useMemo(() => reposQ.data?.slice(0, TOP_N) ?? [], [reposQ.data]);

  const runAll = useCallback(async () => {
    if (batchRunning || topRepos.length === 0) return;
    setBatchRunning(true);
    // Only analyze repos that aren't already done — re-run errors and idles
    const queue = topRepos.filter((r) => analyses[r.id]?.status !== "done");
    let idx = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (idx < queue.length) {
        const my = idx++;
        await runOne(queue[my]);
      }
    });
    await Promise.all(workers);
    setBatchRunning(false);
  }, [batchRunning, topRepos, analyses, runOne]);

  // Sort: done repos by unicornScore desc, then unanalyzed by heuristic score
  const sortedRepos = useMemo(() => {
    return [...topRepos].sort((a, b) => {
      const aDone = analyses[a.id]?.status === "done";
      const bDone = analyses[b.id]?.status === "done";
      if (aDone && bDone) {
        return (analyses[b.id] as { data: UnicornAnalysis }).data.unicornScore
          - (analyses[a.id] as { data: UnicornAnalysis }).data.unicornScore;
      }
      if (aDone) return -1;
      if (bDone) return 1;
      return b.score - a.score;
    });
  }, [topRepos, analyses]);

  const doneCount = topRepos.filter((r) => analyses[r.id]?.status === "done").length;
  const pendingCount = topRepos.filter((r) => analyses[r.id]?.status === "pending").length;

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
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
              // top monetizable repos
            </h2>
            <p className="mt-1 text-xs font-mono text-muted-foreground/70">
              {doneCount > 0
                ? `ranked by AI unicorn score · ${doneCount}/${topRepos.length} analyzed`
                : "heuristic pre-ranking · run AI for unicorn verdicts"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {batchRunning && (
              <span className="font-mono text-xs text-muted-foreground">
                <Loader2 className="mr-1 inline size-3 animate-spin" />
                {doneCount}/{topRepos.length} · {pendingCount} in flight
              </span>
            )}
            {topRepos.length > 0 && (
              <Button
                size="sm"
                onClick={runAll}
                disabled={batchRunning}
                className="h-8 gap-1.5 font-mono text-xs"
              >
                <Zap className="size-3.5" />
                {doneCount === 0 ? "analyze all" : doneCount === topRepos.length ? "re-analyze all" : `analyze remaining (${topRepos.length - doneCount})`}
              </Button>
            )}
          </div>
        </div>

        {reposQ.isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card/40 py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              raiding the graveyard…
            </p>
          </div>
        ) : sortedRepos.length > 0 ? (
          <div className="grid gap-3">
            {sortedRepos.map((repo, i) => (
              <RepoRow
                key={repo.id}
                repo={repo}
                rank={i + 1}
                state={analyses[repo.id] ?? { status: "idle" }}
                onAnalyze={() => runOne(repo)}
                disabled={batchRunning}
              />
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

function RepoRow({
  repo,
  rank,
  state,
  onAnalyze,
  disabled,
}: {
  repo: ScoredRepo;
  rank: number;
  state: AnalysisState;
  onAnalyze: () => void;
  disabled: boolean;
}) {
  const done = state.status === "done" ? state.data : null;
  const pending = state.status === "pending";

  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 backdrop-blur transition-all hover:border-primary/50">
      <div className="flex items-start gap-4">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold ${
          done && done.unicornScore >= 70 ? "bg-primary/20 text-primary"
          : done && done.unicornScore >= 40 ? "bg-accent/20 text-accent"
          : "bg-primary/10 text-primary"
        }`}>
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
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant={done ? "outline" : "default"}
              onClick={onAnalyze}
              disabled={pending || disabled}
              className="h-7 gap-1.5 font-mono text-xs"
            >
              {pending ? (
                <><Loader2 className="size-3 animate-spin" /> analyzing…</>
              ) : done ? (
                <><Zap className="size-3" /> re-analyze</>
              ) : (
                <><Zap className="size-3" /> analyze with AI</>
              )}
            </Button>
            {state.status === "error" && (
              <span className="font-mono text-xs text-destructive">{state.message}</span>
            )}
          </div>
          {done && <AnalysisPanel a={done} />}
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
