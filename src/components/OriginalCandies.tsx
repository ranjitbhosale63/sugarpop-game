import React, { useId } from 'react';
import { CandyShape, SpecialCandyType } from '../types/game';

interface CandyProps {
  type: CandyShape;
  special?: SpecialCandyType;
  size?: number;
  className?: string;
  animate?: boolean;
}

function renderSpecialOverlay(special: SpecialCandyType | undefined, clipId: string) {
  if (!special || special === 'color_bomb') return null;

  if (special === 'striped_h') {
    return (
      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        {/* Contrast backing bands so stripes stay crisp on bright candies like Lemon Star */}
        <g stroke="#2a0a3d" strokeOpacity="0.35" strokeWidth="12">
          <line x1="0" y1="30" x2="100" y2="30" />
          <line x1="0" y1="50" x2="100" y2="50" />
          <line x1="0" y1="70" x2="100" y2="70" />
        </g>
        {/* Crisp sugar-cream horizontal stripes */}
        <g stroke="#ffffff" strokeOpacity="0.95" strokeWidth="7.5">
          <line x1="0" y1="30" x2="100" y2="30" />
          <line x1="0" y1="50" x2="100" y2="50" />
          <line x1="0" y1="70" x2="100" y2="70" />
        </g>
      </g>
    );
  }

  if (special === 'striped_v') {
    return (
      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        <g stroke="#2a0a3d" strokeOpacity="0.35" strokeWidth="12">
          <line x1="30" y1="0" x2="30" y2="100" />
          <line x1="50" y1="0" x2="50" y2="100" />
          <line x1="70" y1="0" x2="70" y2="100" />
        </g>
        <g stroke="#ffffff" strokeOpacity="0.95" strokeWidth="7.5">
          <line x1="30" y1="0" x2="30" y2="100" />
          <line x1="50" y1="0" x2="50" y2="100" />
          <line x1="70" y1="0" x2="70" y2="100" />
        </g>
      </g>
    );
  }

  if (special === 'wrapped') {
    return (
      <g pointerEvents="none">
        {/* Left & Right Twisted Sugar-Foil Wrapper Wings */}
        <path
          d="M17 42 L4 29 L7 50 L4 71 L17 58 Z"
          fill="#ffffff"
          fillOpacity="0.52"
          stroke="#ffe082"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M83 42 L96 29 L93 50 L96 71 L83 58 Z"
          fill="#ffffff"
          fillOpacity="0.52"
          stroke="#ffe082"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Foil wing crimp lines */}
        <line x1="8" y1="38" x2="16" y2="46" stroke="#ffffff" strokeWidth="1.6" strokeOpacity="0.85" />
        <line x1="8" y1="62" x2="16" y2="54" stroke="#ffffff" strokeWidth="1.6" strokeOpacity="0.85" />
        <line x1="92" y1="38" x2="84" y2="46" stroke="#ffffff" strokeWidth="1.6" strokeOpacity="0.85" />
        <line x1="92" y1="62" x2="84" y2="54" stroke="#ffffff" strokeWidth="1.6" strokeOpacity="0.85" />
        {/* Translucent Glazed Cellophane Pouch Frame */}
        <rect
          x="15"
          y="14"
          width="70"
          height="72"
          rx="16"
          fill="#ffffff"
          fillOpacity="0.16"
          stroke="#ffffff"
          strokeWidth="3"
          strokeOpacity="0.92"
        />
        <rect
          x="17.5"
          y="16.5"
          width="65"
          height="67"
          rx="14"
          fill="none"
          stroke="#ffd54f"
          strokeWidth="1.8"
          strokeOpacity="0.88"
        />
        {/* Diagonal cellophane sheen streaks */}
        <line x1="25" y1="22" x2="39" y2="36" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.85" />
        <line x1="63" y1="66" x2="76" y2="79" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.7" />
      </g>
    );
  }

  return null;
}

