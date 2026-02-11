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
              ? 'border-blue-600 ring-2 ring-blue-200 scale-110'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          style={{ backgroundColor: c.hex }}
        />
      ))}
    </div>
  );
}
