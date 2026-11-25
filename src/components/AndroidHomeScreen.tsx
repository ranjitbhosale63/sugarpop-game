import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Settings,
  Heart,
  Coins,
  Star,
  Play,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { LevelInfo, PlayerProfile, SoundSettings, CandyShape } from '../types/game';
import { soundEngine } from '../audio/SoundEffects';
import { OriginalCandy } from './OriginalCandies';
import { LifeRegenCountdown } from './LifeRegenCountdown';
import {
  getLevelDefinition,
  getWorldForLevel,
  resolveActiveCampaignLevel,
} from '../game-engine/levelCatalog';

interface AndroidHomeScreenProps {
  playerProfile: PlayerProfile;
  levels?: LevelInfo[];
  soundSettings: SoundSettings;
  onUpdateSoundSettings: (settings: SoundSettings) => void;
  onOpenSettings: () => void;
  onOpenLevelSelect: () => void;
  onPlayClick: () => void;
  onSyncLives?: () => void;
}

interface FloatingCandyItem {
  id: number;
  type: CandyShape;
  top: number;
  left: number;
  size: number;
  speed: number;
  delay: number;
}

export const AndroidHomeScreen: React.FC<AndroidHomeScreenProps> = ({
  playerProfile,
  levels,
  soundSettings,
  onUpdateSoundSettings,
  onOpenSettings,
  onOpenLevelSelect,
  onPlayClick,
  onSyncLives,
}) => {
  const [poppedCount, setPoppedCount] = useState(0);

  const activeLevelInfo = resolveActiveCampaignLevel(
    levels ?? [],
    playerProfile.highestUnlockedLevel,
    playerProfile.currentLevel
  );
  const displayLevelNumber = activeLevelInfo?.levelNumber ?? playerProfile.currentLevel;
  const displayWorldName =
    activeLevelInfo?.world ||
    getLevelDefinition(displayLevelNumber)?.world ||
    getWorldForLevel(displayLevelNumber)?.name ||
    'Sugar Meadows';

  // Floating background candies for tactile casual joy
  const [floatingCandies] = useState<FloatingCandyItem[]>([
    { id: 1, type: 'strawberry_drop', top: 18, left: 8, size: 42, speed: 4.2, delay: 0 },
    { id: 2, type: 'citrus_ring', top: 28, left: 82, size: 48, speed: 5.1, delay: 1.2 },
    { id: 3, type: 'star_lemon', top: 46, left: 12, size: 40, speed: 4.6, delay: 0.6 },
    { id: 4, type: 'mint_emerald', top: 58, left: 80, size: 44, speed: 4.8, delay: 1.8 },
    { id: 5, type: 'blueberry_oval', top: 68, left: 16, size: 42, speed: 5.4, delay: 0.9 },
    { id: 6, type: 'plum_heart', top: 38, left: 84, size: 38, speed: 4.0, delay: 2.1 },
  ]);

  const handleSoundToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !soundSettings.soundEffectsEnabled;
    const updated = { ...soundSettings, soundEffectsEnabled: nextVal };
    onUpdateSoundSettings(updated);
    if (nextVal) {
      soundEngine.playToggle(true, soundSettings.masterVolume);
    }
  };

  const handleCandyPop = (candy: FloatingCandyItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playPop(1.0 + (candy.id % 3) * 0.25, soundSettings.masterVolume);
    }
    if (soundSettings.hapticsEnabled && 'vibrate' in navigator) {
      navigator.vibrate(25);
    }
    setPoppedCount((prev) => prev + 1);

    // Mini sugar sparkle at click coordinates
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    confetti({
      particleCount: 12,
      spread: 50,
      startVelocity: 15,
      ticks: 40,
      origin: { x, y },
      colors: ['#ff2e63', '#ffd600', '#00e676', '#00b4d8', '#ff9f1c'],
      disableForReducedMotion: true,
    });
  };

  const handleMainPlay = () => {
    if (soundSettings.soundEffectsEnabled) {
      soundEngine.playPlayFanfare(soundSettings.masterVolume);
    }
    if (soundSettings.hapticsEnabled && 'vibrate' in navigator) {
      navigator.vibrate([40, 30, 60]);
    }

    // Sugar confetti burst
    confetti({
      particleCount: 45,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#ffd600', '#ff9f1c', '#ff2e63', '#00e676', '#90e0ef'],
      disableForReducedMotion: true,
    });

    onPlayClick();
  };

  return (
    <div className="relative w-full h-full min-h-0 max-w-[430px] mx-auto flex flex-col justify-between overflow-y-auto overflow-x-hidden bg-gradient-to-b from-[#2e1053] via-[#5c1675] to-[#c72c63] text-white shadow-2xl select-none">
      {/* Dynamic Background Atmosphere */}
      {/* Marshmallow clouds & candy hills vector overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Radial Sunburst */}
        <div className="absolute top-[28%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-b from-amber-300/25 via-pink-400/20 to-transparent blur-2xl" />

        {/* Ambient candy dots / sparkles */}
        <div className="absolute top-24 left-10 w-2 h-2 rounded-full bg-white/40 animate-ping" />
        <div className="absolute top-44 right-14 w-2.5 h-2.5 rounded-full bg-amber-300/50 animate-pulse" />
        <div className="absolute top-64 left-1/3 w-2 h-2 rounded-full bg-pink-300/40 animate-ping" />

        {/* Floating marshmallow cloud shapes */}
        <div className="absolute top-16 -left-12 w-48 h-16 rounded-full bg-white/10 blur-[2px]" />
        <div className="absolute top-28 -right-8 w-56 h-20 rounded-full bg-white/10 blur-[2px]" />

        {/* Rolling Candy Cane Hills at Bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none">
          {/* Back hill */}
          <div className="absolute -bottom-10 -left-12 w-[130%] h-36 rounded-[100%] bg-gradient-to-r from-[#881765] to-[#510e4a] opacity-60" />
          {/* Front sweet hill */}
          <div className="absolute -bottom-14 -right-10 w-[120%] h-36 rounded-[100%] bg-gradient-to-r from-[#ab1d54] via-[#e23b6b] to-[#b31c59] opacity-80" />
        </div>
      </div>

      {/* Floating Interactive Candies */}
      {floatingCandies.map((candy) => (
        <div
          key={candy.id}
          onClick={(e) => handleCandyPop(candy, e)}
          style={{
            top: `${candy.top}%`,
            left: `${candy.left}%`,
            animation: `gentle-float ${candy.speed}s ease-in-out infinite`,
            animationDelay: `${candy.delay}s`,
          }}
          className="absolute z-10 cursor-pointer transition-transform duration-150 active:scale-75 hover:scale-125"
          title={`Pop ${candy.type.replace('_', ' ')}!`}
        >
          <OriginalCandy type={candy.type} size={candy.size} />
        </div>
      ))}

      {/* TOP HUD: Player Stats Bar (Lives, Coins, Stars) */}
      <div className="relative z-20 px-4 pt-3 sm:pt-4">
        <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-black/30 backdrop-blur-md border border-white/15 shadow-lg">
          {/* Lives Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-pink-500/30 border border-pink-400/40">
            <Heart className="w-4 h-4 fill-pink-500 text-pink-400 animate-pulse shrink-0" />
            <span className="text-xs font-black tracking-wide tabular-nums">
              {playerProfile.lives}/{playerProfile.maxLives}
            </span>
            <LifeRegenCountdown
              lives={playerProfile.lives}
              maxLives={playerProfile.maxLives}
              nextLifeSeconds={playerProfile.nextLifeSeconds}
              lastLifeUpdatedAt={playerProfile.lastLifeUpdatedAt}
              fullLabel="FULL"
              onRegenReady={onSyncLives}
              className="text-[10px] font-extrabold text-pink-200 tabular-nums"
            />
          </div>

          {/* Coins Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/30 border border-amber-400/40">
            <Coins className="w-4 h-4 fill-amber-400 text-amber-300" />
            <span className="text-xs font-black tracking-wide text-amber-200">
              {playerProfile.coins}
            </span>
          </div>

          {/* Stars Pill */}
          <button
            onClick={() => {
              if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
              onOpenLevelSelect();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/30 border border-emerald-400/40 hover:bg-emerald-500/40 active:scale-95 transition-all cursor-pointer"
          >
            <Star className="w-4 h-4 fill-emerald-400 text-emerald-300" />
            <span className="text-xs font-black tracking-wide text-emerald-200">
              {playerProfile.totalStars}
            </span>
            <ChevronRight className="w-3 h-3 text-emerald-300/70" />
          </button>
        </div>
      </div>

      {/* MIDDLE: Candy Logo & Mascots */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-2 my-auto">
        {/* Trio of sparkling candies above logo */}
        <div className="flex items-center gap-4 mb-2.5 animate-gentle-float">
          <OriginalCandy type="strawberry_drop" size={38} />
          <OriginalCandy type="star_lemon" size={46} />
          <OriginalCandy type="blueberry_oval" size={38} />
        </div>

        {/* Official SugarPop Square Logo */}
        <div
          className="relative group cursor-pointer"
          onClick={() => {
            if (soundSettings.soundEffectsEnabled) soundEngine.playPop(1.4, soundSettings.masterVolume);
          }}
        >
          {/* Glow backdrop behind logo */}
          <div className="absolute -inset-1 rounded-[32px] bg-pink-500/35 blur-xl group-hover:bg-pink-400/45 transition-all" />

          <img
            src="/assets/aistudio/sugarpop_logo_square_under_1mb-1_52682498.jpg"
            alt="SugarPop Match-3"
            className="relative w-44 h-44 sm:w-52 sm:h-52 aspect-square rounded-[28px] object-cover border-2 border-white/40 shadow-[0_16px_36px_rgba(0,0,0,0.55)] transition-transform duration-200 group-hover:scale-[1.03] active:scale-95"
            draggable={false}
          />
        </div>

        {/* Pops counter bubble */}
        {poppedCount > 0 && (
          <div className="mt-3 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-[11px] font-bold text-amber-200 animate-bounce">
            🍬 {poppedCount} candies popped!
          </div>
        )}
      </div>

      {/* CENTER-LOWER: Large 3D Play Button & Level Badge */}
      <div className="relative z-20 flex flex-col items-center px-6 mb-4">
        {/* The Large 3D Candy Play Button */}
        <div className="relative w-full max-w-[280px]">
          {/* Pulsing glow aura */}
          <div className="absolute inset-0 rounded-[32px] bg-gradient-to-r from-yellow-400 to-orange-500 opacity-60 blur-xl animate-pulse-glow" />

          {/* 3D Button Construction */}
          <button
            onClick={handleMainPlay}
            className="group relative w-full h-[76px] rounded-[30px] transition-transform duration-150 active:translate-y-2 cursor-pointer focus:outline-none"
            aria-label="Play game"
          >
            {/* 3D Base Shadow layer */}
            <div className="absolute inset-0 top-2.5 rounded-[30px] bg-[#932800] shadow-[0_12px_24px_rgba(0,0,0,0.6)]" />

            {/* Main Juicy Button Face */}
            <div className="absolute inset-0 rounded-[30px] bg-gradient-to-b from-[#ffe542] via-[#ff9b00] to-[#e64700] border-2 border-[#fff799]/80 shadow-inner flex items-center justify-center gap-3 shine-effect">
              {/* Top Specular Arc Highlight */}
              <div className="absolute top-1 left-4 right-4 h-5 rounded-full bg-gradient-to-b from-white/70 to-transparent pointer-events-none" />

              {/* Triangle Icon & PLAY Text */}
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/40 shadow-sm group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 fill-white text-white ml-0.5 drop-shadow" />
              </div>
              <span className="text-3xl font-black tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                PLAY
              </span>
            </div>
          </button>
        </div>

        {/* Level Indicator Pill - Clickable to open level select */}
        <button
          onClick={() => {
            if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
            onOpenLevelSelect();
          }}
          className="mt-4 flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-xs font-bold text-amber-200 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-sm shadow-md"
        >
          <MapPin className="w-3.5 h-3.5 text-amber-400" />
          <span>
            LEVEL {displayLevelNumber} • {displayWorldName.toUpperCase()}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-white/60" />
        </button>
      </div>

      {/* BOTTOM ACTION BAR: Sound, Mascot, Settings */}
      <div className="relative z-20 px-6 pb-5 sm:pb-6">
        <div className="flex items-center justify-between gap-4 max-w-[320px] mx-auto">
          {/* Sound Toggle Button */}
          <button
            onClick={handleSoundToggle}
            className={`group relative w-14 h-14 rounded-2xl transition-transform duration-100 active:translate-y-1 cursor-pointer ${
              soundSettings.soundEffectsEnabled ? 'text-white' : 'text-white/60'
            }`}
            aria-label={soundSettings.soundEffectsEnabled ? 'Mute sound' : 'Unmute sound'}
            title={soundSettings.soundEffectsEnabled ? 'Sound On' : 'Sound Muted'}
          >
            {/* 3D Bottom */}
            <div
              className={`absolute inset-0 top-1.5 rounded-2xl ${
                soundSettings.soundEffectsEnabled ? 'bg-[#0f607c]' : 'bg-[#293238]'
              }`}
            />
            {/* Face */}
            <div
              className={`absolute inset-0 rounded-2xl flex items-center justify-center border border-white/40 shadow-md ${
                soundSettings.soundEffectsEnabled
                  ? 'bg-gradient-to-b from-[#38ef7d] to-[#11998e]'
                  : 'bg-gradient-to-b from-[#607d8b] to-[#37474f]'
              }`}
            >
              {soundSettings.soundEffectsEnabled ? (
                <Volume2 className="w-6 h-6 drop-shadow" />
              ) : (
                <VolumeX className="w-6 h-6 drop-shadow" />
              )}
            </div>
          </button>

          {/* Central Mascot Bonbon */}
          <div
            onClick={() => {
              if (soundSettings.soundEffectsEnabled) soundEngine.playPop(1.5, soundSettings.masterVolume);
            }}
            className="w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center cursor-pointer active:scale-90 transition-all shadow-inner backdrop-blur-sm"
            title="Tap the candy!"
          >
            <OriginalCandy type="mint_emerald" size={38} animate />
          </div>

          {/* Settings Button */}
          <button
            onClick={() => {
              if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
              onOpenSettings();
            }}
            className="group relative w-14 h-14 rounded-2xl transition-transform duration-100 active:translate-y-1 cursor-pointer text-white"
            aria-label="Open settings"
            title="Settings"
          >
            {/* 3D Bottom */}
            <div className="absolute inset-0 top-1.5 rounded-2xl bg-[#490c68]" />
            {/* Face */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#c471ed] to-[#7209b7] flex items-center justify-center border border-white/40 shadow-md group-hover:brightness-110">
              <Settings className="w-6 h-6 drop-shadow" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
