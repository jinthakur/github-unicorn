import { useState } from "react";
import { MessageCircle, Loader2, Gavel, UserPlus, Pencil, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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

export function FloatingChat({ repo, analysis, gtm, extraVerdicts, onAddVerdict, onRevisedGtm }: Props) {
  const [open, setOpen] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // custom persona form
  const [customName, setCustomName] = useState("");
  const [customCtx, setCustomCtx] = useState("");

  // gtm revision
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full p-0 shadow-lg shadow-primary/30"
          aria-label="Open interactive panel"
        >
          <MessageCircle className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-mono">// interact</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            Stress-test with another judge, add a custom VC twin, or revise the GTM plan.
          </SheetDescription>
        </SheetHeader>

        {error && (
          <div className="mt-3 rounded border border-destructive/50 bg-destructive/10 p-2 font-mono text-xs text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="judges" className="mt-4">
          <TabsList className="grid w-full grid-cols-3 font-mono text-xs">
            <TabsTrigger value="judges"><Gavel className="mr-1 size-3" /> Judges</TabsTrigger>
            <TabsTrigger value="custom"><UserPlus className="mr-1 size-3" /> Add VC</TabsTrigger>
            <TabsTrigger value="gtm"><Pencil className="mr-1 size-3" /> GTM</TabsTrigger>
          </TabsList>

          {/* JUDGES TAB */}
          <TabsContent value="judges" className="mt-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              // pick a judge to stress-test this repo
            </p>
            <ul className="space-y-2">
              {PERSONAS.map((p) => {
                const isRunning = runningId === p.id;
                const alreadyRan = [...usedIds].some((id) => id.startsWith(p.id));
                return (
                  <li key={p.id} className="rounded border border-border bg-card/40 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold">{p.name}</p>
                        <p className="truncate font-mono text-[10px] text-muted-foreground">{p.firm}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{p.style}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={alreadyRan ? "outline" : "default"}
                        disabled={runningId !== null}
                        onClick={() => runPersona(p)}
                        className="shrink-0 font-mono text-xs"
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
          <TabsContent value="custom" className="mt-4 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              // create a custom VC twin
            </p>
            <div>
              <label className="font-mono text-xs text-muted-foreground">Name</label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value.slice(0, 120))}
                placeholder="e.g. Naval Ravikant"
                className="mt-1 font-mono text-sm"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-muted-foreground">
                LinkedIn URL or 1-line persona (optional)
              </label>
              <Textarea
                value={customCtx}
                onChange={(e) => setCustomCtx(e.target.value.slice(0, 600))}
                placeholder="e.g. https://linkedin.com/in/navalravikant — first-principles solo capitalist, judges by leverage & taste"
                className="mt-1 min-h-20 font-mono text-xs"
              />
            </div>
            <Button
              onClick={runCustom}
              disabled={!customName.trim() || runningId !== null}
              className="w-full font-mono text-xs"
            >
              {runningId?.startsWith("custom") ? (
                <><Loader2 className="mr-1.5 size-3 animate-spin" /> running stress test…</>
              ) : (
                <>Run stress test as {customName.trim() || "..."}</>
              )}
            </Button>
          </TabsContent>

          {/* GTM TAB */}
          <TabsContent value="gtm" className="mt-4 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              // revise the GTM plan in plain english
            </p>
            <Textarea
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value.slice(0, 1000))}
              placeholder={`e.g. switch to bottoms-up PLG, $0 free tier + $20/seat, drop enterprise outbound from the 30-day plan`}
              className="min-h-32 font-mono text-xs"
            />
            <Button
              onClick={reviseGtm}
              disabled={!revisionNote.trim() || revising}
              className="w-full font-mono text-xs"
            >
              {revising ? (
                <><Loader2 className="mr-1.5 size-3 animate-spin" /> reworking GTM…</>
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
          <div className="mt-6 border-t border-border pt-4">
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
                  <button
                    onClick={() => setOpen(false)}
                    className="text-muted-foreground hover:text-primary"
                    aria-label="View on memo"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
