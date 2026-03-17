export const dynamic = 'force-dynamic';

import { PageHeader } from '@/components/PageHeader';
import { getFeatureFlags, getPricingConfig } from '@/lib/queries/config';
import { ConfigClient } from './config-client';

export default async function ConfigPage() {
  const [flags, pricing] = await Promise.all([
    getFeatureFlags(),
    getPricingConfig(),
  ]);

  return (
    <div>
      <PageHeader
        title="Config"
        description="Feature flags and pricing configuration"
      />
      <ConfigClient flags={flags} pricing={pricing} />
    </div>
  );
}
