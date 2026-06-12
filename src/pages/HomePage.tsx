import { lazy, Suspense } from 'react';
import HeroBanner from '../components/hero/HeroBanner';
import CollectionsSection from '../components/CollectionsSection';

const ProductCarousel = lazy(() => import('../components/ProductCarousel'));
const MaterialFeature = lazy(() => import('../components/MaterialFeature'));
const TestimonialsSection = lazy(() => import('../components/TestimonialsSection'));

function SectionFallback() {
  return <div className="w-full h-48 animate-pulse bg-white/5" aria-hidden />;
}

export default function HomePage() {
  return (
    <>
      <HeroBanner />
      <CollectionsSection />
      <Suspense fallback={<SectionFallback />}>
        <ProductCarousel />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <MaterialFeature />
      </Suspense>
      <Suspense fallback={<SectionFallback />}>
        <TestimonialsSection />
      </Suspense>
    </>
  );
}
