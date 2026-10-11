import React, { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  UploadCloud,
  FileCheck2,
  ListTree,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

interface Props {
  children: ReactNode;
}

export const AppShell: React.FC<Props> = ({ children }) => {
  const navItems = [
    { to: '/app', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/app/transfers', label: 'Transfers', icon: ArrowLeftRight },
    { to: '/app/send', label: 'Send File', icon: UploadCloud },
    { to: '/app/received', label: 'Received Files', icon: FileCheck2 },
    { to: '/app/activity', label: 'Activity Logs', icon: ListTree },
    { to: '/app/security', label: 'Security & Keys', icon: ShieldAlert },
    { to: '/app/settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <div className="min-h-screen bg-agnos-dark flex flex-col text-white">
      <Navbar />

      {/* App Subnavigation Bar */}
      <div className="border-b border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-agnos-vermilion text-white shadow-md shadow-agnos-vermilion/20'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <Footer />
    </div>
  );
};
