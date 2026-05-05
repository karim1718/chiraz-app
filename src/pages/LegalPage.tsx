import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function LegalPage() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="pt-28 pb-24 px-6 max-w-3xl mx-auto font-sans text-[#E4E1D5]/90 leading-relaxed"
    >
      <h1 className="font-serif text-3xl md:text-4xl text-[#E4E1D5] mb-8">{t('legal.title')}</h1>
      <p className="text-sm text-[#E4E1D5]/60 mb-12">{t('legal.updated')}</p>
      <div className="space-y-8">
        <section>
          <h2 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('legal.editor')}</h2>
          <p>{t('legal.editorBody')}</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('legal.hosting')}</h2>
          <p>{t('legal.hostingBody')}</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('legal.ip')}</h2>
          <p>{t('legal.ipBody')}</p>
        </section>
        <section>
          <h2 className="font-serif text-xl text-[#E4E1D5] mb-4">{t('legal.contact')}</h2>
          <p>{t('legal.contactBody')}</p>
        </section>
      </div>
    </motion.div>
  );
}
