import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Square, AlertTriangle, 
  ArrowRight, Disc,
  Upload, RefreshCw, Mic, CheckCircle2,
  Download, AlertOctagon, Radio,
  Terminal, FileAudio, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [backendStatus, setBackendStatus] = useState({ online: false, checking: true, data: null });

  const checkHealth = useCallback(() => {
    fetch(`${API_BASE}/api/health`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setBackendStatus({ online: true, checking: false, data }))
      .catch(() => setBackendStatus({ online: false, checking: false, data: null }));
  }, []);

  const handleManualRetry = () => {
    setBackendStatus(s => ({ ...s, checking: true }));
    checkHealth();
  };

  useEffect(() => {
    checkHealth();
    // Auto-poll health every 8 seconds if offline (vital for Render free-tier cold starts)
    const interval = setInterval(() => {
      setBackendStatus(prev => {
        if (!prev.online) {
          checkHealth();
        }
        return prev;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div className="min-h-screen text-[#f5f5f5] selection:bg-[#CCFF00] selection:text-black font-sans relative bg-[#050505] overflow-x-hidden w-full">
      {/* Global Topo Background */}
      <TopoBackground />
      
      <Navbar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        backendStatus={backendStatus} 
        onRetryBackend={handleManualRetry}
      />
      
      <main className="pt-20 sm:pt-24 pb-16 sm:pb-20 px-3 sm:px-6 max-w-7xl mx-auto relative z-10 w-full overflow-x-hidden">
        {activeView === 'landing' && <LandingPage setActiveView={setActiveView} />}
        {activeView === 'dashboard' && <LiveDashboard backendStatus={backendStatus} onRetryBackend={handleManualRetry} />}
        {activeView === 'technology' && <TechnologyPage />}
      </main>
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
function Navbar({ activeView, setActiveView, backendStatus, onRetryBackend }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur border-b border-[#1f1f1f]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        
        <div 
          className="flex items-center gap-2 sm:gap-4 cursor-pointer shrink-0"
          onClick={() => setActiveView('dashboard')}
        >
          <div className="w-5 h-5 sm:w-6 sm:h-6 bg-[#CCFF00] flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-black" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tighter uppercase text-white">
            Vocal<span className="text-[#888888] font-light">Guard</span>
          </span>
          <span className="hidden lg:inline-block font-mono text-[9px] bg-[#111] text-[#888] border border-[#222] px-2 py-0.5">
            MODEL: v3-MULTI-RES-CNN
          </span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 md:gap-8 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[9px] sm:text-[10px] tracking-wider uppercase shrink-0">
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
              <span className="hidden sm:inline">
                {backendStatus.online 
                  ? 'API ONLINE' 
                  : (backendStatus.checking ? 'CHECKING API...' : 'API DISCONNECTED')}
              </span>
              <span className="sm:hidden">
                {backendStatus.online 
                  ? 'ONLINE' 
                  : (backendStatus.checking ? 'CHECKING' : 'OFFLINE')}
              </span>
            </span>
            {!backendStatus.online && (
              <button 
                onClick={onRetryBackend}
                disabled={backendStatus.checking}
                className="ml-1 text-[8px] sm:text-[9px] text-[#CCFF00] hover:underline uppercase tracking-widest border border-[#333] px-1 sm:px-1.5 py-0.5 bg-[#111] disabled:opacity-50"
                title="Retry connecting to backend"
              >
                Retry
              </button>
            )}
          </div>

          {/* Mobile compact nav buttons */}
          <div className="md:hidden flex items-center gap-1 shrink-0">
            <button 
              onClick={() => setActiveView('technology')}
              className={`font-mono text-[9px] px-1.5 py-0.5 uppercase ${activeView === 'technology' ? 'text-[#CCFF00] border-b border-[#CCFF00]' : 'text-[#888]'}`}
            >
              Arch
            </button>
            <button 
              onClick={() => setActiveView('dashboard')}
              className={`font-mono text-[9px] px-2 py-0.5 uppercase font-bold ${activeView === 'dashboard' ? 'bg-[#CCFF00] text-black' : 'text-[#888] border border-[#333]'}`}
            >
              Console
            </button>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <NavLink label="Platform" active={activeView === 'landing'} onClick={() => setActiveView('landing')} />
            <NavLink label="Architecture" active={activeView === 'technology'} onClick={() => setActiveView('technology')} />
            <NavLink label="Console" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} isAccent />
          </div>
        </div>
      </div>
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
            <span className="truncate">PyTorch Multi-Domain Spectrogram CNN // Online</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] uppercase text-white">
            Detect Voice <br/>
            <span className="text-[#888888]">Deepfakes</span><br/>
            In Real Time.
          </h1>
          
          <p className="text-[#888888] text-base sm:text-lg max-w-xl leading-relaxed">
            Stop synthetic voice fraud before authorization. Our PyTorch multi-resolution spectrogram neural network detects high-frequency neural vocoder artifacts, prosodic phase shifts, and AI text-to-speech clones in milliseconds.
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
        <div className="lg:col-span-5 h-[340px] sm:h-[420px] lg:h-[500px] w-full overflow-hidden">
          <NeuralWidget />
        </div>
      </div>

      {/* Grid Features */}
      <div className="grid md:grid-cols-3 gap-0 mt-16 sm:mt-32 border border-[#1f1f1f] bg-black">
        <GridFeature 
          title="Multi-STFT Spectrograms" 
          desc="Combines 512, 1024, and 2048 STFT windows into a 3-channel feature map to expose neural vocoder phase discrepancies."
          number="01"
        />
        <GridFeature 
          title="Trained Deepfake Model" 
          desc="Calibrated against deepfake speech models (HiFi-GAN, MelGAN, VITS, ElevenLabs) with optimal 0.0509 decision boundary."
          number="02"
        />
        <GridFeature 
          title="Sub-50ms Inference" 
          desc="Sliding window chunking with PyTorch inference engine delivers ultra-low latency verdict for any audio format."
          number="03"
        />
      </div>
    </div>
  );
}

function GridFeature({ title, desc, number }) {
  return (
    <div className="p-8 border-r border-b md:border-b-0 border-[#1f1f1f] hover:bg-[#050505] transition-colors group">
      <div className="font-mono text-4xl text-[#1f1f1f] group-hover:text-[#555] transition-colors mb-6">{number}</div>
      <h3 className="text-xl font-bold uppercase tracking-tight mb-3 text-white">{title}</h3>
      <p className="text-[#888888] leading-relaxed text-sm">{desc}</p>
    </div>
  );
}

/* =========================================
   NEURAL FLOW WIDGET
   ========================================= */
function NeuralWidget() {
  return (
    <div className="tech-panel p-1 relative flex flex-col h-full w-full bg-black">
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#1f1f1f] bg-[#0a0a0a]">
        <span className="font-mono text-[10px] text-[#CCFF00] tracking-widest uppercase">
          [ NEURAL_PIPELINE: ACTIVE_INFERENCE ]
        </span>
        <span className="font-mono text-[10px] text-[#888888] tracking-widest uppercase">
          TGT: MULTI_RES_CNN
        </span>
      </div>
      <div className="flex-1 bg-black p-2 relative flex items-center justify-center overflow-hidden">
         <svg className="w-full h-full" viewBox="0 0 500 400" preserveAspectRatio="xMidYMid meet">
           <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
             <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#111" strokeWidth="1"/>
           </pattern>
           <rect width="500" height="400" fill="url(#grid)" />

           <g fill="transparent" stroke="#333" strokeWidth="2" strokeDasharray="4,4">
             <path d="M 60 200 Q 150 100, 220 100" />
             <path d="M 60 200 Q 150 300, 220 300" />
             <path d="M 220 100 Q 300 100, 360 200" />
             <path d="M 220 300 Q 300 300, 360 200" />
             <path d="M 360 200 L 450 200" strokeDasharray="none" stroke="#555" />
           </g>

           <g fill="#CCFF00">
             <circle r="3"><animateMotion dur="2.5s" repeatCount="indefinite" path="M 60 200 Q 150 100, 220 100" /></circle>
             <circle r="3"><animateMotion dur="3.2s" repeatCount="indefinite" path="M 60 200 Q 150 300, 220 300" /></circle>
             <circle r="4"><animateMotion dur="1.8s" repeatCount="indefinite" path="M 220 100 Q 300 100, 360 200" /></circle>
             <circle r="4"><animateMotion dur="2.2s" repeatCount="indefinite" path="M 220 300 Q 300 300, 360 200" /></circle>
           </g>
           
           <circle r="5" fill="#FF3333">
             <animateMotion dur="1.5s" repeatCount="indefinite" path="M 360 200 L 450 200" />
           </circle>

           <circle cx="60" cy="200" r="8" fill="#000" stroke="#888" strokeWidth="2" />
           <text x="60" y="225" fill="#aaa" fontSize="10" fontFamily="monospace" textAnchor="middle" letterSpacing="1">AUDIO_IN</text>
           
           <circle cx="220" cy="100" r="14" fill="#000" stroke="#CCFF00" strokeWidth="2" />
           <text x="220" y="70" fill="#CCFF00" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">MULTI_RES_STFT</text>
           <text x="220" y="130" fill="#777" fontSize="9" fontFamily="monospace" textAnchor="middle">512/1024/2048</text>
           
           <circle cx="220" cy="300" r="14" fill="#000" stroke="#CCFF00" strokeWidth="2" />
           <text x="220" y="270" fill="#CCFF00" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">SE_RESIDUAL_CNN</text>
           <text x="220" y="330" fill="#777" fontSize="9" fontFamily="monospace" textAnchor="middle">SPECTRAL_FEATURES</text>
           
           <circle cx="360" cy="200" r="20" fill="#000" stroke="#fff" strokeWidth="2" />
           <text x="360" y="170" fill="#fff" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">CLASSIFIER</text>
           <text x="360" y="240" fill="#777" fontSize="9" fontFamily="monospace" textAnchor="middle">FC_LAYERS</text>
           
           <circle cx="450" cy="200" r="12" fill="#000" stroke="#FF3333" strokeWidth="3">
              <animate attributeName="stroke" values="#555; #FF3333; #555" dur="1s" repeatCount="indefinite" />
           </circle>
           <text x="450" y="175" fill="#FF3333" fontSize="12" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">VERDICT</text>
           <text x="450" y="235" fill="#FF3333" fontSize="10" fontFamily="monospace" textAnchor="middle">DEEPFAKE / REAL</text>
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
    { num: '01', name: 'STREAM UPLOAD', desc: uploadPhase === 'uploading' ? `${uploadProgress}%` : (activeStage > 1 ? 'COMPLETED' : 'READY') },
    { num: '02', name: 'AUDIO RESAMPLING', desc: '16kHz PCM' },
    { num: '03', name: 'MULTI-STFT', desc: '512/1024/2048' },
    { num: '04', name: 'NEURAL CNN', desc: 'SE-RESNET' },
    { num: '05', name: 'VERDICT', desc: 'CALIBRATED' },
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
  const terminalBottomRef = useRef(null);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

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
          <div ref={terminalBottomRef} />
        </div>
      )}
    </div>
  );
}

/* =========================================
   LIVE DASHBOARD (Full Backend Connected)
   ========================================= */
function LiveDashboard({ backendStatus, onRetryBackend }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, analyzing, danger, safe, error
  const [fileName, setFileName] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
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

  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const xhrRef = useRef(null);
  const stageTimer1Ref = useRef(null);
  const stageTimer2Ref = useRef(null);
  const logCounterRef = useRef(0);

  const addLog = useCallback((tag, msg, type = 'info') => {
    const now = new Date();
    const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0')}`;
    logCounterRef.current += 1;
    const newEntry = { id: logCounterRef.current, time: timeStr, tag, msg, type };
    setTerminalLogs(prev => [...prev.slice(-49), newEntry]);
  }, []);

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
    };
  }, []);

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
      xhr.send(formData);
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
        <div className="mb-4 sm:mb-6 p-3 sm:p-3.5 bg-[#FF3333]/10 border border-[#FF3333] text-[#FF3333] font-mono text-[11px] sm:text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Backend offline: Server might be in cold-start sleep mode (takes ~30s on free tiers).</span>
          </div>
          <button 
            onClick={onRetryBackend} 
            className="underline hover:text-white px-2 py-0.5 border border-[#FF3333]/40 bg-black uppercase tracking-wider text-[9px] sm:text-[10px] shrink-0"
          >
            Reconnect
          </button>
        </div>
      )}

      {backendStatus.checking && (
        <div className="mb-4 sm:mb-6 p-2.5 sm:p-3 bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-[11px] sm:text-xs flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span className="truncate">Connecting to VocalGuard neural inference backend...</span>
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
            <span>MODEL: voice_deepfake_detector.pth</span>
            <span>THRESHOLD: 5.09%</span>
            <div className="flex items-center gap-1 min-w-0 max-w-full">
              <span className="shrink-0">INPUT:</span>
              <span className="truncate max-w-[180px] xs:max-w-[240px] sm:max-w-xs text-white" title={fileName}>
                {fileName ? fileName : (isRecording ? 'LIVE_STREAM' : 'STANDBY')}
              </span>
            </div>
          </div>
        </div>
        
        <div className="w-full md:w-auto flex items-center">
          {/* Status Indicator */}
          <div className={`flex items-center justify-center gap-2 sm:gap-3 tech-panel px-3 sm:px-4 py-2 bg-black border w-full md:w-auto ${
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
            disabled={isAnalyzing || isRecording}
            className="font-mono text-[10px] sm:text-[11px] tracking-wider uppercase px-2.5 sm:px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#CCFF00] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3 h-3 text-[#CCFF00] shrink-0" /> Real Human
          </button>
          <button
            onClick={() => handleLoadSample('/samples/ai_synthetic_voicemaker.mp3', 'ai_synthetic_voicemaker.mp3')}
            disabled={isAnalyzing || isRecording}
            className="font-mono text-[10px] sm:text-[11px] tracking-wider uppercase px-2.5 sm:px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#FF3333] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <AlertTriangle className="w-3 h-3 text-[#FF3333] shrink-0" /> Voicemaker TTS
          </button>
          <button
            onClick={() => handleLoadSample('/samples/ai_generated_speech.mp3', 'ai_generated_speech.mp3')}
            disabled={isAnalyzing || isRecording}
            className="font-mono text-[10px] sm:text-[11px] tracking-wider uppercase px-2.5 sm:px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#FF3333] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <AlertOctagon className="w-3 h-3 text-[#FF3333] shrink-0" /> Synthetic Speech
          </button>
        </div>
      </div>

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
                    disabled={isAnalyzing}
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
                    ? `AI DEEPFAKE PROBABILITY: ${detectionData.fake_probability_pct}%` 
                    : `HUMAN AUTHENTICITY: ${detectionData.real_probability_pct}%`
                ) : 'Calibrated Decision Threshold: 5.09%'}
              </div>

              {detectionData && (
                <div className="mt-1.5 sm:mt-2 font-mono text-[9px] sm:text-[10px] text-[#666]">
                  Calibrated Threshold: {detectionData.threshold} | Windows: {detectionData.audio_metrics?.windows_analyzed}
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
                 <span className="text-white">| THRESHOLD 5.09%</span>
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

/* =========================================
   TECHNOLOGY PAGE (Architecture)
   ========================================= */
function TechnologyPage() {
  return (
    <div className="animate-in fade-in duration-700 bg-black p-4 sm:p-8 border border-[#1f1f1f]">
      <div className="mb-8 sm:mb-16 border-b border-[#1f1f1f] pb-6 sm:pb-8">
        <h2 className="text-3xl sm:text-4xl font-bold uppercase tracking-tighter mb-3 sm:mb-4 text-white">Architecture</h2>
        <p className="font-mono text-[#888888] text-xs sm:text-sm uppercase tracking-widest">
          PyTorch Multi-Domain Deepfake Verification Pipeline
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 md:gap-12">
        <div className="space-y-8 sm:space-y-12">
          
          <div className="relative pl-6 sm:pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-xs sm:text-sm tracking-widest uppercase text-[#CCFF00] mb-2">Stage 01</h3>
             <h4 className="text-xl sm:text-2xl font-bold uppercase tracking-tight mb-2 sm:mb-3 text-white">Multi-STFT Spectrogram Transform</h4>
             <p className="text-[#888888] text-xs sm:text-sm leading-relaxed">
               Raw audio is normalized and transformed into a 3-channel feature map using STFT windows of 512, 1024, and 2048 samples with 128 mel bins. This captures both fine temporal transients and long-range frequency harmonics.
             </p>
          </div>

          <div className="relative pl-6 sm:pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-xs sm:text-sm tracking-widest uppercase text-[#CCFF00] mb-2">Stage 02</h3>
             <h4 className="text-xl sm:text-2xl font-bold uppercase tracking-tight mb-2 sm:mb-3 text-white">Squeeze-and-Excitation Residual CNN</h4>
             <p className="text-[#888888] text-xs sm:text-sm leading-relaxed">
               4-stage convolutional backbone with SE-blocks (Squeeze-and-Excitation) that dynamically recalibrates channel-wise feature responses, picking up subtle checkerboard artifacts and phase irregularities left by neural vocoders (HiFi-GAN, MelGAN).
             </p>
          </div>

          <div className="relative pl-6 sm:pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-xs sm:text-sm tracking-widest uppercase text-[#CCFF00] mb-2">Stage 03</h3>
             <h4 className="text-xl sm:text-2xl font-bold uppercase tracking-tight mb-2 sm:mb-3 text-white">Triple Statistical Pooling Classifier</h4>
             <p className="text-[#888888] text-xs sm:text-sm leading-relaxed">
               Feature maps are aggregated across mean, standard deviation, and max pooling (256 * 3 = 768 dimensions), fed through dense layers with SiLU activations and Dropout, outputting a calibrated sigmoid confidence score.
             </p>
          </div>

        </div>

        <div className="tech-panel bg-black p-4 sm:p-6 flex flex-col justify-between border border-[#1f1f1f]">
          <div className="font-mono text-xs tracking-widest uppercase text-[#888888] border-b border-[#1f1f1f] pb-3 sm:pb-4 mb-4 sm:mb-6">
            Inference API Specification
          </div>
          
          <div className="font-mono text-[10px] sm:text-xs leading-relaxed sm:leading-loose text-[#aaa] overflow-x-auto">
            <span className="text-[#CCFF00]">POST</span> /api/detect<br/>
            Content-Type: multipart/form-data<br/>
            Body: file=[audio_file_binary]<br/>
            <br/>
            Response (JSON):<br/>
            {"{"}<br/>
            &nbsp;&nbsp;"verdict": <span className="text-[#FF3333]">"FAKE"</span>,<br/>
            &nbsp;&nbsp;"is_fake": true,<br/>
            &nbsp;&nbsp;"threat_score": <span className="text-[#FF3333]">65.9</span>,<br/>
            &nbsp;&nbsp;"fake_probability_pct": 65.9,<br/>
            &nbsp;&nbsp;"real_probability_pct": 34.1,<br/>
            &nbsp;&nbsp;"threshold": 0.0509,<br/>
            &nbsp;&nbsp;"alert_level": <span className="text-[#FF3333]">"HIGH"</span>,<br/>
            &nbsp;&nbsp;"latency_ms": 18.4,<br/>
            &nbsp;&nbsp;"audio_metrics": {"{"} "duration_seconds": 2.1 {"}"}<br/>
            {"}"}
          </div>
        </div>
      </div>
    </div>
  );
}
