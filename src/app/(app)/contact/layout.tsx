import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

// SEO denetimi 2026-10-10: /contact is a client page (no metadata of its own) that
// the public-site footer links to. Give it a real title, description and canonical.
export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with Football Analytics: questions about predictions, the model, your account or billing.',
  alternates: { canonical: `${SITE_URL}/contact` },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
