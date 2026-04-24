import './globals.css';

export const metadata = {
  title: 'GOAT UGC AI — Content studio for apps & agencies',
  description:
    'SaaS AI content studio. Generate images, videos, lipsync and cinematic assets for your app or agency using fal.ai, muapi.ai or your own local models. Open-source, self-hostable, cloud-ready.',
  keywords: [
    'AI content generation',
    'UGC AI',
    'SaaS content studio',
    'agency creative tools',
    'fal.ai',
    'local AI models',
    'Higgsfield alternative',
  ],
  openGraph: {
    title: 'GOAT UGC AI — Content studio for apps & agencies',
    description:
      'Open-source SaaS AI studio. Cloud-ready on Vercel, local-ready on your own GPU.',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
