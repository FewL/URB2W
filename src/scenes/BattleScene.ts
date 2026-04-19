import * as Phaser from "phaser";
import { winningAudio } from "../audio/winningAudio";
import { BattleEngine } from "../core/battleEngine";
import type { ActionBeat, CardDefinition, CombatantState, EngineState } from "../core/types";
import { CARD_LIBRARY, CARD_TYPES, ENCOUNTERS, KEYWORD_LABELS, STATUS_META } from "../data/gameData";

type DeltaSnapshot = {
  playerFace: number;
  enemyFace: number;
  playerTilt: number;
  enemyTilt: number;
  opinion: number;
  actionCount: number;
  phase: string;
  logId: string | null;
};

export class BattleScene extends Phaser.Scene {
  private engine = new BattleEngine();
  private root!: Phaser.GameObjects.Container;
  private overlayLayer!: Phaser.GameObjects.Container;
  private phaseBanner!: Phaser.GameObjects.Text;
  private backgroundOrbs: Array<{
    circle: Phaser.GameObjects.Arc;
    baseX: number;
    baseY: number;
    offset: number;
    speed: number;
    amplitudeX: number;
    amplitudeY: number;
  }> = [];
  private enemyTimer: Phaser.Time.TimerEvent | null = null;
  private lastPhase = "";

  constructor() {
    super("battle");
  }

  init(data: { seed?: string }): void {
    this.engine.reset(data.seed ?? `${Date.now()}`);
  }

