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
} from "./data.mjs";

function hashSeed(input) {
  const text = String(input);
  let hash = 1779033703 ^ text.length;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  return function rng() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sample(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

function sampleMany(rng, items, count) {
  const pool = [...items];
  const result = [];
  while (pool.length > 0 && result.length < count) {
    const index = Math.floor(rng() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

export class WinGame {
  constructor(seed = Date.now()) {
    this.reset(seed);
  }

  reset(seed = Date.now()) {
    const seedText = String(seed);
    const seedFactory = hashSeed(seedText);
    this.seed = seedText;
    this.rng = mulberry32(seedFactory());
    this.uidCounter = 1;
    this.state = {
      seed: seedText,
      phase: "booting",
      demoNotes: DEMO_NOTES,
      rewardOptions: [],
      log: [],
      run: {
        encounterIndex: 0,
        playerDeckIds: [...PLAYER_STARTER_DECK],
        playerFace: 30,
        maxFace: 30,
        cleared: [],
      },
      battle: null,
    };
    this.startBattle(0);
  }

  getState() {
    return this.state;
  }

  startBattle(encounterIndex) {
    const encounter = ENCOUNTERS[encounterIndex];
    const battlefield = BATTLEFIELDS[encounter.battlefieldId];

    const player = this.createCombatant({
      side: "player",
      name: "赢学大师",
      role: "逆风成名",
      passive: "体面 ≤10 时，回合开始额外获得 1 气势；每场战斗首次失态仅损失 1 点舆论。",
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
    this.prepareTurn("player", { opening: true });
  }

  createCombatant({ side, name, role, passive, face, maxFace, deckIds }) {
    return {
      side,
      name,
      role,
      passive,
      maxFace,
      face,
      baseMomentum: 3,
      momentum: 0,
      tilt: 0,
      maxTilt: 10,
      block: 0,
      drawPile: deckIds.map((cardId) => this.createCardInstance(cardId)),
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
      firstComposureShieldAvailable: side === "player",
    };
  }

  createCardInstance(cardId) {
    const definition = CARD_LIBRARY[cardId];
    return {
      uid: `${cardId}-${this.uidCounter++}`,
      cardId: definition.id,
    };
  }

  prepareTurn(side, { opening = false } = {}) {
    const battle = this.state.battle;
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
    defender.tookTiltThisTurn = false;
    actor.block = 0;
    actor.momentum =
      actor.baseMomentum +
      (actor.side === "player" && actor.face <= 10 ? 1 : 0);
    actor.responseCharge = 0;
    actor.responseUsed = false;
    defender.responseCharge = 1;
    defender.responseUsed = false;
    battle.pendingAction = null;

    if (!opening) {
      const bonusDraws = battle.battlefield.id === "group-chat" ? 1 : 0;
      this.drawCards(actor, 2 + bonusDraws);
    }

    const sideLabel = side === "player" ? "你的" : `${actor.name}的`;
    this.log(`${sideLabel}回合开始，气势重置为 ${actor.momentum}。`);
    this.state.phase = side === "player" ? "player-turn" : "enemy-turn";
  }

  getCombatant(side) {
    return this.state.battle[side];
  }

  getOpponent(side) {
    return this.state.battle[side === "player" ? "enemy" : "player"];
  }

  drawCards(character, count) {
    for (let drawIndex = 0; drawIndex < count; drawIndex += 1) {
      if (character.drawPile.length === 0) {
        if (character.discard.length === 0) {
          return;
        }
        character.drawPile = character.discard.splice(0);
        this.shuffleInPlace(character.drawPile);
      }
      const card = character.drawPile.pop();
      if (card) {
        character.hand.push(card);
      }
    }
  }

  shuffleInPlace(list) {
    for (let index = list.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.rng() * (index + 1));
      [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
    }
  }

  endPlayerTurn() {
    if (this.state.phase !== "player-turn") {
      return false;
    }
    this.finishTurn("player");
    return true;
  }

  finishTurn(side) {
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
    } else {
      this.prepareTurn("player");
    }
  }

  tickStatuses(character) {
    const nextStatuses = {};
    Object.entries(character.statuses).forEach(([statusId, duration]) => {
      if (duration > 1) {
        nextStatuses[statusId] = duration - 1;
      }
    });
    character.statuses = nextStatuses;
  }

  restoreLastWordIfNeeded() {
    ["player", "enemy"].forEach((side) => {
      const target = this.getCombatant(side);
      if (target.face <= 0 && this.hasStatus(target, "lastWord")) {
        target.face = 1;
        delete target.statuses.lastWord;
        this.log(`${target.name}靠【还没结束】硬抬回了 1 点体面。`);
      }
    });
  }

  playerPlayCard(cardUid) {
    if (this.state.phase !== "player-turn") {
      return false;
    }
    return this.playCard("player", cardUid);
  }

  playCard(side, cardUid, forcedMode = null) {
    const actor = this.getCombatant(side);
    const mode = forcedMode || (this.state.phase === "response-window" ? "response" : "normal");
    const instance = actor.hand.find((card) => card.uid === cardUid);
    if (!instance) {
      return false;
    }
    const definition = CARD_LIBRARY[instance.cardId];
    if (!this.isCardPlayable(actor, definition, mode)) {
      return false;
    }

    const cost = this.getCardCost(actor, definition);
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

    const target = mode === "response" ? null : this.getOpponent(side);
    const pending =
      mode === "response"
        ? this.state.battle.pendingAction
        : this.createPendingAction(actor, target, definition);

    if (mode === "response") {
      this.log(`${actor.name}回应【${definition.name}】。`);
      this.applyResponseCard(definition, actor, pending);
      this.state.phase = pending.actorSide === "enemy" ? "enemy-turn" : "player-turn";
      this.resolvePendingAction();
      return true;
    }

    this.log(`${actor.name}打出【${definition.name}】。`);
    this.state.battle.pendingAction = pending;

    if (side === "player") {
      const enemyResponse = this.chooseEnemyResponse(pending);
      if (enemyResponse) {
        this.playCard("enemy", enemyResponse.uid, "response");
        return true;
      }
      this.resolvePendingAction();
      return true;
    }

    if (this.getAvailableResponses("player").length > 0) {
      this.state.phase = "response-window";
      return true;
    }

    this.resolvePendingAction();
    return true;
  }

  createPendingAction(actor, target, card) {
    const pending = {
      actorSide: actor.side,
      targetSide: target.side,
      cardId: card.id,
      card,
      cancel: false,
      cancelBonus: false,
      reduceFaceDamageRemaining: 0,
      convertFaceToOpinion: 0,
      convertFaceToOpinionBy: null,
      convertFaceToOpinionApplied: false,
      convertFaceToTilt: false,
      cancelRedirect: false,
      bonusPotential: this.cardHasBonusPotential(card),
      convertArgumentToOpinion: false,
      injectedOpinionBonus: actor.nextCardOpinionBonus || 0,
    };

    if (actor.nextArgumentToOpinion && card.type === "Argument") {
      pending.convertArgumentToOpinion = true;
      actor.nextArgumentToOpinion = false;
    }
    actor.nextCardOpinionBonus = 0;
    return pending;
  }

  cardHasBonusPotential(card) {
    return card.effects.some((effect) =>
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
      ].includes(effect.id),
    );
  }

  registerCardPlay(actor, card) {
    if (this.hasStatus(actor, "doubleStandard") && actor.lastCardType === card.type) {
      this.shiftOpinionAgainst(actor, 1, `${actor.name}在【双标】下连续打出同类牌`);
    }

    if (this.hasStatus(actor, "urgent") && ["Argument", "Finisher"].includes(card.type)) {
      this.adjustTilt(actor, 1, `${actor.name}在【急了】状态下情绪继续上头`);
    }

    actor.lastCardType = card.type;
    actor.playedTypeCounts[card.type] = (actor.playedTypeCounts[card.type] || 0) + 1;
  }

  isCardPlayable(actor, card, mode) {
    const cost = this.getCardCost(actor, card);
    if (mode === "normal") {
      if (card.context === "response") {
        return false;
      }
      return actor.momentum >= cost;
    }

    if (card.context !== "response") {
      return false;
    }
    if (this.hasStatus(actor, "speechless")) {
      return false;
    }
    if (actor.responseUsed || actor.responseCharge < cost) {
      return false;
    }
    return this.isResponseRelevant(card, actor, this.state.battle.pendingAction);
  }

  getCardCost(actor, card) {
    let cost = card.cost;
    if (
      this.state.battle.battlefield.id === "comment-zone" &&
      card.keywords.includes("response")
    ) {
      cost -= 1;
    }
    return Math.max(0, cost);
  }

  getAvailableResponses(side) {
    const actor = this.getCombatant(side);
    return actor.hand
      .map((instance) => ({
        ...instance,
        definition: CARD_LIBRARY[instance.cardId],
      }))
      .filter(({ definition }) => this.isCardPlayable(actor, definition, "response"));
  }

  isResponseRelevant(card, actor, pending) {
    if (!pending) {
      return false;
    }
    const actorOpinionBehind = this.relativeOpinion(pending.actorSide) < 0;
    const actorPlayedThesis = (this.getCombatant(pending.actorSide).playedTypeCounts.Thesis || 0) > 0;
    const targetsResponder = pending.targetSide === actor.side;
    const hasFaceDamage = this.pendingHasFaceDamage(pending.card);
    const hasRedirect = pending.card.keywords.includes("redirect");

    switch (card.id) {
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

  chooseEnemyResponse(pending) {
    const enemyOptions = this.getAvailableResponses("enemy");
    if (enemyOptions.length === 0) {
      return null;
    }

    const scored = enemyOptions
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

  scoreResponseCard(card, pending, side) {
    const targetsResponder = pending.targetSide === side;
    const hasFaceDamage = this.pendingHasFaceDamage(pending.card);
    const actorOpinionBehind = this.relativeOpinion(pending.actorSide) < 0;
    const actorPlayedThesis =
      (this.getCombatant(pending.actorSide).playedTypeCounts.Thesis || 0) > 0;

    switch (card.id) {
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

  pendingHasFaceDamage(card) {
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
      ].includes(effect.id),
    );
  }

  applyResponseCard(card, actor, pending) {
    card.effects.forEach((effect) => {
      switch (effect.id) {
        case "reducePendingFace":
          pending.reduceFaceDamageRemaining += effect.value;
          break;
        case "cancelPendingBonus":
          pending.cancelBonus = true;
          break;
        case "counterPending":
          pending.cancel = true;
          break;
        case "opinionIfPendingCostAtLeast":
          if (pending.card.cost >= effect.threshold) {
            this.shiftOpinion(actor, effect.value, `${card.name}带来的舆论反扑`);
          }
          break;
        case "convertPendingFaceToOpinion":
          pending.convertFaceToOpinion = effect.value;
          pending.convertFaceToOpinionBy = actor.side;
          break;
        case "tiltIfActorOpinionBehind":
          if (this.relativeOpinion(pending.actorSide) < 0) {
            this.adjustTilt(
              this.getCombatant(pending.actorSide),
              effect.value,
              `${card.name}让对手舆情反噬`,
            );
          }
          break;
        case "tiltIfPendingActorPlayedTypeThisTurn":
          if (
            (this.getCombatant(pending.actorSide).playedTypeCounts[effect.type] || 0) > 0
          ) {
            this.adjustTilt(
              this.getCombatant(pending.actorSide),
              effect.value,
              `${card.name}指出了对手的套路`,
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

  resolvePendingAction() {
    const pending = this.state.battle.pendingAction;
    if (!pending) {
      return;
    }

    const actor = this.getCombatant(pending.actorSide);
    const target = this.getCombatant(pending.targetSide);
    const { card } = pending;

    if (pending.cancel) {
      this.log(`【${card.name}】被直接掐掉了。`);
      this.state.battle.pendingAction = null;
      this.resolveBattleOutcome();
      return;
    }

    if (pending.cancelRedirect && card.keywords.includes("redirect")) {
      this.log(`【${card.name}】的转进结算被取消。`);
      this.state.battle.pendingAction = null;
      this.resolveBattleOutcome();
      return;
    }

    card.effects.forEach((effect) => {
      this.executeEffect(effect, { actor, target, card, pending });
    });

    if (pending.injectedOpinionBonus > 0) {
      this.shiftOpinion(
        actor,
        pending.injectedOpinionBonus,
        `${card.name}借【我们讨论的是】追加了节奏`,
        true,
      );
    }

    this.state.battle.pendingAction = null;
    this.resolveBattleOutcome();
  }

  executeEffect(effect, context) {
    const { actor, target, card, pending } = context;
    switch (effect.id) {
      case "applyStatus":
        this.applyStatus(
          effect.target === "self" ? actor : target,
          effect.status,
          effect.duration,
        );
        break;
      case "tilt":
        this.adjustTilt(effect.target === "self" ? actor : target, effect.value, card.name);
        break;
      case "dealFace":
        this.applyFaceEffect(effect.value, context);
        break;
      case "opinionIfSelfHasStatus":
        if (this.hasStatus(actor, effect.status) && !pending.cancelBonus) {
          this.shiftOpinion(actor, effect.value, `${card.name}借势推进舆论`, false, card);
        }
        break;
      case "gainMomentum":
        this.gainMomentum(actor, effect.value);
        break;
      case "draw":
        this.drawCards(actor, effect.value);
        break;
      case "gainBlock":
        this.gainBlock(actor, effect.value, card);
        break;
      case "reduceTilt":
        this.adjustTilt(actor, -effect.value, card.name);
        break;
      case "setNextArgumentToOpinion":
        actor.nextArgumentToOpinion = true;
        break;
      case "dealFaceIfTargetHasStatus":
        this.applyFaceEffect(
          effect.base +
            (!pending.cancelBonus && this.targetHasAnyStatus(target) ? effect.bonus : 0),
          context,
        );
        break;
      case "drawIfLeading":
        if (!pending.cancelBonus && this.relativeOpinion(actor.side) > 0) {
          this.drawCards(actor, effect.value);
        }
        break;
      case "dealFaceIfOpinionAtLeast":
        this.applyFaceEffect(
          effect.base +
            (!pending.cancelBonus &&
            this.relativeOpinion(actor.side) >= effect.threshold
              ? effect.bonus
              : 0),
          context,
        );
        break;
      case "gainOpinion":
        this.shiftOpinion(actor, effect.value, card.name, false, card);
        break;
      case "dealFaceByPositiveOpinion": {
        const positive = Math.max(0, this.relativeOpinion(actor.side));
        const damage = Math.min(effect.cap, positive * effect.per);
        this.applyFaceEffect(damage, context);
        break;
      }
      case "dealFaceIfTargetTiltAtLeast":
        this.applyFaceEffect(
          effect.base +
            (!pending.cancelBonus && target.tilt >= effect.threshold ? effect.bonus : 0),
          context,
        );
        break;
      case "dealFaceIfTargetTookTiltThisTurn":
        if (!pending.cancelBonus && target.tookTiltThisTurn) {
          this.applyFaceEffect(effect.value, context);
        }
        break;
      case "forcedComposureIfTiltAtLeast":
        if (target.tilt >= effect.threshold) {
          this.triggerComposure(target, `${card.name}强行把对手打到失态`, true);
        }
        break;
      case "setNextCardOpinionBonus":
        actor.nextCardOpinionBonus += effect.value;
        break;
      case "replaceTargetStatus":
        this.replaceTargetStatus(target, card.name);
        break;
      case "removeEnemyBuff":
        this.removeEnemyBuff(target);
        break;
      case "flipOpinion":
        this.state.battle.opinion = clamp(-(this.state.battle.opinion || 0), -7, 7);
        this.log(`${card.name}让全场舆论方向反过来了。`);
        break;
      case "gainMomentumAndDrawIfFaceAtMost":
        if (!pending.cancelBonus && actor.face <= effect.threshold) {
          this.gainMomentum(actor, effect.momentum);
          this.drawCards(actor, effect.draws);
        }
        break;
      case "dealFaceIfFaceAtMost":
        this.applyFaceEffect(
          effect.base +
            (!pending.cancelBonus && actor.face <= effect.threshold ? effect.bonus : 0),
          context,
        );
        break;
      case "dealFaceWithLostFaceBonus": {
        const bonus = pending.cancelBonus
          ? 0
          : Math.min(effect.cap, Math.floor((actor.maxFace - actor.face) / effect.divisor));
        this.applyFaceEffect(effect.base + bonus, context);
        break;
      }
      case "preventDefeat":
        this.applyStatus(actor, "lastWord", effect.duration);
        break;
      default:
        break;
    }
  }

  applyStatus(target, statusId, duration) {
    const activeSide = this.state.battle.activeSide;
    const adjustedDuration = duration + (target.side === activeSide ? 1 : 0);
    target.statuses[statusId] = Math.max(target.statuses[statusId] || 0, adjustedDuration);
    const status = STATUS_META[statusId];
    if (status) {
      this.log(`${target.name}获得【${status.name}】。`);
    }
  }

  removeEnemyBuff(target) {
    const currentBuff = POSITIVE_STATUS_POOL.find((statusId) => this.hasStatus(target, statusId));
    if (!currentBuff) {
      this.log(`${target.name}没什么增益可拆。`);
      return;
    }
    delete target.statuses[currentBuff];
    this.log(`${target.name}失去了【${STATUS_META[currentBuff].name}】。`);
  }

  replaceTargetStatus(target, source) {
    const current = Object.keys(target.statuses).find((statusId) => statusId !== "lastWord");
    if (!current) {
      this.log(`${source}想偷换概念，但目标身上没状态可换。`);
      return;
    }
    delete target.statuses[current];
    const replacement = sample(this.rng, NEGATIVE_STATUS_POOL);
    this.applyStatus(target, replacement, 1);
    this.log(`${source}把【${STATUS_META[current]?.name || current}】换成了【${STATUS_META[replacement].name}】。`);
  }

  applyFaceEffect(amount, context) {
    const { actor, target, card, pending } = context;
    if (amount <= 0) {
      return;
    }

    let adjusted = amount;
    if (
      this.hasStatus(actor, "stubborn") &&
      actor.face <= 10 &&
      ["Argument", "Finisher"].includes(card.type)
    ) {
      adjusted += 2;
    }

    if (pending.convertArgumentToOpinion && card.type === "Argument") {
      this.shiftOpinion(actor, adjusted, `${card.name}把伤害转成了舆论`, true);
      return;
    }

    if (pending.convertFaceToOpinion > 0 && target.side === pending.targetSide) {
      if (!pending.convertFaceToOpinionApplied) {
        const responder = this.getCombatant(pending.convertFaceToOpinionBy);
        this.shiftOpinion(
          responder,
          pending.convertFaceToOpinion,
          `${card.name}被转进成了舆论波动`,
          true,
        );
        pending.convertFaceToOpinionApplied = true;
      }
      return;
    }

    if (pending.convertFaceToTilt && target.side === pending.targetSide) {
      this.adjustTilt(target, adjusted, `${card.name}把体面伤害改成了破防`);
      return;
    }

    if (pending.reduceFaceDamageRemaining > 0) {
      const reduced = Math.min(adjusted, pending.reduceFaceDamageRemaining);
      adjusted -= reduced;
      pending.reduceFaceDamageRemaining -= reduced;
    }

    if (adjusted <= 0) {
      this.log(`${card.name}的体面伤害被彻底吃掉了。`);
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
    this.log(`${card.name}对${target.name}造成 ${adjusted} 点体面伤害。`);
  }

  gainMomentum(actor, amount) {
    actor.momentum = clamp(actor.momentum + amount, 0, 10);
    this.log(`${actor.name}获得 ${amount} 点气势。`);
  }

  gainBlock(actor, amount, card) {
    const weakened =
      this.hasStatus(actor, "urgent") && card.type === "Counter" ? 1 : 0;
    const finalAmount = Math.max(0, amount - weakened);
    actor.block += finalAmount;
    this.log(`${actor.name}获得 ${finalAmount} 点格挡。`);
  }

  adjustTilt(target, amount, reason) {
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
    } else {
      this.log(`${reason}让${target.name}回复 ${Math.abs(amount)} 点情绪。`);
    }
  }

  triggerComposure(target, reason, forced = false) {
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
    const extra = this.state.battle.battlefield.id === "group-chat" ? 1 : 0;
    this.shiftOpinionAgainst(target, 2 + extra, `${target.name}失态后场面更加失控`);
  }

  shiftOpinion(actor, amount, reason, asMomentumShift = false, card = null) {
    if (amount === 0) {
      return;
    }

    let finalAmount = amount;
    const appliesMomentumShift =
      asMomentumShift || (card && card.keywords.includes("momentumShift"));

    if (appliesMomentumShift && this.hasStatus(actor, "mainNarrative")) {
      finalAmount += 1;
    }
    if (appliesMomentumShift && this.state.battle.battlefield.id === "comment-zone") {
      finalAmount += 1;
    }

    if (actor.side === "player") {
      this.state.battle.opinion = clamp((this.state.battle.opinion || 0) + finalAmount, -7, 7);
    } else {
      this.state.battle.opinion = clamp((this.state.battle.opinion || 0) - finalAmount, -7, 7);
    }
    this.log(`${reason}，舆论 ${finalAmount > 0 ? "+" : ""}${finalAmount}。`);
  }

  shiftOpinionAgainst(target, amount, reason) {
    const source = target.side === "player" ? this.getCombatant("enemy") : this.getCombatant("player");
    this.shiftOpinion(source, amount, reason);
  }

  relativeOpinion(side) {
    const opinion = this.state.battle.opinion || 0;
    return side === "player" ? opinion : -opinion;
  }

  targetHasAnyStatus(target) {
    return Object.keys(target.statuses).some((statusId) => statusId !== "lastWord");
  }

  hasStatus(target, statusId) {
    return (target.statuses[statusId] || 0) > 0;
  }

  resolveBattleOutcome() {
    const battle = this.state.battle;
    if (!battle) {
      return false;
    }

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

    this.state.rewardOptions = sampleMany(this.rng, REWARD_POOL, 3);
    this.state.phase = "reward";
    this.log("战斗结束，你恢复 5 点体面并选择 1 张新牌加入牌组。");
    return true;
  }

  chooseReward(cardId) {
    if (this.state.phase !== "reward") {
      return false;
    }
    this.state.run.playerDeckIds.push(cardId);
    this.state.run.encounterIndex += 1;
    this.startBattle(this.state.run.encounterIndex);
    return true;
  }

  enemyTakeStep() {
    if (this.state.phase !== "enemy-turn") {
      return false;
    }
    const enemy = this.getCombatant("enemy");
    const playable = enemy.hand
      .filter((instance) => {
        const definition = CARD_LIBRARY[instance.cardId];
        return this.isCardPlayable(enemy, definition, "normal");
      })
      .map((instance) => ({
        ...instance,
        definition: CARD_LIBRARY[instance.cardId],
      }));

    if (enemy.turnCardsPlayed >= 3 || playable.length === 0) {
      this.finishTurn("enemy");
      return true;
    }

    const choice = playable
      .map((instance) => ({
        instance,
        score: this.scoreEnemyCard(instance.definition),
      }))
      .sort((left, right) => right.score - left.score)[0];

    this.playCard("enemy", choice.instance.uid);
    return true;
  }

  scoreEnemyCard(card) {
    const enemy = this.getCombatant("enemy");
    const player = this.getCombatant("player");
    const behavior = this.state.battle.encounter.behavior;

    let score = 1 + card.cost * 0.35;

    const behaviorWeights = {
      counter: {
        Counter: 2.1,
        Redirect: 1.8,
        Argument: 1.3,
        Thesis: 1.1,
        Label: 1.0,
        Finisher: 1.2,
      },
      opinion: {
        Thesis: 2.0,
        Argument: 1.7,
        Finisher: 1.5,
        Redirect: 1.0,
        Counter: 0.8,
        Label: 0.9,
      },
      tilt: {
        Label: 2.2,
        Argument: 1.8,
        Finisher: 1.6,
        Redirect: 1.0,
        Counter: 0.8,
        Thesis: 0.9,
      },
      boss: {
        Finisher: 2.3,
        Argument: 1.8,
        Label: 1.3,
        Counter: 1.0,
        Redirect: 1.2,
        Thesis: 1.1,
      },
    };

    score *= behaviorWeights[behavior][card.type] || 1;

    if (card.keywords.includes("momentumShift") && this.relativeOpinion("enemy") < 2) {
      score += 2;
    }
    if (this.hasStatus(enemy, "mainNarrative") && card.keywords.includes("momentumShift")) {
      score += 1;
    }
    if (player.tilt >= 7 && card.id === "cant-hold") {
      score += 7;
    }
    if (player.tilt >= 5 && card.id === "break-check") {
      score += 4;
    }
    if (player.tookTiltThisTurn && card.id === "keep-hitting") {
      score += 4;
    }
    if (enemy.face <= 10 && ["not-lost", "force-explain", "headwind-output"].includes(card.id)) {
      score += 4;
    }
    if (enemy.face <= 8 && card.id === "win-hard") {
      score += 8;
    }
    if (card.id === "everyone-knows" && this.relativeOpinion("enemy") >= 3) {
      score += 4;
    }
    if (card.id === "group-consensus" && this.relativeOpinion("enemy") >= 2) {
      score += 3;
    }
    if (card.id === "burst-point") {
      score += Math.max(-2, this.relativeOpinion("enemy"));
    }
    if (card.id === "main-narrative" && !this.hasStatus(enemy, "mainNarrative")) {
      score += 2;
    }
    if (card.id === "topic-swap" && this.relativeOpinion("enemy") <= -2) {
      score += 5;
    }
    if (card.id === "redefine" && (this.hasStatus(player, "mainNarrative") || this.hasStatus(player, "stubborn"))) {
      score += 4;
    }
    if (card.id === "shift-meaning" && this.targetHasAnyStatus(player)) {
      score += 3;
    }
    if (card.id === "not-over" && enemy.face <= 10 && !this.hasStatus(enemy, "lastWord")) {
      score += 4;
    }
    if (card.id === "classic-redirect" && enemy.hand.some((instance) => CARD_LIBRARY[instance.cardId].type === "Argument")) {
      score += 2;
    }
    if (card.id === "we-are-discussing" && enemy.hand.some((instance) => ["Argument", "Finisher"].includes(CARD_LIBRARY[instance.cardId].type))) {
      score += 2;
    }

    return score;
  }

  skipResponse() {
    if (this.state.phase !== "response-window") {
      return false;
    }
    this.log("你选择先不接这波。");
    this.state.phase = "enemy-turn";
    this.resolvePendingAction();
    return true;
  }

  log(message) {
    this.state.log.unshift({
      id: `log-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      message,
    });
    this.state.log = this.state.log.slice(0, 14);
  }
}
