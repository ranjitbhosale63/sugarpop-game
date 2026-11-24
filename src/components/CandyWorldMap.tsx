import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft,
  Lock,
  Star,
  Trophy,
  Heart,
  Coins,
  Sparkles,
  MapPin,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { LevelInfo, PlayerProfile, SoundSettings, CandyShape } from '../types/game';
import { soundEngine } from '../audio/SoundEffects';
import { OriginalCandy } from './OriginalCandies';
import { formatRegenCountdown } from '../game-engine/economyEngine';
import { WORLD_DEFINITIONS } from '../game-engine/levelCatalog';

interface CandyWorldMapProps {
  levels: LevelInfo[];
  currentLevelNumber: number;
  highestUnlockedLevel: number;
  playerProfile: PlayerProfile;
  soundSettings: SoundSettings;
  onSelectLevel: (level: LevelInfo) => void;
  onBackToHome: () => void;
}

interface NodePoint {
  levelNumber: number;
  xPercent: number;
  y: number;
  zone: string;
  landmarkCandy: CandyShape;
}

const NODE_SPACING_Y = 128;
const TOP_PADDING = 140;
const BOTTOM_PADDING = 165;

// Smooth winding trail horizontal stops (% of map canvas width)
const WINDING_X_CYCLE = [
  50, 73, 66, 30, 24, 58, 77, 60, 26, 32, 68, 76, 38, 24, 50,
];

const LANDMARK_CANDY_CYCLE: CandyShape[] = [
  'strawberry_drop',
  'blueberry_oval',
  'citrus_ring',
  'mint_emerald',
  'star_lemon',
  'plum_heart',
];

function resolveLevelDisplayCandy(level: LevelInfo | undefined, levelNumber: number): CandyShape {
  if (level?.goals && level.goals.length > 0) {
    return level.goals[0].candyType;
  }
  const collectObj = level?.objectives?.find((o) => o.type === 'collect_candy');
  if (collectObj && collectObj.type === 'collect_candy') {
    return collectObj.candyType;
  }
  return LANDMARK_CANDY_CYCLE[(levelNumber - 1) % LANDMARK_CANDY_CYCLE.length];
}

