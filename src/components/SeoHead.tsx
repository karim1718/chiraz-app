import { Helmet } from 'react-helmet-async';

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') || '';

interface SeoHeadProps {
  title: string;
  description?: string;
  image?: string;
  path?: string;
  type?: 'website' | 'product';
}

export default function SeoHead({
  title,
  description,
  image,
  path = '',
  type = 'website',
}: SeoHeadProps) {
  const canonical = SITE_URL ? `${SITE_URL}${path}` : undefined;
  const ogImage = image || (SITE_URL ? `${SITE_URL}/photos/hero-poster.jpg` : '/photos/hero-poster.jpg');

  return (
    <Helmet>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      <meta property="og:title" content={title} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:image" content={ogImage} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      <meta property="og:type" content={type === 'product' ? 'product' : 'website'} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <meta name="twitter:image" content={ogImage} />
      {canonical ? <link rel="canonical" href={canonical} /> : null}
    </Helmet>
  );
}
