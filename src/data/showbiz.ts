import type {
  ActionBeat,
  BattlefieldDefinition,
  CombatantState,
  EncounterDefinition,
  EngineState,
} from "../core/types";

export type FeedTone = "hype" | "snark" | "meltdown" | "alert";

export interface FeedItem {
  id: string;
  text: string;
  tone: FeedTone;
}

export interface FeedPulse {
  ticker: string;
  topics: string[];
  comments: FeedItem[];
}

export interface EncounterSplashData {
  strapline: string;
  title: string;
  subtitle: string;
  tags: string[];
}

export interface RewardShowcase {
  strapline: string;
  title: string;
  subtitle: string;
  ticker: string;
  topics: string[];
}

export interface OutcomeShowcase {
  strapline: string;
  title: string;
  subtitle: string;
  ticker: string;
  topics: string[];
  comments: FeedItem[];
  stats: string[];
}

const BEHAVIOR_PACK = {
  counter: {
    titles: ["全网第一拆字眼已上线", "杠点雷达已经打开"],
    subtitles: [
      "这位主打一个你刚说完，他就盯着词眼抠三轮。",
      "主业不是对线，是让你每句话都得补脚注。",
    ],
    tags: ["#逐字拆你#", "#来源警告#", "#别想顺着讲#"],
  },
  opinion: {
    titles: ["流量场已经烧起来了", "今天这把主打热度滚雪球"],
    subtitles: [
      "它不跟你讲完，只想把全场先点着再说。",
      "场面一热，这位就会把每句都往热搜体质上拱。",
    ],
    tags: ["#热搜预定#", "#全场拱火#", "#谁嗓门大谁赢#"],
  },
  tilt: {
    titles: ["情绪手术刀已经端上桌", "这把就是奔着你心态去的"],
    subtitles: [
      "不急着秒你，先把你架到想回长文。",
      "每句话都不重，但刀子全挑软肋上落。",
    ],
    tags: ["#专戳痛点#", "#阴阳拉满#", "#破防预警#"],
  },
  boss: {
    titles: ["总决赛选手开始嘴硬了", "精神胜利王正在装填最后一轮"],
    subtitles: [
      "它血线越低越像开了疯批模式，千万别给翻盘镜头。",
      "这位不是稳，是死撑；不是退，是越残越会拧剧情。",
    ],
    tags: ["#总决赛#", "#残血嘴硬#", "#收头窗口已开#"],
  },
} as const;

const FIELD_MOODS: Record<string, string[]> = {
  "comment-zone": ["#评论区拉扯#", "#一句话十层意思#", "#谁先破防谁先输#"],
  "group-chat": ["#群聊围观#", "#已读乱回#", "#消息刷得比脑子快#"],
};

const PLAYER_REACTIONS = {
  Thesis: [
    "这句先把调门抱走了，后面很难不跟着他说。",
    "起手先定框架，对面已经得在这个盒子里喘气了。",
  ],
  Argument: [
    "这下不是抬杠，是直接把证据拍脸上了。",
    "这句输出够硬，对面想装没看见都难。",
  ],
  Counter: [
    "这波反手打断很脏，对面刚起势就被掐住了。",
    "一句顶回去，节奏立刻卡壳。",
  ],
  Label: [
    "这帽子扣得太快了，后面每句话都得带着前科讲。",
    "先定性再聊天，赢学味儿已经对了。",
  ],
  Redirect: [
    "这转进速度很熟练，问题还没落地坐标就换了。",
    "正面不接，先把题目拖去隔壁楼层。",
  ],
  Finisher: [
    "这就是收头拳，再往下说都像补台词。",
    "终局味出来了，这下像是真的要盖章。",
  ],
};

const ENEMY_REACTIONS = {
  Thesis: [
    "对面先把版本写上去了，空气有点不妙。",
    "它又开始定调了，再让它说下去就要成默认答案。",
  ],
  Argument: [
    "这句是真奔着打脸来的，别硬吃。",
    "对面这波压力给满了，空气突然安静。",
  ],
  Counter: [
    "刚抬手就被它卡麦，这种感觉最烦。",
    "它又来一句‘先别急’，真的很欠揍。",
  ],
  Label: [
    "它开始挂标签了，这种时候最容易一路连坐。",
    "这帽子一扣，后面解释都会显得像补救。",
  ],
  Redirect: [
    "它又在拐坐标，稍不留神题就没了。",
    "这波话题滑得太快，再不拉回来就白打了。",
  ],
  Finisher: [
    "对面开始收头，别给它演成名场面。",
    "这拳要是吃满，评论区能笑半年。",
  ],
};

