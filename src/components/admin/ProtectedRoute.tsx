import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function ProtectedRoute() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const role = session?.user?.app_metadata?.role;
      setIsAllowed(Boolean(session && role === 'admin'));
      setIsChecking(false);
    };

    void checkAuth();
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#E4E1D5]" />
      </div>
    );
  }

  if (!isAllowed) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
