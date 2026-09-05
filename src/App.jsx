import React, { useState, useEffect } from 'react';
import { 
  Terminal, ShieldAlert, Activity, Play, AlertTriangle, 
  Cpu, ArrowRight, Database, Code2, Layers, Disc,
  Upload, RefreshCw, Mic
} from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState('landing');

  return (
    <div className="min-h-screen text-[#f5f5f5] selection:bg-[#CCFF00] selection:text-black font-sans relative">
      {/* Global Topo Background */}
      <TopoBackground />
      
      <Navbar activeView={activeView} setActiveView={setActiveView} />
      
      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto relative z-10">
        {activeView === 'landing' && <LandingPage setActiveView={setActiveView} />}
        {activeView === 'dashboard' && <LiveDashboard />}
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
function Navbar({ activeView, setActiveView }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-[#1f1f1f]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        <div 
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => setActiveView('landing')}
        >
          <div className="w-6 h-6 bg-[#CCFF00] flex items-center justify-center">
            <div className="w-2 h-2 bg-black" />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase text-white">
            Vocal<span className="text-[#888888] font-light">Guard</span>
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-10">
          <NavLink label="Platform" active={activeView === 'landing'} onClick={() => setActiveView('landing')} />
          <NavLink label="Architecture" active={activeView === 'technology'} onClick={() => setActiveView('technology')} />
          <NavLink label="Console" active={activeView === 'dashboard'} onClick={() => setActiveView('dashboard')} isAccent />
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
      <div className="grid lg:grid-cols-12 gap-12 mt-12 items-center">
        
        {/* Left Typography */}
        <div className="lg:col-span-7 space-y-8">
          <div className="flex items-center gap-3 font-mono text-xs text-[#CCFF00] tracking-widest uppercase">
            <span className="w-2 h-2 bg-[#CCFF00] animate-pulse" />
            Sys.Def. Protocol // Online
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] uppercase text-white">
            Detect Voice <br/>
            <span className="text-[#888888]">Impersonation</span><br/>
            At The Edge.
          </h1>
          
          <p className="text-[#888888] text-lg max-w-xl leading-relaxed">
            Stop synthetic voice fraud before authorization. We analyze spectral phase consistency and neural vocoder artifacts in milliseconds, providing deterministic threat scoring for enterprise telephony.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button onClick={() => setActiveView('dashboard')} className="btn-primary flex items-center justify-center gap-3">
              Initialize Console <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => setActiveView('technology')} className="btn-outline flex items-center justify-center gap-3 bg-black">
              View Architecture
            </button>
          </div>
        </div>
        
        {/* Right Side: Upgraded Neural Widget */}
        <div className="lg:col-span-5 h-[500px]">
          <NeuralWidget />
        </div>
      </div>

      {/* Grid Features */}
      <div className="grid md:grid-cols-3 gap-0 mt-32 border border-[#1f1f1f] bg-black">
        <GridFeature 
          title="Phase Discrepancy" 
          desc="Identifies high-frequency phase mismatches characteristic of neural text-to-speech vocoders."
          number="01"
        />
        <GridFeature 
          title="Prosody Analytics" 
          desc="Evaluates pitch contours and micro-rhythms against baseline human biometrics."
          number="02"
        />
        <GridFeature 
          title="Sub-Second Latency" 
          desc="Built on optimized C++ inferences for real-time interception on existing VoIP networks."
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
   UPGRADED NEURAL FLOW WIDGET
   ========================================= */
