'use client';

interface ColorSwatchesProps {
  colors: { id: string; label: string; hex: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function ColorSwatches({ colors, selectedId, onSelect }: ColorSwatchesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          title={c.label}
          className={`h-8 w-8 rounded-full border-2 transition-all ${
            selectedId === c.id
              ? 'border-primary ring-2 ring-ring/30 scale-110'
              : 'border-border hover:border-primary/40'
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}
