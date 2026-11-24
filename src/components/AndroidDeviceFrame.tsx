import React, { useState } from 'react';
import { Smartphone, Monitor, Code2, Sparkles, Volume2, VolumeX } from 'lucide-react';

interface AndroidDeviceFrameProps {
  children: React.ReactNode;
  onOpenCodeViewer: () => void;
  onOpenLevelSelect: () => void;
  onOpenSettings: () => void;
  isSoundMuted: boolean;
  onToggleSound: () => void;
}

export const AndroidDeviceFrame: React.FC<AndroidDeviceFrameProps> = ({
  children,
  onOpenCodeViewer,
  onOpenLevelSelect,
  onOpenSettings,
  isSoundMuted,
  onToggleSound,
}) => {
  const [frameMode, setFrameMode] = useState<'device' | 'clean'>('device');

  return (
    <div className="min-h-screen w-full bg-[#120a1f] flex flex-col items-center justify-between p-2 sm:p-6 text-white font-sans">
      {/* Top Header Toolbar */}
      <header className="w-full max-w-4xl mb-4 flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 to-amber-400 flex items-center justify-center font-black text-lg shadow-md">
            🍬
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-pink-200 to-purple-200">
                Sugar Pop Match-3
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                Android Jetpack Compose
              </span>
            </div>
            <p className="text-xs text-white/50">Native Android casual-game foundation & home screen</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Kotlin Code Viewer Button */}
          <button
            onClick={onOpenCodeViewer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Code2 className="w-4 h-4 text-amber-300" />
            <span>Kotlin & Compose Code</span>
          </button>

          {/* Device Frame View Toggle */}
          <div className="hidden sm:flex items-center bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setFrameMode('device')}
              className={`p-1.5 rounded-lg transition-colors ${
                frameMode === 'device' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'
              }`}
              title="Mobile Device Mockup"
            >
              <Smartphone className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFrameMode('clean')}
              className={`p-1.5 rounded-lg transition-colors ${
                frameMode === 'clean' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/80'
              }`}
              title="Clean Borderless View"
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Sound Toggle */}
          <button
            onClick={onToggleSound}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            title={isSoundMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* Main Center Area: Android Mobile Simulation */}
      <main className="flex-1 w-full flex items-center justify-center my-auto py-2">
        {frameMode === 'device' ? (
          // Smartphone chassis
          <div className="relative w-full max-w-[390px] sm:max-w-[410px] h-[780px] max-h-[90vh] rounded-[48px] p-3.5 bg-gradient-to-b from-[#2a2b36] via-[#1a1b24] to-[#12131a] shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_0_2px_rgba(255,255,255,0.1)] border-[4px] border-[#3e4050] flex flex-col justify-between">
            {/* Top Speaker Ear-piece & Front Punch-hole Camera */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 pointer-events-none">
              <div className="w-12 h-1 rounded-full bg-black/60" />
            </div>
            {/* Camera cutout */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 w-3.5 h-3.5 rounded-full bg-[#050608] border border-white/10 flex items-center justify-center pointer-events-none shadow-inner">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0d1b2a]/80" />
            </div>

            {/* Inner Screen Display */}
            <div className="relative isolate z-10 w-full h-full rounded-[38px] overflow-hidden bg-black flex flex-col shadow-inner">
              {children}
            </div>
          </div>
        ) : (
          // Clean borderless mobile container
          <div className="relative isolate z-10 w-full max-w-[420px] h-[760px] max-h-[88vh] rounded-3xl overflow-hidden shadow-2xl border border-white/20">
            {children}
          </div>
        )}
      </main>

      {/* Footer Feature Summary Badge */}
      <footer className="w-full max-w-4xl mt-3 flex flex-wrap items-center justify-between text-xs text-white/50 px-3 py-2 border-t border-white/5 gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Original candy graphics • No external copyright assets • Ready for Android Match-3 gameplay mechanics</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-pink-300 font-semibold">Jetpack Compose UI</span>
          <span>•</span>
          <span className="text-amber-300 font-semibold">SoundPool SFX</span>
          <span>•</span>
          <span className="text-emerald-300 font-semibold">Kotlin 2.0</span>
        </div>
      </footer>
    </div>
  );
};
