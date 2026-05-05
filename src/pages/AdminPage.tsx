import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdminPage() {
  const navigate = useNavigate();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkAdminSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;

      const role = session.user.app_metadata?.role;
      if (role === 'admin') {
        navigate('/admin/orders');
      }
    };

    void checkAdminSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setError('');
    setIsLoading(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: emailInput.trim(),
      password: passwordInput,
    });

    if (loginError) {
      setError(loginError.message);
      setIsLoading(false);
      return;
    }

    const role = data.user?.app_metadata?.role;
    if (role !== 'admin') {
      await supabase.auth.signOut();
      setError("Acces refuse: ce compte n'a pas le role admin.");
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    navigate('/admin/orders');
  };

  return (
    <div
      dir="ltr"
      lang="fr"
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-4"
    >
      <div className="absolute inset-0 bg-[#0a0a0a]" aria-hidden />
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#1a1522] to-[#0a0a0a]"
        aria-hidden
        animate={{
          opacity: [0.55, 0.85, 0.55],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute inset-0 bg-gradient-to-tr from-[#E4E1D5]/[0.07] via-transparent to-[#E4E1D5]/[0.04]"
        aria-hidden
        animate={{
          opacity: [0.35, 0.65, 0.35],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm rounded-2xl border border-[#E4E1D5]/10 bg-[#1a1a1a] p-8 shadow-2xl"
        onSubmit={handleLogin}
      >
   <div className="flex justify-center mb-3">
  <img
    src="/logo-Chiraz.png"
    alt="Chiraz"
    className="h-40 sm:h-48 md:h-56 w-auto object-contain filter invert"
  />
</div>
        <h1 className="mb-6 text-center font-serif text-3xl font-bold text-[#E4E1D5]">
          Connexion Admin
        </h1>

        <div className="space-y-3">
          <div>
            <input
              type="email"
              placeholder="Email admin"
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                setError('');
              }}
              className="w-full rounded-xl border border-[#E4E1D5]/20 bg-[#E4E1D5]/5 py-3 px-4 text-[#E4E1D5] placeholder:text-[#E4E1D5]/40 focus:border-[#E4E1D5] focus:outline-none"
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setError('');
              }}
              className="w-full rounded-xl border border-[#E4E1D5]/20 bg-[#E4E1D5]/5 py-3 pl-4 pr-12 text-[#E4E1D5] placeholder:text-[#E4E1D5]/40 focus:border-[#E4E1D5] focus:outline-none"
              required
              disabled={isLoading}
              autoComplete="current-password"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'admin-login-error' : undefined}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition hover:text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E4E1D5]/40"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <Eye className="h-5 w-5" strokeWidth={1.75} />
              )}
            </button>
          </div>

          {error ? (
            <motion.p
              id="admin-login-error"
              role="alert"
              initial={{ opacity: 0, x: 0 }}
              animate={{
                opacity: 1,
                x: [0, -10, 10, -10, 10, 0],
              }}
              transition={{ duration: 0.3 }}
              className="mt-1 text-sm text-red-600"
            >
              {error}
            </motion.p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#E4E1D5] py-3 font-medium text-black transition-colors hover:bg-[#c4c1b5] disabled:pointer-events-none disabled:opacity-70"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
          ) : null}
          Se Connecter
        </button>

        <Link
          to="/"
          className="mt-6 block text-center text-sm text-[#E4E1D5]/50 transition-colors hover:text-[#E4E1D5]"
        >
          Retour à la boutique
        </Link>
      </motion.form>
    </div>
  );
}
