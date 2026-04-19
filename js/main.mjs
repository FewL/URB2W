import {
  CARD_LIBRARY,
  CARD_TYPES,
  KEYWORD_LABELS,
  STATUS_META,
  ENCOUNTERS,
} from "./data.mjs";
import { WinGame } from "./game.mjs";

const makeSeed = () => `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const game = new WinGame(makeSeed());

const elements = {
  newRunButton: document.querySelector("#new-run-btn"),
  endTurnButton: document.querySelector("#end-turn-btn"),
  phaseChip: document.querySelector("#phase-chip"),
  battlefieldChip: document.querySelector("#battlefield-chip"),
  encounterChip: document.querySelector("#encounter-chip"),
  opinionValue: document.querySelector("#opinion-value"),
  opinionTrack: document.querySelector("#opinion-track"),
  battleLog: document.querySelector("#battle-log"),
  playerPanel: document.querySelector("#player-panel"),
  enemyPanel: document.querySelector("#enemy-panel"),
  hand: document.querySelector("#hand"),
  handNote: document.querySelector("#hand-note"),
  runPath: document.querySelector("#run-path"),
  rulesPanel: document.querySelector("#rules-panel"),
  rewardPanel: document.querySelector("#reward-panel"),
  rewardOptions: document.querySelector("#reward-options"),
  seedNote: document.querySelector("#seed-note"),
  deckNote: document.querySelector("#deck-note"),
  deckPreview: document.querySelector("#deck-preview"),
  combatantTemplate: document.querySelector("#combatant-template"),
};

let enemyTimer = null;

const phaseText = {
  "player-turn": "你的回合",
  "enemy-turn": "对手回合",
  "response-window": "回应窗口",
  reward: "战后选牌",
  "run-victory": "通关",
  "run-defeat": "败局",
  booting: "初始化中",
};

function render() {
  const state = game.getState();
  const battle = state.battle;
  const player = battle.player;
  const enemy = battle.enemy;

  elements.phaseChip.textContent = `${phaseText[state.phase] || state.phase} / 第 ${battle.turnNumber} 手`;
  elements.battlefieldChip.textContent = `场地：${battle.battlefield.name}`;
  elements.encounterChip.textContent = `对手：${battle.encounter.name}`;
  elements.opinionValue.textContent = `${battle.opinion >= 0 ? "+" : ""}${battle.opinion}`;
  elements.seedNote.textContent = `Seed ${state.seed}`;
  elements.deckNote.textContent = `${state.run.playerDeckIds.length} 张`;

  renderOpinionTrack(battle.opinion);
  renderCombatant(elements.playerPanel, player);
  renderCombatant(elements.enemyPanel, enemy);
  renderBattleLog(state.log);
  renderHand(state);
  renderRunPath(state);
  renderRules(state);
  renderRewards(state);
  renderDeckPreview(state.run.playerDeckIds);

  const playerCanEnd = state.phase === "player-turn";
  const responseCanSkip = state.phase === "response-window";
  elements.endTurnButton.disabled = !(playerCanEnd || responseCanSkip);
  elements.endTurnButton.textContent = responseCanSkip ? "不回应" : "结束回合";

  clearTimeout(enemyTimer);
  if (state.phase === "enemy-turn") {
    enemyTimer = window.setTimeout(() => {
      game.enemyTakeStep();
      render();
    }, 850);
  }
}

function renderOpinionTrack(opinion) {
  const labels = [];
  for (let value = -7; value <= 7; value += 1) {
    const cell = document.createElement("div");
    cell.className = "opinion-cell";
    if (value < 0) {
      cell.classList.add("enemy");
    }
    if (value === opinion) {
      cell.classList.add("active");
    }
    cell.textContent = value;
    labels.push(cell);
  }
  elements.opinionTrack.replaceChildren(...labels);
}

function renderCombatant(container, combatant) {
  const fragment = elements.combatantTemplate.content.cloneNode(true);
  fragment.querySelector(".combatant-name").textContent = combatant.name;
  fragment.querySelector(".combatant-role").textContent = `${combatant.role} · ${combatant.passive}`;
  fragment.querySelector(".face-pill").textContent = `体面 ${combatant.face}/${combatant.maxFace}`;
  fragment.querySelector(".momentum-pill").textContent = `气势 ${combatant.momentum}`;
  fragment.querySelector(".face-value").textContent = `${combatant.face}/${combatant.maxFace}`;
  fragment.querySelector(".momentum-value").textContent = combatant.momentum;
  fragment.querySelector(".tilt-value").textContent = `${combatant.tilt}/${combatant.maxTilt}`;
  fragment.querySelector(".block-value").textContent = combatant.block;
  fragment.querySelector(".draw-pile").textContent = `抽牌堆 ${combatant.drawPile.length}`;
  fragment.querySelector(".discard-pile").textContent = `弃牌堆 ${combatant.discard.length}`;
  fragment.querySelector(".response-pool").textContent = `应对气势 ${combatant.responseCharge}`;

  const strip = fragment.querySelector(".status-strip");
  const statuses = Object.entries(combatant.statuses);
  if (statuses.length === 0) {
    const empty = document.createElement("span");
    empty.className = "status-pill muted";
    empty.textContent = "暂无状态";
    strip.append(empty);
  } else {
    statuses.forEach(([statusId, duration]) => {
      const meta = STATUS_META[statusId];
      const pill = document.createElement("span");
      pill.className = `status-pill ${meta?.tone || "neutral"}`;
      pill.textContent = `${meta?.name || statusId} ${duration}`;
      pill.title = meta?.description || statusId;
      strip.append(pill);
    });
  }

  container.replaceChildren(fragment);
}

function renderBattleLog(logs) {
  const items = logs.map((entry) => {
    const line = document.createElement("div");
    line.className = "log-line";
    line.textContent = entry.message;
    return line;
  });
  elements.battleLog.replaceChildren(...items);
}

function renderHand(state) {
  const battle = state.battle;
  const player = battle.player;
  const responseMode = state.phase === "response-window";

  const cards = player.hand
    .map((instance) => ({
      ...instance,
      definition: CARD_LIBRARY[instance.cardId],
    }))
    .filter(({ definition }) => (responseMode ? definition.context === "response" : true))
    .map((instance) => renderCardButton(instance, state));

  if (cards.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      state.phase === "response-window" ? "没有能接的回应牌。" : "手里已经打空了。";
    elements.hand.replaceChildren(empty);
  } else {
    elements.hand.replaceChildren(...cards);
  }

  if (state.phase === "player-turn") {
    elements.handNote.textContent = `你有 ${player.momentum} 点气势，可以继续压节奏。`;
  } else if (state.phase === "response-window") {
    elements.handNote.textContent = `敌方【${battle.pendingAction.card.name}】正在结算，选 1 张回应或跳过。`;
  } else if (state.phase === "reward") {
    elements.handNote.textContent = "战斗结束，去右侧拿一张新牌。";
  } else if (state.phase === "run-victory") {
    elements.handNote.textContent = "整条线已经被你打穿了。";
  } else if (state.phase === "run-defeat") {
    elements.handNote.textContent = "这次被打穿了，开新局继续。";
  } else {
    elements.handNote.textContent = "对手正在行动。";
  }
}

function renderCardButton(instance, state) {
  const { definition } = instance;
  const button = document.createElement("button");
  const battle = state.battle;
  const actor = battle.player;
  const inResponse = state.phase === "response-window";
  const playable = game.isCardPlayable(actor, definition, inResponse ? "response" : "normal");

  button.className = `card-button type-${definition.type.toLowerCase()}`;
  if (!playable) {
    button.disabled = true;
  }

  const keywords = definition.keywords
    .map((keyword) => KEYWORD_LABELS[keyword])
    .filter(Boolean)
    .join(" / ");

  button.innerHTML = `
    <div class="card-topline">
      <span class="card-cost">${game.getCardCost(actor, definition)}</span>
      <span class="card-type">${CARD_TYPES[definition.type]}</span>
    </div>
    <h3>${definition.name}</h3>
    <p class="card-desc">${definition.description}</p>
    <div class="card-foot">
      <span>${keywords || "无关键词"}</span>
    </div>
  `;

  button.addEventListener("click", () => {
    if (inResponse) {
      game.playCard("player", instance.uid);
    } else {
      game.playerPlayCard(instance.uid);
    }
    render();
  });

  return button;
}

function renderRunPath(state) {
  const nodes = ENCOUNTERS.map((encounter, index) => {
    const node = document.createElement("div");
    node.className = "path-node";
    if (state.run.cleared.includes(encounter.id)) {
      node.classList.add("cleared");
    } else if (index === state.run.encounterIndex) {
      node.classList.add("active");
    }

    const title = document.createElement("strong");
    title.textContent = encounter.name;
    const detail = document.createElement("span");
    detail.textContent = encounter.role;
    node.append(title, detail);
    return node;
  });
  elements.runPath.replaceChildren(...nodes);
}

function renderRules(state) {
  const lines = [
    ...state.battle.battlefield.rules.map((rule) => `场地：${rule}`),
    ...state.demoNotes.map((note) => `Demo：${note}`),
  ].map((text) => {
    const line = document.createElement("div");
    line.className = "rule-line";
    line.textContent = text;
    return line;
  });
  elements.rulesPanel.replaceChildren(...lines);
}

function renderRewards(state) {
  if (state.phase !== "reward") {
    elements.rewardPanel.classList.add("hidden");
    elements.rewardOptions.replaceChildren();
    return;
  }

  elements.rewardPanel.classList.remove("hidden");
  const cards = state.rewardOptions.map((cardId) => {
    const definition = CARD_LIBRARY[cardId];
    const button = document.createElement("button");
    button.className = `card-button reward-choice type-${definition.type.toLowerCase()}`;
    button.innerHTML = `
      <div class="card-topline">
        <span class="card-cost">${definition.cost}</span>
        <span class="card-type">${CARD_TYPES[definition.type]}</span>
      </div>
      <h3>${definition.name}</h3>
      <p class="card-desc">${definition.description}</p>
    `;
    button.addEventListener("click", () => {
      game.chooseReward(cardId);
      render();
    });
    return button;
  });
  elements.rewardOptions.replaceChildren(...cards);
}

function renderDeckPreview(deckIds) {
  const counts = deckIds.reduce((accumulator, cardId) => {
    accumulator[cardId] = (accumulator[cardId] || 0) + 1;
    return accumulator;
  }, {});

  const rows = Object.entries(counts)
    .sort((left, right) => {
      const leftName = CARD_LIBRARY[left[0]].name;
      const rightName = CARD_LIBRARY[right[0]].name;
      return leftName.localeCompare(rightName, "zh-Hans-CN");
    })
    .map(([cardId, count]) => {
      const row = document.createElement("div");
      row.className = "deck-row-item";
      row.innerHTML = `<span>${CARD_LIBRARY[cardId].name}</span><strong>x${count}</strong>`;
      return row;
    });

  elements.deckPreview.replaceChildren(...rows);
}

elements.newRunButton.addEventListener("click", () => {
  game.reset(makeSeed());
  render();
});

elements.endTurnButton.addEventListener("click", () => {
  if (game.getState().phase === "response-window") {
    game.skipResponse();
  } else {
    game.endPlayerTurn();
  }
  render();
});

render();
