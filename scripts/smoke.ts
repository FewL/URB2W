import { BattleEngine } from "../src/core/battleEngine";
import { CARD_LIBRARY } from "../src/data/gameData";

const scorePlayerCard = (
  engine: BattleEngine,
  cardId: string,
  playerFace: number,
  enemyTilt: number,
  enemyTookTiltThisTurn: boolean,
): number => {
  const card = CARD_LIBRARY[cardId];
  let score = 1 + card.cost * 0.3;

  if (card.type === "Finisher") score += 2.6;
  if (card.type === "Argument") score += 1.9;
  if (card.type === "Label" && enemyTilt >= 4) score += 2.3;
  if (card.keywords.includes("momentumShift") && engine.relativeOpinion("player") < 3) score += 1.5;
  if (card.id === "cant-hold" && enemyTilt >= 7) score += 6;
  if (card.id === "keep-hitting" && enemyTookTiltThisTurn) score += 4;
  if (card.id === "everyone-knows" && engine.relativeOpinion("player") >= 3) score += 4;
  if (card.id === "group-consensus" && engine.relativeOpinion("player") >= 2) score += 3;
  if (card.id === "win-hard" && playerFace <= 8) score += 7;
  if (card.id === "not-over" && playerFace <= 10) score += 4;
  if (card.id === "stubborn-end" && playerFace <= 12) score += 3;
  if (card.id === "main-narrative") score += 2;

  return score;
};

const engine = new BattleEngine("smoke-seed");

for (let step = 0; step < 500; step += 1) {
  const state = engine.getSnapshot();
  const battle = state.battle;
  if (!battle) {
    throw new Error("Battle missing in smoke run.");
  }

  const player = battle.player;
  const enemy = battle.enemy;

  if (state.phase === "player-turn") {
    const playable = player.hand
      .map((instance) => ({ instance, definition: CARD_LIBRARY[instance.cardId] }))
      .filter(({ definition }) => engine.isCardPlayable(player, definition, "normal"))
      .sort((left, right) => {
        const rightScore = scorePlayerCard(
          engine,
          right.definition.id,
          player.face,
          enemy.tilt,
          enemy.tookTiltThisTurn,
        );
        const leftScore = scorePlayerCard(
          engine,
          left.definition.id,
          player.face,
          enemy.tilt,
          enemy.tookTiltThisTurn,
        );
        return rightScore - leftScore;
      });

    if (playable.length === 0) {
      engine.endPlayerTurn();
      continue;
    }

    engine.playPlayerCard(playable[0].instance.uid);
    continue;
  }

  if (state.phase === "response-window") {
    const options = engine.getAvailableResponses("player");
    if (options.length > 0) {
      engine.playCard("player", options[0].uid, "response");
    } else {
      engine.skipResponse();
    }
    continue;
  }

  if (state.phase === "enemy-turn") {
    engine.enemyTakeStep();
    continue;
  }

  if (state.phase === "reward") {
    engine.chooseReward(state.rewardOptions[0]);
    continue;
  }

  if (state.phase === "run-victory" || state.phase === "run-defeat") {
    console.log(`outcome=${state.phase}`);
    console.log(`turn=${battle.turnNumber}`);
    console.log(`player_face=${battle.player.face}`);
    console.log(`enemy_face=${battle.enemy.face}`);
    process.exit(0);
  }
}

console.error("smoke test exceeded step budget");
process.exit(1);
