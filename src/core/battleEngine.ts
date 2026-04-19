import {
  BATTLEFIELDS,
  CARD_LIBRARY,
  DEMO_NOTES,
  ENCOUNTERS,
  NEGATIVE_STATUS_POOL,
  PLAYER_STARTER_DECK,
  POSITIVE_STATUS_POOL,
  REWARD_POOL,
  STATUS_META,
} from "../data/gameData";
import { buildActionBeat } from "../data/actionCallouts";
import type {
  ActionBeat,
  BattleState,
  CardDefinition,
  CardInstance,
  CardType,
  CombatantState,
  EngineState,
  PendingAction,
  Side,
  StatusId,
} from "./types";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const hashSeed = (input: string): (() => number) => {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
};

const mulberry32 = (seed: number): (() => number) => {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export class BattleEngine {
  private uidCounter = 1;
  private logCounter = 1;
  private beatCounter = 1;
  private rng: () => number = Math.random;
  private state: EngineState;

  constructor(seed = Date.now().toString()) {
    this.state = this.buildInitialState(seed);
    this.reset(seed);
  }

  getSnapshot(): EngineState {
    return this.state;
  }

  reset(seed = Date.now().toString()): void {
    const seedText = String(seed);
    const seedFactory = hashSeed(seedText);
    this.rng = mulberry32(seedFactory());
    this.uidCounter = 1;
    this.logCounter = 1;
    this.beatCounter = 1;
    this.state = this.buildInitialState(seedText);
    this.startBattle(0);
  }

  private buildInitialState(seed: string): EngineState {
    return {
      seed,
      phase: "booting",
      demoNotes: DEMO_NOTES,
      rewardOptions: [],
      log: [],
      actionQueue: [],
      run: {
        encounterIndex: 0,
        playerDeckIds: [...PLAYER_STARTER_DECK],
        playerFace: 30,
        maxFace: 30,
        cleared: [],
      },
      battle: null,
    };
  }

  private startBattle(encounterIndex: number): void {
    const encounter = ENCOUNTERS[encounterIndex];
    const battlefield = BATTLEFIELDS[encounter.battlefieldId];

    const player = this.createCombatant({
      side: "player",
      name: "赢学大师",
      role: "逆风成名",
      passive:
        "体面 ≤10 时回合开始额外获得 1 气势；每场战斗首次失态仅损失 1 点舆论。",
      face: this.state.run.playerFace,
      maxFace: this.state.run.maxFace,
      deckIds: this.state.run.playerDeckIds,
    });

    const enemy = this.createCombatant({
      side: "enemy",
      name: encounter.name,
      role: encounter.role,
      passive: encounter.passive,
      face: encounter.face,
      maxFace: encounter.face,
      deckIds: encounter.deck,
    });

    this.shuffleInPlace(player.drawPile);
    this.shuffleInPlace(enemy.drawPile);
    this.drawCards(player, 5);
    this.drawCards(enemy, 5);

    this.state.battle = {
      encounterIndex,
      encounter,
      battlefield,
      activeSide: "player",
      turnNumber: 1,
      opinion: 0,
      player,
      enemy,
      pendingAction: null,
    };
    this.state.rewardOptions = [];
    this.state.log = [];
    this.log(`${battlefield.name}开战，对手是${encounter.name}。`);
    this.log(`敌方特征：${encounter.passive}`);
    this.prepareTurn("player", true);
  }

  private createCombatant(input: {
    side: Side;
    name: string;
    role: string;
    passive: string;
    face: number;
    maxFace: number;
    deckIds: string[];
  }): CombatantState {
    return {
      side: input.side,
      name: input.name,
      role: input.role,
      passive: input.passive,
      maxFace: input.maxFace,
      face: input.face,
      baseMomentum: 3,
      momentum: 0,
      tilt: 0,
      maxTilt: 10,
      block: 0,
      drawPile: input.deckIds.map((cardId) => this.createCardInstance(cardId)),
      hand: [],
      discard: [],
      statuses: {},
      responseCharge: 0,
      responseUsed: false,
      turnCardsPlayed: 0,
      lastCardType: null,
      playedTypeCounts: {},
      tookTiltThisTurn: false,
      nextArgumentToOpinion: false,
      nextCardOpinionBonus: 0,
      firstComposureShieldAvailable: input.side === "player",
    };
  }

  private createCardInstance(cardId: string): CardInstance {
    return {
      uid: `${cardId}-${this.uidCounter++}`,
      cardId,
    };
  }

  private battle(): BattleState {
    if (!this.state.battle) {
      throw new Error("Battle state is not initialized.");
    }
    return this.state.battle;
  }

  private getCombatant(side: Side): CombatantState {
    return this.battle()[side];
  }

  private getOpponent(side: Side): CombatantState {
    return this.battle()[side === "player" ? "enemy" : "player"];
  }

  private prepareTurn(side: Side, opening = false): void {
    const battle = this.battle();
    battle.activeSide = side;
    if (!opening) {
      battle.turnNumber += 1;
    }

    const actor = this.getCombatant(side);
    const defender = this.getOpponent(side);
    actor.turnCardsPlayed = 0;
    actor.lastCardType = null;
    actor.playedTypeCounts = {};
    actor.tookTiltThisTurn = false;
    actor.block = 0;
    actor.momentum = actor.baseMomentum + (actor.side === "player" && actor.face <= 10 ? 1 : 0);
    actor.responseCharge = 0;
    actor.responseUsed = false;
    defender.responseCharge = 1;
    defender.responseUsed = false;
    defender.tookTiltThisTurn = false;
    battle.pendingAction = null;

    if (!opening) {
      const bonusDraw = battle.battlefield.id === "group-chat" ? 1 : 0;
      this.drawCards(actor, 2 + bonusDraw);
    }

    const sideLabel = side === "player" ? "你的" : `${actor.name}的`;
    this.log(`${sideLabel}回合开始，气势重置为 ${actor.momentum}。`);
    this.state.phase = side === "player" ? "player-turn" : "enemy-turn";
  }

  private drawCards(character: CombatantState, count: number): void {
    for (let drawIndex = 0; drawIndex < count; drawIndex += 1) {
      if (character.drawPile.length === 0) {
        if (character.discard.length === 0) {
          return;
        }
        character.drawPile = character.discard.splice(0);
        this.shuffleInPlace(character.drawPile);
      }

      const drawnCard = character.drawPile.pop();
      if (drawnCard) {
        character.hand.push(drawnCard);
      }
    }
  }

  private shuffleInPlace<T>(items: T[]): void {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.rng() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
  }

  endPlayerTurn(): boolean {
    if (this.state.phase !== "player-turn") {
      return false;
    }
    this.finishTurn("player");
    return true;
  }

  skipResponse(): boolean {
    if (this.state.phase !== "response-window") {
      return false;
    }
    this.log("你选择先不接这波。");
    this.state.phase = "enemy-turn";
    this.resolvePendingAction();
    return true;
  }

  private finishTurn(side: Side): void {
    const actor = this.getCombatant(side);
    this.restoreLastWordIfNeeded();
    if (this.resolveBattleOutcome()) {
      return;
    }

    this.tickStatuses(actor);
    actor.momentum = 0;
    actor.responseCharge = 0;
    actor.nextArgumentToOpinion = false;
    actor.nextCardOpinionBonus = 0;

    if (side === "player") {
      this.prepareTurn("enemy");
      return;
    }
    this.prepareTurn("player");
  }

  private tickStatuses(character: CombatantState): void {
    const nextStatuses: CombatantState["statuses"] = {};
    Object.entries(character.statuses).forEach(([statusId, duration]) => {
      if ((duration ?? 0) > 1) {
        nextStatuses[statusId as StatusId] = (duration ?? 0) - 1;
      }
    });
    character.statuses = nextStatuses;
  }

  private restoreLastWordIfNeeded(): void {
    (["player", "enemy"] as Side[]).forEach((side) => {
      const target = this.getCombatant(side);
      if (target.face <= 0 && this.hasStatus(target, "lastWord")) {
        target.face = 1;
        delete target.statuses.lastWord;
        this.log(`${target.name}靠【还没结束】硬抬回了 1 点体面。`);
      }
    });
  }

  playPlayerCard(cardUid: string): boolean {
    if (this.state.phase !== "player-turn") {
      return false;
    }
    return this.playCard("player", cardUid);
  }

  playCard(side: Side, cardUid: string, forcedMode: "normal" | "response" | null = null): boolean {
    const actor = this.getCombatant(side);
    const mode = forcedMode ?? (this.state.phase === "response-window" ? "response" : "normal");
    const instance = actor.hand.find((card) => card.uid === cardUid);

    if (!instance) {
      return false;
    }

    const definition = CARD_LIBRARY[instance.cardId];
    if (!this.isCardPlayable(actor, definition, mode)) {
      return false;
    }

    const cost = this.getCardCost(definition);
    if (mode === "response") {
      actor.responseCharge -= cost;
      actor.responseUsed = true;
    } else {
      actor.momentum -= cost;
      actor.turnCardsPlayed += 1;
      this.registerCardPlay(actor, definition);
    }

    actor.hand = actor.hand.filter((card) => card.uid !== cardUid);
    actor.discard.push(instance);

    if (mode === "response") {
      const pending = this.battle().pendingAction;
      if (!pending) {
        return false;
      }
      this.pushActionBeat(actor.side, definition, "response");
      this.log(`${actor.name}回应【${definition.name}】。`);
      this.applyResponseCard(definition, actor, pending);
      this.state.phase = pending.actorSide === "enemy" ? "enemy-turn" : "player-turn";
      this.resolvePendingAction();
      return true;
    }

    const target = this.getOpponent(side);
    const pendingAction = this.createPendingAction(actor, target, definition);
    this.battle().pendingAction = pendingAction;
    this.pushActionBeat(actor.side, definition, "normal");
    this.log(`${actor.name}打出【${definition.name}】。`);

    if (side === "player") {
      const enemyResponse = this.chooseEnemyResponse(pendingAction);
      if (enemyResponse) {
        this.playCard("enemy", enemyResponse.uid, "response");
      } else {
        this.resolvePendingAction();
      }
      return true;
    }

    if (this.getAvailableResponses("player").length > 0) {
      this.state.phase = "response-window";
      return true;
    }

    this.resolvePendingAction();
    return true;
  }

  private createPendingAction(
    actor: CombatantState,
    target: CombatantState,
    definition: CardDefinition,
  ): PendingAction {
    const pending: PendingAction = {
      actorSide: actor.side,
      targetSide: target.side,
      cardId: definition.id,
      card: definition,
      cancel: false,
      cancelBonus: false,
      reduceFaceDamageRemaining: 0,
      convertFaceToOpinion: 0,
      convertFaceToOpinionBy: null,
      convertFaceToOpinionApplied: false,
      convertFaceToTilt: false,
      cancelRedirect: false,
      bonusPotential: this.cardHasBonusPotential(definition),
      convertArgumentToOpinion: false,
      injectedOpinionBonus: actor.nextCardOpinionBonus,
    };

    if (actor.nextArgumentToOpinion && definition.type === "Argument") {
      pending.convertArgumentToOpinion = true;
      actor.nextArgumentToOpinion = false;
    }
    actor.nextCardOpinionBonus = 0;
    return pending;
  }

  private pushActionBeat(side: Side, definition: CardDefinition, mode: "normal" | "response"): void {
    const beat: ActionBeat = buildActionBeat({
      id: `beat-${this.beatCounter++}`,
      side,
      mode,
      card: definition,
      rng: this.rng,
    });
    this.state.actionQueue.push(beat);
  }

  private cardHasBonusPotential(definition: CardDefinition): boolean {
    return definition.effects.some((effect) =>
      [
        "opinionIfSelfHasStatus",
        "dealFaceIfTargetHasStatus",
        "drawIfLeading",
        "dealFaceIfOpinionAtLeast",
        "dealFaceIfTargetTiltAtLeast",
        "dealFaceIfTargetTookTiltThisTurn",
        "dealFaceIfFaceAtMost",
        "dealFaceWithLostFaceBonus",
        "gainMomentumAndDrawIfFaceAtMost",
      ].includes(effect.kind),
    );
  }

  private registerCardPlay(actor: CombatantState, definition: CardDefinition): void {
    if (this.hasStatus(actor, "doubleStandard") && actor.lastCardType === definition.type) {
      this.shiftOpinionAgainst(actor, 1, `${actor.name}在【双标】下连续打出同类牌`);
    }

    if (
      this.hasStatus(actor, "urgent") &&
      (definition.type === "Argument" || definition.type === "Finisher")
    ) {
      this.adjustTilt(actor, 1, `${actor.name}在【急了】状态下情绪继续上头`);
    }

    actor.lastCardType = definition.type;
    actor.playedTypeCounts[definition.type] = (actor.playedTypeCounts[definition.type] ?? 0) + 1;
  }

  isCardPlayable(
    actor: CombatantState,
    definition: CardDefinition,
    mode: "normal" | "response",
  ): boolean {
    const cost = this.getCardCost(definition);
    if (mode === "normal") {
      if (definition.context === "response") {
        return false;
      }
      return actor.momentum >= cost;
    }

    if (definition.context !== "response") {
      return false;
    }
    if (this.hasStatus(actor, "speechless")) {
      return false;
    }
    if (actor.responseUsed || actor.responseCharge < cost) {
      return false;
    }
    return this.isResponseRelevant(definition, actor, this.battle().pendingAction);
  }

  getCardCost(definition: CardDefinition): number {
    let cost = definition.cost;
    if (
      this.battle().battlefield.id === "comment-zone" &&
      definition.keywords.includes("response")
    ) {
      cost -= 1;
    }
    return Math.max(0, cost);
  }

  getAvailableResponses(side: Side): Array<CardInstance & { definition: CardDefinition }> {
    const actor = this.getCombatant(side);
    return actor.hand
      .map((instance) => ({
        ...instance,
        definition: CARD_LIBRARY[instance.cardId],
      }))
      .filter(({ definition }) => this.isCardPlayable(actor, definition, "response"));
  }

  private isResponseRelevant(
    definition: CardDefinition,
    actor: CombatantState,
    pending: PendingAction | null,
  ): boolean {
    if (!pending) {
      return false;
    }
    const actorOpinionBehind = this.relativeOpinion(pending.actorSide) < 0;
    const actorPlayedThesis =
      (this.getCombatant(pending.actorSide).playedTypeCounts.Thesis ?? 0) > 0;
    const targetsResponder = pending.targetSide === actor.side;
    const hasFaceDamage = this.pendingHasFaceDamage(pending.card);
    const hasRedirect = pending.card.keywords.includes("redirect");

    switch (definition.id) {
      case "ask-first":
        return pending.card.type === "Argument" && hasFaceDamage;
      case "whatabout":
        return targetsResponder && hasFaceDamage;
      case "quote-out":
        return pending.bonusPotential;
      case "logic-leap":
        return true;
      case "opinion-backfire":
        return actorOpinionBehind;
      case "exposed":
        return actorPlayedThesis;
      case "not-the-point":
        return hasFaceDamage;
      case "dont-derail":
        return hasRedirect;
      default:
        return true;
    }
  }

  private chooseEnemyResponse(
    pending: PendingAction,
  ): (CardInstance & { definition: CardDefinition }) | null {
    const options = this.getAvailableResponses("enemy");
    if (options.length === 0) {
      return null;
    }

    const scored = options
      .map((instance) => ({
        instance,
        score: this.scoreResponseCard(instance.definition, pending, "enemy"),
      }))
      .sort((left, right) => right.score - left.score);

    if (scored[0].score <= 0) {
      return null;
    }
    return scored[0].instance;
  }

  private scoreResponseCard(
    definition: CardDefinition,
    pending: PendingAction,
    side: Side,
  ): number {
    const targetsResponder = pending.targetSide === side;
    const hasFaceDamage = this.pendingHasFaceDamage(pending.card);
    const actorOpinionBehind = this.relativeOpinion(pending.actorSide) < 0;
    const actorPlayedThesis =
      (this.getCombatant(pending.actorSide).playedTypeCounts.Thesis ?? 0) > 0;

    switch (definition.id) {
      case "logic-leap":
        return pending.card.cost >= 3 ? 10 : 7;
      case "whatabout":
        return targetsResponder && hasFaceDamage ? 8 : -10;
      case "ask-first":
        return hasFaceDamage ? 6 : -10;
      case "quote-out":
        return pending.bonusPotential ? 7 : -10;
      case "opinion-backfire":
        return actorOpinionBehind ? 7 : -10;
      case "exposed":
        return actorPlayedThesis ? 8 : -10;
      case "dont-derail":
        return pending.card.keywords.includes("redirect") ? 8 : -10;
      case "not-the-point":
        return hasFaceDamage ? 6 : -10;
      default:
        return 1;
    }
  }

  private pendingHasFaceDamage(card: CardDefinition): boolean {
    return card.effects.some((effect) =>
      [
        "dealFace",
        "dealFaceIfTargetHasStatus",
        "dealFaceIfOpinionAtLeast",
        "dealFaceIfTargetTiltAtLeast",
        "dealFaceIfTargetTookTiltThisTurn",
        "dealFaceIfFaceAtMost",
        "dealFaceWithLostFaceBonus",
        "dealFaceByPositiveOpinion",
      ].includes(effect.kind),
    );
  }

  private applyResponseCard(
    definition: CardDefinition,
    actor: CombatantState,
    pending: PendingAction,
  ): void {
    definition.effects.forEach((effect) => {
      switch (effect.kind) {
        case "reducePendingFace":
          pending.reduceFaceDamageRemaining += effect.value ?? 0;
          break;
        case "cancelPendingBonus":
          pending.cancelBonus = true;
          break;
        case "counterPending":
          pending.cancel = true;
          break;
        case "opinionIfPendingCostAtLeast":
          if (pending.card.cost >= (effect.threshold ?? 0)) {
            this.shiftOpinion(actor, effect.value ?? 0, `${definition.name}带来的舆论反扑`);
          }
          break;
        case "convertPendingFaceToOpinion":
          pending.convertFaceToOpinion = effect.value ?? 0;
          pending.convertFaceToOpinionBy = actor.side;
          break;
        case "tiltIfActorOpinionBehind":
          if (this.relativeOpinion(pending.actorSide) < 0) {
            this.adjustTilt(
              this.getCombatant(pending.actorSide),
              effect.value ?? 0,
              `${definition.name}让对手舆情反噬`,
            );
          }
          break;
        case "tiltIfPendingActorPlayedTypeThisTurn":
          if (
            (this.getCombatant(pending.actorSide).playedTypeCounts[effect.type ?? "Thesis"] ?? 0) > 0
          ) {
            this.adjustTilt(
              this.getCombatant(pending.actorSide),
              effect.value ?? 0,
              `${definition.name}指出了对手的套路`,
            );
          }
          break;
        case "convertPendingFaceToTilt":
          pending.convertFaceToTilt = true;
          break;
        case "cancelPendingRedirect":
          pending.cancelRedirect = true;
          break;
        default:
          break;
      }
    });
  }

  private resolvePendingAction(): void {
    const pending = this.battle().pendingAction;
    if (!pending) {
      return;
    }

    const actor = this.getCombatant(pending.actorSide);
    const target = this.getCombatant(pending.targetSide);
    if (pending.cancel) {
      this.log(`【${pending.card.name}】被直接掐掉了。`);
      this.battle().pendingAction = null;
      this.resolveBattleOutcome();
      return;
    }

    if (pending.cancelRedirect && pending.card.keywords.includes("redirect")) {
      this.log(`【${pending.card.name}】的转进结算被取消。`);
      this.battle().pendingAction = null;
      this.resolveBattleOutcome();
      return;
    }

    pending.card.effects.forEach((effect) => {
      this.executeEffect(effect, actor, target, pending);
    });

    if (pending.injectedOpinionBonus > 0) {
      this.shiftOpinion(actor, pending.injectedOpinionBonus, `${pending.card.name}借额外节奏扩音`, true);
    }

    this.battle().pendingAction = null;
    this.resolveBattleOutcome();
  }

  private executeEffect(
    effect: CardDefinition["effects"][number],
    actor: CombatantState,
    target: CombatantState,
    pending: PendingAction,
  ): void {
    switch (effect.kind) {
      case "applyStatus":
        this.applyStatus(effect.target === "self" ? actor : target, effect.statusId!, effect.duration ?? 1);
        break;
      case "tilt":
        this.adjustTilt(effect.target === "self" ? actor : target, effect.value ?? 0, pending.card.name);
        break;
      case "dealFace":
        this.applyFaceEffect(effect.value ?? 0, actor, target, pending);
        break;
      case "opinionIfSelfHasStatus":
        if (effect.statusId && this.hasStatus(actor, effect.statusId) && !pending.cancelBonus) {
          this.shiftOpinion(actor, effect.value ?? 0, `${pending.card.name}借势推进舆论`, false, pending.card);
        }
        break;
      case "gainMomentum":
        this.gainMomentum(actor, effect.value ?? 0);
        break;
      case "draw":
        this.drawCards(actor, effect.value ?? 0);
        break;
      case "gainBlock":
        this.gainBlock(actor, effect.value ?? 0, pending.card);
        break;
      case "reduceTilt":
        this.adjustTilt(actor, -(effect.value ?? 0), pending.card.name);
        break;
      case "setNextArgumentToOpinion":
        actor.nextArgumentToOpinion = true;
        break;
      case "dealFaceIfTargetHasStatus":
        this.applyFaceEffect(
          (effect.base ?? 0) +
            (!pending.cancelBonus && this.targetHasAnyStatus(target) ? effect.bonus ?? 0 : 0),
          actor,
          target,
          pending,
        );
        break;
      case "drawIfLeading":
        if (!pending.cancelBonus && this.relativeOpinion(actor.side) > 0) {
          this.drawCards(actor, effect.value ?? 0);
        }
        break;
      case "dealFaceIfOpinionAtLeast":
        this.applyFaceEffect(
          (effect.base ?? 0) +
            (!pending.cancelBonus && this.relativeOpinion(actor.side) >= (effect.threshold ?? 0)
              ? effect.bonus ?? 0
              : 0),
          actor,
          target,
          pending,
        );
        break;
      case "gainOpinion":
        this.shiftOpinion(actor, effect.value ?? 0, pending.card.name, false, pending.card);
        break;
      case "dealFaceByPositiveOpinion": {
        const positiveOpinion = Math.max(0, this.relativeOpinion(actor.side));
        const damage = Math.min(effect.cap ?? 0, positiveOpinion * (effect.per ?? 0));
        this.applyFaceEffect(damage, actor, target, pending);
        break;
      }
      case "dealFaceIfTargetTiltAtLeast":
        this.applyFaceEffect(
          (effect.base ?? 0) +
            (!pending.cancelBonus && target.tilt >= (effect.threshold ?? 0) ? effect.bonus ?? 0 : 0),
          actor,
          target,
          pending,
        );
        break;
      case "dealFaceIfTargetTookTiltThisTurn":
        if (!pending.cancelBonus && target.tookTiltThisTurn) {
          this.applyFaceEffect(effect.value ?? 0, actor, target, pending);
        }
        break;
      case "forcedComposureIfTiltAtLeast":
        if (target.tilt >= (effect.threshold ?? 0)) {
          this.triggerComposure(target, `${pending.card.name}强行把对手打到失态`, true);
        }
        break;
      case "setNextCardOpinionBonus":
        actor.nextCardOpinionBonus += effect.value ?? 0;
        break;
      case "replaceTargetStatus":
        this.replaceTargetStatus(target, pending.card.name);
        break;
      case "removeEnemyBuff":
        this.removeEnemyBuff(target);
        break;
      case "flipOpinion":
        this.battle().opinion = clamp(-this.battle().opinion, -7, 7);
        this.log(`${pending.card.name}让全场舆论方向反过来了。`);
        break;
      case "gainMomentumAndDrawIfFaceAtMost":
        if (!pending.cancelBonus && actor.face <= (effect.threshold ?? 0)) {
          this.gainMomentum(actor, effect.momentum ?? 0);
          this.drawCards(actor, effect.draws ?? 0);
        }
        break;
      case "dealFaceIfFaceAtMost":
        this.applyFaceEffect(
          (effect.base ?? 0) +
            (!pending.cancelBonus && actor.face <= (effect.threshold ?? 0) ? effect.bonus ?? 0 : 0),
          actor,
          target,
          pending,
        );
        break;
      case "dealFaceWithLostFaceBonus": {
        const bonus = pending.cancelBonus
          ? 0
          : Math.min(effect.cap ?? 0, Math.floor((actor.maxFace - actor.face) / (effect.divisor ?? 1)));
        this.applyFaceEffect((effect.base ?? 0) + bonus, actor, target, pending);
        break;
      }
      case "preventDefeat":
        this.applyStatus(actor, "lastWord", effect.duration ?? 1);
        break;
      default:
        break;
    }
  }

  private applyStatus(target: CombatantState, statusId: StatusId, duration: number): void {
    const adjusted = duration + (target.side === this.battle().activeSide ? 1 : 0);
    target.statuses[statusId] = Math.max(target.statuses[statusId] ?? 0, adjusted);
    this.log(`${target.name}获得【${STATUS_META[statusId].name}】。`);
  }

  private removeEnemyBuff(target: CombatantState): void {
    const currentBuff = POSITIVE_STATUS_POOL.find((statusId) => this.hasStatus(target, statusId));
    if (!currentBuff) {
      this.log(`${target.name}没什么增益可拆。`);
      return;
    }
    delete target.statuses[currentBuff];
    this.log(`${target.name}失去了【${STATUS_META[currentBuff].name}】。`);
  }

  private replaceTargetStatus(target: CombatantState, source: string): void {
    const current = Object.keys(target.statuses).find((statusId) => statusId !== "lastWord") as
      | StatusId
      | undefined;
    if (!current) {
      this.log(`${source}想偷换概念，但目标身上没状态可换。`);
      return;
    }
    delete target.statuses[current];
    const replacement = this.pickRandom(NEGATIVE_STATUS_POOL);
    this.applyStatus(target, replacement, 1);
    this.log(`${source}把【${STATUS_META[current].name}】换成了【${STATUS_META[replacement].name}】。`);
  }

  private applyFaceEffect(
    amount: number,
    actor: CombatantState,
    target: CombatantState,
    pending: PendingAction,
  ): void {
    if (amount <= 0) {
      return;
    }

    let adjusted = amount;
    if (
      this.hasStatus(actor, "stubborn") &&
      actor.face <= 10 &&
      (pending.card.type === "Argument" || pending.card.type === "Finisher")
    ) {
      adjusted += 2;
    }

    if (pending.convertArgumentToOpinion && pending.card.type === "Argument") {
      this.shiftOpinion(actor, adjusted, `${pending.card.name}把伤害转成了舆论`, true);
      return;
    }

    if (pending.convertFaceToOpinion > 0 && !pending.convertFaceToOpinionApplied) {
      const responder = pending.convertFaceToOpinionBy
        ? this.getCombatant(pending.convertFaceToOpinionBy)
        : actor;
      this.shiftOpinion(responder, pending.convertFaceToOpinion, `${pending.card.name}被转进成了舆论波动`, true);
      pending.convertFaceToOpinionApplied = true;
      return;
    }

    if (pending.convertFaceToTilt) {
      this.adjustTilt(target, adjusted, `${pending.card.name}把体面伤害改成了破防`);
      return;
    }

    if (pending.reduceFaceDamageRemaining > 0) {
      const reduced = Math.min(adjusted, pending.reduceFaceDamageRemaining);
      adjusted -= reduced;
      pending.reduceFaceDamageRemaining -= reduced;
    }

    if (adjusted <= 0) {
      this.log(`${pending.card.name}的体面伤害被彻底吃掉了。`);
      return;
    }

    const blocked = Math.min(target.block, adjusted);
    if (blocked > 0) {
      target.block -= blocked;
      adjusted -= blocked;
      this.log(`${target.name}格挡了 ${blocked} 点体面伤害。`);
    }

    if (adjusted <= 0) {
      return;
    }

    target.face = Math.max(-99, target.face - adjusted);
    this.log(`${pending.card.name}对${target.name}造成 ${adjusted} 点体面伤害。`);
  }

  private gainMomentum(actor: CombatantState, amount: number): void {
    actor.momentum = clamp(actor.momentum + amount, 0, 10);
    this.log(`${actor.name}获得 ${amount} 点气势。`);
  }

  private gainBlock(actor: CombatantState, amount: number, definition: CardDefinition): void {
    const weakened = this.hasStatus(actor, "urgent") && definition.type === "Counter" ? 1 : 0;
    const finalAmount = Math.max(0, amount - weakened);
    actor.block += finalAmount;
    this.log(`${actor.name}获得 ${finalAmount} 点格挡。`);
  }

  private adjustTilt(target: CombatantState, amount: number, reason: string): void {
    if (amount === 0) {
      return;
    }
    target.tilt = clamp(target.tilt + amount, 0, target.maxTilt);
    if (amount > 0) {
      target.tookTiltThisTurn = true;
      this.log(`${reason}让${target.name}增加 ${amount} 点破防。`);
      if (target.tilt >= target.maxTilt) {
        this.triggerComposure(target, `${target.name}破防值爆表，直接失态`);
      }
      return;
    }
    this.log(`${reason}让${target.name}回复 ${Math.abs(amount)} 点情绪。`);
  }

  private triggerComposure(target: CombatantState, reason: string, forced = false): void {
    if (!forced && target.tilt < target.maxTilt) {
      return;
    }

    target.tilt = 0;
    if (target.side === "player" && target.firstComposureShieldAvailable) {
      target.firstComposureShieldAvailable = false;
      this.shiftOpinionAgainst(target, 1, `${reason}，但玩家被动兜住了`);
      this.log("逆风成名触发：首次失态不掉体面，只丢 1 点舆论。");
      return;
    }

    target.face = Math.max(-99, target.face - 4);
    this.log(`${reason}，${target.name}额外失去 4 点体面。`);
    const extraOpinion = this.battle().battlefield.id === "group-chat" ? 1 : 0;
    this.shiftOpinionAgainst(target, 2 + extraOpinion, `${target.name}失态后场面更加失控`);
  }

  private shiftOpinion(
    actor: CombatantState,
    amount: number,
    reason: string,
    asMomentumShift = false,
    definition: CardDefinition | null = null,
  ): void {
    if (amount === 0) {
      return;
    }

    let finalAmount = amount;
    const appliesMomentumShift =
      asMomentumShift || Boolean(definition && definition.keywords.includes("momentumShift"));

    if (appliesMomentumShift && this.hasStatus(actor, "mainNarrative")) {
      finalAmount += 1;
    }
    if (appliesMomentumShift && this.battle().battlefield.id === "comment-zone") {
      finalAmount += 1;
    }

    this.battle().opinion = clamp(
      this.battle().opinion + (actor.side === "player" ? finalAmount : -finalAmount),
      -7,
      7,
    );
    this.log(`${reason}，舆论 ${finalAmount > 0 ? "+" : ""}${finalAmount}。`);
  }

  private shiftOpinionAgainst(target: CombatantState, amount: number, reason: string): void {
    const source = target.side === "player" ? this.getCombatant("enemy") : this.getCombatant("player");
    this.shiftOpinion(source, amount, reason);
  }

  relativeOpinion(side: Side): number {
    return side === "player" ? this.battle().opinion : -this.battle().opinion;
  }

  private targetHasAnyStatus(target: CombatantState): boolean {
    return Object.keys(target.statuses).some((statusId) => statusId !== "lastWord");
  }

  hasStatus(target: CombatantState, statusId: StatusId): boolean {
    return (target.statuses[statusId] ?? 0) > 0;
  }

  private resolveBattleOutcome(): boolean {
    const battle = this.battle();
    const playerDead = battle.player.face <= 0 && !this.hasStatus(battle.player, "lastWord");
    const enemyDead = battle.enemy.face <= 0 && !this.hasStatus(battle.enemy, "lastWord");

    if (!playerDead && !enemyDead) {
      return false;
    }

    if (playerDead) {
      this.state.phase = "run-defeat";
      this.log("你的体面被打穿了，这局结束。");
      return true;
    }

    this.state.run.cleared.push(battle.encounter.id);
    this.state.run.playerFace = clamp(battle.player.face + 5, 1, this.state.run.maxFace);

    if (battle.encounterIndex === ENCOUNTERS.length - 1) {
      this.state.phase = "run-victory";
      this.log("精神胜利王倒了，整条线都被你赢麻了。");
      return true;
    }

    this.state.rewardOptions = this.sampleMany(REWARD_POOL, 3);
    this.state.phase = "reward";
    this.log("战斗结束，你恢复 5 点体面并选择 1 张新牌加入牌组。");
    return true;
  }

  chooseReward(cardId: string): boolean {
    if (this.state.phase !== "reward") {
      return false;
    }
    this.state.run.playerDeckIds.push(cardId);
    this.state.run.encounterIndex += 1;
    this.startBattle(this.state.run.encounterIndex);
    return true;
  }

  enemyTakeStep(): boolean {
    if (this.state.phase !== "enemy-turn") {
      return false;
    }

    const enemy = this.getCombatant("enemy");
    const player = this.getCombatant("player");
    const playable = enemy.hand
      .map((instance) => ({ ...instance, definition: CARD_LIBRARY[instance.cardId] }))
      .filter(({ definition }) => this.isCardPlayable(enemy, definition, "normal"));

    if (enemy.turnCardsPlayed >= 3 || playable.length === 0) {
      this.finishTurn("enemy");
      return true;
    }

    playable.sort((left, right) => {
      return this.scoreEnemyCard(right.definition, enemy, player) - this.scoreEnemyCard(left.definition, enemy, player);
    });

    this.playCard("enemy", playable[0].uid);
    return true;
  }

  private scoreEnemyCard(
    definition: CardDefinition,
    enemy: CombatantState,
    player: CombatantState,
  ): number {
    const behavior = this.battle().encounter.behavior;
    let score = 1 + definition.cost * 0.35;

    const behaviorWeights: Record<string, Record<CardType, number>> = {
      counter: {
        Counter: 2.1,
        Redirect: 1.8,
        Argument: 1.3,
        Thesis: 1.1,
        Label: 1,
        Finisher: 1.2,
      },
      opinion: {
        Thesis: 2,
        Argument: 1.7,
        Finisher: 1.5,
        Redirect: 1,
        Counter: 0.8,
        Label: 0.9,
      },
      tilt: {
        Label: 2.2,
        Argument: 1.8,
        Finisher: 1.6,
        Redirect: 1,
        Counter: 0.8,
        Thesis: 0.9,
      },
      boss: {
        Finisher: 2.3,
        Argument: 1.8,
        Label: 1.3,
        Counter: 1,
        Redirect: 1.2,
        Thesis: 1.1,
      },
    };

    score *= behaviorWeights[behavior][definition.type];

    if (definition.keywords.includes("momentumShift") && this.relativeOpinion("enemy") < 2) {
      score += 2;
    }
    if (this.hasStatus(enemy, "mainNarrative") && definition.keywords.includes("momentumShift")) {
      score += 1;
    }
    if (player.tilt >= 7 && definition.id === "cant-hold") {
      score += 7;
    }
    if (player.tilt >= 5 && definition.id === "break-check") {
      score += 4;
    }
    if (player.tookTiltThisTurn && definition.id === "keep-hitting") {
      score += 4;
    }
    if (enemy.face <= 10 && ["not-lost", "force-explain", "headwind-output"].includes(definition.id)) {
      score += 4;
    }
    if (enemy.face <= 8 && definition.id === "win-hard") {
      score += 8;
    }
    if (definition.id === "everyone-knows" && this.relativeOpinion("enemy") >= 3) {
      score += 4;
    }
    if (definition.id === "group-consensus" && this.relativeOpinion("enemy") >= 2) {
      score += 3;
    }
    if (definition.id === "burst-point") {
      score += Math.max(-2, this.relativeOpinion("enemy"));
    }
    if (definition.id === "main-narrative" && !this.hasStatus(enemy, "mainNarrative")) {
      score += 2;
    }
    if (definition.id === "topic-swap" && this.relativeOpinion("enemy") <= -2) {
      score += 5;
    }
    if (
      definition.id === "redefine" &&
      (this.hasStatus(player, "mainNarrative") || this.hasStatus(player, "stubborn"))
    ) {
      score += 4;
    }
    if (definition.id === "shift-meaning" && this.targetHasAnyStatus(player)) {
      score += 3;
    }
    if (definition.id === "not-over" && enemy.face <= 10 && !this.hasStatus(enemy, "lastWord")) {
      score += 4;
    }
    if (
      definition.id === "classic-redirect" &&
      enemy.hand.some((instance) => CARD_LIBRARY[instance.cardId].type === "Argument")
    ) {
      score += 2;
    }
    if (
      definition.id === "we-are-discussing" &&
      enemy.hand.some((instance) => {
        const card = CARD_LIBRARY[instance.cardId];
        return card.type === "Argument" || card.type === "Finisher";
      })
    ) {
      score += 2;
    }

    return score;
  }

  private pickRandom<T>(items: readonly T[]): T {
    return items[Math.floor(this.rng() * items.length)];
  }

  private sampleMany<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const result: T[] = [];
    while (pool.length > 0 && result.length < count) {
      const index = Math.floor(this.rng() * pool.length);
      result.push(pool.splice(index, 1)[0]);
    }
    return result;
  }

  private log(message: string): void {
    this.state.log.unshift({
      id: `log-${this.logCounter++}`,
      message,
    });
    this.state.log = this.state.log.slice(0, 16);
  }
}
