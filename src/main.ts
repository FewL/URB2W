import * as Phaser from "phaser";
import "./style.css";
import { BattleScene } from "./scenes/BattleScene";
import { TitleScene } from "./scenes/TitleScene";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("Missing #app root node.");
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: app,
  width: 1440,
  height: 900,
  backgroundColor: "#110d14",
  render: {
    antialias: true,
    roundPixels: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1440,
    height: 900,
  },
  scene: [TitleScene, BattleScene],
});
