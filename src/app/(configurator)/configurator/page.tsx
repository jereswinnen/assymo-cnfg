import { BrandedShell } from '@/components/shop/BrandedShell';
import ConfiguratorClient from '@/components/canvas/ConfiguratorClient';
import ConfiguratorHeaderActions from '@/components/ui/ConfiguratorHeaderActions';

export default function Home() {
  return (
    <BrandedShell variant="configurator" headerRight={<ConfiguratorHeaderActions />}>
      <ConfiguratorClient />
    </BrandedShell>
  );
}
