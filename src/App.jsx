import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Square, AlertTriangle, 
  ArrowRight, Disc,
  Upload, RefreshCw, Mic, CheckCircle2,
  Download, AlertOctagon, Radio
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export default function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [backendStatus, setBackendStatus] = useState({ online: false, checking: true, data: null });

  useEffect(() => {
    // Check backend health on mount
    fetch(`${API_BASE}/api/health`)
      .then(res => res.json())
      .then(data => setBackendStatus({ online: true, checking: false, data }))
      .catch(() => setBackendStatus({ online: false, checking: false, data: null }));
  }, []);

  return (
    <div className="min-h-screen text-[#f5f5f5] selection:bg-[#CCFF00] selection:text-black font-sans relative bg-[#050505]">
      {/* Global Topo Background */}
      <TopoBackground />
      
      <Navbar activeView={activeView} setActiveView={setActiveView} backendStatus={backendStatus} />
      
      <main className="pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto relative z-10">
        {activeView === 'landing' && <LandingPage setActiveView={setActiveView} />}
        {activeView === 'dashboard' && <LiveDashboard backendStatus={backendStatus} />}
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
function Navbar({ activeView, setActiveView, backendStatus }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-[#1f1f1f]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        <div 
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => setActiveView('dashboard')}
        >
          <div className="w-6 h-6 bg-[#CCFF00] flex items-center justify-center">
            <div className="w-2 h-2 bg-black" />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase text-white">
            Vocal<span className="text-[#888888] font-light">Guard</span>
          </span>
          <span className="hidden sm:inline-block font-mono text-[9px] bg-[#111] text-[#888] border border-[#222] px-2 py-0.5">
            MODEL: v3-MULTI-RES-CNN
          </span>
        </div>
        
        <div className="flex items-center gap-6 md:gap-8">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase">
            <span className={`w-2 h-2 rounded-full ${backendStatus.online ? 'bg-[#CCFF00] animate-pulse' : 'bg-[#FF3333]'}`} />
            <span className={backendStatus.online ? 'text-[#888]' : 'text-[#FF3333]'}>
              {backendStatus.online ? 'API ONLINE' : 'API DISCONNECTED'}
            </span>
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
      <div className="grid lg:grid-cols-12 gap-12 mt-12 items-center">
        
        {/* Left Typography */}
        <div className="lg:col-span-7 space-y-8">
          <div className="flex items-center gap-3 font-mono text-xs text-[#CCFF00] tracking-widest uppercase">
            <span className="w-2 h-2 bg-[#CCFF00] animate-pulse" />
            PyTorch Multi-Domain Spectrogram CNN // Online
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05] uppercase text-white">
            Detect Voice <br/>
            <span className="text-[#888888]">Deepfakes</span><br/>
            In Real Time.
          </h1>
          
          <p className="text-[#888888] text-lg max-w-xl leading-relaxed">
            Stop synthetic voice fraud before authorization. Our PyTorch multi-resolution spectrogram neural network detects high-frequency neural vocoder artifacts, prosodic phase shifts, and AI text-to-speech clones in milliseconds.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button onClick={() => setActiveView('dashboard')} className="btn-primary flex items-center justify-center gap-3">
              Open Analysis Console <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => setActiveView('technology')} className="btn-outline flex items-center justify-center gap-3 bg-black">
              View Architecture
            </button>
          </div>
        </div>
        
        {/* Right Side: Neural Flow Widget */}
        <div className="lg:col-span-5 h-[500px]">
          <NeuralWidget />
        </div>
      </div>

      {/* Grid Features */}
      <div className="grid md:grid-cols-3 gap-0 mt-32 border border-[#1f1f1f] bg-black">
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
   LIVE DASHBOARD (Full Backend Connected)
   ========================================= */
