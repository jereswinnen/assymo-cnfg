import { Label } from '@/components/ui/label';

interface SectionLabelProps {
  children: React.ReactNode;
}

export default function SectionLabel({ children }: SectionLabelProps) {
  return (
    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
      {children}
    </Label>
  );
}