export const CandyWorldMap: React.FC<CandyWorldMapProps> = ({
  levels,
  highestUnlockedLevel,
  playerProfile,
  soundSettings,
  onSelectLevel,
  onBackToHome,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shakeTimeoutRef = useRef<number | null>(null);
  const lockedNoticeTimeoutRef = useRef<number | null>(null);
  const [lockedNotice, setLockedNotice] = useState<{ text: string; x: number; y: number } | null>(null);
  const [shakingNode, setShakingNode] = useState<number | null>(null);

  const orderedLevels = useMemo(
    () => [...levels].sort((a, b) => a.levelNumber - b.levelNumber),
    [levels]
  );

  const maxLevelNumber =
    orderedLevels.length > 0
      ? orderedLevels[orderedLevels.length - 1].levelNumber
      : 15;

  const { mapNodes, totalMapHeight, worldBanners, decorationOffsets } = useMemo(() => {
    const count = Math.max(1, orderedLevels.length);
    const height = TOP_PADDING + (count - 1) * NODE_SPACING_Y + BOTTOM_PADDING;

    // Nodes generated from top (highest level) to bottom (Level 1) for SVG path & stacking
    const nodes: NodePoint[] = [];
    for (let idx = count - 1; idx >= 0; idx--) {
      const lvl = orderedLevels[idx];
      const levelNum = lvl.levelNumber;
      const y = TOP_PADDING + (count - 1 - idx) * NODE_SPACING_Y;
      const xPercent = WINDING_X_CYCLE[idx % WINDING_X_CYCLE.length];

      nodes.push({
        levelNumber: levelNum,
        xPercent,
        y,
        zone: lvl.world || 'Sugar Kingdom',
        landmarkCandy: resolveLevelDisplayCandy(lvl, levelNum),
      });
    }

    const banners = WORLD_DEFINITIONS.map((world, wIdx) => {
      const startNode = nodes.find((n) => n.levelNumber === world.levelRange[0]);
      if (!startNode) return null;
      const isTopWorld = wIdx === WORLD_DEFINITIONS.length - 1;
      const topY = isTopWorld ? 56 : Math.min(height - 52, startNode.y + 62);
      return {
        ...world,
        y: topY,
        isTopWorld,
      };
    }).filter((b): b is NonNullable<typeof b> => b !== null);

    const decos: number[] = [];
    for (let y = 260; y < height - 180; y += 360) {
      decos.push(y);
    }

    return {
      mapNodes: nodes,
      totalMapHeight: height,
      worldBanners: banners,
      decorationOffsets: decos,
    };
  }, [orderedLevels]);

  // Dynamically resolve the actual next playable level
  const activeLevel: LevelInfo = (() => {
    const nextIncomplete = orderedLevels.find((l) => l.isUnlocked && (l.starsEarned || 0) === 0);
    if (nextIncomplete) return nextIncomplete;

    const highestLevel = orderedLevels.find((l) => l.levelNumber === highestUnlockedLevel);
    if (highestLevel && highestLevel.isUnlocked) return highestLevel;

    const unlockedLevels = orderedLevels.filter((l) => l.isUnlocked);
    if (unlockedLevels.length > 0) return unlockedLevels[unlockedLevels.length - 1];

    return orderedLevels[0];
  })();

  const activeLevelNumber = activeLevel.levelNumber;

  // Auto-scroll to center on the active next playable level node on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const targetNode = mapNodes.find((n) => n.levelNumber === activeLevelNumber);
      if (targetNode) {
        const viewportHeight = scrollContainerRef.current.clientHeight || 500;
        const targetScrollTop = Math.max(0, targetNode.y - viewportHeight / 2);
        scrollContainerRef.current.scrollTop = targetScrollTop;
      } else {
        scrollContainerRef.current.scrollTop = totalMapHeight;
      }
    }
  }, [activeLevelNumber, mapNodes, totalMapHeight]);

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
        shakeTimeoutRef.current = null;
      }
      if (lockedNoticeTimeoutRef.current !== null) {
        window.clearTimeout(lockedNoticeTimeoutRef.current);
        lockedNoticeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleNodeClick = (node: NodePoint, levelData?: LevelInfo) => {
    const isUnlocked = levelData?.isUnlocked ?? node.levelNumber === 1;

    if (isUnlocked) {
      if (soundSettings.soundEffectsEnabled) {
        soundEngine.playPlayFanfare(soundSettings.masterVolume);
      }
      if (soundSettings.hapticsEnabled && 'vibrate' in navigator) {
        navigator.vibrate([30, 20, 50]);
      }
      const targetLevel =
        levelData || orderedLevels.find((l) => l.levelNumber === node.levelNumber) || orderedLevels[0];
      onSelectLevel(targetLevel);
    } else {
      if (soundSettings.soundEffectsEnabled) {
        soundEngine.playInvalidSwap(soundSettings.masterVolume);
      }
      if (soundSettings.hapticsEnabled && 'vibrate' in navigator) {
        navigator.vibrate(35);
      }
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
      setShakingNode(node.levelNumber);
      shakeTimeoutRef.current = window.setTimeout(() => {
        shakeTimeoutRef.current = null;
        setShakingNode(null);
      }, 500);

      if (lockedNoticeTimeoutRef.current !== null) {
        window.clearTimeout(lockedNoticeTimeoutRef.current);
      }
      setLockedNotice({
        text: `Level ${node.levelNumber} is locked! Complete Level ${node.levelNumber - 1} first.`,
        x: node.xPercent,
        y: node.y,
      });

      lockedNoticeTimeoutRef.current = window.setTimeout(() => {
        lockedNoticeTimeoutRef.current = null;
        setLockedNotice(null);
      }, 2200);
    }
  };

  // Construct smooth cubic bezier SVG path string from top node down to Level 1
  let pathD = '';
  if (mapNodes.length > 0) {
    pathD = `M ${mapNodes[0].xPercent * 3.8} ${mapNodes[0].y}`;
    for (let i = 0; i < mapNodes.length - 1; i++) {
      const p1 = mapNodes[i];
      const p2 = mapNodes[i + 1];
      const cx1 = p1.xPercent * 3.8;
      const cy1 = p1.y - (p1.y - p2.y) * 0.5;
      const cx2 = p2.xPercent * 3.8;
      const cy2 = p2.y + (p1.y - p2.y) * 0.5;
      pathD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.xPercent * 3.8} ${p2.y}`;
    }
  }

  return (
    <div className="relative w-full h-full min-h-0 max-w-[430px] mx-auto flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#1a0a33] via-[#3d1257] to-[#78185c] text-white select-none">
      {/* TOP HEADER: NAVIGATION & PLAYER HUD */}
      <div className="relative z-30 px-3 py-2.5 bg-black/60 backdrop-blur-md border-b border-white/15 flex items-center justify-between shrink-0 shadow-lg">
        <button
          onClick={() => {
            if (soundSettings.soundEffectsEnabled) soundEngine.playClick(soundSettings.masterVolume);
            onBackToHome();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-b from-white/20 to-white/5 hover:from-white/30 hover:to-white/10 active:scale-95 border border-white/20 transition-all text-xs font-bold text-white shadow-sm cursor-pointer"
          title="Return to Home Screen"
        >
          <ArrowLeft className="w-4 h-4 text-amber-300" />
          <span>Home</span>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 border border-white/30 shadow-md">
          <MapPin className="w-3.5 h-3.5 text-white" />
          <h1 className="text-xs font-black tracking-widest text-white uppercase drop-shadow">
            CANDY MAP
          </h1>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-black">
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-pink-500/30 border border-pink-400/40">
            <Heart className="w-3.5 h-3.5 fill-pink-500 text-pink-400 animate-pulse shrink-0" />
            <span className="text-[11px] tabular-nums">
              {playerProfile.lives}/{playerProfile.maxLives}
            </span>
            <span className="text-[9px] font-bold text-pink-200 tabular-nums">
              {playerProfile.lives >= playerProfile.maxLives
                ? 'FULL'
                : formatRegenCountdown(playerProfile.nextLifeSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/30 border border-amber-400/40 text-amber-300">
            <Coins className="w-3.5 h-3.5 fill-amber-400 text-amber-300 shrink-0" />
            <span className="text-[11px] tabular-nums">{playerProfile.coins}</span>
          </div>
        </div>
      </div>

      {/* SCROLLABLE VERTICAL CANDY WORLD MAP CANVAS */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden scroll-smooth select-none"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div
          className="relative w-full"
          style={{ height: `${totalMapHeight}px`, minWidth: '100%' }}
        >
          {/* BACKGROUND ATMOSPHERIC BANDS & MARSHMALLOW CLOUDS */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0e0724] via-[#3c1258] via-50% to-[#2a0e44]" />
            {decorationOffsets.map((yOffset, idx) => (
              <div
                key={`cloud-${idx}`}
                style={{ top: `${yOffset}px` }}
                className={`absolute ${
                  idx % 2 === 0 ? 'left-4 w-44' : 'right-5 w-52'
                } h-16 rounded-full bg-white/10 blur-[1px]`}
              />
            ))}
          </div>

          {/* SVG WINDING PATH & SCENERY LAYER */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 380 ${totalMapHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="frostingStone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#fff3e0" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#ffe5f1" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            <path
              d={pathD}
              fill="none"
              stroke="#0a0314"
              strokeWidth="28"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.6"
            />
            <path
              d={pathD}
              fill="none"
              stroke="#531b40"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.85"
            />
            <path
              d={pathD}
              fill="none"
              stroke="url(#frostingStone)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={pathD}
              fill="none"
              stroke="#ff9f1c"
              strokeWidth="5"
              strokeDasharray="9 7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Top Citadel Spire Icon */}
            <g transform="translate(150, 6)">
              <rect x="25" y="25" width="30" height="35" rx="6" fill="#801460" stroke="#ffd600" strokeWidth="2.5" />
              <polygon points="40,2 20,25 60,25" fill="#ff1744" stroke="#ffd600" strokeWidth="2" />
              <polygon points="12,18 2,32 22,32" fill="#ffd600" />
              <polygon points="68,18 58,32 78,32" fill="#ffd600" />
              <circle cx="40" cy="18" r="4" fill="#ffffff" />
            </g>

            {/* Repeating Candy Scenery Props along the trail */}
            {decorationOffsets.map((yOffset, idx) =>
              idx % 3 === 0 ? (
                <g key={`lollipop-${idx}`} transform={`translate(${idx % 2 === 0 ? 290 : 30}, ${yOffset - 40})`}>
                  <line x1="20" y1="30" x2="20" y2="75" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
                  <circle cx="20" cy="25" r="21" fill={idx % 2 === 0 ? '#ff1744' : '#00e676'} stroke="#ffffff" strokeWidth="3" />
                  <circle cx="20" cy="25" r="13" fill={idx % 2 === 0 ? '#ffd600' : '#b9f6ca'} />
                  <circle cx="20" cy="25" r="6" fill={idx % 2 === 0 ? '#ff1744' : '#00c853'} />
                </g>
              ) : idx % 3 === 1 ? (
                <g key={`cane-${idx}`} transform={`translate(${idx % 2 === 0 ? 305 : 42}, ${yOffset - 30})`}>
                  <path d="M15 60 L15 20 C15 8, 32 8, 32 20" fill="none" stroke="#ff1744" strokeWidth="6" strokeLinecap="round" />
                  <path d="M15 50 L15 45 M15 35 L15 30 M24 10 L28 12" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
                </g>
              ) : (
                <g key={`gem-${idx}`} transform={`translate(${idx % 2 === 0 ? 285 : 46}, ${yOffset - 20})`}>
                  <polygon points="20,5 35,13 35,31 20,40 5,31 5,13" fill="#ffd600" stroke="#ff6d00" strokeWidth="2" />
                  <polygon points="40,25 55,33 55,51 40,60 25,51 25,33" fill="#ff9f1c" stroke="#ff6d00" strokeWidth="2" />
                </g>
              )
            )}
          </svg>

          {/* DYNAMIC WORLD ZONE BANNERS */}
          {worldBanners.map((banner) => (
            <div
              key={banner.id}
              style={{ top: `${banner.y}px` }}
              className={`absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r ${banner.gradientClass} border-2 border-white/50 shadow-xl backdrop-blur-sm pointer-events-none whitespace-nowrap`}
            >
              {banner.isTopWorld ? (
                <Trophy className="w-3.5 h-3.5 text-white" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span className="text-xs font-black tracking-wider text-white uppercase drop-shadow">
                {banner.badgeEmoji} {banner.name}
              </span>
            </div>
          ))}

          {/* ALL CAMPAIGN LEVEL NODES PLACED DYNAMICALLY */}
          {mapNodes.map((node) => {
            const levelData = orderedLevels.find((l) => l.levelNumber === node.levelNumber);
            const isCompleted = (levelData?.starsEarned ?? 0) > 0;
            const isCurrent = node.levelNumber === activeLevelNumber;
            const isUnlocked = levelData?.isUnlocked ?? node.levelNumber === 1;
            const isShaking = shakingNode === node.levelNumber;
            const isTopNode = node.levelNumber === maxLevelNumber;

            return (
              <div
                key={node.levelNumber}
                style={{
                  left: `${node.xPercent}%`,
                  top: `${node.y}px`,
                }}
                className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center ${
                  isShaking ? 'animate-bounce' : ''
                }`}
              >
                {isCurrent && !isTopNode && (
                  <div className="absolute -top-12 z-30 flex flex-col items-center animate-bounce pointer-events-none">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-[10px] tracking-wider shadow-lg border-2 border-white whitespace-nowrap">
                      <Flame className="w-3 h-3 fill-white" />
                      <span>PLAY!</span>
                    </div>
                    <div className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-amber-400 -mt-0.5" />
                  </div>
                )}

                <button
                  onClick={() => handleNodeClick(node, levelData)}
                  className={`group relative w-16 h-16 rounded-full transition-transform active:scale-90 cursor-pointer focus:outline-none ${
                    isCurrent
                      ? 'scale-110'
                      : isCompleted
                      ? 'hover:scale-105'
                      : 'hover:scale-95'
                  }`}
                  aria-label={`Level ${node.levelNumber}`}
                >
                  {isCurrent && (
                    <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-amber-400 via-rose-500 to-pink-500 opacity-75 blur-md animate-pulse" />
                  )}

                  <div
                    className={`absolute inset-0 top-2 rounded-full ${
                      isCurrent
                        ? 'bg-[#8c2200] shadow-[0_8px_16px_rgba(0,0,0,0.6)]'
                        : isCompleted
                        ? 'bg-[#0f603c] shadow-[0_6px_12px_rgba(0,0,0,0.5)]'
                        : 'bg-[#21092e] shadow-[0_4px_8px_rgba(0,0,0,0.5)]'
                    }`}
                  />

                  <div
                    className={`absolute inset-0 rounded-full flex flex-col items-center justify-center border-2 transition-all shadow-inner ${
                      isCurrent
                        ? 'bg-gradient-to-b from-[#ffe542] via-[#ff9b00] to-[#e64700] border-white shadow-[inset_0_2px_4px_rgba(255,255,255,0.8)]'
                        : isCompleted
                        ? 'bg-gradient-to-b from-[#38ef7d] via-[#11998e] to-[#0d736b] border-emerald-200'
                        : 'bg-gradient-to-b from-[#481c62] via-[#330f47] to-[#1e072b] border-white/20'
                    }`}
                  >
                    <div className="absolute top-1 left-3 right-3 h-3 rounded-full bg-gradient-to-b from-white/70 to-transparent pointer-events-none" />

                    {isUnlocked ? (
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-2xl font-black leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                          {node.levelNumber}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <div className="p-1 rounded-full bg-black/30 border border-white/10">
                          <Lock className="w-5 h-5 text-amber-200/80 drop-shadow" />
                        </div>
                        <span className="text-[10px] font-bold text-white/50 -mb-1 mt-0.5">
                          {node.levelNumber}
                        </span>
                      </div>
                    )}
                  </div>
                </button>

                {isCompleted && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1, 2, 3].map((starIdx) => (
                      <Star
                        key={starIdx}
                        className={`w-3.5 h-3.5 ${
                          starIdx <= (levelData?.starsEarned || 0)
                            ? 'fill-amber-400 text-amber-300 drop-shadow-[0_1px_3px_rgba(251,191,36,0.9)]'
                            : 'fill-white/10 text-white/20'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {isCurrent && (
                  <div className="mt-1 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/20 text-[10px] font-black text-amber-200 shadow-md whitespace-nowrap">
                    Level {activeLevel.levelNumber}
                  </div>
                )}

                {isCurrent && isTopNode && (
                  <div className="mt-1.5 z-30 flex flex-col items-center animate-bounce pointer-events-none">
                    <div className="w-0 h-0 border-x-4 border-x-transparent border-b-4 border-b-amber-400 -mb-0.5" />
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-[10px] tracking-wider shadow-lg border-2 border-white whitespace-nowrap">
                      <Flame className="w-3 h-3 fill-white" />
                      <span>PLAY!</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* FLOATING LOCKED LEVEL TOAST ALERT */}
          {lockedNotice && (
            <div
              style={{
                top: `${Math.max(12, lockedNotice.y - 76)}px`,
              }}
              className={`absolute inset-x-0 z-40 px-2.5 flex pointer-events-none animate-bounce ${
                lockedNotice.x <= 35
                  ? 'justify-start'
                  : lockedNotice.x >= 65
                  ? 'justify-end'
                  : 'justify-center'
              }`}
            >
              <div className="w-fit max-w-full px-3 py-1.5 rounded-2xl bg-black/90 border-2 border-rose-400 text-white text-[11px] font-bold shadow-2xl flex items-center gap-1.5 leading-snug">
                <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{lockedNotice.text}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STICKY BOTTOM FLOATING QUICK-PLAY ACTION BAR */}
      <div className="relative z-30 p-3 bg-black/60 backdrop-blur-md border-t border-white/15 flex items-center justify-between shrink-0 shadow-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-pink-500/20 border border-pink-400/30 flex items-center justify-center shrink-0">
            <OriginalCandy
              type={resolveLevelDisplayCandy(activeLevel, activeLevel.levelNumber)}
              size={26}
            />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider block truncate">
              {activeLevel.world || 'Current Mission'}
            </span>
            <span className="text-xs font-black text-amber-300 truncate block">
              Level {activeLevel.levelNumber} • {activeLevel.name}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            if (soundSettings.soundEffectsEnabled) {
              soundEngine.playPlayFanfare(soundSettings.masterVolume);
            }
            onSelectLevel(activeLevel);
          }}
          className="group relative px-5 py-2.5 rounded-2xl bg-gradient-to-b from-[#ffe542] via-[#ff9b00] to-[#e64700] border-2 border-white/60 shadow-[0_6px_16px_rgba(255,155,0,0.6)] active:scale-95 transition-all text-white font-black text-sm tracking-wide flex items-center gap-2 cursor-pointer shine-effect shrink-0"
        >
          <span>PLAY LEVEL {activeLevel.levelNumber}</span>
          <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
};
