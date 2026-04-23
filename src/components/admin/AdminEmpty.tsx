import type { LucideIcon } from 'lucide-react';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional action — typically a `<Button>` (Link CTA) or a dialog trigger. */
  action?: React.ReactNode;
}

/** Consistent empty-state wrapper for admin list pages. Composes
 *  shadcn `Empty` primitives so page-level layouts stay declarative.
 *  Self-centers in the admin main area: the Empty's inherent
 *  `justify-center items-center` centers content once it claims the
 *  full visible content viewport (100dvh minus the `h-16` header and
 *  the layout's `p-4` padding ≈ 8rem). Inline style avoids Tailwind
 *  arbitrary-value escaping pitfalls inside `calc()`. */
export function AdminEmpty({ icon: Icon, title, description, action }: Props) {
  return (
    <Empty style={{ minHeight: 'calc(100dvh - 8rem)' }}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
