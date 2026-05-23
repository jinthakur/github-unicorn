// GitHub API client (unauthenticated for now — Step 5 wires PAT)
const GH = "https://api.github.com";

export type Repo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  language: string | null;
  topics: string[];
  pushed_at: string;
  created_at: string;
  archived: boolean;
  fork: boolean;
  size: number;
  default_branch: string;
};

export type UserProfile = {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  html_url: string;
};

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${GH}${path}`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error(`User not found`);
    if (res.status === 403) throw new Error(`GitHub rate limit hit — try again in a few minutes`);
    throw new Error(`GitHub error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchUser(username: string): Promise<UserProfile> {
  return gh<UserProfile>(`/users/${encodeURIComponent(username)}`);
}

export async function fetchRepos(username: string): Promise<Repo[]> {
  // Pull up to 100 most recently updated
  const repos = await gh<Repo[]>(
    `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`
  );
  return repos.filter((r) => !r.fork);
}

// Heuristic "monetization score" — lightweight pre-AI ranking so we can show
// something instantly. Step 3 will replace with Lovable AI scoring.
export type ScoredRepo = Repo & {
  score: number;
  signals: string[];
  daysSincePush: number;
};

export function scoreRepos(repos: Repo[]): ScoredRepo[] {
  const now = Date.now();
  return repos
    .map((r) => {
      const daysSincePush = Math.floor((now - new Date(r.pushed_at).getTime()) / 86400000);
      const signals: string[] = [];
      let score = 0;

      // Traction
      score += Math.min(r.stargazers_count, 500) * 0.15;
      if (r.stargazers_count >= 50) signals.push("traction");
      if (r.stargazers_count >= 500) signals.push("viral");

      // Forks = devs care enough to copy
      score += Math.min(r.forks_count, 200) * 0.3;
      if (r.forks_count >= 20) signals.push("forked");

      // Has description = somewhat polished
      if (r.description && r.description.length > 20) score += 5;

      // Topics = positioned for discovery
      score += r.topics.length * 1.5;
      if (r.topics.length >= 3) signals.push("positioned");

      // Recent activity bump (≤90d) — but graveyard repos still count
      if (daysSincePush <= 90) {
        score += 10;
        signals.push("active");
      } else if (daysSincePush >= 365) {
        signals.push("graveyard");
      }

      // Not archived
      if (r.archived) score -= 20;
      else score += 2;

      // Hot languages for monetization (rough heuristic)
      const hotLangs = ["TypeScript", "Python", "Rust", "Go", "Swift"];
      if (r.language && hotLangs.includes(r.language)) score += 3;

      return { ...r, score: Math.round(score * 10) / 10, signals, daysSincePush };
    })
    .sort((a, b) => b.score - a.score);
}
