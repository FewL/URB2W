import * as Phaser from "phaser";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, 0x120f16);
    this.add.rectangle(width / 2, height / 2, width * 0.96, height * 0.92, 0x18131d, 0.85).setStrokeStyle(2, 0xff8a5b, 0.18);

    const orbData = [
      { x: 210, y: 180, radius: 180, color: 0xff6f4b, alpha: 0.18 },
      { x: 1210, y: 190, radius: 150, color: 0x62d8ff, alpha: 0.16 },
      { x: 920, y: 710, radius: 220, color: 0xffbe79, alpha: 0.08 },
    ];
    orbData.forEach((orb) => {
      this.add.circle(orb.x, orb.y, orb.radius, orb.color, orb.alpha);
    });

    this.add
      .text(96, 92, "WINNING STUDIES / WEBGAME / V0.2", {
        fontFamily: "Chivo, sans-serif",
        fontSize: "18px",
        color: "#ffbe79",
        letterSpacing: 3,
      })
      .setAlpha(0.92);

    this.add.text(92, 152, "赢了么", {
      fontFamily: "Chivo, sans-serif",
      fontSize: "122px",
      fontStyle: "900",
      color: "#fff4ec",
      stroke: "#0d0910",
      strokeThickness: 8,
    });

    this.add.text(102, 296, "一款真正的浏览器卡牌战斗游戏", {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "38px",
      color: "#f4d9cc",
    });

    this.add.text(
      102,
      360,
      "不是静态演示页。现在是 Phaser 驱动的正式网页游戏原型：\n四资源战斗、回应窗口、状态连锁、敌人 AI、战后加卡、完整 Boss 闭环。",
      {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "24px",
        color: "#cdbdb4",
        lineSpacing: 12,
      },
    );

    const bullets = [
      "体面 / 气势 / 舆论 / 破防 四资源并行",
      "40 张牌，3 个普通敌人 + 1 个 Boss",
      "Canvas 场景、动画反馈、阶段推进、卡牌交互",
      "部署到 GitHub Pages，可直接在线验收",
    ];
    bullets.forEach((line, index) => {
      this.add.text(112, 510 + index * 44, `• ${line}`, {
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: "22px",
        color: "#f8f1eb",
      });
    });

    const button = this.add.container(1080, 618);
    const buttonBg = this.add
      .rectangle(0, 0, 250, 76, 0xff7b4d, 1)
      .setStrokeStyle(2, 0xffd09b, 0.52);
    const buttonLabel = this.add.text(0, 0, "开始对线", {
      fontFamily: "Chivo, sans-serif",
      fontSize: "30px",
      fontStyle: "700",
      color: "#1a0e12",
    });
    buttonLabel.setOrigin(0.5);
    button.add([buttonBg, buttonLabel]);

    button.setSize(250, 76).setInteractive({ useHandCursor: true });
    button.on("pointerover", () => {
      this.tweens.add({
        targets: button,
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 120,
      });
    });
    button.on("pointerout", () => {
      this.tweens.add({
        targets: button,
        scaleX: 1,
        scaleY: 1,
        duration: 120,
      });
    });
    button.on("pointerdown", () => {
      this.scene.start("battle", { seed: `${Date.now()}-${Math.floor(Math.random() * 100000)}` });
    });

    this.add.text(954, 698, "点击开始，直接进入一整条 run。\n失败可随时重开，通关后继续刷构筑。", {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "21px",
      color: "#dbcac0",
      lineSpacing: 10,
    });

    const footer = this.add.text(width - 96, height - 54, "Space / Click to Start", {
      fontFamily: "Space Grotesk, sans-serif",
      fontSize: "18px",
      color: "#9b8f87",
    });
    footer.setOrigin(1, 0.5);

    this.input.keyboard?.once("keydown-SPACE", () => {
      this.scene.start("battle", { seed: `${Date.now()}-${Math.floor(Math.random() * 100000)}` });
    });
  }
}