  create(): void {
    const { width, height } = this.scale;
    winningAudio.startMusic("battle");

    this.cameras.main.setBackgroundColor(0x110d14);
    this.add.rectangle(width / 2, height / 2, width, height, 0x110d14);
    this.add.rectangle(width / 2, height / 2, 1388, 852, 0x18121b, 0.92).setStrokeStyle(2, 0xffffff, 0.08);

    this.backgroundOrbs = [
      { circle: this.add.circle(200, 145, 160, 0xff6b4a, 0.1), baseX: 200, baseY: 145, offset: 0.2, speed: 0.0005, amplitudeX: 26, amplitudeY: 18 },
      { circle: this.add.circle(1260, 170, 140, 0x67d2ff, 0.1), baseX: 1260, baseY: 170, offset: 1.3, speed: 0.00048, amplitudeX: 22, amplitudeY: 20 },
      { circle: this.add.circle(1120, 738, 210, 0xffb56d, 0.06), baseX: 1120, baseY: 738, offset: 2.1, speed: 0.00032, amplitudeX: 28, amplitudeY: 22 },
      { circle: this.add.circle(430, 760, 210, 0xf28fc4, 0.05), baseX: 430, baseY: 760, offset: 3.4, speed: 0.00036, amplitudeX: 32, amplitudeY: 18 },
    ];

    this.add.text(46, 32, "赢了么", {
      fontFamily: "Chivo, sans-serif",
      fontSize: "54px",
      fontStyle: "900",
      color: "#fff2e9",
    });
    this.add.text(48, 84, "PHASER WEBGAME / CARD COMBAT / LIVE RUN", {
      fontFamily: "Chivo, sans-serif",
      fontSize: "18px",
      color: "#ffb77c",
      letterSpacing: 2,
    });

    this.phaseBanner = this.add
      .text(720, 46, "", {
        fontFamily: "Chivo, sans-serif",
        fontSize: "30px",
        fontStyle: "700",
        color: "#fff4ec",
        backgroundColor: "#2a1c20",
        padding: { left: 16, right: 16, top: 8, bottom: 8 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.root = this.add.container(0, 0);
    this.overlayLayer = this.add.container(0, 0);

    this.input.keyboard?.on("keydown-SPACE", () => {
      const phase = this.engine.getSnapshot().phase;
      if (phase === "player-turn") {
        this.performAction(() => {
          this.engine.endPlayerTurn();
        });
      } else if (phase === "response-window") {
        this.performAction(() => {
          this.engine.skipResponse();
        });
      }
    });

    this.renderScene();
    this.scheduleEnemyIfNeeded();
  }

  update(time: number): void {
    this.backgroundOrbs.forEach((orb) => {
      orb.circle.x = orb.baseX + Math.sin(time * orb.speed + orb.offset) * orb.amplitudeX;
      orb.circle.y = orb.baseY + Math.cos(time * orb.speed * 1.3 + orb.offset) * orb.amplitudeY;
    });
  }

  private renderScene(): void {
    this.root.removeAll(true);
    this.overlayLayer.removeAll(true);

    const state = this.engine.getSnapshot();
    const battle = state.battle;
    if (!battle) {
      return;
    }

    this.renderHeader(state);
    this.renderCombatantPanel(48, 116, 952, 158, battle.enemy, "enemy");
    this.renderOpinionStrip(48, 292, 952, 86, battle.opinion, battle.battlefield.name, battle.encounter.name);
    this.renderCombatantPanel(48, 396, 952, 170, battle.player, "player");
    this.renderHandArea(48, 588, 952, 248, state);
    this.renderSidebar(1030, 116, 360, 720, state);
    this.renderTopButtons(state);
    this.renderOverlay(state);

    if (this.lastPhase !== state.phase) {
      this.lastPhase = state.phase;
      this.showPhaseBanner(this.phaseLabel(state.phase));
      if (state.phase === "run-victory" || state.phase === "run-defeat") {
        winningAudio.playOutcome(state.phase === "run-victory");
      } else {
        winningAudio.playPhaseChange(state.phase);
      }
    }
  }

  private renderHeader(state: EngineState): void {
    const battle = state.battle!;
    const labels = [
      `第 ${battle.turnNumber} 手`,
      `场地 ${battle.battlefield.name}`,
      `对手 ${battle.encounter.name}`,
      `Seed ${state.seed}`,
    ];

    labels.forEach((label, index) => {
      const chip = this.makeChip(440 + index * 166, 92, 154, 38, label, 0x261d24, "#f9efe8");
      this.root.add(chip);
    });
  }

  private renderCombatantPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    combatant: CombatantState,
    tone: "player" | "enemy",
  ): void {
    const fill = tone === "player" ? 0x1f1922 : 0x20171b;
    const stroke = tone === "player" ? 0x6fd4ff : 0xff8a63;
    const panel = this.add.rectangle(x + width / 2, y + height / 2, width, height, fill, 0.98);
    panel.setOrigin(0.5).setStrokeStyle(2, stroke, 0.26);
    this.root.add(panel);

    const title = this.add.text(x + 22, y + 18, combatant.name, {
      fontFamily: "Chivo, sans-serif",
      fontSize: "34px",
      fontStyle: "700",
      color: "#fff4ec",
    });
    const subtitle = this.add.text(x + 24, y + 58, `${combatant.role} · ${combatant.passive}`, {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "18px",
      color: "#cfbfb5",
      wordWrap: { width: 630 },
    });
    this.root.add([title, subtitle]);

    const stats = [
      { label: "体面", value: `${combatant.face}/${combatant.maxFace}`, color: "#fff4ec" },
      { label: "气势", value: `${combatant.momentum}`, color: "#ffe5b8" },
      { label: "破防", value: `${combatant.tilt}/${combatant.maxTilt}`, color: "#ffb0a0" },
      { label: "格挡", value: `${combatant.block}`, color: "#9fe2ff" },
    ];

    stats.forEach((stat, index) => {
      const boxX = x + 640 + index * 74;
      const box = this.add.rectangle(boxX, y + 66, 66, 92, 0x2a232d, 0.9).setStrokeStyle(1, 0xffffff, 0.08);
      const label = this.add.text(boxX, y + 40, stat.label, {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "14px",
        color: "#9f9189",
      }).setOrigin(0.5);
      const value = this.add.text(boxX, y + 76, stat.value, {
        fontFamily: "Chivo, sans-serif",
        fontSize: "20px",
        fontStyle: "700",
        color: stat.color,
      }).setOrigin(0.5);
      this.root.add([box, label, value]);
    });

    const deckText = this.add.text(x + 24, y + 116, `抽牌堆 ${combatant.drawPile.length}   弃牌堆 ${combatant.discard.length}   应对气势 ${combatant.responseCharge}`, {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "18px",
      color: "#f2d1c0",
    });
    this.root.add(deckText);

    const statuses = Object.entries(combatant.statuses);
    if (statuses.length === 0) {
      const none = this.makeChip(x + 150, y + height - 24, 156, 30, "暂无状态", 0x261d24, "#948980");
      this.root.add(none);
    } else {
      statuses.forEach(([statusId, duration], index) => {
        const meta = STATUS_META[statusId as keyof typeof STATUS_META];
        const color = meta.tone === "good" ? "#9aeec0" : "#ffaea1";
        const fillColor = meta.tone === "good" ? 0x143126 : 0x351c20;
        const chip = this.makeChip(
          x + 82 + index * 116,
          y + height - 24,
          108,
          30,
          `${meta.name} ${duration}`,
          fillColor,
          color,
        );
        this.root.add(chip);
      });
    }
  }

  private renderOpinionStrip(
    x: number,
    y: number,
    width: number,
    height: number,
    opinion: number,
    battlefieldName: string,
    encounterName: string,
  ): void {
    this.root.add(this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x201926, 0.96).setStrokeStyle(2, 0xffffff, 0.08));
    this.root.add(
      this.add.text(x + 22, y + 12, "舆论轨道", {
        fontFamily: "Chivo, sans-serif",
        fontSize: "20px",
        fontStyle: "700",
        color: "#fff4ec",
      }),
    );
    this.root.add(
      this.add.text(x + width - 22, y + 16, `${battlefieldName} / ${encounterName}`, {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "18px",
        color: "#c8b8ae",
      }).setOrigin(1, 0),
    );

    for (let value = -7; value <= 7; value += 1) {
      const index = value + 7;
      const cellX = x + 26 + index * 60;
      const isActive = value === opinion;
      const fill = value < 0 ? 0x51261f : 0x1b3143;
      const textColor = value < 0 ? "#ffc5b4" : "#b9ecff";
      const cell = this.add
        .rectangle(cellX, y + 58, 52, 32, fill, isActive ? 1 : 0.65)
        .setStrokeStyle(isActive ? 2 : 1, isActive ? 0xffffff : 0xffffff, isActive ? 0.85 : 0.12);
      const text = this.add.text(cellX, y + 58, `${value}`, {
        fontFamily: "Chivo, sans-serif",
        fontSize: "18px",
        fontStyle: isActive ? "700" : "400",
        color: textColor,
      }).setOrigin(0.5);
      this.root.add([cell, text]);
    }
  }

  private renderHandArea(x: number, y: number, width: number, height: number, state: EngineState): void {
    this.root.add(this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x19141d, 0.97).setStrokeStyle(2, 0xffffff, 0.08));
    this.root.add(
      this.add.text(x + 20, y + 18, "手牌", {
        fontFamily: "Chivo, sans-serif",
        fontSize: "28px",
        fontStyle: "700",
        color: "#fff4ec",
      }),
    );

    const helperText = this.phaseHelperText(state);
    this.root.add(
      this.add.text(x + width - 20, y + 22, helperText, {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "18px",
        color: "#d0bfb5",
      }).setOrigin(1, 0),
    );

    const cards = state.battle!.player.hand.map((instance) => ({
      ...instance,
      definition: CARD_LIBRARY[instance.cardId],
    }));
    const cardWidth = 166;
    const cardHeight = 186;
    const visibleCards = cards.length;
    const spacing = visibleCards <= 5 ? 182 : Math.max(134, 880 / Math.max(1, visibleCards - 1));
    const startX = visibleCards === 1 ? x + width / 2 : x + 28 + cardWidth / 2;

    cards.forEach((instance, index) => {
      const playable = this.engine.isCardPlayable(
        state.battle!.player,
        instance.definition,
        state.phase === "response-window" ? "response" : "normal",
      );
      const cardX =
        visibleCards === 1 ? x + width / 2 : startX + index * spacing;
      const cardY = y + 134;
      const card = this.createCardNode(cardX, cardY, cardWidth, cardHeight, instance.definition, playable, state.phase === "response-window");
      if (playable) {
        card.setInteractive(new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);
        card.on("pointerover", () => {
          this.tweens.add({ targets: card, y: cardY - 12, duration: 120 });
        });
        card.on("pointerout", () => {
          this.tweens.add({ targets: card, y: cardY, duration: 120 });
        });
        card.on("pointerdown", () => {
          this.tweens.add({
            targets: card,
            y: cardY - 30,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 120,
            onComplete: () => {
              this.performAction(() => {
                if (state.phase === "response-window") {
                  this.engine.playCard("player", instance.uid, "response");
                } else {
                  this.engine.playPlayerCard(instance.uid);
                }
              });
            },
          });
        });
      }
      this.root.add(card);
    });
  }

