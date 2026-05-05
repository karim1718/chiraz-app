import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const SECTIONS = [
  { id: 'conditions', titleKey: 'returns.s1h' as const },
  { id: 'delais', titleKey: 'returns.s2h' as const },
  { id: 'procedure', titleKey: 'returns.s3h' as const },
  { id: 'remboursements', titleKey: 'returns.s4h' as const },
  { id: 'exceptions', titleKey: 'returns.s5h' as const },
];

export default function ReturnsPage() {
  const { t } = useTranslation();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="pt-28 pb-24 px-4 sm:px-6 min-h-screen"
    >
      <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-12">
        <div className="lg:hidden mb-4">
          <label htmlFor="section-nav" className="sr-only">
            {t('returns.tocMobile')}
          </label>
          <select
            id="section-nav"
            className="w-full min-h-[48px] px-4 py-2 bg-[#1a1a1a] border border-[#E4E1D5]/20 rounded text-[#E4E1D5] text-base"
            onChange={(e) => {
              const id = e.target.value;
              if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <option value="">{t('returns.tocPlaceholder')}</option>
            {SECTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.titleKey)}
              </option>
            ))}
          </select>
        </div>
        <aside className="hidden lg:block lg:w-56 flex-shrink-0 order-2 lg:order-1">
          <nav className="lg:sticky lg:top-28">
            <h2 className="text-xs uppercase tracking-wider text-[#E4E1D5]/50 font-medium mb-4">
              {t('returns.tocSidebar')}
            </h2>
            <ul className="space-y-2">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-sm text-[#E4E1D5]/80 hover:text-[#E4E1D5] transition-colors"
                  >
                    {t(s.titleKey)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="flex-1 min-w-0 font-sans text-[#E4E1D5]/90 leading-relaxed">
          <h1 className="font-serif text-3xl md:text-4xl text-[#E4E1D5] mb-4">
            {t('returns.title')}
          </h1>
          <p className="text-[#E4E1D5]/60 text-sm mb-12">
            {t('returns.updated')}
          </p>

          <section id="conditions" className="scroll-mt-32 mb-12">
            <h2 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('returns.s1h')}</h2>
            <p className="mb-4">{t('returns.s1p1')}</p>
            <p>{t('returns.s1p2')}</p>
          </section>

          <section id="delais" className="scroll-mt-32 mb-12">
            <h2 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('returns.s2h')}</h2>
            <p>{t('returns.s2p')}</p>
          </section>

          <section id="procedure" className="scroll-mt-32 mb-12">
            <h2 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('returns.s3h')}</h2>
            <p className="mb-4">{t('returns.s3intro')}</p>
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li>{t('returns.s3li1')}</li>
              <li>{t('returns.s3li2')}</li>
              <li>{t('returns.s3li3')}</li>
              <li>{t('returns.s3li4')}</li>
            </ol>
            <p>{t('returns.s3p2')}</p>
          </section>

          <section id="remboursements" className="scroll-mt-32 mb-12">
            <h2 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('returns.s4h')}</h2>
            <p className="mb-4">{t('returns.s4p1')}</p>
            <p>{t('returns.s4p2')}</p>
          </section>

          <section id="exceptions" className="scroll-mt-32 mb-12">
            <h2 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('returns.s5h')}</h2>
            <p className="mb-4">{t('returns.s5p1')}</p>
            <p>{t('returns.s5p2')}</p>
          </section>

          <p className="text-sm text-[#E4E1D5]/60 mt-12">
            <Link to="/contact" className="text-[#E4E1D5]/80 hover:text-[#E4E1D5] underline">
              {t('returns.contactLink')}
            </Link>
          </p>
        </article>
      </div>
    </motion.div>
  );
}
