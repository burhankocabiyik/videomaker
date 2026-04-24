import { redirect } from 'next/navigation';
import StandaloneShell from '@/components/StandaloneShell';
import { providerSummary } from '@/lib/providers/config.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Studio — GOAT UGC AI',
};

export default function StudioPage() {
  const { provider, serverKeyConfigured } = providerSummary();

  // The full Open Generative AI studio is wired to Muapi.ai. On cloud
  // deployments where AI_PROVIDER=fal (and no shared Muapi key exists) we
  // don't want to confront visitors with a Muapi API key modal — send them
  // to the provider-abstracted /create surface instead.
  if (provider !== 'muapi' && !serverKeyConfigured) {
    redirect('/create');
  }

  return <StandaloneShell />;
}
