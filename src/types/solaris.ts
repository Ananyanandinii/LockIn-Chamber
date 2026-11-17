export type CamMode = 'off' | 'stealth' | 'mirror';

export type ClockStatus =
  | 'STANDBY'
  | 'LOCKED IN'
  | 'PAUSED'
  | 'PAUSED — AWAY'
  | 'FLOW OVERTIME';

export interface LedgerStats {
  mins: number;
  flow: number;
  blocks: number;
}

export interface ThoughtItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface RippleOptions {
  x: number;
  y: number;
  r?: number;
  alpha?: number;
  sp?: number;
  fade?: number;
}

export interface GravityWell {
  x: number;
  y: number;
  s: number;
}

export type OrbMode = 'docked' | 'dragging' | 'roaming' | 'recalling';

export interface OrbControlState {
  mode: OrbMode;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  targetX?: number;
  targetY?: number;
}

