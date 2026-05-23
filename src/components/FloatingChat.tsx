import { useState } from "react";
import { Loader2, Gavel, UserPlus, Pencil, RotateCcw, PanelLeftClose, PanelLeftOpen, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PERSONAS, buildCustomPersonaPrompt, type Persona } from "@/lib/personas";
import { judgeRepo, type VcVerdict } from "@/lib/judge.functions";
import { generateGtm, type GtmPlan } from "@/lib/gtm.functions";
import type { UnicornAnalysis } from "@/lib/analyze.functions";

export type ExtraVerdict = {
  id: string;
  personaName: string;
  personaStyle: string;
  verdict: VcVerdict;
};

type Props = {
  repo: {
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    stars: number;
    daysSincePush: number;
    forks: number;
    topics?: string[];
  };
  analysis: UnicornAnalysis;
  gtm: GtmPlan;
  extraVerdicts: ExtraVerdict[];
  onAddVerdict: (v: ExtraVerdict) => void;
  onRevisedGtm: (g: GtmPlan, note: string) => void;
};

/* ────────────────────────────────────────────────────────────────
   Shared inner panel: the actual forms + tabs
   ─────────────────────────────────────────────────────────────── */
function ChatPanel({
  repo, analysis, gtm, extraVerdicts, onAddVerdict, onRevisedGtm,
}: Props & { onClose?: () => void }) {
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customCtx, setCustomCtx] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [revising, setRevising] = useState(false);

  const usedIds = new Set(extraVerdicts.map((v) => v.id));

  const runJudge = async (id: string, name: string, style: string, systemPrompt: string) => {
    setRunningId(id);
    setError(null);
    try {
      const verdict = await judgeRepo({
        data: {
          repo: { name: repo.name, owner: repo.owner, description: repo.description, language: repo.language, stars: repo.stars, daysSincePush: repo.daysSincePush },
          analysis,
          gtm: {
            positioning: gtm.positioning, pricing: gtm.pricing, icp: gtm.icp,
            competitors: gtm.competitors.map((c) => ({ name: c.name, domain: c.domain, angle: c.angle })),
            thirtyDay: gtm.thirtyDay, sixtyDay: gtm.sixtyDay, ninetyDay: gtm.ninetyDay,
          },
          persona: { name, systemPrompt },
        },
      });
      onAddVerdict({ id: `${id}-${Date.now()}`, personaName: name, personaStyle: style, verdict });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run judge");
    } finally {
      setRunningId(null);
    }
  };

  const runPersona = (p: Persona) => runJudge(p.id, p.name, p.style, p.systemPrompt);

  const runCustom = async () => {
    if (!customName.trim()) return;
    const ctx = customCtx.trim();
    await runJudge(
      `custom-${Date.now()}`,
      customName.trim(),
      ctx ? ctx.slice(0, 60) : "Custom VC twin",
      buildCustomPersonaPrompt(customName.trim(), ctx),
    );
    setCustomName("");
    setCustomCtx("");
  };

  const reviseGtm = async () => {
    if (!revisionNote.trim()) return;
    setRevising(true);
    setError(null);
    try {
      const newGtm = await generateGtm({
        data: {
          repo: { name: repo.name, description: repo.description, language: repo.language, topics: repo.topics ?? [], owner: repo.owner },
          revisionNote: revisionNote.trim(),
        },
      });
      onRevisedGtm(newGtm, revisionNote.trim());
      setRevisionNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revise GTM");
    } finally {
      setRevising(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div>
          <h3 className="font-mono text-sm font-semibold">// interact</h3>
          <p className="font-mono text-[10px] text-muted-foreground">
            Stress-test, add judges, or revise GTM.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <div className="mb-3 rounded border border-destructive/50 bg-destructive/10 p-2 font-mono text-xs text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="judges" className="mt-1">
          <TabsList className="grid w-full grid-cols-3 font-mono text-[10px]">
            <TabsTrigger value="judges"><Gavel className="mr-1 size-3" /> Judges</TabsTrigger>
            <TabsTrigger value="custom"><UserPlus className="mr-1 size-3" /> Add VC</TabsTrigger>
            <TabsTrigger value="gtm"><Pencil className="mr-1 size-3" /> GTM</TabsTrigger>
          </TabsList>

          {/* JUDGES TAB */}
          <TabsContent value="judges" className="mt-3 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              // pick a judge to stress-test this repo
            </p>
            <ul className="space-y-2">
              {PERSONAS.map((p) => {
                const isRunning = runningId === p.id;
                const alreadyRan = [...usedIds].some((id) => id.startsWith(p.id));
                return (
                  <li key={p.id} className="rounded border border-border bg-card/40 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-1">
                        <p className="truncate font-mono text-sm font-semibold">{p.name}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">{p.firm}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{p.style}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={alreadyRan ? "outline" : "default"}
                        disabled={runningId !== null}
                        onClick={() => runPersona(p)}
                        className="shrink-1 font-mono text-[10px] px-2 h-7"
                      >
                        {isRunning ? <Loader2 className="size-3 animate-spin" /> : alreadyRan ? "re-run" : "run"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </TabsContent>

          {/* CUSTOM TAB */}
          <TabsContent value="custom" className="mt-3 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              // create a custom VC twin
            </p>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground">Name</label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value.slice(0, 120))}
                placeholder="e.g. Naval Ravikant"
                className="mt-1 font-mono text-sm h-8"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground">
                LinkedIn URL or 1-line persona (optional)
              </label>
              <Textarea
                value={customCtx}
                onChange={(e) => setCustomCtx(e.target.value.slice(0, 600))}
                placeholder="e.g. https://linkedin.com/in/navalravikant — first-principles solo capitalist, judges by leverage & taste"
                className="mt-1 min-h-16 font-mono text-xs"
              />
            </div>
            <Button
              onClick={runCustom}
              disabled={!customName.trim() || runningId !== null}
              className="w-full font-mono text-xs"
              size="sm"
            >
              {runningId?.startsWith("custom") ? (
                <><Loader2 className="mr-1.5 size-3 animate-spin" /> running…</>
              ) : (
                <>Run stress test as {customName.trim() || "…"}</>
              )}
            </Button>
          </TabsContent>

          {/* GTM TAB */}
          <TabsContent value="gtm" className="mt-3 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              // revise the GTM plan in plain english
            </p>
            <Textarea
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value.slice(0, 1000))}
              placeholder={`e.g. switch to bottoms-up PLG, $0 free tier + $20/seat, drop enterprise outbound from the 30-day plan`}
              className="min-h-24 font-mono text-xs"
            />
            <Button
              onClick={reviseGtm}
              disabled={!revisionNote.trim() || revising}
              className="w-full font-mono text-xs"
              size="sm"
            >
              {revising ? (
                <><Loader2 className="mr-1.5 size-3 animate-spin" /> reworking…</>
              ) : (
                <><RotateCcw className="mr-1.5 size-3" /> rework GTM plan</>
              )}
            </Button>
            <p className="font-mono text-[10px] text-muted-foreground">
              The current GTM card on the memo will be replaced. You can revert from the memo.
            </p>
          </TabsContent>
        </Tabs>

        {extraVerdicts.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              // judges run this session ({extraVerdicts.length})
            </p>
            <ul className="mt-2 space-y-1">
              {extraVerdicts.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 font-mono text-xs">
                  <span className="truncate">
                    <span className="text-foreground">{v.personaName}</span>
                    <span className="ml-1.5 text-muted-foreground">
                      {v.verdict.recommendation.replace("_", " ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
   FloatingChat: desktop sidebar + mobile overlay
   ─────────────────────────────────────────────────────────────── */
export function FloatingChat(props: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop: persistent sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-l border-border/50 bg-card/20 transition-all duration-300 ${
          collapsed ? "w-12" : "w-80 xl:w-96"
        }`}
        style={{ height: "calc(100vh - 2rem)" }}
      >
        {collapsed ? (
          <div className="flex h-full flex-col items-center py-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setCollapsed(false)}
              aria-label="Expand panel"
              className="mb-2"
            >
              <PanelLeftOpen className="size-5" />
            </Button>
            <div className="mt-2 flex flex-col items-center gap-1">
              <Gavel className="size-4 text-muted-foreground" />
              {props.extraVerdicts.length > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 font-mono text-[9px] text-primary-foreground">
                  {props.extraVerdicts.length}
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end border-b border-border/50 px-2 py-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse panel"
                className="h-7 w-7"
              >
                <PanelLeftClose className="size-4" />
              </Button>
            </div>
            <ChatPanel {...props} />
          </>
        )}
      </aside>

      {/* Always-visible floating launcher + full-screen overlay */}
      <div>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div>
                <h3 className="font-mono text-sm font-semibold">// interact</h3>
                <p className="font-mono text-[10px] text-muted-foreground">Stress-test, add judges, or revise GTM.</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setMobileOpen(false)} aria-label="Close panel">
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChatPanel {...props} onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <Button
          size="lg"
          className="fixed bottom-5 right-5 z-[100] h-12 rounded-full border border-primary/40 px-4 font-mono text-xs shadow-lg shadow-primary/30"
          aria-label={mobileOpen ? "Close interactive panel" : "Open interactive panel"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="mr-2 size-5" /> : <MessageCircle className="mr-2 size-5" />}
          {mobileOpen ? "close" : "interact"}
          {props.extraVerdicts.length > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[10px] font-bold text-foreground">
              {props.extraVerdicts.length}
            </span>
          )}
        </Button>
      </div>
    </>
  );
}