function NeuralWidget() {
  return (
    <div className="tech-panel p-1 relative flex flex-col h-full w-full bg-black">
      <div className="flex justify-between items-center px-4 py-3 border-b border-[#1f1f1f] bg-[#0a0a0a]">
        <span className="font-mono text-[10px] text-[#CCFF00] tracking-widest uppercase">
          [ NEURAL_PIPELINE: ACTIVE_MONITORING ]
        </span>
        <span className="font-mono text-[10px] text-[#888888] tracking-widest uppercase">
          TGT: SIP_VOIP_01
        </span>
      </div>
      <div className="flex-1 bg-black p-2 relative flex items-center justify-center overflow-hidden">
         
         <svg className="w-full h-full" viewBox="0 0 500 400" preserveAspectRatio="xMidYMid meet">
           
           {/* Background Grid inside SVG */}
           <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
             <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#111" strokeWidth="1"/>
           </pattern>
           <rect width="500" height="400" fill="url(#grid)" />

           {/* ---------------- PATHS ---------------- */}
           <g fill="transparent" stroke="#333" strokeWidth="2" strokeDasharray="4,4">
             <path d="M 60 200 Q 150 100, 220 100" />
             <path d="M 60 200 Q 150 300, 220 300" />
             <path d="M 220 100 Q 300 100, 360 200" />
             <path d="M 220 300 Q 300 300, 360 200" />
             <path d="M 360 200 L 450 200" strokeDasharray="none" stroke="#555" />
           </g>

           {/* ---------------- ANIMATED DATA PULSES ---------------- */}
           <g fill="#CCFF00">
             <circle r="3"><animateMotion dur="2.5s" repeatCount="indefinite" path="M 60 200 Q 150 100, 220 100" /></circle>
             <circle r="3"><animateMotion dur="3.2s" repeatCount="indefinite" path="M 60 200 Q 150 300, 220 300" /></circle>
             <circle r="4"><animateMotion dur="1.8s" repeatCount="indefinite" path="M 220 100 Q 300 100, 360 200" /></circle>
             <circle r="4"><animateMotion dur="2.2s" repeatCount="indefinite" path="M 220 300 Q 300 300, 360 200" /></circle>
           </g>
           
           <circle r="5" fill="#FF3333">
             <animateMotion dur="1.5s" repeatCount="indefinite" path="M 360 200 L 450 200" />
           </circle>

           {/* ---------------- NODES ---------------- */}
           <circle cx="60" cy="200" r="8" fill="#000" stroke="#888" strokeWidth="2" />
           <text x="60" y="225" fill="#aaa" fontSize="10" fontFamily="monospace" textAnchor="middle" letterSpacing="1">LIVE_AUDIO</text>
           
           <circle cx="220" cy="100" r="14" fill="#000" stroke="#CCFF00" strokeWidth="2" />
           <text x="220" y="70" fill="#CCFF00" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">SPECTRAL_PHASE_CNN</text>
           <text x="220" y="130" fill="#777" fontSize="9" fontFamily="monospace" textAnchor="middle">VOCODER_ARTIFACTS</text>
           
           <circle cx="220" cy="300" r="14" fill="#000" stroke="#CCFF00" strokeWidth="2" />
           <text x="220" y="270" fill="#CCFF00" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">PROSODY_LSTM</text>
           <text x="220" y="330" fill="#777" fontSize="9" fontFamily="monospace" textAnchor="middle">PITCH_CONTOURS</text>
           
           <circle cx="360" cy="200" r="20" fill="#000" stroke="#fff" strokeWidth="2" />
           <text x="360" y="170" fill="#fff" fontSize="11" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">RISK_ENGINE</text>
           <text x="360" y="240" fill="#777" fontSize="9" fontFamily="monospace" textAnchor="middle">SCORING_ALG</text>
           
           <circle cx="450" cy="200" r="12" fill="#000" stroke="#FF3333" strokeWidth="3">
              <animate attributeName="stroke" values="#555; #FF3333; #555" dur="1s" repeatCount="indefinite" />
           </circle>
           <text x="450" y="175" fill="#FF3333" fontSize="12" fontFamily="monospace" fontWeight="bold" textAnchor="middle" letterSpacing="1">THREAT</text>
           <text x="450" y="235" fill="#FF3333" fontSize="10" fontFamily="monospace" textAnchor="middle">98.4% CLONE</text>
         </svg>
      </div>
    </div>
  );
}


/* =========================================
   LIVE DASHBOARD (Control Room Style)
   ========================================= */
