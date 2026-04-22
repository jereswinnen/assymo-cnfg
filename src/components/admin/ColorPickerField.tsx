'use client';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  presets?: readonly string[];
}

const DEFAULT_PRESETS = [
  '#0f172a',
  '#1f2937',
  '#0ea5e9',
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#9333ea',
  '#64748b',
  '#ffffff',
] as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function normaliseHex(input: string): string | null {
  const trimmed = input.trim().replace(/^#?/, '#');
  return HEX_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function ColorPickerField({
  label,
  value,
  onChange,
  presets = DEFAULT_PRESETS,
}: Props) {
  const [hexDraft, setHexDraft] = useState(value);
  const [open, setOpen] = useState(false);

  function commitHex(raw: string) {
    const normalised = normaliseHex(raw);
    if (normalised) {
      onChange(normalised);
      setHexDraft(normalised);
    } else {
      setHexDraft(value);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs hover:bg-muted/40 transition-colors"
          >
            <span
              className="h-5 w-5 rounded border border-input/60"
              style={{ backgroundColor: value }}
            />
            <span className="font-mono text-xs text-muted-foreground">{value}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 space-y-3">
          <div className="grid grid-cols-5 gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                aria-label={p}
                onClick={() => {
                  onChange(p);
                  setHexDraft(p);
                  setOpen(false);
                }}
                className={`h-7 w-full rounded border transition-all hover:scale-105 ${value.toLowerCase() === p.toLowerCase() ? 'ring-2 ring-foreground ring-offset-1' : 'border-input/60'}`}
                style={{ backgroundColor: p }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setHexDraft(e.target.value);
              }}
              className="h-8 w-8 cursor-pointer rounded border border-input bg-transparent p-0"
              aria-label={label}
            />
            <Input
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={(e) => commitHex(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitHex(hexDraft);
                }
              }}
              placeholder="#000000"
              className="h-8 font-mono text-xs"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
