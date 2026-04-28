"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PriceBook } from "@/domain/pricing";
import { t } from "@/lib/i18n";

interface Props {
  tenantId: string;
  initialPoort: PriceBook["poort"];
}

export function PoortDialsSection({ tenantId, initialPoort }: Props) {
  const [v, setV] = useState(initialPoort);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof PriceBook["poort"]>(
    k: K,
    val: PriceBook["poort"][K],
  ) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/tenants/${tenantId}/price-book`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poort: v }),
    });
    setBusy(false);
    if (res.ok) setMsg(t("admin.tenant.saved"));
    else {
      const data = await res.json().catch(() => ({}));
      setMsg(t("admin.tenant.saveError", { error: data.error ?? res.status }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.tenant.section.priceBookPoort")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label={t("admin.priceBook.poort.perLeafBase")}>
          <NumberInput
            value={v.perLeafBase}
            onChange={(n) => set("perLeafBase", n)}
            suffix="€"
          />
        </Field>
        <Field label={t("admin.priceBook.poort.motorSurcharge")}>
          <NumberInput
            value={v.motorSurcharge}
            onChange={(n) => set("motorSurcharge", n)}
            suffix="€"
          />
        </Field>
        <Field label={t("admin.priceBook.poort.slidingSurcharge")}>
          <NumberInput
            value={v.slidingSurcharge}
            onChange={(n) => set("slidingSurcharge", n)}
            suffix="€"
          />
        </Field>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>
            {t("admin.tenant.save")}
          </Button>
          {msg && <span className="text-sm text-neutral-600">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  suffix,
}: {
  value: number;
  onChange: (n: number) => void;
  suffix: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        step="1"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
      <span className="text-sm text-muted-foreground">{suffix}</span>
    </div>
  );
}