export const OriginalCandy: React.FC<CandyProps> = ({
  type,
  special = null,
  size = 48,
  className = '',
  animate = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `candy-grad-${type}-${uid}`;
  const glowId = `candy-glow-${type}-${uid}`;
  const clipId = `candy-clip-${type}-${uid}`;
  const animClass = animate ? 'hover:scale-110 transition-transform duration-200 cursor-pointer' : '';

  if (special === 'color_bomb') {
    // Sugar Prism Truffle Bomb: dark cocoa-plum sphere studded with 6 multi-colored sugar jewels & golden starburst core
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${animClass} ${className} drop-shadow-[0_4px_8px_rgba(30,0,50,0.65)]`}
      >
        <defs>
          <radialGradient id={gradId} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#6a3052" />
            <stop offset="40%" stopColor="#38122b" />
            <stop offset="80%" stopColor="#1d0718" />
            <stop offset="100%" stopColor="#0d020b" />
          </radialGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#180028" floodOpacity="0.65" />
          </filter>
        </defs>
        {/* Outer Prismatic Halo Ring */}
        <circle
          cx="50"
          cy="50"
          r="43"
          fill={`url(#${gradId})`}
          stroke="#ffe082"
          strokeWidth="2.5"
          strokeOpacity="0.85"
          filter={`url(#${glowId})`}
        />
        {/* Radiant Starburst Core */}
        <path
          d="M50 24 L55 44 L76 50 L55 56 L50 76 L45 56 L24 50 L45 44 Z"
          fill="#ffd600"
          fillOpacity="0.9"
        />
        <circle cx="50" cy="50" r="10" fill="#ffffff" fillOpacity="0.95" />
        {/* 6 Multi-Colored Sugar Crystal Studs */}
        <circle cx="50" cy="20" r="7.5" fill="#ff1744" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="76" cy="35" r="7.5" fill="#ff9100" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="76" cy="65" r="7.5" fill="#ffd600" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="50" cy="80" r="7.5" fill="#00e676" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="24" cy="65" r="7.5" fill="#00b0ff" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx="24" cy="35" r="7.5" fill="#d500f9" stroke="#ffffff" strokeWidth="1.5" />
        {/* Crisp Specular Glaze Highlight */}
        <path
          d="M27 33 C36 18, 64 18, 73 33"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeOpacity="0.55"
        />
      </svg>
    );
  }

  switch (type) {
    case 'strawberry_drop':
      // 1. RED: Distinct Strawberry silhouette with green calyx leaf cap and ruby red body
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${className} drop-shadow-[0_4px_6px_rgba(180,0,30,0.5)]`}
        >
          <defs>
            <radialGradient id={gradId} cx="38%" cy="36%" r="68%">
              <stop offset="0%" stopColor="#ff8a80" />
              <stop offset="30%" stopColor="#ff1744" />
              <stop offset="75%" stopColor="#c51162" />
              <stop offset="100%" stopColor="#880e4f" />
            </radialGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#500010" floodOpacity="0.5" />
            </filter>
            <clipPath id={clipId}>
              <path d="M50 22 C76 22, 88 56, 76 80 C68 93, 32 93, 24 80 C12 56, 24 22, 50 22 Z" />
            </clipPath>
          </defs>
          {/* Main Strawberry Tapered Conical Body */}
          <path
            d="M50 22 C76 22, 88 56, 76 80 C68 93, 32 93, 24 80 C12 56, 24 22, 50 22 Z"
            fill={`url(#${gradId})`}
            filter={`url(#${glowId})`}
          />
          {/* 3D Glassy Body Rim */}
          <path
            d="M50 24 C74 24, 84 56, 74 78 C66 90, 34 90, 26 78 C16 56, 26 24, 50 24 Z"
            stroke="#ff8a80"
            strokeWidth="2"
            strokeOpacity="0.6"
            fill="none"
          />
          {/* Specular curved gloss reflection */}
          <ellipse cx="40" cy="42" rx="12" ry="16" transform="rotate(-24 40 42)" fill="white" fillOpacity="0.75" />
          <ellipse cx="38" cy="40" rx="6" ry="10" transform="rotate(-24 38 40)" fill="white" fillOpacity="0.95" />
          {/* Golden Sugar Seeds */}
          <circle cx="62" cy="56" r="2.8" fill="#ffe57f" fillOpacity="0.85" />
          <circle cx="48" cy="74" r="2.5" fill="#ffe57f" fillOpacity="0.85" />
          <circle cx="34" cy="68" r="2.2" fill="#ffe57f" fillOpacity="0.8" />
          <circle cx="68" cy="42" r="2.2" fill="#ffe57f" fillOpacity="0.8" />
          {/* Stripes sit cleanly on the strawberry body underneath the calyx leaf cap */}
          {special !== 'wrapped' && renderSpecialOverlay(special, clipId)}
          {/* Distinctive Green Strawberry Calyx Leaf Cap */}
          <path
            d="M50 8 C52 14, 54 18, 58 18 C64 16, 72 16, 68 22 C62 23, 56 22, 53 26 C52 30, 52 31, 50 31 C48 31, 48 30, 47 26 C44 22, 38 23, 32 22 C28 16, 36 16, 42 18 C46 18, 48 14, 50 8 Z"
            fill="#00e676"
            stroke="#00a152"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="50" cy="19" r="2.5" fill="#b9f6ca" />
          {special === 'wrapped' && renderSpecialOverlay(special, clipId)}
        </svg>
      );

    case 'citrus_ring':
      // 2. ORANGE: Round Citrus Candy (Full round wheel with juicy citrus wedge segments)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${className} drop-shadow-[0_4px_6px_rgba(230,81,0,0.5)]`}
        >
          <defs>
            <radialGradient id={gradId} cx="36%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#ffe082" />
              <stop offset="30%" stopColor="#ff9100" />
              <stop offset="70%" stopColor="#ff6d00" />
              <stop offset="100%" stopColor="#bf360c" />
            </radialGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#7f2300" floodOpacity="0.5" />
            </filter>
            <clipPath id={clipId}>
              <circle cx="50" cy="50" r="42" />
            </clipPath>
          </defs>
          {/* Outer Round Candy Disk */}
          <circle cx="50" cy="50" r="42" fill={`url(#${gradId})`} filter={`url(#${glowId})`} />
          {/* Inner Light Citrus Rind */}
          <circle cx="50" cy="50" r="37" fill="#fff3e0" fillOpacity="0.3" stroke="#ffd180" strokeWidth="1.5" />
          {/* Citrus Fruit Wedge Segments (8 slices) */}
          <g stroke="#ffffff" strokeWidth="2" strokeOpacity="0.75" fill="#ff6d00" fillOpacity="0.55">
            <line x1="50" y1="17" x2="50" y2="83" />
            <line x1="17" y1="50" x2="83" y2="50" />
            <line x1="26.7" y1="26.7" x2="73.3" y2="73.3" />
            <line x1="26.7" y1="73.3" x2="73.3" y2="26.7" />
          </g>
          {/* Center Citrus Pip */}
          <circle cx="50" cy="50" r="7" fill="#ffe082" stroke="#ffffff" strokeWidth="1.5" />
          {/* 3D Curved Specular Gloss Arc on top hemisphere */}
          <path
            d="M24 38 C32 20, 68 20, 76 38"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeOpacity="0.85"
          />
          <circle cx="34" cy="68" r="3" fill="white" fillOpacity="0.7" />
          {renderSpecialOverlay(special, clipId)}
        </svg>
      );

    case 'star_lemon':
      // 3. YELLOW: 4-Point Radiant Star Candy with sharp golden facet bevels
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${className} drop-shadow-[0_4px_6px_rgba(216,140,0,0.5)]`}
        >
          <defs>
            <radialGradient id={gradId} cx="42%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#ffff8d" />
              <stop offset="55%" stopColor="#ffd600" />
              <stop offset="85%" stopColor="#ffab00" />
              <stop offset="100%" stopColor="#c67c00" />
            </radialGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#8c5000" floodOpacity="0.5" />
            </filter>
            <clipPath id={clipId}>
              <path d="M50 6 L63 37 L94 50 L63 63 L50 94 L37 63 L6 50 L37 37 Z" />
            </clipPath>
          </defs>
          {/* Sharp 4-Point Radiant Star Silhouette */}
          <path
            d="M50 6 L63 37 L94 50 L63 63 L50 94 L37 63 L6 50 L37 37 Z"
            fill={`url(#${gradId})`}
            filter={`url(#${glowId})`}
          />
          {/* 3D Facet Bevel Ridge Lines */}
          <path
            d="M50 6 L50 94 M6 50 L94 50"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeOpacity="0.9"
          />
          <path
            d="M37 37 L63 63 M63 37 L37 63"
            stroke="#ffe57f"
            strokeWidth="1.5"
            strokeOpacity="0.7"
          />
          {/* Central Star Gem Core */}
          <circle cx="44" cy="42" r="7" fill="white" fillOpacity="0.85" />
          <circle cx="43" cy="41" r="3.5" fill="white" fillOpacity="1" />
          {renderSpecialOverlay(special, clipId)}
        </svg>
      );

    case 'mint_emerald':
      // 4. GREEN: Symmetrical 6-Sided Hexagon Mint Candy (100% PURE GREEN, ZERO BLUE!)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${className} drop-shadow-[0_4px_6px_rgba(0,100,30,0.5)]`}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b9f6ca" />
              <stop offset="25%" stopColor="#69f0ae" />
              <stop offset="55%" stopColor="#00e676" />
              <stop offset="85%" stopColor="#00c853" />
              <stop offset="100%" stopColor="#004d1a" />
            </linearGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#003d14" floodOpacity="0.5" />
            </filter>
            <clipPath id={clipId}>
              <polygon points="50,8 86,28 86,72 50,92 14,72 14,28" />
            </clipPath>
          </defs>
          {/* 6-Sided Hexagon Silhouette */}
          <polygon
            points="50,8 86,28 86,72 50,92 14,72 14,28"
            fill={`url(#${gradId})`}
            filter={`url(#${glowId})`}
          />
          {/* Hexagon 3D Outer Bevel */}
          <polygon
            points="50,11 83,30 83,70 50,89 17,70 17,30"
            stroke="#e8f5e9"
            strokeWidth="2"
            strokeOpacity="0.8"
            fill="none"
          />
          {/* Inner Hexagonal Gem Facet */}
          <polygon
            points="50,22 74,36 74,64 50,78 26,64 26,36"
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeOpacity="0.75"
            fill="none"
          />
          {/* Spearmint Crystal Facet Sheen */}
          <ellipse cx="38" cy="32" rx="9" ry="5.5" transform="rotate(-20 38 32)" fill="white" fillOpacity="0.85" />
          <circle cx="36" cy="31" r="2.5" fill="white" fillOpacity="1" />
          {renderSpecialOverlay(special, clipId)}
        </svg>
      );

    case 'blueberry_oval':
      // 5. BLUE: 4-Sided Faceted Diamond (Rhombus Jewel) - THE ONLY BLUE CANDY!
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${className} drop-shadow-[0_4px_6px_rgba(0,70,180,0.55)]`}
        >
          <defs>
            <radialGradient id={gradId} cx="38%" cy="32%" r="68%">
              <stop offset="0%" stopColor="#e1f5fe" />
              <stop offset="25%" stopColor="#40c4ff" />
              <stop offset="60%" stopColor="#00b0ff" />
              <stop offset="85%" stopColor="#0091ea" />
              <stop offset="100%" stopColor="#01579b" />
            </radialGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#002f6c" floodOpacity="0.55" />
            </filter>
            <clipPath id={clipId}>
              <polygon points="50,6 94,50 50,94 6,50" />
            </clipPath>
          </defs>
          {/* Sharp 4-Sided Diamond (Rhombus) Silhouette */}
          <polygon
            points="50,6 94,50 50,94 6,50"
            fill={`url(#${gradId})`}
            filter={`url(#${glowId})`}
          />
          {/* Outer Diamond Bevel */}
          <polygon
            points="50,9 90,50 50,91 10,50"
            stroke="#ffffff"
            strokeWidth="2"
            strokeOpacity="0.85"
            fill="none"
          />
          {/* Inner Diamond Prism Facet */}
          <polygon
            points="50,22 78,50 50,78 22,50"
            stroke="#b3e5fc"
            strokeWidth="2.5"
            strokeOpacity="0.75"
            fill="none"
          />
          {/* Cross Facet Light Reflection Lines */}
          <line x1="50" y1="6" x2="50" y2="94" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.75" />
          <line x1="6" y1="50" x2="94" y2="50" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.75" />
          {/* Diamond Prism Gleam */}
          <ellipse cx="40" cy="38" rx="8" ry="5" transform="rotate(-40 40 38)" fill="white" fillOpacity="0.9" />
          <circle cx="39" cy="37" r="2.5" fill="white" fillOpacity="1" />
          {renderSpecialOverlay(special, clipId)}
        </svg>
      );

    case 'plum_heart':
      // 6. PURPLE: Royal Plum Heart Bonbon with distinct lobes & violet/plum shine
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${className} drop-shadow-[0_4px_6px_rgba(74,20,140,0.55)]`}
        >
          <defs>
            <radialGradient id={gradId} cx="36%" cy="28%" r="72%">
              <stop offset="0%" stopColor="#f3e5f5" />
              <stop offset="25%" stopColor="#ea80fc" />
              <stop offset="55%" stopColor="#aa00ff" />
              <stop offset="85%" stopColor="#7209b7" />
              <stop offset="100%" stopColor="#38006b" />
            </radialGradient>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#210040" floodOpacity="0.55" />
            </filter>
            <clipPath id={clipId}>
              <path d="M50 86 C12 60, 8 26, 32 18 C43 14, 48 22, 50 26 C52 22, 57 14, 68 18 C92 26, 88 60, 50 86 Z" />
            </clipPath>
          </defs>
          {/* Plump Heart Silhouette with deep cleft and pointed bottom */}
          <path
            d="M50 86 C12 60, 8 26, 32 18 C43 14, 48 22, 50 26 C52 22, 57 14, 68 18 C92 26, 88 60, 50 86 Z"
            fill={`url(#${gradId})`}
            filter={`url(#${glowId})`}
          />
          {/* 3D Heart Outer Rim Bevel */}
          <path
            d="M50 83 C16 58, 12 28, 32 21 C41 17, 47 24, 50 27 C53 24, 59 17, 68 21 C88 28, 84 58, 50 83 Z"
            stroke="#f3e5f5"
            strokeWidth="2"
            strokeOpacity="0.75"
            fill="none"
          />
          {/* Dual Heart Lobe Specular Sheens */}
          <ellipse cx="34" cy="30" rx="9" ry="6" transform="rotate(-30 34 30)" fill="white" fillOpacity="0.85" />
          <ellipse cx="32" cy="29" rx="4" ry="3" transform="rotate(-30 32 29)" fill="white" fillOpacity="1" />
          <ellipse cx="66" cy="32" rx="7" ry="4.5" transform="rotate(25 66 32)" fill="white" fillOpacity="0.65" />
          {renderSpecialOverlay(special, clipId)}
        </svg>
      );

    case 'rainbow_swirl':
    default:
      // 7. RAINBOW: Swirled Pinwheel Lollipop Candy (Special Rainbow Booster)
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${animClass} ${className} drop-shadow-[0_4px_6px_rgba(40,0,60,0.55)]`}
        >
          <defs>
            <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor="#25023f" floodOpacity="0.55" />
            </filter>
            <clipPath id={clipId}>
              <circle cx="50" cy="50" r="40" />
            </clipPath>
          </defs>
          <circle cx="50" cy="50" r="40" fill="#1e0c38" filter={`url(#${glowId})`} />
          {/* Rainbow 4 Quadrant Sectors */}
          <path d="M50 50 L50 10 A40 40 0 0 1 90 50 Z" fill="#ff1744" />
          <path d="M50 50 L90 50 A40 40 0 0 1 50 90 Z" fill="#ffd600" />
          <path d="M50 50 L50 90 A40 40 0 0 1 10 50 Z" fill="#00e676" />
          <path d="M50 50 L10 50 A40 40 0 0 1 50 10 Z" fill="#00b0ff" />
          {/* White Swirl Curved Separator */}
          <circle cx="50" cy="50" r="16" fill="white" fillOpacity="0.95" />
          <circle cx="50" cy="50" r="9" fill="#aa00ff" />
          <circle cx="44" cy="40" r="4" fill="white" fillOpacity="0.95" />
          {renderSpecialOverlay(special, clipId)}
        </svg>
      );
  }
};
