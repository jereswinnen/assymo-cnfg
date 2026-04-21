import { BrandedShell } from '@/components/shop/BrandedShell';
import ConfiguratorClient from '@/components/canvas/ConfiguratorClient';

export default function Home() {
  return (
    <BrandedShell variant="configurator">
      <ConfiguratorClient />
    </BrandedShell>
  );
}
