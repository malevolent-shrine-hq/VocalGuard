import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Square, AlertTriangle, 
  ArrowRight, Disc,
  Upload, RefreshCw, Mic, CheckCircle2,
  Download, AlertOctagon, Radio,
  Terminal, FileAudio, ChevronDown, ChevronUp, Loader2,
  ArrowUpRight, Shield, Code2, Menu, X,
  Fingerprint, UserCheck, UserX, UserPlus, ShieldAlert, ShieldCheck, Trash2,
  Lock, User
} from 'lucide-react';
import { useUser, useAuth, UserButton, SignInButton, SignUpButton } from '@clerk/clerk-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const MAX_LIVE_HISTORY = 120;

function getLiveWebSocketUrl() {
  const configured = import.meta.env.VITE_WS_BASE_URL;
  if (configured) return `${configured.replace(/\/$/, '')}/ws/detect`;
  if (API_BASE) return `${API_BASE.replace(/^http/, 'ws')}/ws/detect`;
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/detect`;
}

function resampleTo16k(samples, sourceRate) {
  if (sourceRate === 16000) return samples;
  const outputLength = Math.max(1, Math.round(samples.length * 16000 / sourceRate));
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / 16000;
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, samples.length - 1);
    const fraction = position - left;
    output[i] = samples[left] + (samples[right] - samples[left]) * fraction;
  }
  return output;
}

function ClerkAuthConsumer({ children }) {
  const { user, isSignedIn, isLoaded } = useUser();
  const { getToken, signOut } = useAuth();

  const auth = {
    isConfigured: true,
    isLoaded,
    isSignedIn: !!isSignedIn,
    user: user
      ? {
          id: user.id,
          name: user.fullName || user.firstName || user.username || user.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Operator',
          email: user.primaryEmailAddress?.emailAddress || '',
          imageUrl: user.imageUrl,
        }
      : null,
    getToken: async () => {
      try {
        return await getToken();
      } catch (e) {
        console.warn('Clerk getToken error:', e);
        return null;
      }
    },
    signOut,
    UserButton,
    SignInButton,
    SignUpButton,
  };

  return children(auth);
}

function ClerkAuthBridge({ isClerkConfigured, children }) {
  if (!isClerkConfigured) {
    const guestAuth = {
      isConfigured: false,
      isLoaded: true,
      isSignedIn: false,
      user: null,
      getToken: async () => null,
      signOut: async () => {},
      UserButton: null,
      SignInButton: null,
      SignUpButton: null,
    };
    return children(guestAuth);
  }

  return <ClerkAuthConsumer>{children}</ClerkAuthConsumer>;
}

export default function App({ isClerkConfigured = false }) {
  return (
    <ClerkAuthBridge isClerkConfigured={isClerkConfigured}>
      {(auth) => <AppContent auth={auth} />}
    </ClerkAuthBridge>
  );
}

function AppContent({ auth }) {
  const [activeView, setActiveView] = useState(() => (auth?.isSignedIn ? 'dashboard' : 'landing'));
  const [backendStatus, setBackendStatus] = useState({ 
    online: false, 
    checking: true, 
    data: null,
    latencyMs: null,
    lastChecked: null 
  });

  const isOnlineRef = useRef(false);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    isOnlineRef.current = backendStatus.online;
    isCheckingRef.current = backendStatus.checking;
  }, [backendStatus.online, backendStatus.checking]);

  const pingHealth = useCallback((setChecking = false) => {
    if (setChecking) {
      setBackendStatus(s => ({ ...s, checking: true }));
    }
    const startTime = performance.now();
    return fetch(`${API_BASE}/api/health?_t=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        const latency = Math.round(performance.now() - startTime);
        setBackendStatus({ 
          online: true, 
          checking: false, 
          data, 
          latencyMs: latency,
          lastChecked: new Date() 
        });
      })
      .catch(() => {
        setBackendStatus(prev => ({ 
          ...prev, 
          online: false, 
          checking: false, 
          latencyMs: null,
          lastChecked: new Date() 
        }));
      });
  }, []);

  const handleManualRetry = () => {
    pingHealth(true);
  };

  useEffect(() => {
    let cancelled = false;
    const runCheck = () => {
      if (!cancelled) pingHealth(false);
    };

    runCheck();
    // Auto-poll health every 5 seconds if offline or checking (vital for Render free-tier cold starts)
    const interval = setInterval(() => {
      if (!isOnlineRef.current || isCheckingRef.current) {
        runCheck();
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pingHealth]);

  return (
    <div className="min-h-screen text-[#f5f5f5] selection:bg-[#CCFF00] selection:text-black font-sans relative bg-[#050505] overflow-x-hidden w-full flex flex-col justify-between">
      {/* Global Topo Background */}
      <TopoBackground />
      
      <Navbar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        backendStatus={backendStatus} 
        onRetryBackend={handleManualRetry}
        auth={auth}
      />
      
      <main className="pt-20 sm:pt-24 pb-16 sm:pb-20 px-3 sm:px-6 max-w-7xl mx-auto relative z-10 w-full overflow-x-hidden flex-1">
        {activeView === 'landing' && <LandingPage setActiveView={setActiveView} />}
        {activeView === 'dashboard' && (
          auth?.isSignedIn ? (
            <LiveDashboard backendStatus={backendStatus} onRetryBackend={handleManualRetry} auth={auth} />
          ) : (
            <ConsoleAuthGate auth={auth} setActiveView={setActiveView} />
          )
        )}
        {activeView === 'technology' && <TechnologyPage />}
        {activeView === 'about' && <AboutPage setActiveView={setActiveView} />}
      </main>

      <Footer 
        activeView={activeView} 
        setActiveView={setActiveView} 
        backendStatus={backendStatus} 
      />
    </div>
  );
}

/* =========================================
   CONSOLE AUTHENTICATION GATE
   ========================================= */
function ConsoleAuthGate({ auth, setActiveView }) {
  return (
    <div className="animate-in fade-in duration-500 max-w-2xl mx-auto my-8 sm:my-16 bg-black border border-[#1f1f1f] p-6 sm:p-10 text-center relative overflow-hidden shadow-2xl">
      {/* Top Cyber Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#CCFF00] to-transparent" />
      
      {/* Security Shield Icon */}
      <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 bg-[#0a0a0a] border border-[#222] flex items-center justify-center relative">
        <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10 text-[#CCFF00]" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#CCFF00] animate-ping rounded-full" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#CCFF00] rounded-full" />
      </div>

      {/* Title */}
      <div className="font-mono text-[10px] sm:text-xs text-[#CCFF00] tracking-widest uppercase mb-2">
        // SECURE OPERATOR ENCLAVE
      </div>
      <h2 className="text-2xl sm:text-4xl font-bold tracking-tight uppercase text-white font-mono mb-4">
        Operator Login Required
      </h2>

      {/* Description */}
      <p className="text-[#888] text-sm sm:text-base max-w-lg mx-auto mb-8 leading-relaxed font-sans">
        The VocalGuard Operations Console is restricted strictly to authenticated operators. Sign in with your account to access real-time neural telemetry, live biometric cross-session verification, and personal voiceprint vault management.
      </p>

      {/* Auth Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 font-mono">
        {auth?.SignInButton ? (
          <auth.SignInButton mode="modal">
            <button className="w-full sm:w-auto px-6 py-3 bg-[#CCFF00] hover:bg-white text-black font-bold uppercase text-xs tracking-wider transition-colors flex items-center justify-center gap-2 shadow-[0_0_12px_rgba(204,255,0,0.3)]">
              <User className="w-4 h-4" />
              <span>Authenticate Operator</span>
            </button>
          </auth.SignInButton>
        ) : (
          <button 
            onClick={() => setActiveView('landing')}
            className="w-full sm:w-auto px-6 py-3 bg-[#CCFF00] hover:bg-white text-black font-bold uppercase text-xs tracking-wider transition-colors"
          >
            Authenticate Operator
          </button>
        )}

        {auth?.SignUpButton && (
          <auth.SignUpButton mode="modal">
            <button className="w-full sm:w-auto px-6 py-3 border border-[#333] hover:border-[#CCFF00] text-white hover:text-[#CCFF00] bg-[#111] uppercase text-xs tracking-wider transition-colors flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </button>
          </auth.SignUpButton>
        )}

        <button
          onClick={() => {
            setActiveView('landing');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="w-full sm:w-auto px-6 py-3 border border-[#222] hover:border-[#444] text-[#888] hover:text-white bg-transparent uppercase text-xs tracking-wider transition-colors flex items-center justify-center gap-1.5"
        >
          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          <span>Back to Overview</span>
        </button>
      </div>

      {/* Footer Info Box */}
      <div className="mt-8 pt-6 border-t border-[#181818] grid grid-cols-1 sm:grid-cols-3 gap-3 text-left font-mono text-[10px] text-[#666]">
        <div className="bg-[#080808] p-3 border border-[#1a1a1a]">
          <div className="text-white font-bold mb-1 flex items-center gap-1.5">
            <Fingerprint className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span>PERSONAL VAULT</span>
          </div>
          <div>Each operator manages their private voiceprint profile isolated from all other users.</div>
        </div>
        <div className="bg-[#080808] p-3 border border-[#1a1a1a]">
          <div className="text-white font-bold mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span>SESSION PROTECTED</span>
          </div>
          <div>Clerk cryptographic JWT authentication with instant token rotation.</div>
        </div>
        <div className="bg-[#080808] p-3 border border-[#1a1a1a]">
          <div className="text-white font-bold mb-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span>ZERO DATA LEAKAGE</span>
          </div>
          <div>Strict user isolation guarantees other operators cannot see or access your profiles.</div>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   TOPO RINGS BACKGROUND
   ========================================= */
function TopoBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ backgroundColor: '#050505' }}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1400px] h-[1400px] border border-[#111] rounded-[40%_60%_70%_30%] animate-[spin_60s_linear_infinite]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[1100px] border border-[#111] rounded-[60%_40%_30%_70%] animate-[spin_45s_linear_infinite_reverse]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-[#111] rounded-[50%_50%_60%_40%] animate-[spin_30s_linear_infinite]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-[#111] rounded-[45%_55%_40%_60%] animate-[spin_20s_linear_infinite_reverse]" />
    </div>
  );
}

/* =========================================
   NAVIGATION BAR
   ========================================= */
function Navbar({ activeView, setActiveView, backendStatus, onRetryBackend, auth }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-b border-[#1f1f1f]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        
        <div 
          className="flex items-center gap-2 sm:gap-4 cursor-pointer shrink-0"
          onClick={() => {
            setActiveView('dashboard');
            setMobileMenuOpen(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div className="w-5 h-5 sm:w-6 sm:h-6 bg-[#CCFF00] flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-black" />
          </div>
          <span className="text-base sm:text-xl font-bold tracking-tighter uppercase text-white font-mono">
            Vocal<span className="text-[#888888] font-light">Guard</span>
          </span>
          <span className="hidden lg:inline-block font-mono text-[9px] bg-[#111] text-[#888] border border-[#222] px-2 py-0.5">
            MODEL: MULTI-RES-SE-RESNET-v3 (93.66% ACC)
          </span>
        </div>
        
        <div className="flex items-center gap-2 min-w-0">
          {/* Desktop Status Badge & Ping Button */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[9px] sm:text-[10px] tracking-wider uppercase shrink-0 px-2 py-1 bg-[#0a0a0a] border border-[#222]">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                backendStatus.online 
                  ? 'bg-[#CCFF00] animate-pulse' 
                  : (backendStatus.checking ? 'bg-amber-400 animate-ping' : 'bg-[#FF3333]')
              }`} />
              <span className={
                backendStatus.online 
                  ? 'text-[#888]' 
                  : (backendStatus.checking ? 'text-amber-400' : 'text-[#FF3333]')
              }>
                {backendStatus.online 
                  ? (backendStatus.latencyMs ? `API ONLINE (${backendStatus.latencyMs}ms)` : 'API ONLINE')
                  : (backendStatus.checking ? 'WAKING API...' : 'API ASLEEP')}
              </span>
            </div>

            <button 
              onClick={onRetryBackend}
              disabled={backendStatus.checking}
              className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono text-[#aaa] hover:text-[#CCFF00] uppercase tracking-wider border border-[#333] hover:border-[#CCFF00] px-2 py-1 bg-[#111] transition-all disabled:opacity-50 group shrink-0"
              title="Ping backend / wake up Render instance (free tier spins down after 15m inactivity)"
            >
              <RefreshCw className={`w-3 h-3 ${backendStatus.checking ? 'animate-spin text-[#CCFF00]' : 'text-[#777] group-hover:text-[#CCFF00]'}`} />
              <span className="font-semibold">
                {backendStatus.checking ? 'Pinging...' : 'Ping Server'}
              </span>
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-6 ml-2">
            <NavLink label="Platform" active={activeView === 'landing'} onClick={() => { setActiveView('landing'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            <NavLink label="Architecture" active={activeView === 'technology'} onClick={() => { setActiveView('technology'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            <NavLink label="About" active={activeView === 'about'} onClick={() => { setActiveView('about'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            <NavLink label="Console" active={activeView === 'dashboard'} onClick={() => { setActiveView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} isAccent />
          </div>

          {/* Clerk Auth Section (Desktop) */}
          <div className="hidden md:flex items-center ml-2">
            {auth?.isConfigured ? (
              auth.isSignedIn ? (
                <div className="flex items-center gap-2 pl-3 border-l border-[#222]">
                  <div className="text-right hidden xl:block font-mono leading-none">
                    <div className="text-[10px] text-white font-bold truncate max-w-[120px]">{auth.user.name}</div>
                    <div className="text-[8px] text-[#CCFF00] uppercase tracking-widest mt-0.5">SECURED</div>
                  </div>
                  {auth.UserButton && <auth.UserButton afterSignOutUrl="/" />}
                </div>
              ) : (
                <div className="flex items-center gap-2 pl-3 border-l border-[#222]">
                  {auth.SignInButton && (
                    <auth.SignInButton mode="modal">
                      <button className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border border-[#333] hover:border-[#CCFF00] text-white hover:text-[#CCFF00] bg-[#111] transition-colors flex items-center gap-1.5">
                        <User className="w-3 h-3 text-[#CCFF00]" />
                        <span>Sign In</span>
                      </button>
                    </auth.SignInButton>
                  )}
                  {auth.SignUpButton && (
                    <auth.SignUpButton mode="modal">
                      <button className="hidden xl:flex font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 bg-[#CCFF00] hover:bg-white text-black font-bold transition-colors">
                        Register
                      </button>
                    </auth.SignUpButton>
                  )}
                </div>
              )
            ) : (
              <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 bg-[#0e0e0e] border border-[#222] text-[9px] font-mono text-[#777] ml-2" title="Clerk publishable key not provided in .env (running in guest mode)">
                <span className="w-1.5 h-1.5 rounded-full bg-[#555]" />
                <span>GUEST MODE</span>
              </div>
            )}
          </div>

          {/* Mobile Quick Status Pill */}
          <button
            onClick={onRetryBackend}
            disabled={backendStatus.checking}
            className="md:hidden flex items-center gap-1.5 text-[9px] font-mono border border-[#222] bg-[#0c0c0c] hover:border-[#CCFF00] px-2 py-1 text-[#aaa] transition-colors shrink-0"
            title="Ping backend gateway"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              backendStatus.online 
                ? 'bg-[#CCFF00]' 
                : (backendStatus.checking ? 'bg-amber-400 animate-ping' : 'bg-[#FF3333]')
            }`} />
            <span className="uppercase">{backendStatus.online ? (backendStatus.latencyMs ? `${backendStatus.latencyMs}ms` : 'ONLINE') : (backendStatus.checking ? 'WAKING' : 'OFFLINE')}</span>
            <RefreshCw className={`w-2.5 h-2.5 shrink-0 ${backendStatus.checking ? 'animate-spin text-[#CCFF00]' : 'text-[#666]'}`} />
          </button>

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="md:hidden p-1.5 bg-[#111] hover:bg-[#1a1a1a] border border-[#333] hover:border-[#CCFF00] text-white transition-colors focus:outline-none shrink-0"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-[#CCFF00]" />
            ) : (
              <Menu className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-black/98 border-b border-[#222] px-4 py-4 space-y-2 animate-in slide-in-from-top-2 duration-200 shadow-2xl backdrop-blur-md">
          <div className="text-[9px] font-mono text-[#666] uppercase tracking-widest border-b border-[#181818] pb-1.5 mb-2 flex justify-between items-center">
            <span>Navigation Menu</span>
            <span className="text-[#CCFF00]">VOCALGUARD v3.0</span>
          </div>

          {/* Mobile Auth Drawer Segment */}
          <div className="pb-2 border-b border-[#181818] mb-2">
            {auth?.isConfigured ? (
              auth.isSignedIn ? (
                <div className="p-2.5 bg-[#0a0a0a] border border-[#222] flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {auth.UserButton && <auth.UserButton afterSignOutUrl="/" />}
                    <div className="font-mono truncate">
                      <div className="text-xs text-white font-bold truncate">{auth.user.name}</div>
                      <div className="text-[10px] text-[#888] truncate">{auth.user.email}</div>
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-[#CCFF00] border border-[#CCFF00]/40 px-1.5 py-0.5 uppercase shrink-0">AUTH</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {auth.SignInButton && (
                    <auth.SignInButton mode="modal">
                      <button 
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full py-2 font-mono text-xs uppercase tracking-wider border border-[#333] hover:border-[#CCFF00] text-white bg-[#111] text-center"
                      >
                        Sign In
                      </button>
                    </auth.SignInButton>
                  )}
                  {auth.SignUpButton && (
                    <auth.SignUpButton mode="modal">
                      <button 
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full py-2 font-mono text-xs uppercase tracking-wider bg-[#CCFF00] text-black font-bold text-center"
                      >
                        Register
                      </button>
                    </auth.SignUpButton>
                  )}
                </div>
              )
            ) : (
              <div className="p-2 bg-[#0e0e0e] border border-[#222] font-mono text-[10px] text-[#777] flex items-center justify-between">
                <span>OPERATOR: GUEST MODE</span>
                <span className="text-[#555]">DEMO</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setActiveView('landing');
              setMobileMenuOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`w-full flex items-center justify-between p-2.5 font-mono text-xs uppercase tracking-wider text-left border transition-all ${
              activeView === 'landing'
                ? 'bg-[#CCFF00]/10 border-[#CCFF00] text-[#CCFF00]'
                : 'bg-[#0a0a0a] border-[#1e1e1e] text-[#aaa] hover:text-white'
            }`}
          >
            <div>
              <div className="font-bold">// 01 PLATFORM</div>
              <div className="text-[10px] text-[#666] normal-case">Forensic deepfake detection overview</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#555]" />
          </button>

          <button
            onClick={() => {
              setActiveView('technology');
              setMobileMenuOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`w-full flex items-center justify-between p-2.5 font-mono text-xs uppercase tracking-wider text-left border transition-all ${
              activeView === 'technology'
                ? 'bg-[#CCFF00]/10 border-[#CCFF00] text-[#CCFF00]'
                : 'bg-[#0a0a0a] border-[#1e1e1e] text-[#aaa] hover:text-white'
            }`}
          >
            <div>
              <div className="font-bold">// 02 ARCHITECTURE</div>
              <div className="text-[10px] text-[#666] normal-case">Multi-Res STFT & Anisotropic SE-ResNet v3</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#555]" />
          </button>

          <button
            onClick={() => {
              setActiveView('about');
              setMobileMenuOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`w-full flex items-center justify-between p-2.5 font-mono text-xs uppercase tracking-wider text-left border transition-all ${
              activeView === 'about'
                ? 'bg-[#CCFF00]/10 border-[#CCFF00] text-[#CCFF00]'
                : 'bg-[#0a0a0a] border-[#1e1e1e] text-[#aaa] hover:text-white'
            }`}
          >
            <div>
              <div className="font-bold">// 03 ABOUT TEAM</div>
              <div className="text-[10px] text-[#666] normal-case">Bimbok, Aditya & Bijan (SIH PS 26104)</div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#555]" />
          </button>

          <button
            onClick={() => {
              setActiveView('dashboard');
              setMobileMenuOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full flex items-center justify-between p-3 font-mono text-xs uppercase tracking-wider text-left bg-[#CCFF00] text-black font-bold border border-[#CCFF00] hover:bg-white transition-all shadow-[0_0_12px_rgba(204,255,0,0.25)] mt-1"
          >
            <div>
              <div>// 04 OPERATIONS CONSOLE</div>
              <div className="text-[10px] text-black/80 font-normal normal-case">Launch live deepfake analysis engine</div>
            </div>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>

          <div className="pt-2 border-t border-[#181818] flex items-center justify-between text-[10px] font-mono text-[#777] mt-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${backendStatus.online ? 'bg-[#CCFF00] animate-pulse' : 'bg-red-500'}`} />
              <span>{backendStatus.online ? `API ONLINE (${backendStatus.latencyMs || 35}ms)` : 'API ASLEEP'}</span>
            </div>
            <button
              onClick={() => onRetryBackend()}
              disabled={backendStatus.checking}
              className="text-[#CCFF00] hover:underline uppercase flex items-center gap-1 border border-[#333] px-2 py-0.5 bg-[#111]"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${backendStatus.checking ? 'animate-spin' : ''}`} />
              <span>{backendStatus.checking ? 'Pinging...' : 'Ping Server'}</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ label, active, onClick, isAccent }) {
  if (isAccent) {
    return (
      <button 
        onClick={onClick}
        className="font-mono text-xs tracking-widest uppercase text-black bg-[#CCFF00] px-4 py-2 hover:bg-white transition-colors"
      >
        [ {label} ]
      </button>
    );
  }
  return (
    <button 
      onClick={onClick} 
      className={`font-mono text-xs tracking-widest uppercase transition-colors ${
        active ? 'text-white' : 'text-[#888888] hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

/* =========================================
   LANDING PAGE (Asymmetric & Brutalist)
   ========================================= */
function LandingPage({ setActiveView }) {
  return (
    <div className="animate-in fade-in duration-700">
      
      {/* Hero Layout */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 mt-6 sm:mt-12 items-center">
        
        {/* Left Typography */}
        <div className="lg:col-span-7 space-y-6 sm:space-y-8">
          <div className="flex items-center gap-2 sm:gap-3 font-mono text-[10px] sm:text-xs text-[#CCFF00] tracking-widest uppercase">
            <span className="w-2 h-2 bg-[#CCFF00] animate-pulse shrink-0" />
            <span className="truncate">PyTorch Multi-Resolution SE-ResNet (v3) // Online</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] uppercase text-white">
            Detect Voice <br/>
            <span className="text-[#888888]">Deepfakes</span><br/>
            In Real Time.
          </h1>
          
          <p className="text-[#888888] text-base sm:text-lg max-w-xl leading-relaxed">
            Stop synthetic voice fraud before authorization. Powered by PyTorch, VocalGuard's 3-channel Multi-Resolution STFT and Time-Frequency SE-ResNet inspect phonetic formants, vocoder phase shifts, and acoustic artifacts with 93.66% test accuracy and 98.71% ROC-AUC.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
            <button onClick={() => setActiveView('dashboard')} className="btn-primary flex items-center justify-center gap-3">
              Open Analysis Console <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => setActiveView('technology')} className="btn-outline flex items-center justify-center gap-3 bg-black">
              View Architecture
            </button>
          </div>
        </div>
        
        {/* Right Side: Neural Flow Widget */}
        <div className="lg:col-span-5 h-[360px] sm:h-[420px] lg:h-[480px] w-full overflow-hidden">
          <NeuralWidget />
        </div>
      </div>

      {/* Official Benchmark Metrics Ribbon */}
      <div className="mt-12 sm:mt-16 p-4 sm:p-6 bg-black border border-[#1f1f1f] grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 font-mono">
        <div className="border-l-2 border-[#CCFF00] pl-3">
          <div className="text-[10px] text-[#888] uppercase tracking-wider">Test Accuracy</div>
          <div className="text-2xl sm:text-3xl font-bold text-white mt-0.5">93.66%</div>
          <div className="text-[9px] text-[#666] mt-0.5">FoR Official Test Split</div>
        </div>
        <div className="border-l-2 border-[#CCFF00] pl-3">
          <div className="text-[10px] text-[#888] uppercase tracking-wider">ROC-AUC</div>
          <div className="text-2xl sm:text-3xl font-bold text-[#CCFF00] mt-0.5">98.71%</div>
          <div className="text-[9px] text-[#666] mt-0.5">Class Separability</div>
        </div>
        <div className="border-l-2 border-[#333] pl-3">
          <div className="text-[10px] text-[#888] uppercase tracking-wider">Equal Error Rate</div>
          <div className="text-2xl sm:text-3xl font-bold text-white mt-0.5">6.34%</div>
          <div className="text-[9px] text-[#666] mt-0.5">EER (FAR = FRR)</div>
        </div>
        <div className="border-l-2 border-[#333] pl-3">
          <div className="text-[10px] text-[#888] uppercase tracking-wider">Deepfake Recall</div>
          <div className="text-2xl sm:text-3xl font-bold text-white mt-0.5">93.57%</div>
          <div className="text-[9px] text-[#666] mt-0.5">509 of 544 Caught</div>
        </div>
        <div className="border-l-2 border-[#333] pl-3 col-span-2 md:col-span-1">
          <div className="text-[10px] text-[#888] uppercase tracking-wider">Decision Boundary</div>
          <div className="text-2xl sm:text-3xl font-bold text-white mt-0.5">0.0509</div>
          <div className="text-[9px] text-[#666] mt-0.5">Youden's J Calibrated</div>
        </div>
      </div>

      {/* Grid Features */}
      <div className="grid md:grid-cols-3 gap-0 mt-8 sm:mt-12 border border-[#1f1f1f] bg-black">
        <GridFeature 
          title="3-Channel Multi-Resolution STFT" 
          desc="Decomposes raw audio into 3 parallel time-frequency channels: 1024-Mel (vocal tract formants), 512-Linear (fast temporal phase transients), and 2048-Linear (pitch overtone harmonics), capturing micro-cues single-window models smudge."
          number="01"
        />
        <GridFeature 
          title="Anisotropic SE-ResNet Backbone" 
          desc="Engineered with alternating (5x3 & 3x5) asymmetric convolutions and Squeeze-and-Excitation channel attention to isolate neural vocoder upsampling checkerboards while dampening acoustic room noise."
          number="02"
        />
        <GridFeature 
          title="768-D Multi-Stat Pooling & Calibration" 
          desc="Extracts Global Mean, StdDev, and Adaptive Max pooling to intercept fleeting 20ms synthetic glitches, calibrated via Youden's J statistic to an optimal 0.0509 decision boundary."
          number="03"
        />
      </div>
    </div>
  );
}

function GridFeature({ title, desc, number }) {
  return (
    <div className="p-6 sm:p-8 border-r border-b md:border-b-0 border-[#1f1f1f] hover:bg-[#050505] transition-colors group">
      <div className="font-mono text-3xl sm:text-4xl text-[#1f1f1f] group-hover:text-[#555] transition-colors mb-4 sm:mb-6">{number}</div>
      <h3 className="text-lg sm:text-xl font-bold uppercase tracking-tight mb-2 sm:mb-3 text-white">{title}</h3>
      <p className="text-[#888888] leading-relaxed text-xs sm:text-sm">{desc}</p>
    </div>
  );
}

/* =========================================
   NEURAL FLOW WIDGET
   ========================================= */
function NeuralWidget() {
  return (
    <div className="tech-panel p-1 relative flex flex-col h-full w-full bg-black">
      <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#1f1f1f] bg-[#0a0a0a]">
        <span className="font-mono text-[10px] text-[#CCFF00] tracking-widest uppercase truncate">
          [ FORENSIC_PIPELINE: MULTI_RES_SE_RESNET_v3 ]
        </span>
        <span className="font-mono text-[10px] text-[#888888] tracking-widest uppercase shrink-0">
          93.66% ACC
        </span>
      </div>
      <div className="flex-1 bg-black p-2 relative flex items-center justify-center overflow-hidden">
         <svg className="w-full h-full" viewBox="0 0 520 400" preserveAspectRatio="xMidYMid meet">
           <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
             <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#111" strokeWidth="1"/>
           </pattern>
           <rect width="520" height="400" fill="url(#grid)" />

           {/* Branching paths from Audio In to 3 STFT Channels */}
           <g fill="transparent" stroke="#2a2a2a" strokeWidth="1.5" strokeDasharray="4,4">
             <path d="M 45 200 C 90 200, 110 80, 165 80" />
             <path d="M 45 200 L 165 200" />
             <path d="M 45 200 C 90 200, 110 320, 165 320" />
             
             {/* Paths from 3 STFT Channels into SE-ResNet Backbone */}
             <path d="M 165 80 C 220 80, 240 200, 295 200" />
             <path d="M 165 200 L 295 200" />
             <path d="M 165 320 C 220 320, 240 200, 295 200" />
             
             {/* Path from SE-ResNet to Multi-Stat Pooling / Head */}
             <path d="M 295 200 L 395 200" />
             
             {/* Path from Pooling Head to Calibrated Verdict */}
             <path d="M 395 200 L 475 200" strokeDasharray="none" stroke="#444" />
           </g>

           {/* Animated Pulse Packets */}
           <g fill="#CCFF00">
             <circle r="3"><animateMotion dur="2.4s" repeatCount="indefinite" path="M 45 200 C 90 200, 110 80, 165 80" /></circle>
             <circle r="3"><animateMotion dur="2.0s" repeatCount="indefinite" path="M 45 200 L 165 200" /></circle>
             <circle r="3"><animateMotion dur="2.6s" repeatCount="indefinite" path="M 45 200 C 90 200, 110 320, 165 320" /></circle>
             
             <circle r="3.5"><animateMotion dur="2.2s" repeatCount="indefinite" path="M 165 80 C 220 80, 240 200, 295 200" /></circle>
             <circle r="3.5"><animateMotion dur="1.8s" repeatCount="indefinite" path="M 165 200 L 295 200" /></circle>
             <circle r="3.5"><animateMotion dur="2.5s" repeatCount="indefinite" path="M 165 320 C 220 320, 240 200, 295 200" /></circle>

             <circle r="4"><animateMotion dur="1.5s" repeatCount="indefinite" path="M 295 200 L 395 200" /></circle>
           </g>
           
           <circle r="4.5" fill="#FF3333">
             <animateMotion dur="1.2s" repeatCount="indefinite" path="M 395 200 L 475 200" />
           </circle>

           {/* Node 1: Raw Audio In */}
           <circle cx="45" cy="200" r="9" fill="#000" stroke="#888" strokeWidth="2" />
           <text x="45" y="175" fill="#aaa" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">AUDIO_IN</text>
           <text x="45" y="225" fill="#666" fontSize="8" fontFamily="monospace" textAnchor="middle">16kHz PCM</text>
           
           {/* STFT Channel 0: 1024-Mel */}
           <circle cx="165" cy="80" r="12" fill="#000" stroke="#CCFF00" strokeWidth="2" />
           <text x="165" y="55" fill="#CCFF00" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">1024_MEL</text>
           <text x="165" y="105" fill="#777" fontSize="8" fontFamily="monospace" textAnchor="middle">FORMANTS</text>
           
           {/* STFT Channel 1: 512-Linear */}
           <circle cx="165" cy="200" r="12" fill="#000" stroke="#CCFF00" strokeWidth="2" />
           <text x="165" y="180" fill="#CCFF00" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">512_TIME</text>
           <text x="165" y="225" fill="#777" fontSize="8" fontFamily="monospace" textAnchor="middle">PHASE TRANSIENTS</text>
           
           {/* STFT Channel 2: 2048-Linear */}
           <circle cx="165" cy="320" r="12" fill="#000" stroke="#CCFF00" strokeWidth="2" />
           <text x="165" y="300" fill="#CCFF00" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">2048_FREQ</text>
           <text x="165" y="345" fill="#777" fontSize="8" fontFamily="monospace" textAnchor="middle">PITCH HARMONICS</text>
           
           {/* Node 3: SE-ResNet Backbone */}
           <circle cx="295" cy="200" r="16" fill="#000" stroke="#CCFF00" strokeWidth="2.5" />
           <text x="295" y="170" fill="#CCFF00" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">SE_RESNET</text>
           <text x="295" y="232" fill="#888" fontSize="8" fontFamily="monospace" textAnchor="middle">ANISOTROPIC_CNN</text>
           
           {/* Node 4: 768-D Multi-Stat Pooling Head */}
           <circle cx="395" cy="200" r="15" fill="#000" stroke="#fff" strokeWidth="2" />
           <text x="395" y="172" fill="#fff" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">768D_POOL</text>
           <text x="395" y="230" fill="#888" fontSize="8" fontFamily="monospace" textAnchor="middle">MEAN/STD/MAX</text>
           
           {/* Node 5: Final Calibrated Verdict */}
           <circle cx="475" cy="200" r="13" fill="#000" stroke="#FF3333" strokeWidth="3">
              <animate attributeName="stroke" values="#555; #FF3333; #CCFF00; #FF3333" dur="2s" repeatCount="indefinite" />
           </circle>
           <text x="475" y="175" fill="#FF3333" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">VERDICT</text>
           <text x="475" y="230" fill="#aaa" fontSize="8" fontFamily="monospace" textAnchor="middle">τ=0.0509</text>
         </svg>
      </div>
    </div>
  );
}


/* =========================================
   HELPER UTILITIES & TELEMETRY COMPONENTS
   ========================================= */
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function PipelineStepper({ activeStage, uploadProgress, uploadPhase }) {
  const stages = [
    { num: '01', name: 'STREAM INGEST', desc: uploadPhase === 'uploading' ? `${uploadProgress}%` : (activeStage > 1 ? 'COMPLETED' : 'READY') },
    { num: '02', name: 'POLYPHASE RESAMPLE', desc: '16kHz PCM / DC' },
    { num: '03', name: 'MULTI-STFT TENSOR', desc: '1024-Mel / 512 / 2048' },
    { num: '04', name: 'SE-RESNET v3', desc: '768-D Multi-Stat Pool' },
    { num: '05', name: 'FORENSIC VERDICT', desc: 'Calibrated τ=0.0509' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[9px] sm:text-[10px] uppercase tracking-wider w-full">
      {stages.map((st, idx) => {
        const stageNum = idx + 1;
        const isDone = activeStage > stageNum || activeStage === 5;
        const isActive = activeStage === stageNum && activeStage !== 5;
        return (
          <div 
            key={st.num}
            className={`p-2 sm:p-2.5 border transition-all ${
              idx === 4 ? 'col-span-2 sm:col-span-1' : ''
            } ${
              isActive 
                ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-white shadow-[0_0_8px_rgba(204,255,0,0.15)]' 
                : (isDone 
                    ? 'border-[#333] bg-[#0a0a0a] text-[#aaa]' 
                    : 'border-[#1a1a1a] bg-[#050505] text-[#555]')
            }`}
          >
            <div className="flex items-center justify-between mb-0.5 sm:mb-1">
              <span className={`text-[8px] sm:text-[9px] font-bold ${isActive ? 'text-[#CCFF00]' : (isDone ? 'text-[#888]' : 'text-[#555]')}`}>
                STAGE {st.num}
              </span>
              {isDone && <span className="text-[#CCFF00] text-[9px] sm:text-[10px] font-bold">✓</span>}
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-ping" />}
            </div>
            <div className="font-bold truncate text-[10px] sm:text-[11px] text-white">{st.name}</div>
            <div className={`text-[8px] sm:text-[9px] truncate mt-0.5 ${isActive ? 'text-[#CCFF00]' : 'text-[#666]'}`}>{st.desc}</div>
          </div>
        );
      })}
    </div>
  );
}

function TelemetryTerminal({ logs, uploadProgress, uploadPhase, isAnalyzing, onAbort, isCollapsed, setIsCollapsed }) {
  return (
    <div className="tech-panel bg-black border border-[#1f1f1f] w-full overflow-hidden">
      {/* Terminal Header */}
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-[#080808] border-b border-[#1f1f1f] flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[9px] sm:text-[10px] tracking-wider uppercase text-[#f5f5f5] min-w-0">
          <Terminal className="w-3.5 h-3.5 text-[#CCFF00] shrink-0" />
          <span className="truncate">TELEMETRY STREAM // PIPELINE LOGS</span>
          {isAnalyzing && (
            <span className="ml-1 sm:ml-2 px-1.5 py-0.5 bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/30 text-[8px] sm:text-[9px] animate-pulse shrink-0">
              {uploadPhase === 'uploading' ? `${uploadProgress}%` : 'BUSY'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isAnalyzing && (
            <button
              onClick={onAbort}
              className="font-mono text-[8px] sm:text-[9px] uppercase tracking-widest text-[#FF3333] border border-[#FF3333]/40 hover:bg-[#FF3333] hover:text-black px-1.5 sm:px-2 py-0.5 transition-colors"
            >
              [ Abort ]
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="font-mono text-[9px] sm:text-[10px] text-[#888] hover:text-white flex items-center gap-1"
          >
            {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            <span>{isCollapsed ? 'EXPAND' : 'COLLAPSE'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      {!isCollapsed && (
        <div className="p-2.5 sm:p-3 bg-[#030303] font-mono text-[10px] sm:text-[11px] h-48 overflow-y-auto space-y-1.5 select-text selection:bg-[#CCFF00] selection:text-black">
          {logs.length === 0 ? (
            <div className="text-[#555] py-4 text-center text-[10px] sm:text-[11px]">
              Awaiting audio stream input to initialize neural telemetry buffer...
            </div>
          ) : (
            logs.map(log => {
              let tagColor = 'text-[#888] border-[#333]';
              if (log.tag === 'INGEST') tagColor = 'text-cyan-400 border-cyan-800/40 bg-cyan-950/20';
              if (log.tag === 'UPLOAD' || log.tag === 'TRANSMIT') tagColor = 'text-amber-400 border-amber-800/40 bg-amber-950/20';
              if (log.tag === 'DSP' || log.tag === 'SPECTRAL') tagColor = 'text-[#CCFF00] border-[#CCFF00]/40 bg-[#CCFF00]/10';
              if (log.tag === 'NEURAL') tagColor = 'text-purple-400 border-purple-800/40 bg-purple-950/20';
              if (log.tag === 'VERDICT') tagColor = log.type === 'danger' ? 'text-[#FF3333] border-[#FF3333]/40 bg-[#FF3333]/10 font-bold' : 'text-[#CCFF00] border-[#CCFF00]/40 bg-[#CCFF00]/10 font-bold';
              if (log.tag === 'ERROR' || log.tag === 'ABORT') tagColor = 'text-[#FF3333] border-[#FF3333]/40 bg-[#FF3333]/10';

              return (
                <div key={log.id} className="leading-relaxed flex items-start gap-1.5 sm:gap-2 break-all sm:break-normal">
                  <span className="text-[#555] select-none shrink-0 text-[9px] sm:text-[10px]">[{log.time}]</span>
                  <span className={`px-1 sm:px-1.5 py-0.5 border text-[8px] sm:text-[9px] shrink-0 ${tagColor}`}>
                    {log.tag}
                  </span>
                  <span className={`break-words min-w-0 ${log.type === 'danger' ? 'text-[#FF3333]' : (log.type === 'success' ? 'text-white' : 'text-[#bbb]')}`}>
                    {log.msg}
                  </span>
                </div>
              );
            })
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-2 text-[#CCFF00] animate-pulse pt-1">
              <span className="inline-block w-2 h-3.5 bg-[#CCFF00]" />
              <span className="text-[9px] sm:text-[10px]">PROCESSING PIPELINE...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================
   LIVE DASHBOARD (Full Backend Connected)
   ========================================= */
function LiveDashboard({ backendStatus, onRetryBackend, auth }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, analyzing, danger, safe, error
  const [fileName, setFileName] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [isLiveDetecting, setIsLiveDetecting] = useState(false);
  const [livePhase, setLivePhase] = useState('IDLE');
  const [liveData, setLiveData] = useState(null);
  const [liveHistory, setLiveHistory] = useState([]);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [detectionData, setDetectionData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // New Upload & Telemetry States
  const [uploadPhase, setUploadPhase] = useState('idle'); // idle, uploading, processing, done, error
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMetrics, setUploadMetrics] = useState({ loadedBytes: 0, totalBytes: 0, fileSizeStr: '', speedStr: '' });
  const [activeStage, setActiveStage] = useState(0);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Speaker Biometrics & Voiceprint Vault States
  const [enrolledProfiles, setEnrolledProfiles] = useState([]);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('');
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollAsOwnDefault, setEnrollAsOwnDefault] = useState(true);
  const selectedSpeakerIdRef = useRef(selectedSpeakerId);

  useEffect(() => {
    selectedSpeakerIdRef.current = selectedSpeakerId;
  }, [selectedSpeakerId]);

  const myProfile = enrolledProfiles.find(p => p.is_own_profile || (auth?.user?.id && p.user_id === auth?.user?.id));

  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const xhrRef = useRef(null);
  const stageTimer1Ref = useRef(null);
  const stageTimer2Ref = useRef(null);
  const logCounterRef = useRef(0);
  const liveSocketRef = useRef(null);
  const liveStreamRef = useRef(null);
  const liveContextRef = useRef(null);
  const liveSourceRef = useRef(null);
  const liveProcessorRef = useRef(null);
  const liveMuteRef = useRef(null);
  const liveAnalyserRef = useRef(null);
  const liveTimerRef = useRef(null);
  const liveStoppingRef = useRef(false);

  const addLog = useCallback((tag, msg, type = 'info') => {
    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0')}`;
    logCounterRef.current += 1;
    const newEntry = { id: logCounterRef.current, time: timeStr, tag, msg, type };
    setTerminalLogs(prev => [...prev.slice(-49), newEntry]);
  }, []);

  const fetchProfiles = useCallback(async () => {
    try {
      const token = auth?.getToken ? await auth.getToken() : null;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/biometrics/profiles`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.profiles)) {
        setEnrolledProfiles(data.profiles);
        if (data.profiles.length > 0) {
          setSelectedSpeakerId(prev => {
            const exists = data.profiles.some(p => p.speaker_id === prev);
            if (exists) return prev;
            const myProfile = data.profiles.find(p => p.is_own_profile);
            return myProfile ? myProfile.speaker_id : data.profiles[0].speaker_id;
          });
        } else {
          setSelectedSpeakerId('');
        }
      }
    } catch (err) {
      console.warn('Could not fetch profiles:', err);
    }
  }, [auth]);

  useEffect(() => {
    let isCurrent = true;
    (async () => {
      if (isCurrent) await fetchProfiles();
    })();
    return () => { isCurrent = false; };
  }, [fetchProfiles, auth?.isSignedIn]);

  const handleSelectSpeaker = useCallback((speakerId) => {
    setSelectedSpeakerId(speakerId);
    const socket = liveSocketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'set_speaker', speaker_id: speakerId || null }));
      const targetName = enrolledProfiles.find(p => p.speaker_id === speakerId)?.name || (speakerId ? speakerId : 'None');
      addLog('BIOMETRIC', `Active target identity switched to: ${targetName}`, 'info');
    }
  }, [addLog, enrolledProfiles]);

  const handleDeleteProfile = useCallback(async (speakerId) => {
    const target = enrolledProfiles.find(p => p.speaker_id === speakerId);
    const targetName = target ? target.name : speakerId;
    if (!window.confirm(`Delete voiceprint profile "${targetName}" from vault?`)) return;
    try {
      const token = auth?.getToken ? await auth.getToken() : null;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/biometrics/profiles/${speakerId}`, { 
        method: 'DELETE',
        headers 
      });
      if (res.ok) {
        addLog('BIOMETRIC', `Deleted profile from vault: ${targetName}`, 'warning');
        await fetchProfiles();
      } else {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || 'Failed to delete profile.';
        alert(msg);
        addLog('BIOMETRIC', `Delete failed: ${msg}`, 'danger');
      }
    } catch (err) {
      console.error('Delete profile error:', err);
      alert('Delete error: ' + err.message);
    }
  }, [addLog, enrolledProfiles, fetchProfiles, auth]);

  const releaseLiveResources = useCallback(() => {
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    liveTimerRef.current = null;
    if (liveProcessorRef.current) {
      liveProcessorRef.current.onaudioprocess = null;
      liveProcessorRef.current.disconnect();
    }
    liveSourceRef.current?.disconnect();
    liveMuteRef.current?.disconnect();
    liveStreamRef.current?.getTracks().forEach(track => track.stop());
    if (liveContextRef.current && liveContextRef.current.state !== 'closed') liveContextRef.current.close();
    liveProcessorRef.current = null;
    liveSourceRef.current = null;
    liveMuteRef.current = null;
    liveAnalyserRef.current = null;
    liveStreamRef.current = null;
    liveContextRef.current = null;
  }, []);

  const stopLiveDetection = useCallback((reason) => {
    liveStoppingRef.current = true;
    const socket = liveSocketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'stop' }));
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'Operator stopped live detection');
    liveSocketRef.current = null;
    releaseLiveResources();
    setIsLiveDetecting(false);
    setLivePhase('IDLE');
    if (reason) {
      setErrorMessage(reason);
      addLog('LIVE', reason, 'warning');
    }
  }, [addLog, releaseLiveResources]);

  const startLiveDetection = useCallback(async () => {
    if (isLiveDetecting || isRecording || isAnalyzing) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.WebSocket || !window.AudioContext) {
      setErrorMessage('Live detection requires microphone, WebSocket, and Web Audio API support.');
      setLivePhase('ERROR');
      return;
    }
    liveStoppingRef.current = false;
    setErrorMessage(null);
    setLiveData(null);
    setLiveHistory([]);
    setLiveSeconds(0);
    setLivePhase('CONNECTING');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (liveStoppingRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const context = new AudioContext();
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      const processor = context.createScriptProcessor(4096, 1, 1);
      const mute = context.createGain();
      mute.gain.value = 0;
      liveStreamRef.current = stream;
      liveContextRef.current = context;
      liveSourceRef.current = source;
      liveAnalyserRef.current = analyser;
      liveProcessorRef.current = processor;
      liveMuteRef.current = mute;

      const token = auth?.getToken ? await auth.getToken() : null;
      const socket = new WebSocket(getLiveWebSocketUrl());
      socket.binaryType = 'arraybuffer';
      liveSocketRef.current = socket;
      socket.onopen = () => {
        if (liveStoppingRef.current) return;
        socket.send(JSON.stringify({ 
          type: 'start', 
          format: 'pcm_s16le', 
          sample_rate: 16000, 
          channels: 1,
          token: token || undefined,
          speaker_id: selectedSpeakerIdRef.current || undefined
        }));
        if (selectedSpeakerIdRef.current) {
          socket.send(JSON.stringify({ type: 'set_speaker', speaker_id: selectedSpeakerIdRef.current }));
        }
        source.connect(analyser);
        analyser.connect(processor);
        processor.connect(mute);
        mute.connect(context.destination);
        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          event.outputBuffer.getChannelData(0).fill(0);
          if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 512 * 1024) return;
          const pcm = resampleTo16k(input, context.sampleRate);
          const encoded = new Int16Array(pcm.length);
          for (let i = 0; i < pcm.length; i += 1) encoded[i] = Math.max(-1, Math.min(1, pcm[i])) * 32767;
          socket.send(encoded.buffer);
        };
        setIsLiveDetecting(true);
        setLivePhase('LISTENING');
        liveTimerRef.current = setInterval(() => setLiveSeconds(seconds => seconds + 1), 1000);
        addLog('LIVE', 'WebSocket open; streaming in-memory PCM 16 kHz mono.', 'success');
      };
      socket.onmessage = (event) => {
        if (liveStoppingRef.current) return;
        let frame;
        try { frame = JSON.parse(event.data); } catch { return; }
        if (frame.type === 'prediction') {
          setLiveData(frame);
          setLivePhase(frame.state || 'ANALYZING');
          setLiveHistory(history => [...history.slice(-(MAX_LIVE_HISTORY - 1)), frame]);
          if (frame.composite_verdict) {
            const isDanger = frame.composite_risk === 'HIGH';
            addLog('SECURITY', `[${frame.composite_verdict}] Fake: ${frame.fake_percentage}% | Match: ${frame.biometrics?.identity_match_percentage ?? '—'}% → ${frame.action_mandated}`, isDanger ? 'danger' : 'success');
          } else {
            addLog('LIVE', `Window ${frame.window_start}s–${frame.window_end}s: fake ${frame.fake_percentage}% (EMA ${frame.smoothed_percentage}%).`, frame.is_fake ? 'danger' : 'success');
          }
        } else if (frame.type === 'status') {
          setLivePhase(frame.state || 'LISTENING');
        } else if (frame.type === 'error') {
          setErrorMessage(frame.message || 'Live analysis error.');
          setLivePhase('ERROR');
          addLog('LIVE', frame.message || 'Live analysis error.', 'danger');
        }
      };
      socket.onerror = () => { setErrorMessage('Unable to connect to VocalGuard analysis server.'); setLivePhase('ERROR'); };
      socket.onclose = () => {
        if (!liveStoppingRef.current) {
          releaseLiveResources();
          setIsLiveDetecting(false);
          setLivePhase('ERROR');
          setErrorMessage('Live analysis stopped because the server disconnected.');
        }
      };
    } catch (err) {
      releaseLiveResources();
      setLivePhase('ERROR');
      setErrorMessage(err.name === 'NotAllowedError' ? 'Microphone permission denied.' : `Unable to start live detection: ${err.message}`);
    }
  }, [addLog, isAnalyzing, isLiveDetecting, isRecording, releaseLiveResources, auth]);

  // Audio Playback Listener
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setIsPlaying(false);
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [audioUrl]);

  // Clean up component timers and abort in-flight XHR on unmount
  useEffect(() => {
    return () => {
      clearTimeout(stageTimer1Ref.current);
      clearTimeout(stageTimer2Ref.current);
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
      liveStoppingRef.current = true;
      liveSocketRef.current?.close();
      releaseLiveResources();
    };
  }, [releaseLiveResources]);

  // Revoke previous audio blob URL when a new one is set or on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Perform Audio Upload and Multi-Stage Inference
  const analyzeAudioBlobOrFile = async (fileOrBlob, displayName) => {
    setFileName(displayName);
    setStatus('analyzing');
    setIsAnalyzing(true);
    setErrorMessage(null);
    setDetectionData(null);
    setTerminalLogs([]);
    setIsTerminalCollapsed(false);

    // Create playable audio preview
    const newAudioUrl = URL.createObjectURL(fileOrBlob);
    setAudioUrl(newAudioUrl);

    const totalBytes = fileOrBlob.size || 0;
    const sizeStr = formatBytes(totalBytes);
    setUploadMetrics({ loadedBytes: 0, totalBytes, fileSizeStr: sizeStr, speedStr: '' });
    setUploadProgress(0);
    setUploadPhase('uploading');
    setActiveStage(1);

    addLog('INGEST', `Stream initialized for "${displayName}" (${sizeStr})`, 'info');
    addLog('TRANSMIT', `Uploading binary audio buffer to ${API_BASE || 'local'} gateway...`, 'info');

    let lastTime = Date.now();
    let lastLoaded = 0;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      const formData = new FormData();
      formData.append('file', fileOrBlob, displayName);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
          setUploadProgress(percent);

          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          if (timeDiff > 0.3) {
            const speed = (event.loaded - lastLoaded) / timeDiff;
            const speedStr = `${formatBytes(speed)}/s`;
            setUploadMetrics({
              loadedBytes: event.loaded,
              totalBytes: event.total,
              fileSizeStr: formatBytes(event.total),
              speedStr,
            });
            lastTime = now;
            lastLoaded = event.loaded;
          }

          if (percent === 25 || percent === 50 || percent === 75) {
            addLog('UPLOAD', `Transferred ${formatBytes(event.loaded)} / ${formatBytes(event.total)} (${percent}%)`, 'info');
          }
        }
      };

      xhr.upload.onload = () => {
        setUploadProgress(100);
        setUploadPhase('processing');
        setActiveStage(2);
        addLog('TRANSMIT', `Upload 100% completed (${sizeStr}). Transferring payload to server memory...`, 'success');
        addLog('DECODE', `Server decoding audio stream via soundfile / ffmpeg fallback...`, 'info');

        // Progressive telemetry feedback while PyTorch inference executes
        stageTimer1Ref.current = setTimeout(() => {
          setActiveStage(3);
          addLog('DSP', `Polyphase resampling to 16,000 Hz & amplitude normalization completed`, 'info');
          addLog('SPECTRAL', `Computing Multi-STFT Spectrograms (windows: 512, 1024, 2048)...`, 'info');
        }, 700);

        stageTimer2Ref.current = setTimeout(() => {
          setActiveStage(4);
          addLog('NEURAL', `Forward pass through MultiDomainDeepfakeDetector with SE-Residual layers...`, 'info');
        }, 1500);
      };

      xhr.onload = () => {
        clearTimeout(stageTimer1Ref.current);
        clearTimeout(stageTimer2Ref.current);
        setIsAnalyzing(false);

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            setDetectionData(result);
            setActiveStage(5);
            setUploadPhase('done');

            addLog('TELEMETRY', `Analyzed ${result.audio_metrics?.windows_analyzed || 1} window(s) across ${result.audio_metrics?.duration_seconds || 0}s duration`, 'success');
            addLog('VERDICT', `Inference finished in ${result.latency_ms}ms: ${result.verdict} (Threat: ${result.threat_score}%)`, result.is_fake ? 'danger' : 'success');

            if (result.is_fake) {
              setStatus('danger');
            } else {
              setStatus('safe');
            }
            resolve(result);
          } catch {
            setStatus('error');
            setUploadPhase('error');
            setErrorMessage('Invalid JSON received from inference engine.');
            addLog('ERROR', 'Invalid JSON response from server.', 'danger');
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            setStatus('error');
            setUploadPhase('error');
            setErrorMessage(err.detail || `Server error (${xhr.status})`);
            addLog('ERROR', `Server error (${xhr.status}): ${err.detail || xhr.statusText}`, 'danger');
          } catch {
            setStatus('error');
            setUploadPhase('error');
            setErrorMessage(`Server error (${xhr.status}): ${xhr.statusText || 'Inference failed'}`);
            addLog('ERROR', `Server responded with status ${xhr.status}`, 'danger');
          }
        }
      };

      xhr.onerror = () => {
        clearTimeout(stageTimer1Ref.current);
        clearTimeout(stageTimer2Ref.current);
        setIsAnalyzing(false);
        setStatus('error');
        setUploadPhase('error');
        setErrorMessage('Network communication error. Please ensure the backend is online.');
        addLog('ERROR', 'Network communication failed with inference server.', 'danger');
      };

      xhr.onabort = () => {
        clearTimeout(stageTimer1Ref.current);
        clearTimeout(stageTimer2Ref.current);
        setIsAnalyzing(false);
        setUploadPhase('idle');
        setStatus('idle');
        addLog('ABORT', 'Audio upload and inference aborted by operator.', 'warning');
      };

      xhr.open('POST', `${API_BASE}/api/detect`);
      if (auth?.getToken) {
        auth.getToken().then(token => {
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.send(formData);
        }).catch(() => {
          xhr.send(formData);
        });
      } else {
        xhr.send(formData);
      }
    });
  };

  const handleAbort = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    clearTimeout(stageTimer1Ref.current);
    clearTimeout(stageTimer2Ref.current);
    setIsAnalyzing(false);
    setUploadPhase('idle');
    setStatus('idle');
  };

  // Upload Audio File
  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      analyzeAudioBlobOrFile(file, file.name);
      e.target.value = '';
    }
  };

  // Demo Sample Loader
  const handleLoadSample = async (samplePath, displayName) => {
    setStatus('analyzing');
    setIsAnalyzing(true);
    setFileName(displayName);
    try {
      const res = await fetch(samplePath);
      const blob = await res.blob();
      analyzeAudioBlobOrFile(blob, displayName);
    } catch (err) {
      setStatus('error');
      setIsAnalyzing(false);
      setErrorMessage(`Failed to load sample: ${err.message}`);
    }
  };

  // Live Microphone Recording
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        analyzeAudioBlobOrFile(audioBlob, `live_mic_${Date.now()}.webm`);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      setStatus('idle');
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert(`Could not access microphone: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
    }
    setIsRecording(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    if (audioRef.current) audioRef.current.pause();
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    clearTimeout(stageTimer1Ref.current);
    clearTimeout(stageTimer2Ref.current);
    setStatus('idle');
    setIsAnalyzing(false);
    setUploadPhase('idle');
    setActiveStage(0);
    setUploadProgress(0);
    setUploadMetrics({ loadedBytes: 0, totalBytes: 0, fileSizeStr: '', speedStr: '' });
    setFileName(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setDetectionData(null);
    setErrorMessage(null);
  };

  const downloadAuditReport = () => {
    if (!detectionData) return;
    const report = {
      timestamp: new Date().toISOString(),
      service: "VocalGuard Deepfake Detection Engine",
      model_architecture: "Multi-Resolution STFT Spectrogram + ResNet SE-Block CNN",
      model_checkpoint: "voice_deepfake_detector.pth",
      file_analyzed: fileName,
      result: detectionData
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocalguard_audit_${fileName ? fileName.replace(/\.[^/.]+$/, "") : 'result'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derive risk percentage for gauge
  const currentRiskScore = detectionData ? detectionData.threat_score : 0;
  const isFakeVerdict = detectionData?.is_fake || status === 'danger';

  return (
    <div className="animate-in fade-in duration-700 w-full">
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {!backendStatus.online && !backendStatus.checking && (
        <div className="mb-4 sm:mb-6 p-3.5 bg-[#FF3333]/10 border border-[#FF3333] text-[#FF3333] font-mono text-[11px] sm:text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_15px_rgba(255,51,51,0.1)]">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#FF3333] mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold text-white uppercase tracking-wider block sm:inline mr-2">Backend Sleeping (Render Free Tier):</span>
              <span className="text-[#FF9999]">Services spin down automatically after 15 minutes of inactivity. Click 'Wake Server' to request a boot (takes ~30–45s).</span>
            </div>
          </div>
          <button 
            onClick={onRetryBackend} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF3333] hover:bg-white text-black font-bold uppercase tracking-wider text-[10px] sm:text-[11px] transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Wake Server Now</span>
          </button>
        </div>
      )}

      {backendStatus.checking && (
        <div className="mb-4 sm:mb-6 p-3.5 bg-amber-400/10 border border-amber-400 text-amber-400 font-mono text-[11px] sm:text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse shadow-[0_0_15px_rgba(251,191,36,0.1)]">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 animate-spin shrink-0 text-amber-400" />
            <div>
              <span className="font-bold text-white uppercase tracking-wider block sm:inline mr-2">Pinging Render Gateway:</span>
              <span className="text-amber-200">Waking up container from 15-minute idle sleep... Initial boot takes ~30–45s. Background auto-polling is active.</span>
            </div>
          </div>
          <span className="text-[10px] bg-black border border-amber-400/50 px-2.5 py-1 text-amber-400 shrink-0 font-bold">
            CONNECTING...
          </span>
        </div>
      )}
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8 border-b border-[#1f1f1f] pb-4 sm:pb-6 gap-3 sm:gap-4 w-full">
        <div className="min-w-0 w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tighter uppercase text-white">Operations Console</h2>
            <span className="font-mono text-[10px] sm:text-xs bg-[#111] text-[#CCFF00] border border-[#222] px-2 py-0.5">
              LIVE INFERENCE
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 font-mono text-[10px] sm:text-xs text-[#888888] min-w-0">
            <span>MODEL: voice_deepfake_detector.pth (SE-ResNet v3)</span>
            <span>THRESHOLD: 5.09% (Youden's J)</span>
            <span>BENCHMARK: 93.66% Acc | 98.71% AUC</span>
            <div className="flex items-center gap-1 min-w-0 max-w-full">
              <span className="shrink-0 text-[#aaa]">INPUT:</span>
              <span className="truncate max-w-[180px] xs:max-w-[240px] sm:max-w-xs text-white" title={fileName}>
                {fileName ? fileName : (isRecording ? 'LIVE_STREAM' : 'STANDBY')}
              </span>
            </div>
          </div>
        </div>
        
        <div className="w-full md:w-auto flex flex-wrap sm:flex-nowrap items-center gap-2.5">
          {/* Quick Ping / Wake Backend Button */}
          <button
            onClick={onRetryBackend}
            disabled={backendStatus.checking}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-[#111] hover:bg-[#1c1c1c] border border-[#333] hover:border-[#CCFF00] text-white font-mono text-[10px] sm:text-xs uppercase tracking-wider transition-all disabled:opacity-50 shrink-0 w-full sm:w-auto group"
            title="Render free-tier instances spin down after 15m. Click to ping the backend or wake it up."
          >
            <RefreshCw className={`w-3.5 h-3.5 ${backendStatus.checking ? 'animate-spin text-[#CCFF00]' : 'text-[#888] group-hover:text-[#CCFF00]'}`} />
            <span>
              {backendStatus.checking 
                ? 'Pinging Server...' 
                : (backendStatus.online ? 'Ping Server' : 'Wake Server')}
            </span>
            {backendStatus.online && backendStatus.latencyMs && (
              <span className="text-[9px] text-[#CCFF00] font-bold px-1 bg-[#CCFF00]/10 border border-[#CCFF00]/30">
                {backendStatus.latencyMs}ms
              </span>
            )}
          </button>

          {/* Status Indicator */}
          <div className={`flex items-center justify-center gap-2 sm:gap-3 tech-panel px-3 sm:px-4 py-2 bg-black border w-full sm:w-auto ${
            status === 'danger' ? 'border-[#FF3333]' : 
            status === 'safe' ? 'border-[#CCFF00]' : 
            status === 'analyzing' ? 'border-[#CCFF00]' : 'border-[#333]'
          }`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${
              status === 'danger' ? 'bg-[#FF3333] animate-ping' : 
              status === 'safe' ? 'bg-[#CCFF00]' : 
              status === 'analyzing' ? 'bg-[#CCFF00] animate-pulse' : 
              isRecording ? 'bg-[#FF3333] animate-pulse' : 'bg-[#555]'
            }`} />
            <span className="font-mono text-[10px] sm:text-xs tracking-widest uppercase text-white truncate text-center">
              {status === 'danger' && 'THREAT DETECTED'}
              {status === 'safe' && 'VOICE VERIFIED (REAL)'}
              {status === 'analyzing' && (uploadPhase === 'uploading' ? `UPLOADING (${uploadProgress}%)` : 'PROCESSING MULTI-STFT...')}
              {status === 'error' && 'INFERENCE ERROR'}
              {status === 'idle' && (isRecording ? `RECORDING (00:${String(recordSeconds).padStart(2, '0')})` : 'SYSTEM ARMED')}
            </span>
          </div>
        </div>
      </div>

      {/* Demo Samples Quick Bar */}
      <div className="mb-6 p-3 sm:p-4 tech-panel bg-[#0a0a0a] border-[#222] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 w-full">
        <div className="flex items-center gap-2 font-mono text-[10px] sm:text-xs text-[#888] shrink-0">
          <Radio className="w-3.5 h-3.5 text-[#CCFF00]" />
          <span>INSTANT DEMO SAMPLES:</span>
        </div>
        <div className="grid grid-cols-1 xs:grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <button
            onClick={() => handleLoadSample('/samples/real_human_voice.m4a', 'real_human_voice.m4a')}
            disabled={isAnalyzing || isRecording || isLiveDetecting}
            className="font-mono text-[10px] sm:text-[11px] tracking-wider uppercase px-2.5 sm:px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#CCFF00] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3 h-3 text-[#CCFF00] shrink-0" /> Real Human
          </button>
          <button
            onClick={() => handleLoadSample('/samples/ai_synthetic_voicemaker.mp3', 'ai_synthetic_voicemaker.mp3')}
            disabled={isAnalyzing || isRecording || isLiveDetecting}
            className="font-mono text-[10px] sm:text-[11px] tracking-wider uppercase px-2.5 sm:px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#FF3333] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <AlertTriangle className="w-3 h-3 text-[#FF3333] shrink-0" /> Voicemaker TTS
          </button>
          <button
            onClick={() => handleLoadSample('/samples/ai_generated_speech.mp3', 'ai_generated_speech.mp3')}
            disabled={isAnalyzing || isRecording || isLiveDetecting}
            className="font-mono text-[10px] sm:text-[11px] tracking-wider uppercase px-2.5 sm:px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#FF3333] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <AlertOctagon className="w-3 h-3 text-[#FF3333] shrink-0" /> Synthetic Speech
          </button>
        </div>
      </div>

      <section className="mb-6 tech-panel bg-black border-[#2a2a2a] overflow-hidden">
        {/* Top Header: Status & Live Controls */}
        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1f1f1f]">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs tracking-widest uppercase text-[#CCFF00]">
              <span className={`w-2 h-2 rounded-full ${isLiveDetecting ? 'bg-[#CCFF00] animate-pulse' : 'bg-[#555]'}`} />
              Live Voice Forensics & Cross-Session Biometrics
            </div>
            <p className="font-mono text-[10px] text-[#777] mt-1">
              PCM 16 kHz mono → 2.0s rolling context → Dual-Factor Verification: Neural Deepfake CNN + 128-D Voiceprint Consistency.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => {
                setEnrollAsOwnDefault(true);
                setIsEnrollModalOpen(true);
              }}
              className="font-mono text-xs uppercase tracking-wider px-3 sm:px-3.5 py-2.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#CCFF00] transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-3.5 h-3.5 text-[#CCFF00]" />
              <span className="hidden sm:inline">Enroll Voice Profile</span>
              <span className="sm:inline hidden text-[10px] text-[#666]">({enrolledProfiles.length})</span>
              <span className="sm:hidden">Vault ({enrolledProfiles.length})</span>
            </button>
            <button
              onClick={isLiveDetecting ? () => stopLiveDetection() : startLiveDetection}
              disabled={isAnalyzing || isRecording || livePhase === 'CONNECTING'}
              className={`font-mono text-xs uppercase tracking-widest font-bold px-4 sm:px-5 py-2.5 sm:py-3 transition-colors disabled:opacity-50 ${isLiveDetecting ? 'bg-[#FF3333] text-black hover:bg-white' : 'bg-[#CCFF00] text-black hover:bg-white'}`}
            >
              {livePhase === 'CONNECTING' ? 'Connecting…' : isLiveDetecting ? `Stop live detection (${liveSeconds}s)` : 'Start live detection'}
            </button>
          </div>
        </div>

        {/* Personal Voiceprint Status Ribbon (Clerk Multi-User Aware) */}
        {auth?.isConfigured && (
          <div className="px-4 sm:px-5 py-2.5 bg-[#0a0f0a] border-b border-[#1c2918] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
            {auth.isSignedIn ? (
              myProfile ? (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-[#CCFF00]/10 border border-[#CCFF00]/40 text-[#CCFF00] shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-bold truncate">Personal Voiceprint Active:</span>
                        <span className="text-[#CCFF00] font-bold">{myProfile.name}</span>
                        <span className="text-[9px] bg-[#1a2e12] text-[#8ce94b] border border-[#2d4f20] px-1.5 py-0.2 uppercase font-bold">128-D PROTECTED</span>
                      </div>
                      <div className="text-[10px] text-[#777] truncate">
                        Bound to Clerk session ({auth.user?.email || auth.user?.name}) · Enrolled {myProfile.enrolled_at}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedSpeakerId !== myProfile.speaker_id ? (
                      <button
                        onClick={() => handleSelectSpeaker(myProfile.speaker_id)}
                        className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider bg-[#CCFF00] text-black hover:bg-white transition-colors"
                      >
                        Target My Voice
                      </button>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#CCFF00] border border-[#CCFF00]/40 px-2 py-0.5 bg-[#CCFF00]/10">
                        ✓ Active Live Target
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setEnrollAsOwnDefault(true);
                        setIsEnrollModalOpen(true);
                      }}
                      className="px-2 py-1 text-[10px] uppercase tracking-wider text-[#aaa] hover:text-white border border-[#333] hover:border-[#555] bg-[#111] transition-colors"
                    >
                      Re-enroll
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-amber-500/10 border border-amber-500/40 text-amber-400 shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-bold text-xs flex items-center gap-2">
                        <span>Personal Voiceprint Not Enrolled</span>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 uppercase font-bold">VULNERABLE</span>
                      </div>
                      <div className="text-[10px] text-[#888] truncate">
                        Signed in as {auth.user?.name}. Enroll your genuine voice to protect yourself from impersonation.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEnrollAsOwnDefault(true);
                      setIsEnrollModalOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-[#CCFF00] text-black hover:bg-white transition-colors flex items-center gap-1.5 shrink-0 shadow-[0_0_8px_rgba(204,255,0,0.2)]"
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>Enroll My Voiceprint</span>
                  </button>
                </>
              )
            ) : (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 bg-[#141414] border border-[#282828] text-[#888] shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-bold text-xs">Clerk Multi-User Biometric Isolation Available</div>
                    <div className="text-[10px] text-[#777] truncate">
                      Sign in to enroll your private personal voiceprint and isolate biometrics to your user session.
                    </div>
                  </div>
                </div>
                {auth.SignInButton ? (
                  <auth.SignInButton mode="modal">
                    <button className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider border border-[#CCFF00] text-[#CCFF00] hover:bg-[#CCFF00] hover:text-black transition-colors shrink-0">
                      Sign In to Enroll
                    </button>
                  </auth.SignInButton>
                ) : null}
              </>
            )}
          </div>
        )}

        {/* Target CXO Selector Ribbon */}
        <div className="px-4 sm:px-5 py-2.5 bg-[#080808] border-b border-[#1a1a1a] flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-[#888] uppercase tracking-wider text-[11px]">
              <Fingerprint className="w-3.5 h-3.5 text-[#00E5FF]" /> Target Executive Profile:
            </span>
            <select
              value={selectedSpeakerId}
              onChange={(e) => handleSelectSpeaker(e.target.value)}
              className="bg-[#111] text-white border border-[#333] px-2.5 py-1 text-xs focus:border-[#CCFF00] focus:outline-none max-w-xs sm:max-w-md truncate"
            >
              {enrolledProfiles.map((p) => {
                const isMine = p.is_own_profile || (auth?.user?.id && p.user_id === auth?.user?.id);
                return (
                  <option key={p.speaker_id} value={p.speaker_id}>
                    {isMine ? '⭐ [MY PROFILE] ' : p.is_system ? '🏛️ [ORG] ' : '👤 '}
                    {p.name} — {p.role} ({p.authorized_limit})
                  </option>
                );
              })}
              <option value="">-- No Target (General Deepfake Only) --</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[#777]">
            <span>Vault:</span>
            <span className="text-[#CCFF00] font-bold">{enrolledProfiles.length} Enrolled</span>
            <span className="text-[#444]">|</span>
            <span>Target Limit:</span>
            <span className="text-white font-medium">
              {enrolledProfiles.find(p => p.speaker_id === selectedSpeakerId)?.authorized_limit || 'Standard'}
            </span>
          </div>
        </div>

        {/* Composite Security Verdict Banner (When evaluated or live active) */}
        {liveData?.composite_verdict && (
          <div className={`px-4 sm:px-5 py-3 border-b font-mono transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
            liveData.composite_verdict === 'CLONED_DEEPFAKE_ATTACK'
              ? 'bg-[#FF3333]/15 border-[#FF3333] text-[#FF3333]'
              : liveData.composite_verdict === 'UNAUTHORIZED_HUMAN_IMPOSTER'
              ? 'bg-amber-500/15 border-amber-500 text-amber-300'
              : liveData.composite_verdict === 'VERIFIED_AUTHORIZED_CALLER'
              ? 'bg-[#CCFF00]/10 border-[#CCFF00]/50 text-[#CCFF00]'
              : 'bg-[#111] border-[#222] text-[#aaa]'
          }`}>
            <div className="flex items-start sm:items-center gap-3">
              {liveData.composite_verdict === 'CLONED_DEEPFAKE_ATTACK' && <ShieldAlert className="w-5 h-5 shrink-0 text-[#FF3333] animate-pulse mt-0.5 sm:mt-0" />}
              {liveData.composite_verdict === 'UNAUTHORIZED_HUMAN_IMPOSTER' && <UserX className="w-5 h-5 shrink-0 text-amber-400 mt-0.5 sm:mt-0" />}
              {liveData.composite_verdict === 'VERIFIED_AUTHORIZED_CALLER' && <ShieldCheck className="w-5 h-5 shrink-0 text-[#CCFF00] mt-0.5 sm:mt-0" />}
              {liveData.composite_verdict === 'GENUINE_HUMAN_VOICE' && <UserCheck className="w-5 h-5 shrink-0 text-white mt-0.5 sm:mt-0" />}
              <div>
                <div className="font-bold text-xs sm:text-sm tracking-wide flex items-center gap-2">
                  <span>SECURITY VERDICT: {liveData.composite_verdict.replace(/_/g, ' ')}</span>
                </div>
                <div className="text-[10px] opacity-80 mt-0.5">
                  {liveData.composite_verdict === 'CLONED_DEEPFAKE_ATTACK' && `Neural vocoder artifacts identified (${liveData.fake_percentage}% synthetic probability vs 5.09% calibrated threshold). High-risk voice cloning attack.`}
                  {liveData.composite_verdict === 'UNAUTHORIZED_HUMAN_IMPOSTER' && `Acoustic voice is organic human, but vocal tract biometrics (${liveData.biometrics?.identity_match_percentage ?? 0}%) DO NOT match authorized identity "${liveData.biometrics?.speaker_name}".`}
                  {liveData.composite_verdict === 'VERIFIED_AUTHORIZED_CALLER' && `Dual criteria satisfied: Organic human speech confirmed (${liveData.fake_percentage}% fake) & Identity verified with ${liveData.biometrics?.speaker_name} (${liveData.biometrics?.identity_match_percentage}% match).`}
                  {liveData.composite_verdict === 'GENUINE_HUMAN_VOICE' && 'Organic human speech verified. No specific executive identity target selected for biometrics.'}
                  {liveData.composite_verdict === 'AMBIENT_NOISE_CNN_GATED' && 'Ambient background silence detected; inference gated until voiced speech is present.'}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-wider opacity-70">Mandate:</span>
              <span className={`px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase border ${
                liveData.composite_risk === 'HIGH'
                  ? 'bg-[#FF3333] text-black border-[#FF3333]'
                  : 'bg-[#CCFF00] text-black border-[#CCFF00]'
              }`}>
                {liveData.action_mandated ? liveData.action_mandated.replace(/_/g, ' ') : 'MONITORING'}
              </span>
            </div>
          </div>
        )}

        {/* Dual Gauges & Waveform Grid */}
        <div className="grid md:grid-cols-12 gap-0">
          {/* Waveform Column */}
          <div className="md:col-span-6 p-4 sm:p-5 border-b md:border-b-0 md:border-r border-[#1f1f1f]">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider mb-3">
              <span className="text-[#888]">Microphone waveform</span>
              <span className={livePhase === 'ERROR' ? 'text-[#FF3333]' : 'text-[#CCFF00]'}>{livePhase}</span>
            </div>
            <LiveWaveform analyserRef={liveAnalyserRef} active={isLiveDetecting} />
            {livePhase === 'BUFFERING' && <div className="mt-2 font-mono text-[10px] text-[#888]">Collecting initial 2-second speech window…</div>}
            {livePhase === 'NO_SPEECH' && <div className="mt-2 font-mono text-[10px] text-amber-300">Ambient silence detected; model gated until voiced speech arrives.</div>}
            {livePhase === 'ERROR' && <div className="mt-2 font-mono text-[10px] text-[#FF3333]">{errorMessage}</div>}
          </div>

          {/* Dual Gauges Column */}
          <div className="md:col-span-6 p-4 sm:p-5 space-y-4 font-mono">
            {/* Dual Gauges Row */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Gauge 1: Synthetic Voice Probability */}
              <div className="p-3 bg-[#0a0a0a] border border-[#1f1f1f]">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-[#777] mb-1">
                  <span>Synthetic Voice</span>
                  <span className={liveData?.is_fake ? 'text-[#FF3333]' : 'text-[#CCFF00]'}>
                    {liveData ? (liveData.is_fake ? 'DEEPFAKE' : 'ORGANIC') : 'STANDBY'}
                  </span>
                </div>
                <div className={`text-2xl sm:text-3xl font-bold ${liveData?.is_fake ? 'text-[#FF3333]' : 'text-white'}`}>
                  {liveData ? `${liveData.fake_percentage}%` : '—'}
                </div>
                {/* Horizontal Meter Bar */}
                <div className="w-full bg-[#1c1c1c] h-1.5 mt-2 relative overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${liveData?.is_fake ? 'bg-[#FF3333]' : 'bg-[#CCFF00]'}`}
                    style={{ width: `${Math.min(100, liveData?.fake_percentage || 0)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-[#FF3333]" style={{ left: '5.09%' }} title="Threshold τ = 5.09%" />
                </div>
                <div className="flex justify-between text-[8px] text-[#666] mt-1.5">
                  <span>EMA: {liveData ? `${liveData.smoothed_percentage}%` : '—'}</span>
                  <span>τ = 5.09%</span>
                </div>
              </div>

              {/* Gauge 2: Speaker Voiceprint Match */}
              <div className="p-3 bg-[#0a0a0a] border border-[#1f1f1f]">
                <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-[#777] mb-1">
                  <span>Voiceprint Match</span>
                  <span className={
                    !liveData?.biometrics?.enrolled ? 'text-[#777]'
                    : liveData.biometrics.is_identity_verified ? 'text-[#CCFF00]'
                    : liveData.biometrics.identity_match_percentage >= 50 ? 'text-amber-400'
                    : 'text-[#FF3333]'
                  }>
                    {!liveData?.biometrics?.enrolled ? 'NO TARGET'
                    : liveData.biometrics.is_identity_verified ? 'MATCH'
                    : liveData.biometrics.identity_match_percentage >= 50 ? 'UNCERTAIN'
                    : 'MISMATCH'}
                  </span>
                </div>
                <div className={`text-2xl sm:text-3xl font-bold ${
                  !liveData?.biometrics?.enrolled ? 'text-[#555]'
                  : liveData.biometrics.is_identity_verified ? 'text-[#CCFF00]'
                  : liveData.biometrics.identity_match_percentage >= 50 ? 'text-amber-400'
                  : 'text-[#FF3333]'
                }`}>
                  {liveData?.biometrics?.enrolled ? `${liveData.biometrics.identity_match_percentage}%` : '—'}
                </div>
                {/* Horizontal Meter Bar */}
                <div className="w-full bg-[#1c1c1c] h-1.5 mt-2 relative overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      !liveData?.biometrics?.enrolled ? 'bg-[#444]'
                      : liveData.biometrics.is_identity_verified ? 'bg-[#CCFF00]'
                      : liveData.biometrics.identity_match_percentage >= 50 ? 'bg-amber-400'
                      : 'bg-[#FF3333]'
                    }`}
                    style={{ width: `${Math.min(100, liveData?.biometrics?.identity_match_percentage || 0)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-[#00E5FF]" style={{ left: '75%' }} title="Threshold ≥ 75%" />
                </div>
                <div className="flex justify-between text-[8px] text-[#666] mt-1.5">
                  <span className="truncate max-w-[90px]" title={liveData?.biometrics?.speaker_name || enrolledProfiles.find(p => p.speaker_id === selectedSpeakerId)?.name || 'No Target'}>
                    {liveData?.biometrics?.speaker_name || enrolledProfiles.find(p => p.speaker_id === selectedSpeakerId)?.name || 'No Target'}
                  </span>
                  <span>Pass: ≥ 75%</span>
                </div>
              </div>
            </div>

            {/* Timeline & Graph */}
            <div className="border-t border-[#1f1f1f] pt-2">
              <div className="flex justify-between text-[9px] uppercase tracking-widest text-[#777] mb-1.5">
                <span>Dual Forensics Timeline</span>
                <span>{liveData?.inference_ms ? `${liveData.inference_ms} ms latency` : 'Awaiting speech'}</span>
              </div>
              <LiveProbabilityGraph history={liveHistory} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visualizer & Controls */}
        <div className="lg:col-span-8 space-y-6">
          <div 
            className={`tech-panel relative bg-black transition-all ${isDragging ? 'ring-2 ring-[#CCFF00]' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                const file = e.dataTransfer.files[0];
                analyzeAudioBlobOrFile(file, file.name);
              }
            }}
          >
            {/* Header controls inside visualizer */}
            <div className="border-b border-[#1f1f1f] px-3 sm:px-6 py-3 sm:py-4 flex flex-col md:flex-row justify-between items-start md:items-center bg-[#050505] gap-3 sm:gap-4 w-full">
              <div className="font-mono text-[10px] sm:text-xs text-[#f5f5f5] flex items-center gap-2 sm:gap-3 min-w-0 max-w-full">
                <Disc className="w-4 h-4 text-[#888888] shrink-0" />
                <span className="truncate max-w-[190px] xs:max-w-[240px] sm:max-w-xs md:max-w-sm" title={fileName}>
                  {fileName ? `ACTIVE: ${fileName}` : (isRecording ? 'STREAM: MICROPHONE_BUFFER' : 'SOURCE: WAITING FOR AUDIO')}
                </span>
                {uploadMetrics.fileSizeStr && (
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 bg-[#1a1a1a] text-[#aaa] border border-[#333]">
                    {uploadMetrics.fileSizeStr}
                  </span>
                )}
              </div>
              
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Audio Playback button if file exists */}
                {audioUrl && !isRecording && (
                  <button
                    onClick={togglePlayback}
                    className="font-mono text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest uppercase bg-[#1a1a1a] border border-[#333] text-white px-2.5 sm:px-3 py-2 hover:border-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    {isPlaying ? <Square className="w-3 h-3 fill-white shrink-0" /> : <Play className="w-3 h-3 fill-white shrink-0" />}
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                )}

                {/* Live Mic Button */}
                {!isRecording ? (
                  <button 
                    onClick={startRecording}
                    disabled={isAnalyzing || isLiveDetecting}
                    className="font-mono text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest uppercase bg-[#111] border border-[#333] text-[#f5f5f5] px-2.5 sm:px-4 py-2 hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Mic className="w-3 h-3 shrink-0" /> Record Mic
                  </button>
                ) : (
                  <button 
                    onClick={stopRecording}
                    className="col-span-2 sm:col-span-1 font-mono text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest uppercase bg-[#FF3333] text-black px-3 sm:px-4 py-2 hover:bg-white transition-colors flex items-center justify-center gap-1.5 animate-pulse"
                  >
                    <Square className="w-3 h-3 fill-black shrink-0" /> Stop ({recordSeconds}s)
                  </button>
                )}
                
                {/* Upload Button */}
                <label className="font-mono text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest uppercase bg-white text-black px-2.5 sm:px-4 py-2 hover:bg-[#CCFF00] transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload className="w-3 h-3 shrink-0" /> Upload Audio
                  <input 
                    type="file" 
                    accept="audio/*,video/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={isLiveDetecting}
                  />
                </label>

                {(status === 'danger' || status === 'safe' || status === 'error' || isAnalyzing) && (
                  <button 
                    onClick={handleReset}
                    className="font-mono text-[9px] sm:text-[10px] tracking-wider sm:tracking-widest uppercase bg-[#111] border border-[#333] text-[#f5f5f5] px-2.5 sm:px-4 py-2 hover:border-white hover:text-white transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3 shrink-0" /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Dynamic In-Flight Progress Bar for Uploads */}
            {uploadPhase === 'uploading' && (
              <div className="p-3 sm:p-4 bg-[#0a0a0a] border-b border-[#1f1f1f] space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center font-mono text-[11px] sm:text-xs gap-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[#CCFF00]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span className="font-bold uppercase tracking-wider text-[10px] sm:text-xs">UPLOADING AUDIO STREAM</span>
                    <span className="text-white">({uploadProgress}%)</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-[#aaa]">
                    <span>{uploadMetrics.loadedBytes ? formatBytes(uploadMetrics.loadedBytes) : '0 B'}</span>
                    <span className="text-[#666]"> / </span>
                    <span className="text-white font-bold">{uploadMetrics.fileSizeStr || '—'}</span>
                    {uploadMetrics.speedStr && <span className="ml-1 sm:ml-2 text-[#CCFF00]">[{uploadMetrics.speedStr}]</span>}
                  </div>
                </div>
                
                <div className="w-full bg-[#151515] h-2 sm:h-2.5 overflow-hidden border border-[#222]">
                  <div 
                    className="h-full bg-gradient-to-r from-[#CCFF00]/80 to-[#CCFF00] transition-all duration-150 shadow-[0_0_12px_rgba(204,255,0,0.5)]" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadPhase === 'processing' && (
              <div className="p-3 sm:p-4 bg-[#0a0a0a] border-b border-[#1f1f1f] space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center font-mono text-[11px] sm:text-xs gap-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[#CCFF00]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span className="font-bold uppercase tracking-wider text-[10px] sm:text-xs">PAYLOAD UPLOADED — INFERENCE IN PROGRESS</span>
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-[#CCFF00] uppercase tracking-widest">
                    [ PYTORCH MULTI-STFT CNN ]
                  </div>
                </div>
                
                <div className="w-full bg-[#151515] h-2 overflow-hidden border border-[#222]">
                  <div className="h-full bg-[#CCFF00] animate-[pulse_1s_ease-in-out_infinite] w-full" />
                </div>
              </div>
            )}

            {/* Brutalist Waveform & Visualizer */}
            <div className="h-64 sm:h-72 p-3 sm:p-6 flex flex-col justify-center relative overflow-hidden bg-black w-full max-w-full">
              
              {/* Drag & drop overlay */}
              {isDragging && (
                <div className="absolute inset-0 z-30 bg-black/90 border-2 border-dashed border-[#CCFF00] flex flex-col items-center justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-150">
                  <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-[#CCFF00] animate-bounce mb-2 sm:mb-3" />
                  <div className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-widest text-center">
                    Drop Audio File To Inspect
                  </div>
                  <div className="font-mono text-[10px] sm:text-xs text-[#888] mt-1 text-center">
                    Accepts .wav, .mp3, .m4a, .aac, .ogg, .flac, .webm (Universal Decoders)
                  </div>
                </div>
              )}

              {/* Background grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between py-4 sm:py-6 pointer-events-none opacity-20">
                <div className="w-full border-t border-dashed border-[#888888]" />
                <div className="w-full border-t border-dashed border-[#888888]" />
                <div className="w-full border-t border-dashed border-[#888888]" />
              </div>

              {status === 'idle' && !isRecording ? (
                <div className="text-center font-mono text-[#555] tracking-widest uppercase text-xs sm:text-sm space-y-1.5 sm:space-y-2 px-2">
                  <div className="flex items-center justify-center gap-2 text-[#777]">
                    <FileAudio className="w-4 h-4 shrink-0" />
                    <span>Drop audio file or record speech to inspect</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-[#444]">Supports .wav, .mp3, .m4a, .aac, .flac, .ogg, .webm</div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-0.5 sm:gap-1 md:gap-[2px] h-32 sm:h-36 w-full max-w-full overflow-hidden px-1 sm:px-2">
                  {[...Array(48)].map((_, i) => {
                    const isDanger = status === 'danger';
                    const isSafe = status === 'safe';
                    const activeBar = isAnalyzing || isPlaying || isRecording;
                    const seed = (Math.sin(i * 0.4) + 1) / 2;
                    const harmonicVariance = ((i * 17) % 31) / 31;
                    const heightPercent = activeBar 
                      ? Math.min(100, Math.max(12, Math.floor(seed * 65 + harmonicVariance * 35))) 
                      : (isDanger ? Math.min(95, Math.max(15, (i % 7) * 14 + 10)) : 10);

                    return (
                      <div 
                        key={i} 
                        className={`w-1 xs:w-1.5 sm:w-2 shrink-0 transition-all duration-150 ${
                          isDanger ? 'bg-[#FF3333]' : 
                          isSafe ? 'bg-[#CCFF00]' : 
                          isRecording ? 'bg-[#FF3333]' : 'bg-[#CCFF00]'
                        }`}
                        style={{ 
                          height: `${heightPercent}%`,
                          opacity: isDanger && (i % 3 === 0) ? 0.6 : 1
                        }}
                      />
                    );
                  })}
                </div>
              )}
              
              {/* Alert Overlays */}
              {status === 'danger' && (
                <div className="absolute inset-0 bg-[#FF3333]/15 flex items-center justify-center backdrop-blur-[2px] p-3 animate-in fade-in duration-300">
                   <div className="bg-black border-2 border-[#FF3333] p-3 sm:p-5 flex items-center gap-3 sm:gap-4 max-w-[94%] sm:max-w-md shadow-2xl">
                     <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-[#FF3333] shrink-0 animate-bounce" />
                     <div className="min-w-0">
                       <div className="font-mono font-bold text-xs sm:text-base text-[#FF3333] tracking-wider sm:tracking-widest uppercase truncate sm:whitespace-normal">
                         🚨 SYNTHETIC MATCH DETECTED
                       </div>
                       <div className="font-mono text-[10px] sm:text-xs text-[#ccc] mt-0.5 sm:mt-1 leading-snug">
                         High confidence of AI text-to-speech / neural vocoder generation.
                       </div>
                     </div>
                   </div>
                </div>
              )}

              {status === 'safe' && (
                <div className="absolute inset-0 bg-[#CCFF00]/10 flex items-center justify-center backdrop-blur-[2px] p-3 animate-in fade-in duration-300">
                   <div className="bg-black border-2 border-[#CCFF00] p-3 sm:p-5 flex items-center gap-3 sm:gap-4 max-w-[94%] sm:max-w-md shadow-2xl">
                     <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-[#CCFF00] shrink-0" />
                     <div className="min-w-0">
                       <div className="font-mono font-bold text-xs sm:text-base text-[#CCFF00] tracking-wider sm:tracking-widest uppercase truncate sm:whitespace-normal">
                         ✅ VERIFIED HUMAN VOICE
                       </div>
                       <div className="font-mono text-[10px] sm:text-xs text-[#ccc] mt-0.5 sm:mt-1 leading-snug">
                         Authentic acoustic harmonics confirmed. No deepfake anomalies.
                       </div>
                     </div>
                   </div>
                </div>
              )}

              {status === 'error' && (
                <div className="absolute inset-0 bg-[#FF3333]/20 flex items-center justify-center backdrop-blur-[2px] p-3">
                   <div className="bg-black border border-[#FF3333] p-3 sm:p-4 text-center max-w-[94%] sm:max-w-md">
                     <div className="font-mono font-bold text-xs text-[#FF3333] tracking-widest uppercase mb-1">
                       Inference Failed
                     </div>
                     <div className="font-mono text-[10px] sm:text-[11px] text-[#aaa] break-words">
                       {errorMessage}
                     </div>
                   </div>
                </div>
              )}
            </div>

            {/* Audio Info Strip */}
            {detectionData && (
              <div className="border-t border-[#1f1f1f] bg-[#070707] px-3 sm:px-6 py-2.5 sm:py-3 grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-between gap-2 sm:gap-4 font-mono text-[10px] sm:text-[11px] text-[#888]">
                <div>DURATION: <span className="text-white">{detectionData.audio_metrics?.duration_seconds}s</span></div>
                <div>WINDOWS: <span className="text-white">{detectionData.audio_metrics?.windows_analyzed}</span></div>
                <div>PEAK AMP: <span className="text-white">{detectionData.audio_metrics?.peak_amplitude}</span></div>
                <div>SPECTRAL CENTROID: <span className="text-white">{detectionData.audio_metrics?.spectral_centroid_hz} Hz</span></div>
                <div className="col-span-2 sm:col-span-1">LATENCY: <span className="text-[#CCFF00]">{detectionData.latency_ms} ms</span></div>
              </div>
            )}
          </div>

          {/* Multi-Stage Pipeline Stepper */}
          {(isAnalyzing || status !== 'idle') && (
            <PipelineStepper 
              activeStage={activeStage} 
              uploadProgress={uploadProgress} 
              uploadPhase={uploadPhase} 
            />
          )}

          {/* Live Telemetry Terminal Logs */}
          <TelemetryTerminal 
            logs={terminalLogs}
            uploadProgress={uploadProgress}
            uploadPhase={uploadPhase}
            isAnalyzing={isAnalyzing}
            onAbort={handleAbort}
            isCollapsed={isTerminalCollapsed}
            setIsCollapsed={setIsTerminalCollapsed}
          />

          {/* Data Modules */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
            <DataModule 
              title="Spectral Align" 
              value={
                detectionData 
                  ? detectionData.spectral_flags?.phase_anomaly 
                  : (status === 'idle' ? 'STANDBY' : 'CALCULATING')
              }
              isAlert={detectionData?.spectral_flags?.phase_anomaly === 'ERR_PHASE'}
            />
            <DataModule 
              title="Vocoder Cues" 
              value={
                detectionData 
                  ? detectionData.spectral_flags?.vocoder_artifacts 
                  : (status === 'idle' ? 'STANDBY' : 'ANALYZING')
              }
              isAlert={detectionData?.spectral_flags?.vocoder_artifacts === 'SYNTH_MATCH'}
            />
            <DataModule 
              title="Prosody Shift" 
              value={
                detectionData 
                  ? detectionData.spectral_flags?.prosody_stability 
                  : (status === 'idle' ? 'STANDBY' : 'EVALUATING')
              }
              isAlert={detectionData?.spectral_flags?.prosody_stability === 'UNNATURAL'}
            />
            <DataModule 
              title="Alert Level" 
              value={
                detectionData 
                  ? detectionData.alert_level 
                  : (status === 'idle' ? 'ARMED' : 'EVAL')
              }
              isAlert={detectionData?.alert_level === 'CRITICAL' || detectionData?.alert_level === 'HIGH'}
            />
          </div>

          {/* Sliding Window Breakdown (if multi-window) */}
          {detectionData && detectionData.windows && detectionData.windows.length > 1 && (
            <div className="tech-panel bg-black p-3.5 sm:p-5 border border-[#1f1f1f]">
              <div className="font-mono text-[11px] sm:text-xs tracking-widest uppercase text-[#888888] mb-3 flex flex-wrap items-center justify-between gap-2">
                <span>Multi-Window Temporal Analysis ({detectionData.windows.length} Segments)</span>
                <span className="text-[9px] sm:text-[10px] text-[#555]">2.0s SLIDING WINDOWS</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {detectionData.windows.map((w, idx) => (
                  <div 
                    key={idx}
                    className={`p-2 sm:p-2.5 border text-center font-mono text-[9px] sm:text-[10px] ${
                      w.is_fake 
                        ? 'border-[#FF3333]/50 bg-[#FF3333]/10 text-[#FF3333]' 
                        : 'border-[#333] bg-[#0a0a0a] text-[#888]'
                    }`}
                  >
                    <div className="font-bold">{w.start_time}s - {w.end_time}s</div>
                    <div className="mt-1 text-xs">{w.fake_percentage}%</div>
                    <div className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5">
                      {w.is_fake ? 'FAKE' : 'REAL'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Threat Probability & Protocol Enforcement */}
        <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-6">
          
          <div className="tech-panel bg-black flex-1 p-4 sm:p-6 flex flex-col justify-between border border-[#1f1f1f]">
            <div className="font-mono text-xs tracking-widest uppercase text-[#888888] border-b border-[#1f1f1f] pb-3 sm:pb-4 mb-4 sm:mb-6 flex justify-between items-center">
              <span>Threat Probability</span>
              {detectionData && (
                <span className={`text-[10px] px-2 py-0.5 font-bold ${isFakeVerdict ? 'bg-[#FF3333] text-black' : 'bg-[#CCFF00] text-black'}`}>
                  {detectionData.verdict}
                </span>
              )}
            </div>
            
            <div className="text-center my-2 sm:my-4">
              <span className={`text-5xl xs:text-6xl sm:text-7xl font-bold tracking-tighter ${
                isFakeVerdict ? 'text-[#FF3333]' : (status === 'safe' ? 'text-[#CCFF00]' : 'text-white')
              }`}>
                {Math.round(currentRiskScore)}<span className="text-3xl sm:text-4xl text-[#555]">%</span>
              </span>
              
              <div className="mt-3 sm:mt-4 font-mono text-[11px] sm:text-xs tracking-wider sm:tracking-widest uppercase text-[#aaa] break-words">
                {detectionData ? (
                  isFakeVerdict 
                    ? `AI DEEPFAKE PROBABILITY: ${detectionData.fake_probability_pct}% (Above 5.09% Threshold)` 
                    : `HUMAN AUTHENTICITY: ${detectionData.real_probability_pct}% (Below 5.09% Threshold)`
                ) : 'Calibrated Decision Threshold: 5.09% (Youden\'s J Optimal)'}
              </div>

              {detectionData && (
                <div className="mt-1.5 sm:mt-2 font-mono text-[9px] sm:text-[10px] text-[#666]">
                  Decision Boundary: {detectionData.threshold} (5.09%) | Analyzed Windows: {detectionData.audio_metrics?.windows_analyzed}
                </div>
              )}
            </div>

            <div className="mt-6 sm:mt-8">
               <div className="w-full bg-[#111] h-3 relative">
                 {/* 5.09% threshold mark */}
                 <div 
                   className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-white z-10" 
                   style={{ left: '5.09%' }}
                   title="Model Decision Threshold (5.09%)"
                 />
                 <div 
                   className={`h-full transition-all duration-500 ${isFakeVerdict ? 'bg-[#FF3333]' : 'bg-[#CCFF00]'}`} 
                   style={{ width: `${Math.min(100, Math.max(0, currentRiskScore))}%` }}
                 />
               </div>
               <div className="flex justify-between font-mono text-[8px] sm:text-[9px] text-[#666] mt-1">
                 <span>0% REAL</span>
                 <span className="text-[#CCFF00]">| THRESHOLD 5.09% (YOUDEN'S J)</span>
                 <span>100% AI</span>
               </div>
            </div>
          </div>

          {/* Action Module */}
          <div className="tech-panel bg-black p-4 sm:p-6 border border-[#1f1f1f]">
            <div className="font-mono text-xs tracking-widest uppercase text-[#888888] mb-3 sm:mb-4">
              Protocol Enforcement & Export
            </div>
            {detectionData ? (
              <div className="space-y-2.5 sm:space-y-3 animate-in slide-in-from-bottom-2">
                {isFakeVerdict ? (
                  <button 
                    onClick={() => alert(`Connection Blocked: Synthetic identity impersonation detected on file ${fileName}`)}
                    className="w-full py-2.5 sm:py-3 bg-[#FF3333] text-black font-mono font-bold text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest hover:bg-white transition-colors"
                  >
                    🚨 Block Audio Stream
                  </button>
                ) : (
                  <button 
                    onClick={() => alert(`Connection Approved: Verified human voice authentication for ${fileName}`)}
                    className="w-full py-2.5 sm:py-3 bg-[#CCFF00] text-black font-mono font-bold text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest hover:bg-white transition-colors"
                  >
                    ✅ Authorize Stream
                  </button>
                )}
                
                <button 
                  onClick={downloadAuditReport}
                  className="w-full py-2.5 sm:py-3 bg-transparent border border-[#333] text-white font-mono font-bold text-[11px] sm:text-xs uppercase tracking-wider sm:tracking-widest hover:border-white transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Download Audit JSON
                </button>
              </div>
            ) : (
              <div className="h-[80px] sm:h-[98px] flex items-center justify-center border border-[#1f1f1f] border-dashed">
                <span className="font-mono text-[9px] sm:text-[10px] text-[#555] uppercase">Waiting for audio analysis...</span>
              </div>
            )}
          </div>
        </div>

        {/* Enroll CXO Voiceprint Vault Modal */}
        <EnrollExecutiveModal
          isOpen={isEnrollModalOpen}
          onClose={() => setIsEnrollModalOpen(false)}
          onEnrolled={(newId) => {
            fetchProfiles();
            if (newId) handleSelectSpeaker(newId);
          }}
          enrolledProfiles={enrolledProfiles}
          onDeleteProfile={handleDeleteProfile}
          auth={auth}
          initialIsOwnProfile={enrollAsOwnDefault}
        />

      </div>
    </div>
  );
}

function DataModule({ title, value, isAlert }) {
  return (
    <div className={`tech-panel bg-black p-3 sm:p-5 border-l-2 ${isAlert ? 'border-l-[#FF3333]' : 'border-l-[#333]'}`}>
      <h4 className="font-mono text-[9px] sm:text-[10px] text-[#888888] uppercase tracking-wider sm:tracking-widest mb-1 truncate">{title}</h4>
      <div className={`font-mono text-sm sm:text-lg font-bold truncate ${isAlert ? 'text-[#FF3333]' : 'text-[#f5f5f5]'}`}>
        {value}
      </div>
    </div>
  );
}

function LiveWaveform({ analyserRef, active }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    let frameId;
    const render = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const scale = window.devicePixelRatio || 1;
      if (canvas.width !== width * scale || canvas.height !== height * scale) {
        canvas.width = width * scale;
        canvas.height = height * scale;
        context.setTransform(scale, 0, 0, scale, 0, 0);
      }
      context.fillStyle = '#070707';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = active ? '#CCFF00' : '#444444';
      context.lineWidth = 1.5;
      context.beginPath();
      const analyser = analyserRef.current;
      const values = analyser ? new Uint8Array(analyser.fftSize) : null;
      if (values) analyser.getByteTimeDomainData(values);
      for (let index = 0; index < width; index += 1) {
        const sourceIndex = values ? Math.floor(index * values.length / width) : 0;
        const y = values ? ((values[sourceIndex] - 128) / 128) * height * 0.42 + height / 2 : height / 2;
        if (index === 0) context.moveTo(index, y); else context.lineTo(index, y);
      }
      context.stroke();
      frameId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frameId);
  }, [active, analyserRef]);

  return <canvas ref={canvasRef} className="block w-full h-24 border border-[#1f1f1f]" aria-label="Live microphone waveform" />;
}

function LiveProbabilityGraph({ history }) {
  if (!history.length) return <div className="h-16 flex items-center justify-center border border-dashed border-[#222] text-[9px] text-[#555]">PREDICTIONS WILL APPEAR AFTER 2 SECONDS OF SPEECH</div>;
  const viewWidth = 300;
  const viewHeight = 64;
  const slice = history.slice(-60);
  const fakePoints = slice.map((frame, index, list) => {
    const x = list.length === 1 ? viewWidth : index * viewWidth / (list.length - 1);
    const y = viewHeight - (frame.smoothed_fake_probability * viewHeight);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const bioPoints = slice.map((frame, index, list) => {
    const x = list.length === 1 ? viewWidth : index * viewWidth / (list.length - 1);
    const bioPercent = (frame.biometrics?.identity_match_percentage ?? 0) / 100.0;
    const y = viewHeight - (bioPercent * viewHeight);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div>
      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="block w-full h-16 border border-[#1f1f1f] bg-[#070707]" preserveAspectRatio="none" aria-label="Smoothed fake probability and voiceprint match over time">
        {/* Baseline threshold for Fake (τ = 5.09%) */}
        <path d={`M0 ${viewHeight * (1 - 0.0509)} H${viewWidth}`} stroke="#FF3333" strokeDasharray="3 3" strokeOpacity="0.4" />
        {/* Pass threshold for Biometrics (75%) */}
        <path d={`M0 ${viewHeight * (1 - 0.75)} H${viewWidth}`} stroke="#00E5FF" strokeDasharray="3 3" strokeOpacity="0.4" />
        {/* Biometrics trace (cyan dashed) */}
        <polyline points={bioPoints} fill="none" stroke="#00E5FF" strokeWidth="1.5" strokeDasharray="4 2" vectorEffect="non-scaling-stroke" />
        {/* Fake probability trace (lime solid) */}
        <polyline points={fakePoints} fill="none" stroke="#CCFF00" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex items-center justify-between text-[8px] text-[#777] font-mono mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-0.5 bg-[#CCFF00]" /> Fake Prob (τ=5.09%)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-0.5 bg-[#00E5FF] border-b border-dashed" /> Voiceprint Match (Pass ≥ 75%)</span>
      </div>
    </div>
  );
}

function EnrollExecutiveModal({ isOpen, onClose, onEnrolled, enrolledProfiles, onDeleteProfile, auth, initialIsOwnProfile = true }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'record'
  const [name, setName] = useState('');
  const [role, setRole] = useState('Authorized Operator');
  const [authorizedLimit, setAuthorizedLimit] = useState('₹ 5,00,00,000');
  const [isOwnProfile, setIsOwnProfile] = useState(initialIsOwnProfile !== false);
  const [file, setFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setIsOwnProfile(initialIsOwnProfile !== false);
    if (auth?.isSignedIn && auth?.user?.name) {
      setName(auth.user.name);
      setRole('Authorized Operator');
    }
  }, [initialIsOwnProfile, auth?.isSignedIn, auth?.user, isOpen]);

  const handleCloseModal = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setErrorMsg(null);
    setSuccessMsg(null);
    onClose();
  };

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setRecordedBlob(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start(100);
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    } catch (err) {
      setErrorMsg('Microphone permission denied: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter operator full name.');
      return;
    }

    const audioToUpload = activeTab === 'upload' ? file : recordedBlob;
    if (!audioToUpload) {
      setErrorMsg(activeTab === 'upload' ? 'Please select an audio file (.wav, .mp3, .m4a).' : 'Please record at least 2-3 seconds of speech.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('role', role.trim());
      formData.append('authorized_limit', authorizedLimit.trim());
      if (isOwnProfile && auth?.isSignedIn) {
        formData.append('is_own_profile', 'true');
      }
      const fileName = activeTab === 'upload' ? (file.name || 'reference.wav') : 'recorded_sample.wav';
      formData.append('file', audioToUpload, fileName);

      const token = auth?.getToken ? await auth.getToken() : null;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const res = await fetch(`${API_BASE}/api/biometrics/enroll`, {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Voiceprint enrollment failed.');
      }
      setSuccessMsg(`Successfully enrolled ${name}! 128-D voiceprint committed to vault.`);
      setName('');
      setFile(null);
      setRecordedBlob(null);
      if (onEnrolled) onEnrolled(data.speaker_id);
    } catch (err) {
      setErrorMsg(err.message || 'Enrollment error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0a0a0a] border border-[#2a2a2a] max-w-2xl w-full max-h-[90vh] overflow-y-auto font-mono text-white p-4 sm:p-6 shadow-2xl relative">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#1f1f1f] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00]">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-[#CCFF00]">// Biometric Vault</div>
              <h3 className="text-base sm:text-lg font-bold uppercase tracking-tight text-white">Enroll Voiceprint Profile</h3>
            </div>
          </div>
          <button 
            onClick={handleCloseModal}
            className="text-[#666] hover:text-white transition-colors p-1 border border-transparent hover:border-[#333]"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* DPDP Compliance Notice */}
        <div className="p-3 bg-[#111] border border-[#222] text-[10px] text-[#888] leading-relaxed mb-4">
          <span className="text-[#CCFF00] font-bold">DPDP Act Privacy Compliant:</span> Raw audio is processed strictly in-memory into a 128-dimensional acoustic sub-band feature vector. No raw audio files are permanently retained in the biometric vault.
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div className="mb-4 p-2.5 bg-[#FF3333]/15 border border-[#FF3333] text-[#FF3333] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-2.5 bg-[#CCFF00]/15 border border-[#CCFF00] text-[#CCFF00] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Enrollment Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Own Profile Toggle for Signed-In Users */}
          {auth?.isSignedIn && (
            <div className="p-3 bg-[#0d140b] border border-[#CCFF00]/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-4 h-4 text-[#CCFF00] shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Enroll as My Personal Voiceprint</div>
                  <div className="text-[10px] text-[#888]">
                    Tags this 128-D vector to your user account (<span className="text-[#CCFF00]">{auth.user?.email || auth.user?.name}</span>).
                  </div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOwnProfile}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setIsOwnProfile(val);
                    if (val && auth.user?.name && !name) {
                      setName(auth.user.name);
                    }
                  }}
                  className="w-4 h-4 accent-[#CCFF00] cursor-pointer"
                />
              </label>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#888] mb-1">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Operator Full Name"
                required
                className="w-full bg-[#111] border border-[#333] px-3 py-2 text-xs text-white placeholder-[#555] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[#888] mb-1">Corporate Role / Designation *</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Authorized Operator"
                required
                className="w-full bg-[#111] border border-[#333] px-3 py-2 text-xs text-white placeholder-[#555] focus:border-[#CCFF00] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#888] mb-1">Authorized Transaction Limit *</label>
            <input
              type="text"
              value={authorizedLimit}
              onChange={(e) => setAuthorizedLimit(e.target.value)}
              placeholder="e.g. ₹ 5,00,00,000"
              required
              className="w-full bg-[#111] border border-[#333] px-3 py-2 text-xs text-white placeholder-[#555] focus:border-[#CCFF00] focus:outline-none"
            />
          </div>

          {/* Audio Input Tabs */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[#888] mb-1">Reference Audio Sample *</label>
            <div className="flex border-b border-[#222] mb-3">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border-b-2 transition-colors ${activeTab === 'upload' ? 'border-[#CCFF00] text-[#CCFF00]' : 'border-transparent text-[#666] hover:text-[#aaa]'}`}
              >
                Upload File (.wav/.mp3/.m4a)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('record')}
                className={`px-3 py-1.5 text-xs font-mono tracking-wider uppercase border-b-2 transition-colors ${activeTab === 'record' ? 'border-[#CCFF00] text-[#CCFF00]' : 'border-transparent text-[#666] hover:text-[#aaa]'}`}
              >
                Record Live Microphone
              </button>
            </div>

            {activeTab === 'upload' ? (
              <div className="p-4 border border-dashed border-[#333] bg-[#0d0d0d] text-center">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-[#888] file:mr-3 file:py-1.5 file:px-3 file:border-0 file:text-xs file:font-mono file:bg-[#222] file:text-white hover:file:bg-[#333] file:cursor-pointer"
                />
                {file && <div className="text-[10px] text-[#CCFF00] mt-2 font-mono">Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</div>}
              </div>
            ) : (
              <div className="p-4 border border-[#333] bg-[#0d0d0d] flex flex-col items-center justify-center gap-3">
                <div className="text-center">
                  <div className="text-xs text-white font-bold">
                    {isRecording ? `Recording... (${recordSeconds}s)` : (recordedBlob ? `Sample Recorded (${recordSeconds}s)` : 'Speak 3-5 seconds of clear reference speech')}
                  </div>
                  <div className="text-[10px] text-[#777] mt-0.5">e.g. "This is an authorized operator voice sample for biometric verification."</div>
                </div>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-4 py-2 bg-[#111] hover:bg-[#222] border border-[#333] hover:border-[#CCFF00] text-white text-xs uppercase tracking-wider flex items-center gap-2"
                  >
                    <Mic className="w-3.5 h-3.5 text-[#CCFF00]" /> Start Recording
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-4 py-2 bg-[#FF3333] text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5 fill-black" /> Stop Recording ({recordSeconds}s)
                  </button>
                )}
                {recordedBlob && (
                  <div className="text-[10px] text-[#CCFF00] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Audio clip captured ready for feature extraction
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-xs uppercase tracking-wider text-[#888] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!file && !recordedBlob)}
              className="px-5 py-2 bg-[#CCFF00] hover:bg-white text-black font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-2 shadow-[0_0_10px_rgba(204,255,0,0.2)]"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint className="w-3.5 h-3.5" />}
              {isSubmitting ? 'Extracting 128-D Vector…' : 'Extract & Commit Voiceprint'}
            </button>
          </div>
        </form>

        {/* Existing Vault Profiles Section */}
        <div className="border-t border-[#1f1f1f] mt-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-wider text-[#888]">Currently Enrolled Voiceprint Profiles ({enrolledProfiles.length})</span>
            <span className="text-[9px] text-[#555]">VAULT ID: 128-D-EMB-V1</span>
          </div>
          {enrolledProfiles.length === 0 ? (
            <div className="text-center py-4 text-[10px] text-[#666] border border-dashed border-[#222]">
              No voiceprint profiles enrolled yet. Use the form above to enroll your personal voiceprint.
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {enrolledProfiles.map((p) => {
                const isMine = p.is_own_profile || (auth?.user?.id && p.user_id === auth?.user?.id);
                return (
                  <div key={p.speaker_id} className="p-2.5 bg-[#080808] border border-[#1e1e1e] flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                        <span>{p.name}</span>
                        {isMine && (
                          <span className="text-[8px] px-1.5 py-0.2 bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/40 uppercase font-bold">
                            MY PROFILE
                          </span>
                        )}
                        {p.is_system && (
                          <span className="text-[8px] px-1.5 py-0.2 bg-[#1a1a1a] text-[#888] border border-[#333] uppercase">
                            SYSTEM
                          </span>
                        )}
                        <span className="text-[9px] px-1.5 py-0.5 bg-[#1a1a1a] text-[#aaa] border border-[#333]">{p.authorized_limit}</span>
                      </div>
                      <div className="text-[10px] text-[#666] truncate">{p.role} · {p.enrolled_at}</div>
                    </div>
                    {p.is_owner ? (
                      <button
                        onClick={() => onDeleteProfile(p.speaker_id)}
                        className="p-1.5 text-[#666] hover:text-[#FF3333] hover:bg-[#FF3333]/10 border border-transparent hover:border-[#FF3333]/30 transition-colors"
                        title={`Delete ${p.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span 
                        className="p-1.5 text-[#444] cursor-not-allowed" 
                        title={p.is_system ? "Protected system profile" : "Owned by another operator"}
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================
   TECHNOLOGY PAGE (Architecture & Forensics)
   ========================================= */
function TechnologyPage() {
  return (
    <div className="animate-in fade-in duration-700 bg-black p-4 sm:p-8 border border-[#1f1f1f] space-y-10">
      {/* Header */}
      <div className="border-b border-[#1f1f1f] pb-6 sm:pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-[#CCFF00] tracking-widest uppercase mb-2">
            <span className="w-2 h-2 bg-[#CCFF00] animate-pulse" />
            Forensic Architecture Specification
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold uppercase tracking-tighter text-white">Multi-Res SE-ResNet v3</h2>
          <p className="font-mono text-[#888888] text-xs sm:text-sm uppercase tracking-widest mt-1">
            PyTorch Multi-Resolution STFT & Time-Frequency SE-ResNet Pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono text-[10px] sm:text-xs">
          <span className="px-2.5 py-1 bg-[#111] border border-[#333] text-white">TEST ACC: 93.66%</span>
          <span className="px-2.5 py-1 bg-[#111] border border-[#333] text-[#CCFF00]">ROC-AUC: 98.71%</span>
          <span className="px-2.5 py-1 bg-[#111] border border-[#333] text-[#aaa]">EER: 6.34%</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left Column: 4 Forensic Stages */}
        <div className="lg:col-span-7 space-y-10">
          
          <div className="relative pl-6 sm:pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-xs sm:text-sm tracking-widest uppercase text-[#CCFF00] mb-1">Stage 01</h3>
             <h4 className="text-xl sm:text-2xl font-bold uppercase tracking-tight mb-2 sm:mb-3 text-white">
               3-Channel Multi-Resolution Spectrogram Frontend
             </h4>
             <p className="text-[#aaa] text-xs sm:text-sm leading-relaxed mb-3">
               Raw audio is polyphase resampled to 16,000 Hz, DC-offset corrected, and peak-amplitude normalized to [-1, 1]. To overcome the physical Gabor time-frequency resolution limit, the frontend computes three parallel STFT decompositions in float32 precision:
             </p>
             <ul className="text-[#888] text-xs space-y-1.5 font-mono list-disc list-inside">
               <li><strong className="text-white">Channel 0 (1024-Mel)</strong>: 128 mel-scale filterbanks (20–8000 Hz) mapping vocal tract geometry, phonetic formants, and biological acoustic timbre.</li>
               <li><strong className="text-white">Channel 1 (512-Linear)</strong>: High temporal resolution (Δt ≈ 16ms) with 128 linearly-spaced bins via adaptive pooling, exposing vocoder frame splicing clicks and abrupt phoneme phase cancellations.</li>
               <li><strong className="text-white">Channel 2 (2048-Linear)</strong>: High frequency resolution (Δf ≈ 7.8Hz) with 128 linearly-spaced bins, revealing unnatural harmonic rigidity, comb-filtering, and pitch quantization.</li>
             </ul>
             <div className="mt-3 text-[11px] font-mono text-[#666] bg-[#080808] p-2.5 border border-[#1a1a1a]">
               Numerical Safeguard: Log dynamic range compression log(clamp(S, min=1e-5)) with per-channel instance normalization.
             </div>
          </div>

          <div className="relative pl-6 sm:pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-xs sm:text-sm tracking-widest uppercase text-[#CCFF00] mb-1">Stage 02</h3>
             <h4 className="text-xl sm:text-2xl font-bold uppercase tracking-tight mb-2 sm:mb-3 text-white">
               Asymmetric Time-Frequency SE-ResNet Backbone
             </h4>
             <p className="text-[#aaa] text-xs sm:text-sm leading-relaxed mb-3">
               Audio spectrogram dimensions represent fundamentally different physical quantities (horizontal = chronological time sequence vs. vertical = acoustic pitch). The backbone reflects this physics:
             </p>
             <ul className="text-[#888] text-xs space-y-1.5 font-mono list-disc list-inside">
               <li><strong className="text-white">Anisotropic Convolutions</strong>: Alternates between (5x3) kernels (wide temporal context for phonetic decay tracking) and (3x5) kernels (tall spectral context for harmonic overtone stacks).</li>
               <li><strong className="text-white">Squeeze-and-Excitation (SE) Units</strong>: Integrated across every residual block with SiLU activations. Global context is squeezed into channel descriptors that dynamically amplify channels detecting vocoder checkerboard artifacts while dampening ambient room reverberation.</li>
             </ul>
          </div>

          <div className="relative pl-6 sm:pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-xs sm:text-sm tracking-widest uppercase text-[#CCFF00] mb-1">Stage 03</h3>
             <h4 className="text-xl sm:text-2xl font-bold uppercase tracking-tight mb-2 sm:mb-3 text-white">
               Multi-Statistic Global Aggregation (768-D Embedding)
             </h4>
             <p className="text-[#aaa] text-xs sm:text-sm leading-relaxed mb-3">
               Standard Global Average Pooling (GAP) smudges and dilutes fleeting 20ms synthetic glitches over a 2-second audio segment. VocalGuard extracts three independent summary statistics across the final 256-channel feature tensor:
             </p>
             <ul className="text-[#888] text-xs space-y-1.5 font-mono list-disc list-inside">
               <li><strong className="text-white">Global Mean (256-D)</strong>: Captures overall acoustic timbre, spectral envelope, and recording conditions.</li>
               <li><strong className="text-white">Global StdDev (256-D)</strong>: Quantifies energy dispersion and dynamic range stability.</li>
               <li><strong className="text-white">Global Adaptive Max (256-D)</strong>: Catches localized micro-glitches and vocoder phase spikes that averaging misses.</li>
             </ul>
             <div className="mt-3 text-[11px] font-mono text-[#666] bg-[#080808] p-2.5 border border-[#1a1a1a]">
               Classifier Head: Linear(768→256) → LayerNorm → SiLU → Dropout(0.40) → Linear(256→64) → SiLU → Dropout(0.20) → Linear(64→1).
             </div>
          </div>

          <div className="relative pl-6 sm:pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-xs sm:text-sm tracking-widest uppercase text-[#CCFF00] mb-1">Stage 04</h3>
             <h4 className="text-xl sm:text-2xl font-bold uppercase tracking-tight mb-2 sm:mb-3 text-white">
               Binary Focal Loss & Youden's J Calibration
             </h4>
             <p className="text-[#aaa] text-xs sm:text-sm leading-relaxed mb-3">
               Trained on the curated Fake-or-Real (FoR / for-2sec) benchmark with Binary Focal Loss (γ = 2.0, α = 0.5) to prevent easy human voices from overwhelming gradient updates, paired with label smoothing (0.05) and spectral Mixup (α = 0.2, p = 0.5).
             </p>
             <div className="text-[11px] font-mono text-[#888] bg-[#080808] p-3 border border-[#1a1a1a] space-y-1">
               <div>• <span className="text-[#CCFF00]">Optimal Threshold (τ*)</span>: Evaluated across 1,000 threshold candidates via Youden's J statistic (J = Sensitivity + Specificity - 1) on validation data: <strong className="text-white">τ* = 0.0509</strong>.</div>
               <div>• <span className="text-[#CCFF00]">Unseen Test Set (1,088 clips)</span>: 93.66% accuracy, 98.71% ROC-AUC, 6.34% EER, 93.57% deepfake recall (509/544 caught), and 93.75% real specificity (510/544 verified).</div>
             </div>
          </div>

        </div>

        {/* Right Column: Benchmark Table & API Specification */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Official Evaluation Verification Card */}
          <div className="tech-panel bg-black p-5 border border-[#1f1f1f]">
            <div className="font-mono text-xs tracking-widest uppercase text-[#888888] border-b border-[#1f1f1f] pb-3 mb-4 flex justify-between items-center">
              <span>Benchmark Verification</span>
              <span className="text-[10px] text-[#CCFF00] font-bold">FoR Official Test Split</span>
            </div>
            
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1 border-b border-[#151515]">
                <span className="text-[#888]">Test Dataset Partition</span>
                <span className="text-white">FoR for-2sec (1,088 clips)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#151515]">
                <span className="text-[#888]">Overall Test Accuracy</span>
                <span className="text-[#CCFF00] font-bold">93.66% (1,019 / 1,088)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#151515]">
                <span className="text-[#888]">ROC-AUC Metric</span>
                <span className="text-[#CCFF00] font-bold">98.71% (0.9871)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#151515]">
                <span className="text-[#888]">Equal Error Rate (EER)</span>
                <span className="text-white font-bold">6.34%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#151515]">
                <span className="text-[#888]">Deepfake Recall (TPR)</span>
                <span className="text-white font-bold">93.57% (509 / 544 caught)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#151515]">
                <span className="text-[#888]">Human Voice Specificity</span>
                <span className="text-white font-bold">93.75% (510 / 544 verified)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#151515]">
                <span className="text-[#888]">Calibrated Decision Boundary</span>
                <span className="text-[#CCFF00] font-bold">0.0509 (Youden's J)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#888]">Model Checkpoint Size</span>
                <span className="text-white">12.86 MB (PyTorch FP32)</span>
              </div>
            </div>
          </div>

          {/* API Specification */}
          <div className="tech-panel bg-black p-5 border border-[#1f1f1f]">
            <div className="font-mono text-xs tracking-widest uppercase text-[#888888] border-b border-[#1f1f1f] pb-3 mb-4 flex justify-between items-center">
              <span>Inference API Specification</span>
              <span className="text-[10px] text-[#aaa]">FASTAPI / PYTORCH</span>
            </div>
            
            <div className="font-mono text-[10px] sm:text-xs leading-relaxed text-[#aaa] space-y-2">
              <div className="text-white">
                <span className="text-[#CCFF00] font-bold">POST</span> <span className="text-[#888]">/api/detect</span>
              </div>
              <div className="text-[#777] text-[10px]">
                Content-Type: multipart/form-data<br/>
                Body: file=[audio_file_binary]
              </div>
              
              <div className="pt-2 text-[10px] text-[#888]">Response Schema (JSON):</div>
              <pre className="p-3 bg-[#050505] border border-[#222] text-[#bbb] text-[10px] overflow-x-auto leading-normal font-mono">
{`{
  "verdict": "FAKE",
  "is_fake": true,
  "threat_score": 65.9,
  "threat_probability": 0.659,
  "fake_probability_pct": 65.9,
  "real_probability_pct": 34.1,
  "threshold": 0.0509,
  "alert_level": "HIGH",
  "latency_ms": 18.4,
  "audio_metrics": {
    "duration_seconds": 2.1,
    "processed_sample_rate": 16000,
    "windows_analyzed": 1,
    "peak_amplitude": 0.982,
    "spectral_centroid_hz": 1737.1
  },
  "spectral_flags": {
    "phase_anomaly": "ERR_PHASE",
    "vocoder_artifacts": "SYNTH_MATCH",
    "prosody_stability": "UNNATURAL"
  }
}`}
              </pre>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* =========================================
   GITHUB ICON HELPER (Pixel-Perfect SVG)
   ========================================= */
function GithubIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

/* =========================================
   ABOUT PAGE (Mission, Builders & Research)
   ========================================= */
function AboutPage({ setActiveView }) {
  const builders = [
    {
      name: "Bimbok Mukherjee",
      github: "https://github.com/Bimbok",
      handle: "@Bimbok",
      avatar: "https://avatars.githubusercontent.com/u/132834022?v=4",
      role: "Machine Learning & Backend Systems Engineer",
      badge: "MODEL & BACKEND ARCHITECTURE",
      bio: "Co-developed the PyTorch Multi-Resolution SE-ResNet (v3) deep learning model and the backend server architecture alongside Aditya. Formulated the 3-channel STFT representation (1024-Mel formants, 512-Linear temporal transients, 2048-Linear harmonic pitch overtones), focal loss training, and Youden's J calibration (τ* = 0.0509). Co-engineered the high-performance FastAPI inference gateway, polyphase audio resampling pipeline, and production deployment on Render.",
      skills: ["PyTorch", "Model Architecture", "FastAPI Backend", "DSP Pipelines", "Focal Loss & Calibration"]
    },
    {
      name: "Aditya Paul",
      github: "https://github.com/adityapaul26",
      handle: "@adityapaul26",
      avatar: "https://avatars.githubusercontent.com/u/180437661?v=4",
      role: "Machine Learning & Backend Systems Engineer",
      badge: "MODEL & BACKEND SYSTEMS",
      bio: "Co-engineered both the PyTorch Multi-Resolution SE-ResNet (v3) deep learning model and the backend server architecture alongside Bimbok. Worked on anisotropic convolutional feature extraction, SE attention blocks, multi-statistic global pooling, and model optimization. Co-built the FastAPI backend inference pipeline, audio tensor streaming endpoints, error-handling telemetry, and server deployment.",
      skills: ["PyTorch", "Deep Learning", "FastAPI Backend", "Audio Processing", "Model Optimization"]
    },
    {
      name: "Bijan Murmu",
      github: "https://github.com/bijanmurmu",
      handle: "@bijanmurmu",
      avatar: "https://avatars.githubusercontent.com/u/73417763?v=4",
      role: "Frontend & UI/UX Systems Engineer",
      badge: "FRONTEND & UI/UX ARCHITECTURE",
      bio: "Architected and engineered the complete frontend web application and interactive user experience for VocalGuard. Designed the industrial cyber-brutalist operations console, 60 FPS HTML5 Canvas real-time audio waveform telemetry, and responsive mobile-optimized layouts. Integrated the Web Audio API microphone capture, multi-stage analysis progress steppers, and client-side communication with the backend inference gateway.",
      skills: ["React 19", "Vite", "Tailwind CSS", "HTML5 Canvas Telemetry", "Web Audio API", "UI/UX Architecture"]
    }
  ];

  return (
    <div className="animate-in fade-in duration-700 space-y-12 sm:space-y-16">
      
      {/* Hero Header */}
      <div className="bg-black p-6 sm:p-10 border border-[#1f1f1f] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#CCFF00]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-4 max-w-4xl">
          <div className="flex items-center gap-2 font-mono text-xs text-[#CCFF00] tracking-widest uppercase">
            <span className="w-2 h-2 bg-[#CCFF00] animate-pulse shrink-0" />
            <span>PROJECT DOSSIER // SIH PROBLEM STATEMENT 26104</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tighter text-white">
            Engineered To Stop <br />
            <span className="text-[#888888]">Voice Cloning Attacks</span>
          </h1>

          <p className="text-sm sm:text-base text-[#aaa] leading-relaxed max-w-2xl font-mono">
            VocalGuard is an open-source forensic defense system built by a team of three engineers to detect neural voice cloning, vocoder phase anomalies, and synthetic speech impersonations in real time.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2 font-mono text-[10px] sm:text-xs">
            <span className="px-3 py-1.5 bg-[#111] border border-[#333] text-white">
              CORE TEAM: 3 BUILDERS
            </span>
            <span className="px-3 py-1.5 bg-[#111] border border-[#333] text-[#CCFF00]">
              EVALUATION: FAKE-OR-REAL (FoR)
            </span>
            <span className="px-3 py-1.5 bg-[#111] border border-[#333] text-[#aaa]">
              INFERENCE: &lt;35MS ON CPU
            </span>
            <span className="px-3 py-1.5 bg-[#111] border border-[#333] text-[#aaa]">
              MODEL WEIGHTS: 12.86 MB
            </span>
          </div>
        </div>
      </div>

      {/* The Builders Section */}
      <div className="space-y-6">
        <div className="border-b border-[#1f1f1f] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="font-mono text-xs text-[#CCFF00] tracking-widest uppercase mb-1">
              THE ARCHITECTS & DEVELOPERS
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tighter text-white">
              Core Engineering Team
            </h2>
          </div>
          <p className="font-mono text-xs text-[#666]">
            3 ENGINEERS // ZERO COMPROMISE
          </p>
        </div>

        {/* 3 Builder Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {builders.map((builder) => (
            <div 
              key={builder.github} 
              className="bg-black border border-[#1f1f1f] hover:border-[#CCFF00]/60 transition-all p-6 flex flex-col justify-between group relative overflow-hidden"
            >
              <div className="space-y-5">
                {/* Header with avatar and badge */}
                <div className="flex items-start justify-between gap-4">
                  <div className="relative">
                    <img 
                      src={builder.avatar} 
                      alt={builder.name} 
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover border-2 border-[#333] group-hover:border-[#CCFF00] transition-colors"
                    />
                    <div className="absolute -bottom-1.5 -right-1.5 bg-[#CCFF00] text-black text-[8px] font-mono font-bold px-1 uppercase">
                      BUILDER
                    </div>
                  </div>
                  <span className="font-mono text-[9px] bg-[#111] text-[#CCFF00] border border-[#333] px-2 py-0.5 uppercase tracking-wider text-right">
                    {builder.badge}
                  </span>
                </div>

                {/* Identity */}
                <div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-[#CCFF00] transition-colors">
                    {builder.name}
                  </h3>
                  <a 
                    href={builder.github} 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-mono text-xs text-[#888] hover:text-[#CCFF00] inline-flex items-center gap-1 mt-0.5"
                  >
                    <span>{builder.handle}</span>
                    <ArrowUpRight className="w-3 h-3 text-[#666] group-hover:text-[#CCFF00]" />
                  </a>
                  <div className="font-mono text-xs text-[#aaa] mt-1 font-semibold">
                    {builder.role}
                  </div>
                </div>

                {/* Bio & Contributions */}
                <p className="text-xs text-[#777] leading-relaxed font-sans">
                  {builder.bio}
                </p>

                {/* Skills tags */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {builder.skills.map((skill, sIdx) => (
                    <span 
                      key={sIdx} 
                      className="font-mono text-[10px] bg-[#0c0c0c] text-[#888] border border-[#222] px-2 py-0.5 group-hover:border-[#333] transition-colors"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* GitHub Link Button */}
              <div className="pt-6 mt-6 border-t border-[#1a1a1a]">
                <a 
                  href={builder.github} 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 bg-[#111] hover:bg-[#CCFF00] text-white hover:text-black font-mono text-xs uppercase tracking-wider font-bold border border-[#2a2a2a] hover:border-[#CCFF00] transition-all flex items-center justify-center gap-2"
                >
                  <GithubIcon className="w-4 h-4" />
                  <span>View GitHub Profile</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SIH Problem Statement 26104 Dossier */}
      <div className="bg-black p-6 sm:p-8 border border-[#1f1f1f] space-y-6">
        <div className="flex items-center gap-2 font-mono text-xs text-[#CCFF00] tracking-widest uppercase">
          <Shield className="w-4 h-4 text-[#CCFF00]" />
          <span>HACKATHON CONTEXT // SMART INDIA HACKATHON 2026</span>
        </div>

        <h3 className="text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white">
          Problem Statement 26104: AI Voice Cloning Impersonation Interception
        </h3>

        <div className="grid md:grid-cols-2 gap-6 text-xs sm:text-sm text-[#888] leading-relaxed">
          <div className="space-y-3 bg-[#0a0a0a] p-5 border border-[#1a1a1a]">
            <div className="font-mono text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#FF3333]" />
              The Threat Vector
            </div>
            <p>
              Generative neural voice synthesis models (e.g. ElevenLabs, XTTS, StyleTTS2, Tortoise) can clone an individual's vocal acoustics using as little as 3 seconds of reference speech intercepted from phone calls or social media.
            </p>
            <p>
              These synthetic voices are actively leveraged in high-frequency financial authorization fraud, emergency extortion scams, and CEO wire fraud, where traditional audio verification and human ears fail completely.
            </p>
          </div>

          <div className="space-y-3 bg-[#0a0a0a] p-5 border border-[#1a1a1a]">
            <div className="font-mono text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#CCFF00]" />
              The VocalGuard Engineering Answer
            </div>
            <p>
              Rather than attempting to analyze semantic speech content with heavyweight multi-gigabyte models, VocalGuard evaluates the physical and mathematical acoustics of the audio signal itself.
            </p>
            <p>
              By combining three simultaneous STFT resolutions (Mel formants, linear temporal transients, and harmonic overtones) into anisotropic SE-ResNet convolutions, VocalGuard intercepts vocoder artifacts in under 35 milliseconds on ordinary CPUs.
            </p>
          </div>
        </div>
      </div>

      {/* Architectural Pillars Summary */}
      <div className="space-y-6">
        <div className="border-b border-[#1f1f1f] pb-4">
          <div className="font-mono text-xs text-[#CCFF00] tracking-widest uppercase mb-1">
            CORE METHODOLOGY
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tighter text-white">
            Why VocalGuard Outperforms Single-Spectrogram Detectors
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
          <div className="bg-black p-5 border border-[#1f1f1f] space-y-3 border-t-2 border-t-[#CCFF00]">
            <div className="text-[10px] text-[#CCFF00] uppercase tracking-wider">Pillar 01</div>
            <div className="text-base font-bold text-white uppercase">Tri-Channel STFT Tensor</div>
            <p className="text-xs text-[#777] font-sans leading-relaxed">
              Standard audio detectors feed a single Mel spectrogram, discarding phase transients and fine harmonic combs. VocalGuard constructs a 3-channel tensor (1024-Mel + 512-Linear + 2048-Linear) providing concurrent time and frequency resolution.
            </p>
          </div>

          <div className="bg-black p-5 border border-[#1f1f1f] space-y-3 border-t-2 border-t-[#CCFF00]">
            <div className="text-[10px] text-[#CCFF00] uppercase tracking-wider">Pillar 02</div>
            <div className="text-base font-bold text-white uppercase">Anisotropic SE-ResNet</div>
            <p className="text-xs text-[#777] font-sans leading-relaxed">
              Alternating (5×3) and (3×5) directional convolution filters isolate horizontal pitch harmonics and vertical transient frame boundaries without isotropic blurring. Squeeze-and-Excitation recalibrates channel attention dynamically.
            </p>
          </div>

          <div className="bg-black p-5 border border-[#1f1f1f] space-y-3 border-t-2 border-t-[#CCFF00]">
            <div className="text-[10px] text-[#CCFF00] uppercase tracking-wider">Pillar 03</div>
            <div className="text-base font-bold text-white uppercase">Calibrated Youden's J</div>
            <p className="text-xs text-[#777] font-sans leading-relaxed">
              Trained with Binary Focal Loss (γ=2.0) and calibrated via Youden's J statistic to an optimal threshold of τ* = 0.0509, achieving 93.57% synthetic recall and 93.75% human specificity with 98.71% ROC-AUC on unseen data.
            </p>
          </div>
        </div>
      </div>

      {/* GitHub Repository Banner & Call to Action */}
      <div className="bg-black p-6 sm:p-8 border border-[#1f1f1f] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="font-mono text-xs text-[#CCFF00] uppercase tracking-widest flex items-center gap-2 justify-center md:justify-start">
            <Code2 className="w-4 h-4 text-[#CCFF00]" />
            <span>Open Source Project Repository</span>
          </div>
          <h4 className="text-xl sm:text-2xl font-bold uppercase text-white">
            malevolent-shrine-hq / VocalGuard
          </h4>
          <p className="text-xs text-[#777] font-mono">
            Clone and inspect the complete PyTorch training scripts, model checkpoints, and FastAPI gateway.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
          <a 
            href="https://github.com/malevolent-shrine-hq/VocalGuard" 
            target="_blank" 
            rel="noreferrer"
            className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <GithubIcon className="w-4 h-4" />
            <span>Star on GitHub</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
          <button 
            onClick={() => { setActiveView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="btn-outline flex items-center justify-center gap-2 w-full sm:w-auto bg-black"
          >
            <span>Launch Console</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}

/* =========================================
   CYBER-INDUSTRIAL FOOTER
   ========================================= */
function Footer({ activeView, setActiveView, backendStatus }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateTo = (view) => {
    setActiveView(view);
    scrollToTop();
  };

  return (
    <footer className="relative z-20 bg-black/95 border-t border-[#1f1f1f] text-[#888] font-sans mt-16 sm:mt-24">
      {/* Glow highlight line */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#CCFF00]/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12 pb-12 border-b border-[#1a1a1a]">
          
          {/* Brand & Mission (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-4">
            <div 
              className="flex items-center gap-2 cursor-pointer inline-flex"
              onClick={() => navigateTo('landing')}
            >
              <div className="w-5 h-5 bg-[#CCFF00] flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-black" />
              </div>
              <span className="text-lg font-bold tracking-tighter uppercase text-white font-mono">
                Vocal<span className="text-[#888]">Guard</span>
              </span>
              <span className="font-mono text-[9px] bg-[#111] text-[#CCFF00] border border-[#222] px-1.5 py-0.5 ml-2">
                DEFENSE ARCHITECTURE
              </span>
            </div>

            <p className="text-xs sm:text-sm text-[#777] leading-relaxed max-w-md">
              Forensic real-time audio deepfake and synthetic voice cloning interception framework. Powered by PyTorch Multi-Resolution SE-ResNet (v3) with 93.66% accuracy and 98.71% ROC-AUC on the Fake-or-Real benchmark.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px]">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#0d0d0d] border border-[#222] text-[#aaa]">
                <span className={`w-2 h-2 rounded-full ${backendStatus.online ? 'bg-[#CCFF00] animate-pulse' : 'bg-red-500'}`} />
                {backendStatus.online ? 'API ONLINE (RENDER)' : 'API STANDBY'}
              </span>
              <span className="px-2 py-1 bg-[#0d0d0d] border border-[#222] text-[#888]">
                SIH PS: 26104
              </span>
              <span className="px-2 py-1 bg-[#0d0d0d] border border-[#222] text-[#888]">
                CALIBRATED τ = 0.0509
              </span>
            </div>
          </div>

          {/* Quick Nav (lg:col-span-2) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-widest text-white border-b border-[#222] pb-2">
              System Modules
            </div>
            <ul className="space-y-2 text-xs font-mono">
              <li>
                <button 
                  onClick={() => navigateTo('landing')}
                  className={`hover:text-[#CCFF00] transition-colors uppercase ${activeView === 'landing' ? 'text-[#CCFF00]' : 'text-[#777]'}`}
                >
                  // Platform
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateTo('dashboard')}
                  className={`hover:text-[#CCFF00] transition-colors uppercase ${activeView === 'dashboard' ? 'text-[#CCFF00]' : 'text-[#777]'}`}
                >
                  // Live Console
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateTo('technology')}
                  className={`hover:text-[#CCFF00] transition-colors uppercase ${activeView === 'technology' ? 'text-[#CCFF00]' : 'text-[#777]'}`}
                >
                  // Architecture
                </button>
              </li>
              <li>
                <button 
                  onClick={() => navigateTo('about')}
                  className={`hover:text-[#CCFF00] transition-colors uppercase flex items-center gap-1.5 ${activeView === 'about' ? 'text-[#CCFF00]' : 'text-[#777]'}`}
                >
                  <span>// About & Builders</span>
                  <span className="text-[9px] bg-[#CCFF00]/10 text-[#CCFF00] px-1 border border-[#CCFF00]/30">TEAM</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Core Builders (lg:col-span-3) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-widest text-white border-b border-[#222] pb-2 flex items-center justify-between">
              <span>The Builders</span>
              <button 
                onClick={() => navigateTo('about')}
                className="text-[9px] text-[#CCFF00] hover:underline uppercase font-mono"
              >
                Team Dossier →
              </button>
            </div>
            <div className="space-y-2.5">
              <a 
                href="https://github.com/Bimbok" 
                target="_blank" 
                rel="noreferrer"
                className="group flex items-center justify-between p-2 bg-[#0c0c0c] border border-[#1e1e1e] hover:border-[#CCFF00] transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img 
                    src="https://avatars.githubusercontent.com/u/132834022?v=4" 
                    alt="Bimbok Mukherjee" 
                    className="w-6 h-6 rounded-none border border-[#333] shrink-0" 
                  />
                  <div className="truncate">
                    <div className="text-xs text-white group-hover:text-[#CCFF00] transition-colors font-mono font-medium truncate">
                      Bimbok Mukherjee
                    </div>
                    <div className="text-[10px] text-[#666] font-mono truncate">
                      Model & Backend Systems
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#555] group-hover:text-[#CCFF00] shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              <a 
                href="https://github.com/adityapaul26" 
                target="_blank" 
                rel="noreferrer"
                className="group flex items-center justify-between p-2 bg-[#0c0c0c] border border-[#1e1e1e] hover:border-[#CCFF00] transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img 
                    src="https://avatars.githubusercontent.com/u/180437661?v=4" 
                    alt="Aditya Paul" 
                    className="w-6 h-6 rounded-none border border-[#333] shrink-0" 
                  />
                  <div className="truncate">
                    <div className="text-xs text-white group-hover:text-[#CCFF00] transition-colors font-mono font-medium truncate">
                      Aditya Paul
                    </div>
                    <div className="text-[10px] text-[#666] font-mono truncate">
                      Model & Backend Systems
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#555] group-hover:text-[#CCFF00] shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              <a 
                href="https://github.com/bijanmurmu" 
                target="_blank" 
                rel="noreferrer"
                className="group flex items-center justify-between p-2 bg-[#0c0c0c] border border-[#1e1e1e] hover:border-[#CCFF00] transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img 
                    src="https://avatars.githubusercontent.com/u/73417763?v=4" 
                    alt="Bijan Murmu" 
                    className="w-6 h-6 rounded-none border border-[#333] shrink-0" 
                  />
                  <div className="truncate">
                    <div className="text-xs text-white group-hover:text-[#CCFF00] transition-colors font-mono font-medium truncate">
                      Bijan Murmu
                    </div>
                    <div className="text-[10px] text-[#666] font-mono truncate">
                      Frontend & UI/UX Systems
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#555] group-hover:text-[#CCFF00] shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>
          </div>

          {/* Project Spec & GitHub Link (lg:col-span-2) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="font-mono text-[11px] uppercase tracking-widest text-white border-b border-[#222] pb-2">
              Source Code
            </div>
            <p className="text-[11px] text-[#666] font-mono leading-relaxed">
              Open-source neural defense implementation for SIH 2026 (Problem Statement 26104).
            </p>
            <a 
              href="https://github.com/malevolent-shrine-hq/VocalGuard" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-[#111] hover:bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#CCFF00] text-white text-xs font-mono transition-all w-full justify-center"
            >
              <GithubIcon className="w-4 h-4 text-white" />
              <span>GitHub Repo</span>
              <ArrowUpRight className="w-3 h-3 text-[#888]" />
            </a>
            <button 
              onClick={scrollToTop}
              className="text-[10px] font-mono text-[#777] hover:text-[#CCFF00] transition-colors flex items-center gap-1 pt-1"
            >
              ↑ Return to Top
            </button>
          </div>

        </div>

        {/* Bottom copyright / bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] text-[#666]">
          <div className="flex flex-wrap items-center gap-2 text-center sm:text-left">
            <span>© 2026 VOCALGUARD FORENSICS</span>
            <span className="hidden sm:inline text-[#333]">|</span>
            <span>BUILT BY BIMBOK MUKHERJEE, ADITYA PAUL & BIJAN MURMU</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#555]">ALL INDIA COUNCIL FOR TECHNICAL EDUCATION (AICTE)</span>
            <span className="w-1.5 h-1.5 bg-[#CCFF00] rounded-full" />
          </div>
        </div>
      </div>
    </footer>
  );
}