function LiveDashboard() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, analyzing, danger, safe
  const [fileName, setFileName] = useState(null);

  useEffect(() => {
    if (!isAnalyzing) return;
    setStatus('analyzing');
    let progress = 0;
    
    const interval = setInterval(() => {
      progress += Math.random() * 12;
      if (progress > 100) progress = 100;
      
      setRiskScore(Math.min(progress * 0.96, 96));

      if (progress >= 100) {
        clearInterval(interval);
        setStatus('danger');
        setIsAnalyzing(false);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleReset = () => {
    setStatus('idle');
    setRiskScore(0);
    setIsAnalyzing(false);
    setFileName(null);
  };

  return (
    <div className="animate-in fade-in duration-700 w-full">
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-[#1f1f1f] pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter uppercase text-white">Operations Console</h2>
          <div className="flex gap-4 mt-2 font-mono text-xs text-[#888888]">
            <span>LOC: IN-MUM-01</span>
            <span>NET: {fileName ? 'FILE_UPLOAD' : 'VoIP_SIP_TRUNK'}</span>
          </div>
        </div>
        
        <div className="mt-4 md:mt-0 flex items-center gap-3 tech-panel px-4 py-2 border-[#333] bg-black">
          <div className={`w-2 h-2 ${status === 'danger' ? 'bg-[#FF3333]' : 'bg-[#CCFF00]'} animate-pulse`} />
          <span className="font-mono text-xs tracking-widest uppercase">
            {status === 'danger' ? 'Threat Detected' : 'System Armed'}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visualizer */}
        <div className="lg:col-span-8 space-y-6">
          <div className="tech-panel relative bg-black">
            
            <div className="border-b border-[#1f1f1f] px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center bg-[#050505] gap-4">
              <div className="font-mono text-[10px] sm:text-xs text-[#f5f5f5] flex items-center gap-3 truncate max-w-full">
                <Disc className="w-4 h-4 text-[#888888] shrink-0" />
                <span className="truncate">
                  {fileName ? `FILE: ${fileName}` : 'STREAM_ID: 9982XF // MIC_INPUT'}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {status === 'idle' && !isAnalyzing && (
                  <>
                    <button 
                      onClick={() => { setFileName(null); setIsAnalyzing(true); }}
                      className="font-mono text-[10px] tracking-widest uppercase bg-[#111] border border-[#333] text-[#f5f5f5] px-4 py-2 hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors flex items-center gap-2"
                    >
                      <Mic className="w-3 h-3" /> Live Mic
                    </button>
                    
                    <label className="font-mono text-[10px] tracking-widest uppercase bg-white text-black px-4 py-2 hover:bg-[#CCFF00] transition-colors flex items-center gap-2 cursor-pointer">
                      <Upload className="w-3 h-3" /> Upload Audio
                      <input 
                        type="file" 
                        accept="audio/*,video/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setFileName(e.target.files[0].name);
                            setIsAnalyzing(true);
                          }
                        }}
                      />
                    </label>
                  </>
                )}

                {status === 'analyzing' && (
                  <div className="font-mono text-[10px] tracking-widest uppercase text-[#CCFF00] animate-pulse py-2">
                    [ ANALYZING {fileName ? 'FILE' : 'STREAM'} ]
                  </div>
                )}

                {(status === 'danger' || status === 'safe') && (
                  <button 
                    onClick={handleReset}
                    className="font-mono text-[10px] tracking-widest uppercase bg-[#111] border border-[#333] text-[#f5f5f5] px-4 py-2 hover:border-white hover:text-white transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-3 h-3" /> Test Again
                  </button>
                )}
              </div>
            </div>

            {/* Brutalist Waveform */}
            <div className="h-64 p-6 flex flex-col justify-center relative overflow-hidden bg-black">
              
              {/* Background grid lines for measurement */}
              <div className="absolute inset-0 flex flex-col justify-between py-6 pointer-events-none opacity-20">
                <div className="w-full border-t border-dashed border-[#888888]" />
                <div className="w-full border-t border-dashed border-[#888888]" />
                <div className="w-full border-t border-dashed border-[#888888]" />
              </div>

              {status === 'idle' ? (
                <div className="text-center font-mono text-[#555] tracking-widest uppercase text-sm">
                  Waiting for audio source...
                </div>
              ) : (
                <div className="flex items-center gap-[2px] h-32 w-full justify-center">
                  {[...Array(80)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-2 transition-all duration-75 ${
                        status === 'danger' ? 'bg-[#FF3333]' : 'bg-[#CCFF00]'
                      }`}
                      style={{ 
                        height: isAnalyzing || status === 'danger' ? `${10 + Math.random() * 90}%` : '4px',
                        opacity: status === 'danger' && Math.random() > 0.8 ? 0.3 : 1
                      }}
                    />
                  ))}
                </div>
              )}
              
              {/* Threat Overlay */}
              {status === 'danger' && (
                <div className="absolute inset-0 bg-[#FF3333]/10 flex items-center justify-center backdrop-blur-[2px] animate-in fade-in duration-500">
                   <div className="bg-black border border-[#FF3333] px-6 py-3 flex items-center gap-4">
                     <AlertTriangle className="w-5 h-5 text-[#FF3333] animate-pulse" />
                     <span className="font-mono font-bold text-sm text-[#FF3333] tracking-widest uppercase">
                       Synthetic Match Found
                     </span>
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* Data Modules */}
          <div className="grid grid-cols-2 gap-6">
            <DataModule 
              title="Spectral Align" 
              value={status === 'danger' ? 'ERR_PHASE' : (status === 'idle' ? 'STANDBY' : '0.04ms')}
              isAlert={status === 'danger'}
            />
            <DataModule 
              title="Prosody Shift" 
              value={status === 'danger' ? 'UNNATURAL' : (status === 'idle' ? 'STANDBY' : '0.82Hz')}
              isAlert={status === 'danger'}
            />
          </div>
        </div>

        {/* Right Column: Scoring */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <div className="tech-panel bg-black flex-1 p-6 flex flex-col justify-between">
            <div className="font-mono text-xs tracking-widest uppercase text-[#888888] border-b border-[#1f1f1f] pb-4 mb-8">
              Threat Probability
            </div>
            
            <div className="text-center">
              <span className={`text-8xl font-bold tracking-tighter ${status === 'danger' ? 'text-[#FF3333]' : 'text-white'}`}>
                {Math.round(riskScore)}<span className="text-4xl text-[#555]">%</span>
              </span>
              
              <div className="mt-6 font-mono text-[10px] tracking-widest uppercase text-[#888888]">
                Enterprise Threshold: 85%
              </div>
            </div>

            <div className="mt-12">
               <div className="w-full bg-[#111] h-2">
                 <div 
                   className={`h-full transition-all duration-300 ${status === 'danger' ? 'bg-[#FF3333]' : 'bg-[#CCFF00]'}`} 
                   style={{ width: `${riskScore}%` }}
                 />
               </div>
            </div>
          </div>

          {/* Action Module */}
          <div className="tech-panel bg-black p-6">
             <div className="font-mono text-xs tracking-widest uppercase text-[#888888] mb-4">
              Protocol Enforcement
            </div>
            {status === 'danger' ? (
              <div className="space-y-3 animate-in slide-in-from-bottom-2">
                <button className="w-full py-3 bg-[#FF3333] text-black font-mono font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors">
                  Block Connection
                </button>
                <button className="w-full py-3 bg-transparent border border-[#333] text-white font-mono font-bold text-xs uppercase tracking-widest hover:border-white transition-colors">
                  Flag For Review
                </button>
              </div>
            ) : (
              <div className="h-[98px] flex items-center justify-center border border-[#1f1f1f] border-dashed">
                <span className="font-mono text-[10px] text-[#555] uppercase">Waiting for analysis...</span>
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
    <div className={`tech-panel bg-black p-6 border-l-2 ${isAlert ? 'border-l-[#FF3333]' : 'border-l-[#333]'}`}>
      <h4 className="font-mono text-[10px] text-[#888888] uppercase tracking-widest mb-2">{title}</h4>
      <div className={`font-mono text-xl ${isAlert ? 'text-[#FF3333]' : 'text-[#f5f5f5]'}`}>
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
    <div className="animate-in fade-in duration-700 bg-black p-8 border border-[#1f1f1f]">
      <div className="mb-16 border-b border-[#1f1f1f] pb-8">
        <h2 className="text-4xl font-bold uppercase tracking-tighter mb-4 text-white">Architecture</h2>
        <p className="font-mono text-[#888888] text-sm uppercase tracking-widest">
          Multi-Stage Neural Verification Pipeline
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-12">
          
          <div className="relative pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-sm tracking-widest uppercase text-[#CCFF00] mb-2">Stage 01</h3>
             <h4 className="text-2xl font-bold uppercase tracking-tight mb-3 text-white">Spectral Extraction</h4>
             <p className="text-[#888888] text-sm leading-relaxed">
               Raw audio is decomposed into high-frequency mel-spectrograms. Neural network vocoders (HiFi-GAN, MelGAN) inevitably leave repetitive phase artifacts during waveform reconstruction. We isolate these signatures.
             </p>
          </div>

          <div className="relative pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-sm tracking-widest uppercase text-[#CCFF00] mb-2">Stage 02</h3>
             <h4 className="text-2xl font-bold uppercase tracking-tight mb-3 text-white">Prosodic Timing</h4>
             <p className="text-[#888888] text-sm leading-relaxed">
               Evaluating the biological constraints of speech. LLM-driven TTS engines generate continuous speech that lacks human lung-capacity variations, micro-stutters, and natural intonation decay.
             </p>
          </div>

        </div>

        <div className="tech-panel bg-black p-6 flex flex-col justify-between">
          <div className="font-mono text-xs tracking-widest uppercase text-[#888888] border-b border-[#1f1f1f] pb-4 mb-6">
            Integration API
          </div>
          
          <div className="font-mono text-xs leading-loose text-[#aaa]">
            <span className="text-[#CCFF00]">POST</span> /api/v1/stream/analyze<br/>
            Headers: <br/>
            &nbsp;&nbsp;Authorization: Bearer [KEY]<br/>
            &nbsp;&nbsp;X-Latency-Profile: "ultra-low"<br/>
            <br/>
            Response:<br/>
            {"{"}<br/>
            &nbsp;&nbsp;"status": "COMPLETED",<br/>
            &nbsp;&nbsp;"risk_score": <span className="text-[#FF3333]">98.4</span>,<br/>
            &nbsp;&nbsp;"flags": ["PHASE_ERR", "VOC_MATCH"],<br/>
            &nbsp;&nbsp;"recommended_action": "TERMINATE"<br/>
            {"}"}
          </div>
        </div>
      </div>
    </div>
  );
}
