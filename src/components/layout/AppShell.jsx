import { useEffect, useState, Suspense } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Search, Moon, Sun, Bell, LogOut, Menu, X, ChevronsLeft, ChevronsRight, Repeat, ChevronDown, Loader2 } from 'lucide-react';
import { useDB, useSession } from '../../data/store';
import { useCurrentUser, usePortalStudent } from '../../data/selectors';
import { navFor, navItem, MOBILE_TABS, ROLES } from '../../lib/permissions';
import { Avatar, cx, toast } from '../ui';
import CommandPalette from './CommandPalette';
import { OfflineBanner, SlowChip } from '../NetworkBanner';
import Logo from './Logo';
import { userPhotoKey } from '../../data/photos';

function SidebarNav({ role, collapsed, onNavigate }) {
  const modules = useDB((s) => s.settings.modules);
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
      {navFor(role, modules).map((g) => (
        <div key={g.group}>
          {!collapsed && <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">{g.group}</p>}
          <div className="space-y-1">
            {g.items.map((it) => (
              <NavLink
                key={it.key}
                to={it.path}
                end={it.path === '/'}
                onClick={onNavigate}
                title={collapsed ? it.label : undefined}
                className={({ isActive }) => cx('nav-link', isActive && 'active', collapsed && 'justify-center px-0')}
              >
                <it.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{it.label}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SchoolBadge({ collapsed }) {
  const settings = useDB((s) => s.settings);
  if (collapsed) return null;
  return (
    <div className="mx-3 mb-4 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-4 text-white shadow-lg shadow-brand-900/40">
      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-200">Current term</p>
      <p className="mt-1 text-sm font-bold">{settings.academicYear} · Term {settings.currentTerm.slice(-1)}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
        <div className="h-full w-[58%] rounded-full bg-accent-500" />
      </div>
      <p className="mt-1.5 text-[11px] text-brand-100">Week 8 of 14</p>
    </div>
  );
}

function ChildSwitcher() {
  const { student, children } = usePortalStudent();
  const setChild = useSession((s) => s.setChild);
  const classes = useDB((s) => s.classes);
  if (children.length < 2) return null;
  return (
    <div className="relative hidden sm:block">
      <select
        value={student?.id}
        onChange={(e) => setChild(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-navy-900 dark:text-slate-200"
      >
        {children.map((c) => (
          <option key={c.id} value={c.id}>
            {c.firstName} · {classes.find((x) => x.id === c.classId)?.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export default function AppShell() {
  const user = useCurrentUser();
  const { dark, toggleDark, logout, sidebarCollapsed, toggleSidebar } = useSession();
  const messages = useDB((s) => s.messages);
  const settings = useDB((s) => s.settings);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  // Signs out after a period of inactivity when secure sign-in is on.
  const timeout = settings.auth?.mode === 'secure' ? settings.auth.sessionTimeout : 0;
  useEffect(() => {
    if (!timeout) return;
    const { touch } = useSession.getState();
    let last = 0;
    const onActivity = () => {
      if (Date.now() - last > 15000) {
        last = Date.now();
        touch();
      }
    };
    const check = () => {
      const la = useSession.getState().lastActive;
      if (la && Date.now() - la > timeout * 60000) {
        useSession.getState().logout();
        toast.info('Signed out', `No activity for ${timeout} minutes`);
      }
    };
    check();
    const t = setInterval(check, 30000);
    ['pointerdown', 'keydown', 'scroll'].forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      clearInterval(t);
      ['pointerdown', 'keydown', 'scroll'].forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [timeout]);
  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  if (!user) return null;
  const unread = messages.filter((m) => m.toId === user.id && !m.read).length;
  const tabs = (MOBILE_TABS[user.role] || ['dashboard']).map(navItem).filter((t) => t && navFor(user.role, settings.modules).some((g) => g.items.includes(t)));

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className={cx('no-print fixed inset-y-0 left-0 z-30 hidden flex-col bg-navy-900 transition-all lg:flex', sidebarCollapsed ? 'w-20' : 'w-72')}>
        <div className={cx('flex h-20 items-center px-5', sidebarCollapsed && 'justify-center px-0')}>
          <Logo compact={sidebarCollapsed} dark />
        </div>
        <SchoolBadge collapsed={sidebarCollapsed} />
        <SidebarNav role={user.role} collapsed={sidebarCollapsed} />
        <button onClick={toggleSidebar} className="m-3 flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-slate-400 hover:bg-white/5 hover:text-white">
          {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-[85%] max-w-xs animate-slide-in flex-col bg-navy-900">
            <div className="flex h-20 items-center justify-between px-5">
              <Logo dark />
              <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-slate-300 hover:bg-white/10" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SchoolBadge />
            <SidebarNav role={user.role} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className={cx('transition-all', sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72')}>
        <OfflineBanner />
        {/* Topbar */}
        <header className="no-print sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-white/5 dark:bg-navy-950/85">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden h-10 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-400 transition hover:border-brand-300 dark:border-white/10 dark:bg-white/5 md:flex md:max-w-md"
            >
              <Search className="h-4 w-4" />
              Search students, staff, pages…
              <kbd className="ml-auto rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-navy-900">Ctrl K</kbd>
            </button>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <SlowChip />
              <ChildSwitcher />
              <button onClick={() => setPaletteOpen(true)} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 md:hidden" aria-label="Search">
                <Search className="h-5 w-5" />
              </button>
              <button onClick={toggleDark} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Toggle dark mode">
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button onClick={() => navigate('/communication')} className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Messages">
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-navy-950">{unread}</span>}
              </button>
              <div className="relative">
                <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2.5 rounded-xl p-1 pr-2 hover:bg-slate-100 dark:hover:bg-white/10">
                  <Avatar name={user.name} photo={userPhotoKey(user)} size="sm" />
                  <div className="hidden text-left sm:block">
                    <p className="max-w-[140px] truncate text-sm font-semibold leading-tight text-slate-800 dark:text-white">{user.name}</p>
                    <p className="text-[11px] leading-tight text-slate-500">{ROLES[user.role].label}</p>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-64 animate-scale-in overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lift dark:border-white/10 dark:bg-navy-900">
                      <div className="border-b border-slate-100 p-4 dark:border-white/5">
                        <p className="font-semibold text-slate-900 dark:text-white">{user.name}</p>
                        <p className="truncate text-xs text-slate-500">{user.email}</p>
                        <p className="mt-1 text-[11px] text-slate-400">{settings.schoolName}</p>
                      </div>
                      <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5">
                        <Repeat className="h-4 w-4" /> Switch role
                      </button>
                      <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-accent-600 hover:bg-accent-50 dark:hover:bg-accent-500/10">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] animate-fade-in px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12" key={loc.pathname}>
          <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-brand-600" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-xl safe-bottom dark:border-white/10 dark:bg-navy-900/95 lg:hidden">
        <div className="grid grid-cols-5">
          {tabs.map((t) => (
            <NavLink key={t.key} to={t.path} end={t.path === '/'} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400')}>
              <t.icon className="h-5 w-5" />
              <span className="max-w-full truncate px-1">{t.label.split(' ')[0]}</span>
            </NavLink>
          ))}
          <button onClick={() => setMobileOpen(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-slate-400">
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