function LiveDashboard({ backendStatus }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, analyzing, danger, safe, error
  const [fileName, setFileName] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [detectionData, setDetectionData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  // Audio Playback Listener
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onEnded = () => setIsPlaying(false);
    el.addEventListener('ended', onEnded);
    return () => el.removeEventListener('ended', onEnded);
  }, [audioUrl]);

  // Clean up audio blob URL on change/unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Handle Audio File Detection
  const analyzeAudioBlobOrFile = async (fileOrBlob, displayName) => {
    setFileName(displayName);
    setStatus('analyzing');
    setIsAnalyzing(true);
    setErrorMessage(null);
    setDetectionData(null);

    // Create playable audio URL
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const newAudioUrl = URL.createObjectURL(fileOrBlob);
    setAudioUrl(newAudioUrl);

    try {
      const formData = new FormData();
      formData.append('file', fileOrBlob, displayName);

      const response = await fetch(`${API_BASE}/api/detect`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.detail || `Inference error (Status: ${response.status})`);
      }

      const result = await response.json();
      setDetectionData(result);
      setIsAnalyzing(false);

      if (result.is_fake) {
        setStatus('danger');
      } else {
        setStatus('safe');
      }
    } catch (err) {
      console.error('Detection failed:', err);
      setIsAnalyzing(false);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to communicate with inference server.');
    }
  };

  // Upload Audio File
  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      analyzeAudioBlobOrFile(file, file.name);
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
        // Stop all tracks to release mic
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
    setStatus('idle');
    setIsAnalyzing(false);
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
        <div className="mb-6 p-3 bg-[#FF3333]/10 border border-[#FF3333] text-[#FF3333] font-mono text-xs flex items-center justify-between">
          <span>⚠️ Backend offline: Start local server with &quot;npm run backend&quot; or ensure API is reachable.</span>
          <button 
            onClick={() => window.location.reload()} 
            className="underline hover:text-white"
          >
            Retry
          </button>
        </div>
      )}
      
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-[#1f1f1f] pb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tighter uppercase text-white">Operations Console</h2>
            <span className="font-mono text-xs bg-[#111] text-[#CCFF00] border border-[#222] px-2 py-0.5">
              LIVE INFERENCE
            </span>
          </div>
          <div className="flex flex-wrap gap-4 mt-2 font-mono text-xs text-[#888888]">
            <span>MODEL: voice_deepfake_detector.pth</span>
            <span>THRESHOLD: 5.09%</span>
            <span>INPUT: {fileName ? fileName : (isRecording ? 'LIVE_STREAM' : 'STANDBY')}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className={`flex items-center gap-3 tech-panel px-4 py-2 bg-black border ${
            status === 'danger' ? 'border-[#FF3333]' : 
            status === 'safe' ? 'border-[#CCFF00]' : 
            status === 'analyzing' ? 'border-[#CCFF00]' : 'border-[#333]'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              status === 'danger' ? 'bg-[#FF3333] animate-ping' : 
              status === 'safe' ? 'bg-[#CCFF00]' : 
              status === 'analyzing' ? 'bg-[#CCFF00] animate-pulse' : 
              isRecording ? 'bg-[#FF3333] animate-pulse' : 'bg-[#555]'
            }`} />
            <span className="font-mono text-xs tracking-widest uppercase text-white">
              {status === 'danger' && 'THREAT DETECTED'}
              {status === 'safe' && 'VOICE VERIFIED (REAL)'}
              {status === 'analyzing' && 'ANALYZING SPECTROGRAMS...'}
              {status === 'error' && 'INFERENCE ERROR'}
              {status === 'idle' && (isRecording ? `RECORDING (00:${String(recordSeconds).padStart(2, '0')})` : 'SYSTEM ARMED')}
            </span>
          </div>
        </div>
      </div>

      {/* Demo Samples Quick Bar */}
      <div className="mb-6 p-4 tech-panel bg-[#0a0a0a] border-[#222] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs text-[#888]">
          <Radio className="w-3.5 h-3.5 text-[#CCFF00]" />
          <span>INSTANT DEMO SAMPLES:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleLoadSample('/samples/real_human_voice.m4a', 'real_human_voice.m4a')}
            disabled={isAnalyzing || isRecording}
            className="font-mono text-[11px] tracking-wider uppercase px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#CCFF00] transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3 h-3 text-[#CCFF00]" /> Real Human Sample
          </button>
          <button
            onClick={() => handleLoadSample('/samples/ai_synthetic_voicemaker.mp3', 'ai_synthetic_voicemaker.mp3')}
            disabled={isAnalyzing || isRecording}
            className="font-mono text-[11px] tracking-wider uppercase px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#FF3333] transition-colors flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3 h-3 text-[#FF3333]" /> AI Voicemaker TTS
          </button>
          <button
            onClick={() => handleLoadSample('/samples/ai_generated_speech.mp3', 'ai_generated_speech.mp3')}
            disabled={isAnalyzing || isRecording}
            className="font-mono text-[11px] tracking-wider uppercase px-3 py-1.5 bg-[#111] hover:bg-[#1a1a1a] text-white border border-[#333] hover:border-[#FF3333] transition-colors flex items-center gap-1.5"
          >
            <AlertOctagon className="w-3 h-3 text-[#FF3333]" /> AI Synthetic Speech
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Left Column: Visualizer & Controls */}
        <div className="lg:col-span-8 space-y-6">
          <div className="tech-panel relative bg-black">
            
            {/* Header controls inside visualizer */}
            <div className="border-b border-[#1f1f1f] px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center bg-[#050505] gap-4">
              <div className="font-mono text-[10px] sm:text-xs text-[#f5f5f5] flex items-center gap-3 truncate max-w-full">
                <Disc className="w-4 h-4 text-[#888888] shrink-0" />
                <span className="truncate">
                  {fileName ? `ACTIVE: ${fileName}` : (isRecording ? 'STREAM: MICROPHONE_BUFFER' : 'SOURCE: WAITING FOR AUDIO')}
                </span>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Audio Playback button if file exists */}
                {audioUrl && !isRecording && (
                  <button
                    onClick={togglePlayback}
                    className="font-mono text-[10px] tracking-widest uppercase bg-[#1a1a1a] border border-[#333] text-white px-3 py-2 hover:border-white transition-colors flex items-center gap-2"
                  >
                    {isPlaying ? <Square className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white" />}
                    {isPlaying ? 'Pause Audio' : 'Play Audio'}
                  </button>
                )}

                {/* Live Mic Button */}
                {!isRecording ? (
                  <button 
                    onClick={startRecording}
                    disabled={isAnalyzing}
                    className="font-mono text-[10px] tracking-widest uppercase bg-[#111] border border-[#333] text-[#f5f5f5] px-4 py-2 hover:border-[#CCFF00] hover:text-[#CCFF00] transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Mic className="w-3 h-3" /> Record Mic
                  </button>
                ) : (
                  <button 
                    onClick={stopRecording}
                    className="font-mono text-[10px] tracking-widest uppercase bg-[#FF3333] text-black px-4 py-2 hover:bg-white transition-colors flex items-center gap-2 animate-pulse"
                  >
                    <Square className="w-3 h-3 fill-black" /> Stop & Analyze ({recordSeconds}s)
                  </button>
                )}
                
                {/* Upload Button */}
                <label className="font-mono text-[10px] tracking-widest uppercase bg-white text-black px-4 py-2 hover:bg-[#CCFF00] transition-colors flex items-center gap-2 cursor-pointer">
                  <Upload className="w-3 h-3" /> Upload Audio
                  <input 
                    type="file" 
                    accept="audio/*,video/*,.wav,.mp3,.m4a,.aac,.ogg,.flac,.webm" 
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
                </label>

                {(status === 'danger' || status === 'safe' || status === 'error') && (
                  <button 
                    onClick={handleReset}
                    className="font-mono text-[10px] tracking-widest uppercase bg-[#111] border border-[#333] text-[#f5f5f5] px-4 py-2 hover:border-white hover:text-white transition-colors flex items-center gap-2"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Brutalist Waveform & Visualizer */}
            <div className="h-72 p-6 flex flex-col justify-center relative overflow-hidden bg-black">
              
              {/* Background grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between py-6 pointer-events-none opacity-20">
                <div className="w-full border-t border-dashed border-[#888888]" />
                <div className="w-full border-t border-dashed border-[#888888]" />
                <div className="w-full border-t border-dashed border-[#888888]" />
              </div>

              {status === 'idle' && !isRecording ? (
                <div className="text-center font-mono text-[#555] tracking-widest uppercase text-sm space-y-2">
                  <div>Select an audio file or record speech to inspect</div>
                  <div className="text-xs text-[#444]">Supports .wav, .mp3, .m4a, .aac, .flac, .ogg, .webm</div>
                </div>
              ) : (
                <div className="flex items-center gap-[2px] h-36 w-full justify-center">
                  {[...Array(72)].map((_, i) => {
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
                        className={`w-2 transition-all duration-150 ${
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
                <div className="absolute inset-0 bg-[#FF3333]/15 flex items-center justify-center backdrop-blur-[2px] animate-in fade-in duration-300">
                   <div className="bg-black border-2 border-[#FF3333] p-5 flex items-center gap-4 max-w-md shadow-2xl">
                     <AlertTriangle className="w-8 h-8 text-[#FF3333] shrink-0 animate-bounce" />
                     <div>
                       <div className="font-mono font-bold text-base text-[#FF3333] tracking-widest uppercase">
                         🚨 SYNTHETIC MATCH DETECTED
                       </div>
                       <div className="font-mono text-xs text-[#ccc] mt-1">
                         High confidence of AI text-to-speech / neural vocoder generation.
                       </div>
                     </div>
                   </div>
                </div>
              )}

              {status === 'safe' && (
                <div className="absolute inset-0 bg-[#CCFF00]/10 flex items-center justify-center backdrop-blur-[2px] animate-in fade-in duration-300">
                   <div className="bg-black border-2 border-[#CCFF00] p-5 flex items-center gap-4 max-w-md shadow-2xl">
                     <CheckCircle2 className="w-8 h-8 text-[#CCFF00] shrink-0" />
                     <div>
                       <div className="font-mono font-bold text-base text-[#CCFF00] tracking-widest uppercase">
                         ✅ VERIFIED HUMAN VOICE
                       </div>
                       <div className="font-mono text-xs text-[#ccc] mt-1">
                         Authentic acoustic harmonics confirmed. No deepfake anomalies.
                       </div>
                     </div>
                   </div>
                </div>
              )}

              {status === 'error' && (
                <div className="absolute inset-0 bg-[#FF3333]/20 flex items-center justify-center backdrop-blur-[2px]">
                   <div className="bg-black border border-[#FF3333] p-4 text-center max-w-md">
                     <div className="font-mono font-bold text-xs text-[#FF3333] tracking-widest uppercase mb-1">
                       Inference Failed
                     </div>
                     <div className="font-mono text-[11px] text-[#aaa]">
                       {errorMessage}
                     </div>
                   </div>
                </div>
              )}
            </div>

            {/* Audio Info Strip */}
            {detectionData && (
              <div className="border-t border-[#1f1f1f] bg-[#070707] px-6 py-3 flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] text-[#888]">
                <div>DURATION: <span className="text-white">{detectionData.audio_metrics?.duration_seconds}s</span></div>
                <div>WINDOWS: <span className="text-white">{detectionData.audio_metrics?.windows_analyzed}</span></div>
                <div>PEAK AMP: <span className="text-white">{detectionData.audio_metrics?.peak_amplitude}</span></div>
                <div>SPECTRAL CENTROID: <span className="text-white">{detectionData.audio_metrics?.spectral_centroid_hz} Hz</span></div>
                <div>LATENCY: <span className="text-[#CCFF00]">{detectionData.latency_ms} ms</span></div>
              </div>
            )}
          </div>

          {/* Data Modules */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div className="tech-panel bg-black p-5 border border-[#1f1f1f]">
              <div className="font-mono text-xs tracking-widest uppercase text-[#888888] mb-3 flex items-center justify-between">
                <span>Multi-Window Temporal Analysis ({detectionData.windows.length} Segments)</span>
                <span className="text-[10px] text-[#555]">2.0s SLIDING WINDOWS</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {detectionData.windows.map((w, idx) => (
                  <div 
                    key={idx}
                    className={`p-2.5 border text-center font-mono text-[10px] ${
                      w.is_fake 
                        ? 'border-[#FF3333]/50 bg-[#FF3333]/10 text-[#FF3333]' 
                        : 'border-[#333] bg-[#0a0a0a] text-[#888]'
                    }`}
                  >
                    <div className="font-bold">{w.start_time}s - {w.end_time}s</div>
                    <div className="mt-1 text-xs">{w.fake_percentage}%</div>
                    <div className="text-[9px] uppercase tracking-wider mt-0.5">
                      {w.is_fake ? 'FAKE' : 'REAL'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Threat Probability & Protocol Enforcement */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <div className="tech-panel bg-black flex-1 p-6 flex flex-col justify-between border border-[#1f1f1f]">
            <div className="font-mono text-xs tracking-widest uppercase text-[#888888] border-b border-[#1f1f1f] pb-4 mb-6 flex justify-between items-center">
              <span>Threat Probability</span>
              {detectionData && (
                <span className={`text-[10px] px-2 py-0.5 font-bold ${isFakeVerdict ? 'bg-[#FF3333] text-black' : 'bg-[#CCFF00] text-black'}`}>
                  {detectionData.verdict}
                </span>
              )}
            </div>
            
            <div className="text-center my-4">
              <span className={`text-7xl font-bold tracking-tighter ${
                isFakeVerdict ? 'text-[#FF3333]' : (status === 'safe' ? 'text-[#CCFF00]' : 'text-white')
              }`}>
                {Math.round(currentRiskScore)}<span className="text-4xl text-[#555]">%</span>
              </span>
              
              <div className="mt-4 font-mono text-xs tracking-widest uppercase text-[#aaa]">
                {detectionData ? (
                  isFakeVerdict 
                    ? `AI DEEPFAKE PROBABILITY: ${detectionData.fake_probability_pct}%` 
                    : `HUMAN AUTHENTICITY: ${detectionData.real_probability_pct}%`
                ) : 'Calibrated Decision Threshold: 5.09%'}
              </div>

              {detectionData && (
                <div className="mt-2 font-mono text-[10px] text-[#666]">
                  Calibrated Threshold: {detectionData.threshold} | Windows: {detectionData.audio_metrics?.windows_analyzed}
                </div>
              )}
            </div>

            <div className="mt-8">
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
               <div className="flex justify-between font-mono text-[9px] text-[#666] mt-1">
                 <span>0% REAL</span>
                 <span className="text-white">| THRESHOLD 5.09%</span>
                 <span>100% AI</span>
               </div>
            </div>
          </div>

          {/* Action Module */}
          <div className="tech-panel bg-black p-6 border border-[#1f1f1f]">
            <div className="font-mono text-xs tracking-widest uppercase text-[#888888] mb-4">
              Protocol Enforcement & Export
            </div>
            {detectionData ? (
              <div className="space-y-3 animate-in slide-in-from-bottom-2">
                {isFakeVerdict ? (
                  <button 
                    onClick={() => alert(`Connection Blocked: Synthetic identity impersonation detected on file ${fileName}`)}
                    className="w-full py-3 bg-[#FF3333] text-black font-mono font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                  >
                    🚨 Block Audio Stream
                  </button>
                ) : (
                  <button 
                    onClick={() => alert(`Connection Approved: Verified human voice authentication for ${fileName}`)}
                    className="w-full py-3 bg-[#CCFF00] text-black font-mono font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
                  >
                    ✅ Authorize Stream
                  </button>
                )}
                
                <button 
                  onClick={downloadAuditReport}
                  className="w-full py-3 bg-transparent border border-[#333] text-white font-mono font-bold text-xs uppercase tracking-widest hover:border-white transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Download Audit JSON
                </button>
              </div>
            ) : (
              <div className="h-[98px] flex items-center justify-center border border-[#1f1f1f] border-dashed">
                <span className="font-mono text-[10px] text-[#555] uppercase">Waiting for audio analysis...</span>
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
    <div className={`tech-panel bg-black p-4 sm:p-5 border-l-2 ${isAlert ? 'border-l-[#FF3333]' : 'border-l-[#333]'}`}>
      <h4 className="font-mono text-[10px] text-[#888888] uppercase tracking-widest mb-1">{title}</h4>
      <div className={`font-mono text-base sm:text-lg font-bold truncate ${isAlert ? 'text-[#FF3333]' : 'text-[#f5f5f5]'}`}>
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
          PyTorch Multi-Domain Deepfake Verification Pipeline
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-12">
          
          <div className="relative pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-sm tracking-widest uppercase text-[#CCFF00] mb-2">Stage 01</h3>
             <h4 className="text-2xl font-bold uppercase tracking-tight mb-3 text-white">Multi-STFT Spectrogram Transform</h4>
             <p className="text-[#888888] text-sm leading-relaxed">
               Raw audio is normalized and transformed into a 3-channel feature map using STFT windows of 512, 1024, and 2048 samples with 128 mel bins. This captures both fine temporal transients and long-range frequency harmonics.
             </p>
          </div>

          <div className="relative pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-sm tracking-widest uppercase text-[#CCFF00] mb-2">Stage 02</h3>
             <h4 className="text-2xl font-bold uppercase tracking-tight mb-3 text-white">Squeeze-and-Excitation Residual CNN</h4>
             <p className="text-[#888888] text-sm leading-relaxed">
               4-stage convolutional backbone with SE-blocks (Squeeze-and-Excitation) that dynamically recalibrates channel-wise feature responses, picking up subtle checkerboard artifacts and phase irregularities left by neural vocoders (HiFi-GAN, MelGAN).
             </p>
          </div>

          <div className="relative pl-8 border-l border-[#333]">
             <div className="absolute left-[-5px] top-0 w-2 h-2 bg-[#CCFF00]" />
             <h3 className="font-mono text-sm tracking-widest uppercase text-[#CCFF00] mb-2">Stage 03</h3>
             <h4 className="text-2xl font-bold uppercase tracking-tight mb-3 text-white">Triple Statistical Pooling Classifier</h4>
             <p className="text-[#888888] text-sm leading-relaxed">
               Feature maps are aggregated across mean, standard deviation, and max pooling (256 * 3 = 768 dimensions), fed through dense layers with SiLU activations and Dropout, outputting a calibrated sigmoid confidence score.
             </p>
          </div>

        </div>

        <div className="tech-panel bg-black p-6 flex flex-col justify-between border border-[#1f1f1f]">
          <div className="font-mono text-xs tracking-widest uppercase text-[#888888] border-b border-[#1f1f1f] pb-4 mb-6">
            Inference API Specification
          </div>
          
          <div className="font-mono text-xs leading-loose text-[#aaa]">
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
