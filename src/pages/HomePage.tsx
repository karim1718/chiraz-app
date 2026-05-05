import HeroBanner from '../components/HeroBanner';
import CollectionsSection from '../components/CollectionsSection';
import ProductCarousel from '../components/ProductCarousel';
import MaterialFeature from '../components/MaterialFeature';
import TestimonialsSection from '../components/TestimonialsSection';

export default function HomePage() {
  return (
    <>
      <HeroBanner />
      <CollectionsSection />
      <ProductCarousel />
      <MaterialFeature />
      <TestimonialsSection />
    </>
  );
}