const OPINION_SWINGS = {
  player: [
    "路人开始站你这边了，场子肉眼可见往右偏。",
    "风向在往你这边倒，对面现在讲什么都像补作业。",
  ],
  enemy: [
    "场子被它带歪了，围观群众明显开始点头。",
    "风向开始向对面斜了，再不抢回来就真成它版本了。",
  ],
};

const STARTER_COMMENTS = [
  "刚开场先别急着下结论，通常第一波嘴最硬。",
  "评论区今天人挺齐，估计很快就有人开始断章取义。",
  "这把要么一路带热搜，要么一路带破防，总之不会安静。",
];

const unique = (items: string[]): string[] => [...new Set(items)];

const pick = (items: readonly string[], salt: number): string => {
  return items[Math.abs(salt) % items.length];
};

const mergeTopics = (fresh: string[], existing: string[]): string[] => {
  return unique([...fresh, ...existing]).slice(0, 3);
};

const makeFeedItem = (id: string, text: string, tone: FeedTone): FeedItem => ({ id, text, tone });

export const buildEncounterSplash = (
  encounter: EncounterDefinition,
  battlefield: BattlefieldDefinition,
  serial: number,
): EncounterSplashData => {
  const pack = BEHAVIOR_PACK[encounter.behavior];
  return {
    strapline: `${battlefield.name.toUpperCase()} / ${encounter.role.toUpperCase()}`,
    title: pick(pack.titles, serial),
    subtitle: `${encounter.name}进场。${pick(pack.subtitles, serial + 1)} ${encounter.passive}`,
    tags: unique([pick(FIELD_MOODS[battlefield.id] ?? ["#场子开了#"], serial), ...pack.tags]).slice(0, 3),
  };
};

export const buildEncounterFeed = (
  encounter: EncounterDefinition,
  battlefield: BattlefieldDefinition,
  serial: number,
): FeedPulse => {
  const pack = BEHAVIOR_PACK[encounter.behavior];
  return {
    ticker: `【现场连线】${battlefield.name}开打，${encounter.name}已经进场，弹幕区正在热身。`,
    topics: mergeTopics(
      [pick(pack.tags, serial), pick(FIELD_MOODS[battlefield.id] ?? ["#场面升级#"], serial + 1), `#${encounter.name}上线#`],
      [],
    ),
    comments: [
      makeFeedItem(`enc-${serial}-0`, STARTER_COMMENTS[serial % STARTER_COMMENTS.length], "alert"),
      makeFeedItem(`enc-${serial}-1`, `${encounter.name}这被动一亮出来，就知道今天不会好讲。`, "snark"),
      makeFeedItem(`enc-${serial}-2`, `场地是${battlefield.name}，今天这把注定不是正常交流。`, "hype"),
    ],
  };
};

export const buildBeatFeedPulse = (
  state: EngineState,
  beat: ActionBeat,
  serial: number,
  existingTopics: string[],
): FeedPulse => {
  const sideLabel = beat.side === "player" ? "你这边" : "对面";
  const opinionSide = state.battle && state.battle.opinion >= 0 ? "player" : "enemy";
  const reactionPool = beat.side === "player" ? PLAYER_REACTIONS[beat.cardType] : ENEMY_REACTIONS[beat.cardType];
  const opinionPool = opinionSide === "player" ? OPINION_SWINGS.player : OPINION_SWINGS.enemy;

  const beatTopic = beat.cardType === "Finisher" ? `#${beat.cardName}收头现场#` : `#${beat.cardName}#`;
  const modeTopic = beat.mode === "response" ? "#临场回嘴#" : "#现场对线#";
  const swingTopic = Math.abs(state.battle?.opinion ?? 0) >= 4 ? "#风向开始倾斜#" : "#评论区还在拉扯#";

  const comments = [
    makeFeedItem(`beat-${serial}-0`, `${sideLabel}甩出【${beat.cardName}】。${pick(reactionPool, serial)}。`, beat.cardType === "Finisher" ? "alert" : "hype"),
    makeFeedItem(`beat-${serial}-1`, pick(opinionPool, serial + 2), Math.abs(state.battle?.opinion ?? 0) >= 4 ? "alert" : "snark"),
  ];

  if (beat.mode === "response") {
    comments.push(
      makeFeedItem(
        `beat-${serial}-2`,
        `这波是临场插话，不让对面顺着结算下去。围观群众最爱看这种硬打断。`,
        "meltdown",
      ),
    );
  }

  return {
    ticker: `【热帖更新】${sideLabel}刚打出【${beat.cardName}】，${beat.headline}。`,
    topics: mergeTopics([beatTopic, modeTopic, swingTopic], existingTopics),
    comments,
  };
};