  private createCardNode(
    x: number,
    y: number,
    width: number,
    height: number,
    definition: CardDefinition,
    playable: boolean,
    responseMode: boolean,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const tone = this.cardTone(definition.type);
    const bg = this.add
      .rectangle(0, 0, width, height, tone.fill, playable ? 0.98 : 0.42)
      .setStrokeStyle(2, tone.stroke, playable ? 0.85 : 0.16);
    const cost = this.add
      .circle(-width / 2 + 24, -height / 2 + 24, 18, 0x121018, 1)
      .setStrokeStyle(2, tone.stroke, 0.75);
    const costText = this.add.text(-width / 2 + 24, -height / 2 + 24, `${this.engine.getCardCost(definition)}`, {
      fontFamily: "Chivo, sans-serif",
      fontSize: "20px",
      fontStyle: "700",
      color: "#fff3ea",
    }).setOrigin(0.5);
    const typeText = this.add.text(width / 2 - 12, -height / 2 + 14, CARD_TYPES[definition.type], {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "14px",
      color: tone.type,
    }).setOrigin(1, 0);
    const name = this.add.text(-width / 2 + 18, -height / 2 + 48, definition.name, {
      fontFamily: "Chivo, sans-serif",
      fontSize: "24px",
      fontStyle: "700",
      color: playable ? "#fff6ef" : "#b4a39a",
      wordWrap: { width: width - 36 },
    });
    const desc = this.add.text(-width / 2 + 18, -height / 2 + 92, definition.description, {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "14px",
      color: playable ? "#d9cbc2" : "#867a74",
      wordWrap: { width: width - 36 },
      lineSpacing: 4,
    });
    const keywords = definition.keywords
      .map((keyword) => KEYWORD_LABELS[keyword])
      .filter(Boolean)
      .join(" / ");
    const foot = this.add.text(-width / 2 + 18, height / 2 - 28, keywords || (responseMode ? "不可回应" : "无关键词"), {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "14px",
      color: tone.type,
    });
    container.add([bg, cost, costText, typeText, name, desc, foot]);
    return container;
  }

