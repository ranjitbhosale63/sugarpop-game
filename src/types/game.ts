export type CandyShape =
  | 'strawberry_drop'
  | 'citrus_ring'
  | 'star_lemon'
  | 'mint_emerald'
  | 'blueberry_oval'
  | 'plum_heart'
  | 'rainbow_swirl';

export type SpecialCandyType =
  | 'striped_h'
  | 'striped_v'
  | 'wrapped'
  | 'color_bomb'
  | null;

export interface Candy {
  color: CandyShape;
  special: SpecialCandyType;
  sugarCrushId?: number;
}

export type BlockerType =
  | 'frosting'
  | 'chocolate'
  | 'stone'
  | 'licorice'
  | null;

export interface BoardCell {
  candy: Candy | null;
  playable: boolean;
  isSpawner?: boolean;
  jellyLayers: number;
  blocker: BlockerType;
  blockerHealth: number;
  isLocked: boolean;
}

export type BoardGrid = BoardCell[][];

export interface CandyDefinition {
  id: CandyShape;
  displayName: string;
  flavor: string;
  primaryColor: string;
  secondaryColor: string;
  highlightColor: string;
  shadowColor: string;
  accentGlow: string;
}

export interface SoundSettings {
  soundEffectsEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  masterVolume: number;
}

export type PreGameBoosterType = 'color_bomb' | 'striped' | 'wrapped';

export type InGameBoosterType = 'lollipop_hammer' | 'extra_moves' | 'shuffle';

export type BoosterType = PreGameBoosterType | InGameBoosterType;

export interface LevelRewardProgress {
  firstClearClaimed: boolean;
  maxStarsRewarded: number;
}

export interface PlayerProfile {
  lives: number;
  maxLives: number;
  nextLifeSeconds: number;
  lastLifeUpdatedAt?: number;
  coins: number;
  currentLevel: number;
  totalStars: number;
  highestUnlockedLevel: number;
  completedLevelRewards?: Record<number, LevelRewardProgress>;
  boosterInventory?: Partial<Record<BoosterType, number>>;
}

export type LevelDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface CandyDistributionConfig {
  candyPool?: CandyShape[];
  weights?: Partial<Record<CandyShape, number>>;
}

export interface BoardCellConfig {
  playable?: boolean;
  isSpawner?: boolean;
  jellyLayers?: number;
  blocker?: BlockerType;
  blockerHealth?: number;
  isLocked?: boolean;
}

export interface BoardLayoutConfig {
  rows?: number;
  cols?: number;
  nonPlayableCells?: Array<{ r: number; c: number }>;
  spawnerCells?: Array<{ r: number; c: number }>;
  jellyCells?: Array<{ r: number; c: number; layers: number }>;
  blockerCells?: Array<{
    r: number;
    c: number;
    type: Exclude<BlockerType, null>;
    health?: number;
  }>;
  lockedCells?: Array<{ r: number; c: number }>;
  cells?: Record<string, BoardCellConfig>;
}

export type LevelObjective =
  | {
      id?: string;
      type: 'collect_candy';
      candyType: CandyShape;
      requiredCount: number;
    }
  | {
      id?: string;
      type: 'clear_jelly';
      requiredCount?: number;
    }
  | {
      id?: string;
      type: 'break_blocker';
      blockerType: Exclude<BlockerType, null>;
      requiredCount?: number;
    }
  | {
      id?: string;
      type: 'collect_special';
      specialType: Exclude<SpecialCandyType, null> | 'striped' | 'any';
      requiredCount: number;
    }
  | {
      id?: string;
      type: 'reach_score';
      targetScore: number;
    };

export interface LevelGoal {
  candyType: CandyShape;
  requiredCount: number;
}

export interface LevelInfo {
  levelNumber: number;
  name: string;
  world?: string;
  difficulty?: LevelDifficulty;
  targetScore: number;
  maxMoves: number;
  starsEarned: number;
  highScore?: number;
  isUnlocked: boolean;
  goalDescription: string;
  goals: LevelGoal[];
  objectives?: LevelObjective[];
  boardLayout?: BoardLayoutConfig;
  candyDistribution?: CandyDistributionConfig;
  starScores: [number, number, number];
  config?: Record<string, string | number | boolean>;
}

export const CANDY_DEFINITIONS: Record<CandyShape, CandyDefinition> = {
  strawberry_drop: {
    id: 'strawberry_drop',
    displayName: 'Ruby Strawberry',
    flavor: 'Wild Strawberry',
    primaryColor: '#ff1744',
    secondaryColor: '#d50000',
    highlightColor: '#ff8a80',
    shadowColor: '#8a001a',
    accentGlow: 'rgba(255, 23, 68, 0.45)',
  },
  citrus_ring: {
    id: 'citrus_ring',
    displayName: 'Tangerine Citrus',
    flavor: 'Tangy Tangerine',
    primaryColor: '#ff6d00',
    secondaryColor: '#e65100',
    highlightColor: '#ffe082',
    shadowColor: '#bf360c',
    accentGlow: 'rgba(255, 109, 0, 0.45)',
  },
  star_lemon: {
    id: 'star_lemon',
    displayName: 'Lemon Star',
    flavor: 'Sparkling Lemon',
    primaryColor: '#ffd600',
    secondaryColor: '#ffab00',
    highlightColor: '#ffff8d',
    shadowColor: '#b37400',
    accentGlow: 'rgba(255, 214, 0, 0.45)',
  },
  mint_emerald: {
    id: 'mint_emerald',
    displayName: 'Spearmint Hexagon',
    flavor: 'Spearmint Frost',
    primaryColor: '#00e676',
    secondaryColor: '#00c853',
    highlightColor: '#b9f6ca',
    shadowColor: '#00600f',
    accentGlow: 'rgba(0, 230, 118, 0.45)',
  },
  blueberry_oval: {
    id: 'blueberry_oval',
    displayName: 'Sapphire Diamond',
    flavor: 'Sweet Blueberry',
    primaryColor: '#00b0ff',
    secondaryColor: '#0091ea',
    highlightColor: '#e1f5fe',
    shadowColor: '#01579b',
    accentGlow: 'rgba(0, 176, 255, 0.45)',
  },
  plum_heart: {
    id: 'plum_heart',
    displayName: 'Plum Heart',
    flavor: 'Royal Plum Bonbon',
    primaryColor: '#aa00ff',
    secondaryColor: '#7209b7',
    highlightColor: '#ea80fc',
    shadowColor: '#4a148c',
    accentGlow: 'rgba(170, 0, 255, 0.45)',
  },
  rainbow_swirl: {
    id: 'rainbow_swirl',
    displayName: 'Rainbow Swirl',
    flavor: 'All-Flavors Super Candy',
    primaryColor: '#ff007f',
    secondaryColor: '#7928ca',
    highlightColor: '#00dfd8',
    shadowColor: '#25023f',
    accentGlow: 'rgba(255, 0, 127, 0.5)',
  },
};

