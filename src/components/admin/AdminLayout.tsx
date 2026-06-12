import { useCallback, useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

import {
  LayoutDashboard,
  Package,
  Archive,
  ShoppingBag,
  Wallet,
  Users,
  Store,
  BarChart3,
  ClipboardList,
  LogOut,
  Menu,
  X,
} from "lucide-react";
type NavLinkItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  badge?: number;
  /** Default red; amber = stock faible uniquement (aucune rupture). */
  badgeTone?: "danger" | "warning";
  pulseBadge?: boolean;
};

export default function AdminLayout() {
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [exhaustedCount, setExhaustedCount] = useState(0);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [draftLeadsCount, setDraftLeadsCount] = useState(0);
  const [financialAlertsCount, setFinancialAlertsCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    try {
      const { count } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "nouveau");

      if (count !== null) setNewOrdersCount(count);

      const { count: draftLeads } = await supabase
        .from('order_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'draft');
      setDraftLeadsCount(draftLeads ?? 0);

      const { count: exhausted } = await supabase
        .from('variants')
        .select('*', { count: 'exact', head: true })
        .eq('stock', 0);
      setExhaustedCount(exhausted ?? 0);

      const { count: lowAlert } = await supabase
        .from('variants')
        .select('*', { count: 'exact', head: true })
        .gt('stock', 0)
        .lte('stock', 3);
      setLowStockCount(lowAlert ?? 0);

      const { count: overduePayments } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true })
        .in("status", ["en_attente_encaissement", "en_retard"]);
      setFinancialAlertsCount(overduePayments || 0);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    void fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          void fetchCounts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel("admin-payments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          void fetchCounts();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel('admin-leads-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_leads' },
        () => {
          void fetchCounts();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  useEffect(() => {
    const channel: RealtimeChannel = supabase
      .channel('admin-variants-counts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'variants' },
        () => {
          void fetchCounts();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchCounts]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const navLinks: NavLinkItem[] = [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/admin/products", icon: Package, label: "Produits" },
    {
      to: "/admin/stock",
      icon: Archive,
      label: "Stock",
      badge: lowStockCount + exhaustedCount,
      badgeTone:
        exhaustedCount > 0
          ? "danger"
          : lowStockCount > 0
            ? "warning"
            : undefined,
    },
    {
      to: "/admin/orders",
      icon: ShoppingBag,
      label: "Commandes",
      badge: newOrdersCount,
      pulseBadge: true,
    },
    {
      to: "/admin/leads",
      icon: ClipboardList,
      label: "Prospects",
      badge: draftLeadsCount,
      badgeTone: draftLeadsCount > 0 ? "warning" : undefined,
    },
    { to: "/admin/direct-sales", icon: Store, label: "Vente directe" },
    {
      to: "/admin/payments",
      icon: Wallet,
      label: "Encaissements",
      badge: financialAlertsCount,
      badgeTone: financialAlertsCount > 0 ? "warning" : undefined,
    },
    { to: "/admin/reports", icon: BarChart3, label: "Rapports" },
    { to: "/admin/customers", icon: Users, label: "Clients" },
  ];

  return (
    <div
      dir="ltr"
      lang="fr"
      className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-[#F9FAFB] font-sans antialiased"
    >
      {/* Overlay mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar : pleine hauteur viewport, fixe (mobile) ou sticky (desktop) */}
      <aside
        className={[
          "z-50 flex w-[300px] shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-neutral-950 via-[#121212] to-neutral-950 text-white shadow-2xl transition-transform duration-300 ease-out",
          "fixed inset-y-0 left-0 h-[100dvh] max-h-[100dvh]",
          /* Desktop : dans le flux, pleine hauteur du shell (toute la page admin) */
          "lg:static lg:h-[100dvh] lg:max-h-[100dvh] lg:translate-x-0 lg:shadow-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="relative shrink-0 overflow-x-hidden border-b border-white/10 py-1">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="absolute right-2 top-2 rounded-md p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Fermer le menu"
          >
            <X size={20} strokeWidth={1.75} />
          </button>

          <div className="flex justify-center px-0">
            <img
              src="/logo-Chiraz.png"
              alt="Chiraz"
              className="h-48 w-auto object-contain filter invert sm:h-56 md:h-64"
            />
          </div>
        </div>

        <nav
          className="admin-sidebar-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5"
          aria-label="Navigation principale"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
            Menu
          </p>

          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) =>
                    [
                      "flex min-h-[3rem] items-center justify-between gap-2 rounded-xl px-3 py-3 transition",
                      isActive
                        ? "bg-gradient-to-r from-white/20 to-transparent font-semibold text-white"
                        : "text-neutral-400 hover:bg-white/10 hover:text-white",
                    ].join(" ")
                  }
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <link.icon size={18} strokeWidth={1.75} />
                    </div>
                    <span className="truncate text-[15px]">{link.label}</span>
                  </div>

                  <span className="flex shrink-0 items-center gap-1">
                    {link.badge !== undefined && link.badge > 0 ? (
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-xs font-bold",
                          link.badgeTone === "warning"
                            ? "bg-amber-500 text-neutral-950"
                            : "bg-red-500 text-white",
                          link.pulseBadge ? "animate-pulse" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {link.badge}
                      </span>
                    ) : null}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-white/10 bg-black/20 px-4 py-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-950/40">
              AD
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">Admin</p>
              <p className="truncate text-xs text-white/50">Chiraz</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Zone principale : occupe le reste de la hauteur, scroll interne */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-[100dvh]">
        <header className="flex shrink-0 items-center gap-4 border-b border-neutral-200/90 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 text-neutral-800 hover:bg-neutral-100"
            aria-label="Ouvrir le menu"
          >
            <Menu size={24} strokeWidth={1.75} />
          </button>

          <img
            src="/logo-Chiraz.png"
            alt="Chiraz"
            className="h-8 w-auto max-w-[140px] object-contain"
          />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