  private renderSidebar(x: number, y: number, width: number, height: number, state: EngineState): void {
    this.root.add(this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x18121a, 0.98).setStrokeStyle(2, 0xffffff, 0.08));

    this.root.add(
      this.add.text(x + 22, y + 18, "路线", {
        fontFamily: "Chivo, sans-serif",
        fontSize: "26px",
        fontStyle: "700",
        color: "#fff4ec",
      }),
    );
    ENCOUNTERS.forEach((encounter, index) => {
      const nodeY = y + 72 + index * 80;
      const active = index === state.run.encounterIndex;
      const cleared = state.run.cleared.includes(encounter.id);
      const fill = cleared ? 0x1c3628 : active ? 0x32231f : 0x241d25;
      const stroke = cleared ? 0x8bf3b5 : active ? 0xffab83 : 0xffffff;
      const node = this.add.rectangle(x + width / 2, nodeY, width - 34, 64, fill, 0.95).setStrokeStyle(2, stroke, active || cleared ? 0.4 : 0.08);
      const title = this.add.text(x + 24, nodeY - 16, encounter.name, {
        fontFamily: "Chivo, sans-serif",
        fontSize: "24px",
        fontStyle: "700",
        color: "#fff4ec",
      });
      const role = this.add.text(x + 24, nodeY + 10, encounter.role, {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "17px",
        color: "#c4b7af",
      });
      this.root.add([node, title, role]);
    });

    const notesY = y + 410;
    this.root.add(
      this.add.text(x + 22, notesY, "规则 / 说明", {
        fontFamily: "Chivo, sans-serif",
        fontSize: "26px",
        fontStyle: "700",
        color: "#fff4ec",
      }),
    );
    const ruleLines = [
      ...state.battle!.battlefield.rules.map((rule) => `场地：${rule}`),
      ...state.demoNotes.map((note) => `Demo：${note}`),
    ];
    ruleLines.forEach((line, index) => {
      const boxY = notesY + 52 + index * 56;
      const box = this.add.rectangle(x + width / 2, boxY, width - 34, 48, 0x241d25, 0.85).setStrokeStyle(1, 0xffffff, 0.06);
      const text = this.add.text(x + 22, boxY - 13, line, {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "15px",
        color: "#d4c5bc",
        wordWrap: { width: width - 56 },
      });
      this.root.add([box, text]);
    });

