import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Bell, ClipboardList, House, Tractor, User } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { useI18n } from '../i18n'
import { useNotifications } from '../notifications/NotificationsContext'
import { BrandName, LanguageSelect, Logo } from './Brand'
import type { TranslationKey } from '../i18n/en'
import type { Role } from '../types'

interface NavItem {
  to: string
  label: TranslationKey
  icon: typeof House
  end?: boolean
}

const NAV: Record<Role, NavItem[]> = {
  farmer: [
    { to: '/farmer', label: 'nav.home', icon: House, end: true },
    { to: '/farmer/bookings', label: 'nav.bookings', icon: ClipboardList },
    { to: '/profile', label: 'nav.profile', icon: User },
  ],
  owner: [
    { to: '/owner', label: 'nav.home', icon: House, end: true },
    { to: '/owner/machines', label: 'nav.machines', icon: Tractor },
    { to: '/owner/bookings', label: 'nav.requests', icon: ClipboardList },
    { to: '/profile', label: 'nav.profile', icon: User },
  ],
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, changeLanguage } = useAuth()
  const { t, lang } = useI18n()
  const { unread } = useNotifications()
  const role: Role = profile?.role ?? 'farmer'
  const items = NAV[role]

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="sticky top-0 z-30 border-b border-line bg-cream-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex min-h-11 items-center gap-2.5" aria-label={t('app.name')}>
            <Logo size={38} />
            <BrandName className="hidden text-xl min-[380px]:inline" />
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Main">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-lg font-semibold ${
                    isActive ? 'bg-brand-800 text-white' : 'text-brand-900 hover:bg-brand-50'
                  }`
                }
              >
                <item.icon className="h-5 w-5" aria-hidden />
                {t(item.label)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LanguageSelect value={lang} onChange={changeLanguage} />
            <Link
              to="/notifications"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-line bg-white text-brand-900 hover:border-brand-700"
              aria-label={unread > 0 ? `${t('nav.notifications')} (${unread})` : t('nav.notifications')}
            >
              <Bell className="h-6 w-6" aria-hidden />
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-700 px-1 text-sm font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-32 pt-4 md:pb-12 md:pt-6">{children}</main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white md:hidden"
        aria-label="Main"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-xl">
          {items.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-sm font-semibold leading-tight ${
                    isActive ? 'text-brand-800' : 'text-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`rounded-full px-4 py-1 ${isActive ? 'bg-brand-100' : ''}`}>
                      <item.icon className="h-6 w-6" aria-hidden />
                    </span>
                    {t(item.label)}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
