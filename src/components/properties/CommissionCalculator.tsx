import { useMemo, useState } from "react";
import { Calculator, TrendingUp, Database } from "lucide-react";
import { PageCard } from "@/components/common/PageCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fmtMoney } from "@/data/mock";

type Tier = { downPct: number; commissionPct: number };

// Commission policy by model. Source of truth (mirrors current business rules).
// Designed to be replaced by a backend-driven config per model.
const COMMISSION_POLICY: Record<string, Tier[]> = {
  NARDO: [
    { downPct: 10, commissionPct: 3 },
    { downPct: 30, commissionPct: 3.5 },
    { downPct: 50, commissionPct: 4 },
    { downPct: 90, commissionPct: 4.5 },
  ],
  BUGAMBILIA: [
    { downPct: 10, commissionPct: 3 },
    { downPct: 30, commissionPct: 3.5 },
    { downPct: 50, commissionPct: 4 },
    { downPct: 90, commissionPct: 4.5 },
  ],
  JAZMIN: [
    { downPct: 20, commissionPct: 3 },
    { downPct: 50, commissionPct: 4 },
    { downPct: 90, commissionPct: 4.5 },
  ],
  MAGNOLIA: [
    { downPct: 30, commissionPct: 3 },
    { downPct: 50, commissionPct: 4 },
    { downPct: 90, commissionPct: 4.5 },
  ],
};

function normalizeModelKey(model: string | null | undefined): string | null {
  if (!model) return null;
  const upper = model
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  if (upper.includes("NARDO")) return "NARDO";
  if (upper.includes("BUGAMBILIA")) return "BUGAMBILIA";
  if (upper.includes("JAZMIN")) return "JAZMIN";
  if (upper.includes("MAGNOLIA")) return "MAGNOLIA";
  return null;
}

function resolveTier(tiers: Tier[], inputPct: number): Tier | null {
  if (!tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => a.downPct - b.downPct);
  if (inputPct < sorted[0].downPct) return null;
  // closest LOWER (or equal) tier
  let chosen: Tier = sorted[0];
  for (const t of sorted) {
    if (inputPct >= t.downPct) chosen = t;
  }
  return chosen;
}

export function CommissionCalculator({
  model,
  price,
}: {
  model: string | null | undefined;
  price: number;
}) {
  const modelKey = normalizeModelKey(model);
  const tiers = modelKey ? COMMISSION_POLICY[modelKey] : null;
  const [pctInput, setPctInput] = useState<string>("");

  const pct = useMemo(() => {
    const n = parseFloat(pctInput.replace(",", "."));
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(100, n));
  }, [pctInput]);

  const tier = useMemo(() => {
    if (!tiers || pct === null) return null;
    return resolveTier(tiers, pct);
  }, [tiers, pct]);

  const enganche = pct !== null ? (price * pct) / 100 : 0;
  const saldo = pct !== null ? price - enganche : price;
  const comisionMxn = tier ? (price * tier.commissionPct) / 100 : 0;

  return (
    <PageCard
      title="Calculadora de Comisión"
      description="Calcula tu comisión según el modelo y el enganche"
      action={
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Database className="h-3 w-3" /> Reglas por modelo
        </span>
      }
    >
      {!modelKey || !tiers ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          No hay política de comisión configurada para este modelo
          {model ? ` (“${model}”)` : ""}. Define el modelo de la propiedad para
          calcular comisiones.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calculator className="h-3.5 w-3.5" />
            Modelo:{" "}
            <span className="font-medium text-foreground">{modelKey}</span>
          </div>

          {/* Quick tier buttons */}
          <div>
            <Label className="text-xs text-muted-foreground">
              Enganches sugeridos
            </Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {tiers.map((t) => {
                const active = pct !== null && pct === t.downPct;
                return (
                  <Button
                    key={t.downPct}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    onClick={() => setPctInput(String(t.downPct))}
                    className="h-8"
                  >
                    {t.downPct}% · {t.commissionPct}%
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Custom input */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-1">
              <Label htmlFor="enganche-pct" className="text-xs">
                Enganche (%)
              </Label>
              <Input
                id="enganche-pct"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.1"
                placeholder="Ej. 30"
                value={pctInput}
                onChange={(e) => setPctInput(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2 text-xs text-muted-foreground">
              Si ingresas un porcentaje intermedio, se usará el escalón
              inferior más cercano.
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <ResultCell label="Enganche" value={fmtMoney(enganche)} />
            <ResultCell label="Saldo restante" value={fmtMoney(saldo)} />
            <ResultCell
              label="Comisión"
              value={tier ? `${tier.commissionPct}%` : "—"}
            />
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Comisión MXN
              </div>
              <div className="mt-0.5 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {tier ? fmtMoney(comisionMxn) : "—"}
              </div>
            </div>
          </div>

          {pct !== null && !tier && (
            <p className="text-xs text-muted-foreground">
              El porcentaje ingresado es menor al mínimo requerido (
              {tiers[0].downPct}%) para este modelo.
            </p>
          )}
        </div>
      )}
    </PageCard>
  );
}

function ResultCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium tabular-nums">{value}</div>
    </div>
  );
}
