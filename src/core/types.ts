export type Side = "player" | "enemy";
export type CardContext = "normal" | "response";
export type CardType =
  | "Thesis"
  | "Argument"
  | "Counter"
  | "Label"
  | "Redirect"
  | "Finisher";

export type StatusId =
  | "urgent"
  | "doubleStandard"
  | "stubborn"
  | "speechless"
  | "mainNarrative"
  | "labeled"
  | "lastWord";

export type Phase =
  | "booting"
  | "player-turn"
  | "enemy-turn"
  | "response-window"
  | "reward"
  | "run-victory"
  | "run-defeat";

export interface StatusMeta {
  name: string;
  tone: "good" | "bad" | "neutral";
  description: string;
}

export interface CardEffect {
  kind: string;
  target?: "self" | "enemy" | "none";
  value?: number;
  base?: number;
  bonus?: number;
  threshold?: number;
  duration?: number;
  statusId?: StatusId;
  momentum?: number;
  draws?: number;
  type?: CardType;
  per?: number;
  cap?: number;
  divisor?: number;
}

export interface CardDefinition {
  id: string;
  name: string;
  cost: number;
  type: CardType;
  target: "self" | "enemy" | "none";
  context: CardContext;
  keywords: string[];
  description: string;
  effects: CardEffect[];
}

export interface CardInstance {
  uid: string;
  cardId: string;
}

export interface BattlefieldDefinition {
  id: string;
  name: string;
  rules: string[];
}

export interface EncounterDefinition {
  id: string;
  name: string;
  role: string;
  face: number;
  battlefieldId: string;
  behavior: "counter" | "opinion" | "tilt" | "boss";
  deck: string[];
  passive: string;
}

export interface CombatantState {
  side: Side;
  name: string;
  role: string;
  passive: string;
  maxFace: number;
  face: number;
  baseMomentum: number;
  momentum: number;
  tilt: number;
  maxTilt: number;
  block: number;
  drawPile: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  statuses: Partial<Record<StatusId, number>>;
  responseCharge: number;
  responseUsed: boolean;
  turnCardsPlayed: number;
  lastCardType: CardType | null;
  playedTypeCounts: Partial<Record<CardType, number>>;
  tookTiltThisTurn: boolean;
  nextArgumentToOpinion: boolean;
  nextCardOpinionBonus: number;
  firstComposureShieldAvailable: boolean;
}

export interface PendingAction {
  actorSide: Side;
  targetSide: Side;
  cardId: string;
  card: CardDefinition;
  cancel: boolean;
  cancelBonus: boolean;
  reduceFaceDamageRemaining: number;
  convertFaceToOpinion: number;
  convertFaceToOpinionBy: Side | null;
  convertFaceToOpinionApplied: boolean;
  convertFaceToTilt: boolean;
  cancelRedirect: boolean;
  bonusPotential: boolean;
  convertArgumentToOpinion: boolean;
  injectedOpinionBonus: number;
}

export interface RunState {
  encounterIndex: number;
  playerDeckIds: string[];
  playerFace: number;
  maxFace: number;
  cleared: string[];
}

export interface LogEntry {
  id: string;
  message: string;
}

export interface BattleState {
  encounterIndex: number;
  encounter: EncounterDefinition;
  battlefield: BattlefieldDefinition;
  activeSide: Side;
  turnNumber: number;
  opinion: number;
  player: CombatantState;
  enemy: CombatantState;
  pendingAction: PendingAction | null;
}

export interface EngineState {
  seed: string;
  phase: Phase;
  demoNotes: string[];
  rewardOptions: string[];
  log: LogEntry[];
  run: RunState;
  battle: BattleState | null;
}
