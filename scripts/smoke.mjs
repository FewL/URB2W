import { CARD_LIBRARY } from "../js/data.mjs";
import { WinGame } from "../js/game.mjs";

function scorePlayerCard(game, card, player, enemy) {
  let score = 1 + card.cost * 0.3;
  if (card.type === "Finisher") score += 2.5;
  if (card.type === "Argument") score += 1.8;
  if (card.type === "Label") score += enemy.tilt >= 4 ? 2.2 : 1.4;
  if (card.keywords.includes("momentumShift")) score += game.relativeOpinion("player") < 3 ? 1.4 : 0.2;
  if (card.id === "cant-hold" && enemy.tilt >= 7) score += 6;
  if (card.id === "keep-hitting" && enemy.tookTiltThisTurn) score += 3;
  if (card.id === "everyone-knows" && game.relativeOpinion("player") >= 3) score += 4;
  if (card.id === "group-consensus" && game.relativeOpinion("player") >= 2) score += 3;
  if (card.id === "win-hard" && player.face <= 8) score += 7;
  if (card.id === "not-over" && player.face <= 10) score += 4;
  if (card.id === "stubborn-end" && player.face <= 12) score += 3;
  if (card.id === "main-narrative" && !player.statuses.mainNarrative) score += 2;
  return score;
}

const game = new WinGame("smoke-seed");

for (let step = 0; step < 500; step += 1) {
  const state = game.getState();
  const battle = state.battle;
  const player = battle.player;
  const enemy = battle.enemy;

  if (state.phase === "player-turn") {
    const playable = player.hand
      .map((instance) => ({
        ...instance,
        definition: CARD_LIBRARY[instance.cardId],
      }))
      .filter(({ definition }) => game.isCardPlayable(player, definition, "normal"))
      .sort((left, right) => {
        return (
          scorePlayerCard(game, right.definition, player, enemy) -
          scorePlayerCard(game, left.definition, player, enemy)
        );
      });

    if (playable.length === 0) {
      game.endPlayerTurn();
      continue;
    }

    game.playerPlayCard(playable[0].uid);
    continue;
  }

  if (state.phase === "response-window") {
    const options = game.getAvailableResponses("player");
    if (options.length > 0) {
      game.playCard("player", options[0].uid);
    } else {
      game.skipResponse();
    }
    continue;
  }

  if (state.phase === "enemy-turn") {
    game.enemyTakeStep();
    continue;
  }

  if (state.phase === "reward") {
    game.chooseReward(state.rewardOptions[0]);
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
