import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Briefcase, 
  Calendar, 
  Settings, 
  LogOut, 
  Search,
  Scale,
  Bell,
  Cloud,
  CloudOff,
  Loader2,
  Check,
  Menu,
  X,
  Gavel
} from "lucide-react";
import { useState, useEffect, createContext, useContext } from "react";
import logo from "@assets/generated_images/minimalist_legal_logo_navy_gold.png";
import { useSaveStatus } from "@/hooks/use-save-status";

const MobileMenuContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({ isOpen: false, setIsOpen: () => {} });

export function useMobileMenu() {
  return useContext(MobileMenuContext);
}

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Briefcase, label: "My Cases", href: "/cases" },
    { icon: Gavel, label: "Trial Prep", href: "/trial-prep" },
    { icon: Calendar, label: "Calendar", href: "/calendar" },
    { icon: Scale, label: "Legal Research", href: "/research" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className="w-64 h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-2xl">
      <div className="p-4 md:p-6 flex items-center justify-between border-b border-sidebar-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary/10 flex items-center justify-center p-1">
            <img src={logo} alt="CaseBuddy Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-lg text-sidebar-primary tracking-wide">CaseBuddy</h1>
            <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wider">Legal AI OS</p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="md:hidden p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
            data-testid="button-close-sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-2 md:mt-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href}
              onClick={handleNavClick}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
                ${isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-md shadow-sidebar-primary/20" 
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white"
                }
              `}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60 group-hover:text-white"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border/50">
        <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

function SaveStatusIndicator() {
  const { status, lastSaved } = useSaveStatus();

  const formatTime = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 text-xs" data-testid="save-status-indicator">
      {status === "saving" && (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Cloud className="w-3 h-3 text-green-500" />
          <span className="text-green-600 font-medium">Saved</span>
          {lastSaved && (
            <span className="text-muted-foreground">{formatTime(lastSaved)}</span>
          )}
        </>
      )}
      {status === "error" && (
        <>
          <CloudOff className="w-3 h-3 text-red-500" />
          <span className="text-red-600 font-medium">Save failed</span>
        </>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change for mobile
  const [location] = useLocation();
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  return (
    <MobileMenuContext.Provider value={{ isOpen: sidebarOpen, setIsOpen: setSidebarOpen }}>
      <div className="min-h-screen bg-background font-sans flex">
        {/* Desktop Sidebar - always visible */}
        <div className="hidden md:block fixed left-0 top-0 z-20">
          <Sidebar />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-black/50 z-30 animate-in fade-in duration-200"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar - slide in from left */}
        <div className={`
          md:hidden fixed left-0 top-0 z-40 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        <main className="flex-1 md:ml-64 min-h-screen relative w-full">
          <header className="h-14 md:h-16 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10 px-4 md:px-8 flex items-center justify-between gap-2 md:gap-4">
            {/* Mobile menu button */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-secondary transition-colors"
              data-testid="button-open-sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Mobile logo */}
            <div className="md:hidden flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center p-0.5">
                <img src={logo} alt="CaseBuddy" className="w-full h-full object-contain" />
              </div>
              <span className="font-serif font-bold text-primary text-sm">CaseBuddy</span>
            </div>

            {/* Search bar - hidden on very small screens, smaller on tablet */}
            <div className="hidden sm:block flex-1 max-w-[200px] md:max-w-[384px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2 bg-secondary/50 border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                data-testid="input-global-search"
              />
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* Mobile search button */}
              <button className="sm:hidden p-2 rounded-full hover:bg-secondary transition-colors" data-testid="button-mobile-search">
                <Search className="w-5 h-5 text-muted-foreground" />
              </button>
              <div className="hidden sm:block">
                <SaveStatusIndicator />
              </div>
              <button className="relative p-2 rounded-full hover:bg-secondary transition-colors" data-testid="button-notifications">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background"></span>
              </button>
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-xs">
                JD
              </div>
            </div>
          </header>
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </MobileMenuContext.Provider>
  );
}
