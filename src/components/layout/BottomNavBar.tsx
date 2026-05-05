import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchStore } from '../../store/searchStore';

export default function BottomNavBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const openSearch = useSearchStore((s) => s.openSearch);

  const items = [
    { icon: Home, label: t('common.home'), to: '/' },
    { icon: ShoppingBag, label: t('common.shop'), to: '/shop' },
    { icon: Search, label: t('common.searchLabel'), to: '#', action: 'search' as const },
  ];

  const handleItem = (item: (typeof items)[number]) => {
    if (item.action === 'search') openSearch();
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a] border-t border-[#E4E1D5]/10 flex items-center justify-around h-14 pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label={t('bottomNav.aria')}
    >
      {items.map((item) => {
        const isActive = item.to !== '#' && location.pathname === item.to;
        const Icon = item.icon;
        const content = (
          <span className="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center">
            <span className="relative">
              <Icon
                size={22}
                strokeWidth={1.5}
                className={isActive ? 'text-[#E4E1D5]' : 'text-[#E4E1D5]/60'}
              />
            </span>
            <span className={`text-[10px] ${isActive ? 'text-[#E4E1D5]' : 'text-[#E4E1D5]/50'}`}>
              {item.label}
            </span>
          </span>
        );
        if (item.action) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => handleItem(item)}
              className="flex-1 flex justify-center"
              aria-label={item.label}
            >
              {content}
            </button>
          );
        }
        return (
          <Link key={item.label} to={item.to} className="flex-1 flex justify-center">
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