export const buildRewardShowcase = (
  state: EngineState,
  serial: number,
): RewardShowcase => {
  const encounter = state.battle?.encounter;
  const nextNode = state.run.encounterIndex + 2;
  return {
    strapline: "冲榜补强 / 选一张继续上强度",
    title: "路人已经开始点菜了",
    subtitle: encounter
      ? `刚把 ${encounter.name} 处理完，热度还没掉。现在补一张牌，下一站直接去第 ${nextNode} 场继续发癫。`
      : "这波打完还没散场，趁热补一张牌继续冲。",
    ticker: "【节目效果追加中】观众席一致建议：趁热塞新活，别让节奏掉下来。",
    topics: [
      `#第${nextNode}场继续冲#`,
      pick(["#路人催更新活#", "#趁热补强#", "#卡组继续加戏#"], serial),
      "#别让热度掉下来#",
    ],
  };
};

const outcomeTitle = (victory: boolean, encounter: EncounterDefinition | undefined, serial: number): string => {
  if (victory) {
    return pick(
      [
        "整条线打穿，今天这把真成节目了",
        `【${encounter?.name ?? "对面"}】被当场做成了切片`,
      ],
      serial,
    );
  }
  return pick(
    [
      "场面站不住了，截图已经在路上",
      "这把寄得很完整，路人都替你尴尬",
    ],
    serial,
  );
};

const outcomeSubtitle = (
  victory: boolean,
  battle: EngineState["battle"],
  player: CombatantState | null,
  serial: number,
): string => {
  const opinion = battle?.opinion ?? 0;
  if (victory) {
    return pick(
      [
        `最终风向 ${opinion >= 0 ? "彻底倒向你这边" : "虽然拉扯过但还是被你抢回来了"}，评论区今天得聊你很久。`,
        `${player ? `你还剩 ${player.face} 点体面` : "你最后还是站住了"}，这波已经够做成高赞回顾帖了。`,
      ],
      serial,
    );
  }
  return pick(
    [
      "这波不是没节目，是节目效果全落你身上了。",
      "路人现在最爱说的一句就是：早提醒过别跟着它的节奏走。",
    ],
    serial,
  );
};

export const buildOutcomeShowcase = (
  state: EngineState,
  serial: number,
): OutcomeShowcase => {
  const battle = state.battle;
  const victory = state.phase === "run-victory";
  const encounter = battle?.encounter;
  const player = battle?.player ?? null;
  const enemy = battle?.enemy ?? null;
  const opinion = battle?.opinion ?? 0;

  const stats = [
    `本局手数 ${battle?.turnNumber ?? 0}`,
    `最终风向 ${opinion >= 0 ? "+" : ""}${opinion}`,
    `你剩 ${player?.face ?? 0} 点体面`,
    `${encounter?.name ?? "对面"} 剩 ${enemy?.face ?? 0} 点体面`,
  ];

  const comments = victory
    ? [
        makeFeedItem(`out-${serial}-0`, "这不是赢，是把对面整套版本都拆了。", "hype"),
        makeFeedItem(`out-${serial}-1`, "建议把最后那波收头录下来循环播放。", "alert"),
        makeFeedItem(`out-${serial}-2`, "今天评论区的高赞，大概率都是夸这把怎么赢的。", "snark"),
      ]
    : [
        makeFeedItem(`out-${serial}-0`, "这把不是没输出，是每次都刚好进了对面想看的节奏。", "meltdown"),
        makeFeedItem(`out-${serial}-1`, "下一局先别急着抬手，别再给它现成反制位。", "alert"),
        makeFeedItem(`out-${serial}-2`, "截图党已经存好了，这把重开才是正事。", "snark"),
      ];

  return {
    strapline: victory ? "热搜收官 / 高赞复盘" : "翻车现场 / 弹幕复盘",
    title: outcomeTitle(victory, encounter, serial),
    subtitle: outcomeSubtitle(victory, battle, player, serial),
    ticker: victory
      ? "【收官播报】整条 run 已通关，观众席正在狂刷“赢麻了”。"
      : "【翻车播报】本局已寄，围观群众正在建议你重开别嘴硬。",
    topics: victory
      ? [`#${encounter?.name ?? "Boss"}被打穿#`, "#赢麻了现场#", "#高赞复盘生成中#"]
      : [`#这局寄了#`, "#翻车切片预定#", `#${encounter?.name ?? "对面"}拿捏成功#`],
    comments,
    stats,
  };
};
