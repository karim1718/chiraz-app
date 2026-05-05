import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Clés EmailJS : tableau EmailJS → Integration / Account → Public Key,
 * Email Services → Service ID, Email Templates → Template ID.
 * À définir dans `.env` (voir `.env.example`). Ne pas commiter `.env`.
 */
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

function isEmailJsConfigured(): boolean {
  return Boolean(
    EMAILJS_SERVICE_ID?.trim() &&
      EMAILJS_TEMPLATE_ID?.trim() &&
      EMAILJS_PUBLIC_KEY?.trim() &&
      !EMAILJS_SERVICE_ID.includes('YOUR_'),
  );
}

const WHATSAPP_NUMBER = '21620780741';

export default function ContactPage() {
  const { t, i18n } = useTranslation();
  const subjects = useMemo(
    () => (t('contact.subjects', { returnObjects: true }) as string[]) || [],
    [t, i18n.language],
  );
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSent(false);

    if (!isEmailJsConfigured()) {
      setErrorMsg(t('contact.emailDisabled'));
      setLoading(false);
      return;
    }

    try {
      const emailjs = (await import('emailjs-com')).default;

      await emailjs.send(
        EMAILJS_SERVICE_ID!,
        EMAILJS_TEMPLATE_ID!,
        {
          from_name: form.name,
          from_email: form.email,
          reply_to: form.email,
          subject: form.subject,
          message: form.message,
        },
        EMAILJS_PUBLIC_KEY!,
      );

      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err: unknown) {
      console.error(err);
      const text =
        err && typeof err === 'object' && 'text' in err && typeof (err as { text?: string }).text === 'string'
          ? (err as { text: string }).text
          : err instanceof Error
            ? err.message
            : String(err);

      let hint = t('contact.sendFailed');

      if (/403|blocked|origin|domain/i.test(text)) {
        hint +=
          ' Sur EmailJS : Account → Authorized domains : ajoutez localhost et votre domaine de production.';
      }
      if (/401|invalid.*user|public.*key/i.test(text)) {
        hint += ' Vérifiez VITE_EMAILJS_PUBLIC_KEY (clé publique du compte EmailJS).';
      }

      setErrorMsg(`${text ? `${text}. ` : ''}${hint}`);
    } finally {
      setLoading(false);
    }
  };

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER.replace(/\+/g, '')}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="pt-28 pb-24 px-4 sm:px-6 max-w-4xl mx-auto"
    >
      <div className="text-center mb-16">
        <h1 className="font-serif text-4xl md:text-5xl text-[#E4E1D5] mb-4">{t('contact.title')}</h1>
        <p className="text-[#E4E1D5]/70 text-lg max-w-xl mx-auto">
          {t('contact.lead')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="contact-name" className="block text-sm text-[#E4E1D5]/80 mb-2">
                  {t('contact.name')}
                </label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#E4E1D5]/20 rounded text-[#E4E1D5] focus:outline-none focus:border-[#E4E1D5]/50"
                  placeholder={t('contact.placeholderName')}
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm text-[#E4E1D5]/80 mb-2">
                  {t('contact.email')}
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#E4E1D5]/20 rounded text-[#E4E1D5] focus:outline-none focus:border-[#E4E1D5]/50"
                  placeholder={t('contact.placeholderEmail')}
                />
              </div>
            </div>
            <div>
              <label htmlFor="contact-subject" className="block text-sm text-[#E4E1D5]/80 mb-2">
                {t('contact.subject')}
              </label>
              <select
                id="contact-subject"
                required
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#E4E1D5]/20 rounded text-[#E4E1D5] focus:outline-none focus:border-[#E4E1D5]/50"
              >
                <option value="">{t('contact.chooseSubject')}</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="contact-message" className="block text-sm text-[#E4E1D5]/80 mb-2">
                {t('contact.message')}
              </label>
              <textarea
                id="contact-message"
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-[#E4E1D5]/20 rounded text-[#E4E1D5] focus:outline-none focus:border-[#E4E1D5]/50 resize-none"
                placeholder={t('contact.placeholderMessage')}
              />
            </div>

            {errorMsg ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200/95">
                {errorMsg}
              </div>
            ) : null}

            {sent ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {t('contact.sent')}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#E4E1D5] text-[#0a0a0a] font-medium rounded hover:bg-[#0a0a0a] hover:text-[#E4E1D5] hover:border hover:border-[#E4E1D5]/50 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? <Loader2 size={22} className="animate-spin" /> : null}
              {loading ? t('contact.sending') : t('contact.send')}
            </button>
          </form>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-8"
        >
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full min-h-[56px] py-4 bg-[#25D366] text-white font-medium rounded-lg hover:bg-[#20BD5A] transition-colors"
          >
            <MessageCircle size={24} />
            {t('contact.waCta')}
          </a>
          <div className="text-[#E4E1D5]/80 text-sm space-y-4">
            <p>
              <span className="text-[#E4E1D5]/50 block text-xs uppercase tracking-wider mb-1">{t('common.address')}</span>
              {t('contact.addressLine')}
            </p>
            <p>
              <span className="text-[#E4E1D5]/50 block text-xs uppercase tracking-wider mb-1">{t('contact.email')}</span>
              contact@chiraz.tn
            </p>
            <p>
              <span className="text-[#E4E1D5]/50 block text-xs uppercase tracking-wider mb-1">{t('common.phone')}</span>
              216 20 78 07 41
            </p>
          </div>
        </motion.aside>
      </div>
    </motion.div>
  );
}