    const logTitleY = y + height - 222;
    this.root.add(
      this.add.text(x + 22, logTitleY, "战报", {
        fontFamily: "Chivo, sans-serif",
        fontSize: "26px",
        fontStyle: "700",
        color: "#fff4ec",
      }),
    );
    state.log.slice(0, 5).forEach((entry, index) => {
      const logY = logTitleY + 48 + index * 34;
      const text = this.add.text(x + 24, logY, `· ${entry.message}`, {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "15px",
        color: index === 0 ? "#fff1e9" : "#b7aaa1",
        wordWrap: { width: width - 54 },
      });
      this.root.add(text);
    });
  }

  private renderTopButtons(state: EngineState): void {
    const audioState = winningAudio.getState();
    const turnButtonLabel = state.phase === "response-window" ? "不回应" : "结束回合";
    const turnButtonEnabled = state.phase === "player-turn" || state.phase === "response-window";

    const turnButton = this.createButton(1090, 54, 148, 46, turnButtonLabel, turnButtonEnabled, () => {
      this.performAction(() => {
        if (state.phase === "response-window") {
          this.engine.skipResponse();
        } else {
          this.engine.endPlayerTurn();
        }
      });
    }, 0x2c232c, 0xffe3c8);
    this.root.add(turnButton);

    const restartButton = this.createButton(1258, 54, 152, 46, "重新开局", true, () => {
      this.scene.start("battle", { seed: `${Date.now()}-${Math.floor(Math.random() * 100000)}` });
    }, 0xff7748, 0x120d12);
    this.root.add(restartButton);

    const musicButton = this.createButton(1108, 92, 56, 34, "乐", true, () => {
      winningAudio.unlock();
      winningAudio.toggleMusic();
      this.renderScene();
    }, audioState.musicEnabled ? 0xffb35c : 0x342a35, 0x120d12);
    const sfxButton = this.createButton(1174, 92, 56, 34, "效", true, () => {
      winningAudio.unlock();
      winningAudio.toggleSfx();
      this.renderScene();
    }, audioState.sfxEnabled ? 0x7ed8ff : 0x342a35, 0x120d12);
    const voiceButton = this.createButton(1240, 92, 56, 34, "语", true, () => {
      winningAudio.unlock();
      winningAudio.toggleVoice();
      this.renderScene();
    }, audioState.voiceEnabled ? 0xff93a0 : 0x342a35, 0x120d12);
    this.root.add([musicButton, sfxButton, voiceButton]);
  }

  private renderOverlay(state: EngineState): void {
    if (state.phase !== "reward" && state.phase !== "run-victory" && state.phase !== "run-defeat") {
      return;
    }

    this.overlayLayer.add(this.add.rectangle(720, 450, 1440, 900, 0x0f0b10, 0.72));

    if (state.phase === "reward") {
      const title = this.add.text(720, 188, "战后加卡", {
        fontFamily: "Chivo, sans-serif",
        fontSize: "52px",
        fontStyle: "700",
        color: "#fff4ec",
      }).setOrigin(0.5);
      const subtitle = this.add.text(720, 246, "选 1 张加入牌组，然后继续推进整条 run。", {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "24px",
        color: "#d6c6bc",
      }).setOrigin(0.5);
      this.overlayLayer.add([title, subtitle]);

      state.rewardOptions.forEach((cardId, index) => {
        const definition = CARD_LIBRARY[cardId];
        const card = this.createCardNode(452 + index * 270, 500, 220, 246, definition, true, false);
        card.setInteractive(new Phaser.Geom.Rectangle(-110, -123, 220, 246), Phaser.Geom.Rectangle.Contains);
        card.on("pointerover", () => {
          this.tweens.add({ targets: card, y: 484, duration: 120 });
        });
        card.on("pointerout", () => {
          this.tweens.add({ targets: card, y: 500, duration: 120 });
        });
        card.on("pointerdown", () => {
          this.performAction(() => {
            this.engine.chooseReward(cardId);
          });
        });
        this.overlayLayer.add(card);
      });
      return;
    }

    const isVictory = state.phase === "run-victory";
    const title = this.add.text(720, 310, isVictory ? "赢麻了" : "场面站不住了", {
      fontFamily: "Chivo, sans-serif",
      fontSize: "88px",
      fontStyle: "900",
      color: isVictory ? "#ffd29a" : "#ffb7a3",
    }).setOrigin(0.5);
    const subtitle = this.add.text(
      720,
      410,
      isVictory
        ? "精神胜利王已经倒了。这是一整条可打通的浏览器 run。"
        : "这次被对线打穿了。重开再构筑，继续验证这套系统。",
      {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "28px",
        color: "#f4e9e3",
        wordWrap: { width: 880 },
        align: "center",
      },
    ).setOrigin(0.5);
    this.overlayLayer.add([title, subtitle]);

    const button = this.createButton(720, 540, 244, 74, "再来一局", true, () => {
      this.scene.start("battle", { seed: `${Date.now()}-${Math.floor(Math.random() * 100000)}` });
    }, isVictory ? 0xffb45a : 0xff7a53, 0x120d12);
    this.overlayLayer.add(button);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
    fill: number,
    textColor: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, fill, enabled ? 0.98 : 0.42).setStrokeStyle(2, 0xffffff, enabled ? 0.18 : 0.06);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Chivo, sans-serif",
      fontSize: "22px",
      fontStyle: "700",
      color: Phaser.Display.Color.IntegerToColor(textColor).rgba,
    }).setOrigin(0.5);
    container.add([bg, text]);
    if (enabled) {
      container.setSize(width, height).setInteractive({ useHandCursor: true });
      container.on("pointerover", () => {
        winningAudio.playUiHover();
        this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 120 });
      });
      container.on("pointerout", () => {
        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 });
      });
      container.on("pointerdown", () => {
        winningAudio.unlock();
        winningAudio.playUiConfirm();
        onClick();
      });
    }
    return container;
  }

  private makeChip(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fill: number,
    color: string,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, width, height, fill, 0.94).setStrokeStyle(1, 0xffffff, 0.08);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "17px",
      color,
    }).setOrigin(0.5);
    container.add([bg, text]);
    return container;
  }

  private cardTone(type: CardDefinition["type"]): { fill: number; stroke: number; type: string } {
    switch (type) {
      case "Thesis":
        return { fill: 0x3d2b1f, stroke: 0xffc27d, type: "#ffd39f" };
      case "Argument":
        return { fill: 0x193245, stroke: 0x78d5ff, type: "#b8ecff" };
      case "Counter":
        return { fill: 0x31223f, stroke: 0xc89df4, type: "#e2c8ff" };
      case "Label":
        return { fill: 0x451f29, stroke: 0xff8f87, type: "#ffc5bf" };
      case "Redirect":
        return { fill: 0x183531, stroke: 0x81f6db, type: "#bdfaf0" };
      case "Finisher":
        return { fill: 0x433319, stroke: 0xffd55d, type: "#ffe7a6" };
      default:
        return { fill: 0x2a232d, stroke: 0xffffff, type: "#fff4ec" };
    }
  }

  private performAction(action: () => void): void {
    const before = this.captureDelta();
    action();
    this.renderScene();
    this.animateDelta(before);
    this.scheduleEnemyIfNeeded();
  }

  private scheduleEnemyIfNeeded(): void {
    if (this.enemyTimer) {
      this.enemyTimer.remove(false);
      this.enemyTimer = null;
    }
    const state = this.engine.getSnapshot();
    if (state.phase === "enemy-turn") {
      this.enemyTimer = this.time.delayedCall(780, () => {
        this.performAction(() => {
          this.engine.enemyTakeStep();
        });
      });
    }
  }

  private captureDelta(): DeltaSnapshot {
    const state = this.engine.getSnapshot();
    const battle = state.battle!;
    return {
      playerFace: battle.player.face,
      enemyFace: battle.enemy.face,
      playerTilt: battle.player.tilt,
      enemyTilt: battle.enemy.tilt,
      opinion: battle.opinion,
      actionCount: state.actionQueue.length,
      phase: state.phase,
      logId: state.log[0]?.id ?? null,
    };
  }

  private animateDelta(before: DeltaSnapshot): void {
    const state = this.engine.getSnapshot();
    const battle = state.battle!;

    const spawnFloat = (x: number, y: number, text: string, color: string): void => {
      const label = this.add.text(x, y, text, {
        fontFamily: "Chivo, sans-serif",
        fontSize: "34px",
        fontStyle: "700",
        color,
      }).setOrigin(0.5);
      this.overlayLayer.add(label);
      this.tweens.add({
        targets: label,
        y: y - 42,
        alpha: 0,
        duration: 720,
        ease: "Cubic.easeOut",
        onComplete: () => label.destroy(),
      });
    };

    if (battle.enemy.face < before.enemyFace) {
      spawnFloat(892, 172, `-${before.enemyFace - battle.enemy.face}`, "#ffcfad");
      this.cameras.main.shake(110, 0.0023);
    }
    if (battle.player.face < before.playerFace) {
      spawnFloat(892, 458, `-${before.playerFace - battle.player.face}`, "#ffb0a0");
      this.cameras.main.shake(140, 0.0032);
    }
    if (battle.enemy.tilt > before.enemyTilt) {
      spawnFloat(748, 172, `+${battle.enemy.tilt - before.enemyTilt} 破防`, "#ff9a92");
    }
    if (battle.player.tilt > before.playerTilt) {
      spawnFloat(748, 458, `+${battle.player.tilt - before.playerTilt} 破防`, "#ffd0bf");
    }
    if (battle.opinion !== before.opinion) {
      const diff = battle.opinion - before.opinion;
      spawnFloat(520, 334, `${diff > 0 ? "+" : ""}${diff} 舆论`, diff > 0 ? "#79ddff" : "#ff9d86");
    }

    state.actionQueue.slice(before.actionCount).forEach((beat, index) => {
      winningAudio.playActionBeat(beat, index * 180);
      this.showActionBeat(beat, index * 180);
    });
  }

  private showActionBeat(beat: ActionBeat, delay: number): void {
    const tone = this.actionTone(beat);
    const targetX = beat.side === "player" ? 390 : 1050;
    const targetY = beat.side === "player" ? 524 : 188;
    const drift = beat.side === "player" ? 48 : -48;
    const startX = beat.side === "player" ? -420 : 1860;

    const flash = this.add
      .rectangle(720, 450, 1440, 900, tone.flash, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.overlayLayer.add(flash);

    const container = this.add.container(startX, targetY);
    container.setAlpha(0);
    container.setScale(0.96);

    const glow = this.add.ellipse(0, 0, 620, 176, tone.glow, 0.18);
    const plate = this.add
      .rectangle(0, 0, 572, 138, tone.fill, 0.96)
      .setStrokeStyle(3, tone.stroke, 0.92);
    const rail = this.add.rectangle(beat.side === "player" ? -270 : 270, 0, 16, 138, tone.stroke, 1);
    const accent = this.add.rectangle(beat.side === "player" ? -220 : 220, -42, 120, 8, tone.stroke, 0.95);

    const overline = this.add.text(-246, -50, this.actionBeatLabel(beat), {
      fontFamily: "Chivo, sans-serif",
      fontSize: "16px",
      fontStyle: "700",
      color: tone.overline,
      letterSpacing: 1,
    });
    const cardName = this.add.text(-246, -22, `【${beat.cardName}】`, {
      fontFamily: "Chivo, sans-serif",
      fontSize: "27px",
      fontStyle: "700",
      color: "#fff6ef",
    });
    const headline = this.add.text(-246, 12, beat.headline, {
      fontFamily: "Chivo, sans-serif",
      fontSize: "31px",
      fontStyle: "900",
      color: "#fff7f2",
      wordWrap: { width: 460 },
    });
    const kicker = this.add.text(-246, 56, beat.kicker, {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "17px",
      color: "#eaded6",
      wordWrap: { width: 468 },
      lineSpacing: 4,
    });

    container.add([glow, plate, rail, accent, overline, cardName, headline, kicker]);
    this.overlayLayer.add(container);

    beat.shards.forEach((shard, index) => {
      const shardNode = this.add
        .text(targetX + (beat.side === "player" ? 60 : -60), targetY - 42 + index * 26, shard, {
          fontFamily: "Chivo, sans-serif",
          fontSize: "18px",
          fontStyle: "700",
          color: tone.shard,
          backgroundColor: tone.shardBg,
          padding: { left: 10, right: 10, top: 4, bottom: 4 },
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.overlayLayer.add(shardNode);
      this.tweens.add({
        targets: shardNode,
        alpha: 1,
        x: targetX + (beat.side === "player" ? 170 + index * 26 : -170 - index * 26),
        y: targetY - 80 + index * 22,
        delay: delay + 110 + index * 42,
        duration: 180,
        ease: "Cubic.easeOut",
      });
      this.tweens.add({
        targets: shardNode,
        alpha: 0,
        y: shardNode.y - 28,
        delay: delay + 430 + index * 42,
        duration: 240,
        ease: "Cubic.easeOut",
        onComplete: () => shardNode.destroy(),
      });
    });

    this.tweens.add({
      targets: flash,
      alpha: 0.15,
      delay,
      duration: 90,
      yoyo: true,
      hold: 50,
      onComplete: () => flash.destroy(),
    });

    this.tweens.add({
      targets: container,
      x: targetX,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      delay,
      duration: 220,
      ease: "Cubic.easeOut",
    });

    this.tweens.add({
      targets: container,
      x: targetX + drift,
      alpha: 0,
      delay: delay + 720,
      duration: 260,
      ease: "Cubic.easeIn",
      onComplete: () => container.destroy(),
    });

    if (beat.cardType === "Finisher") {
      this.time.delayedCall(delay, () => {
        this.cameras.main.shake(180, 0.0046);
      });
    } else if (beat.mode === "response" || beat.cardType === "Counter") {
      this.time.delayedCall(delay, () => {
        this.cameras.main.shake(90, 0.0024);
      });
    }
  }

  private actionBeatLabel(beat: ActionBeat): string {
    if (beat.mode === "response") {
      return beat.side === "player" ? "PLAYER RESPONSE" : "ENEMY RESPONSE";
    }
    return beat.side === "player" ? "PLAYER PLAY" : "ENEMY PLAY";
  }

  private actionTone(beat: ActionBeat): {
    fill: number;
    stroke: number;
    glow: number;
    flash: number;
    overline: string;
    shard: string;
    shardBg: string;
  } {
    switch (beat.cardType) {
      case "Thesis":
        return {
          fill: 0x3b281d,
          stroke: 0xffbe78,
          glow: 0xffb15a,
          flash: 0xffb15a,
          overline: "#ffd8ad",
          shard: "#29140c",
          shardBg: "#ffcf9f",
        };
      case "Argument":
        return {
          fill: 0x163243,
          stroke: 0x77d6ff,
          glow: 0x51c5ff,
          flash: 0x3d9fd3,
          overline: "#b5eaff",
          shard: "#0d1c28",
          shardBg: "#b7ecff",
        };
      case "Counter":
        return {
          fill: 0x2f2040,
          stroke: 0xd4a4ff,
          glow: 0xaa6df0,
          flash: 0x9d5ce4,
          overline: "#edd5ff",
          shard: "#1d102b",
          shardBg: "#e4c8ff",
        };
      case "Label":
        return {
          fill: 0x451d28,
          stroke: 0xff8f8f,
          glow: 0xff6d6d,
          flash: 0xd35656,
          overline: "#ffd3d0",
          shard: "#2f0e16",
          shardBg: "#ffc3bd",
        };
      case "Redirect":
        return {
          fill: 0x183631,
          stroke: 0x86f2de,
          glow: 0x48d7be,
          flash: 0x3ab39f,
          overline: "#cdfcf2",
          shard: "#0c221f",
          shardBg: "#c0f9ed",
        };
      case "Finisher":
        return {
          fill: 0x433218,
          stroke: 0xffd55e,
          glow: 0xffc648,
          flash: 0xe6a93d,
          overline: "#fff0ba",
          shard: "#25170a",
          shardBg: "#ffe5a0",
        };
      default:
        return {
          fill: 0x29232d,
          stroke: 0xffffff,
          glow: 0xffffff,
          flash: 0xffffff,
          overline: "#fff6ef",
          shard: "#201717",
          shardBg: "#fff1e6",
        };
    }
  }

  private showPhaseBanner(text: string): void {
    this.phaseBanner.setText(text);
    this.phaseBanner.setAlpha(1);
    this.phaseBanner.setScale(0.94);
    this.tweens.add({
      targets: this.phaseBanner,
      scaleX: 1,
      scaleY: 1,
      yoyo: false,
      duration: 160,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: this.phaseBanner,
      alpha: 0,
      delay: 820,
      duration: 420,
    });
  }

  private phaseLabel(phase: EngineState["phase"]): string {
    switch (phase) {
      case "player-turn":
        return "你的回合";
      case "enemy-turn":
        return "对手回合";
      case "response-window":
        return "回应窗口";
      case "reward":
        return "战后加卡";
      case "run-victory":
        return "整条线打通";
      case "run-defeat":
        return "这局寄了";
      default:
        return phase;
    }
  }

  private phaseHelperText(state: EngineState): string {
    const player = state.battle!.player;
    switch (state.phase) {
      case "player-turn":
        return `你有 ${player.momentum} 点气势，继续压强度。`;
      case "response-window":
        return `敌方正在结算【${state.battle!.pendingAction?.card.name ?? ""}】，接或不接。`;
      case "reward":
        return "右侧收尾，中央选牌。";
      case "run-victory":
        return "Boss 已倒，整条 run 通关。";
      case "run-defeat":
        return "这次对线被打穿了。";
      default:
        return "对手正在操作。";
    }
  }
}
