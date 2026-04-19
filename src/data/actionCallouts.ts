import type { ActionBeat, CardContext, CardDefinition, CardType, Side } from "../core/types";

type Template = {
  headlines: string[];
  kickers: string[];
  shards?: string[];
};

const TYPE_TEMPLATES: Record<CardType, Template> = {
  Thesis: {
    headlines: ["先把调门起上来", "论点先落地，场子先控住"],
    kickers: ["这不是解释，这是先把定义权抱走。", "先把话筒拿稳，后面谁都得顺着这个调说。"],
    shards: ["定调", "控场", "起手"],
  },
  Argument: {
    headlines: ["证据往脸上拍", "逻辑链直接顶上来"],
    kickers: ["先给结论，再给压力。", "这波不是聊天，是把论证硬塞到你面前。"],
    shards: ["打脸", "证据", "压强"],
  },
  Counter: {
    headlines: ["反手把链条掐半空", "先别急着结算这句"],
    kickers: ["不是不同意，是不让你顺着讲完。", "等你抬手的一瞬间，先把麦克风抢过来。"],
    shards: ["反手", "拆招", "打断"],
  },
  Label: {
    headlines: ["标签先挂，空气先歪", "先下定义，再谈内容"],
    kickers: ["赢学第一步是钉人设，不是讲细节。", "帽子一戴，后面的每句话都要多算一层成本。"],
    shards: ["定性", "挂标签", "人设"],
  },
  Redirect: {
    headlines: ["坐标开始漂移", "问题不答，方向先改"],
    kickers: ["正面不接，先把现场拖去别的维度。", "只要坐标够偏，原题就会自己蒸发。"],
    shards: ["转进", "偏题", "改坐标"],
  },
  Finisher: {
    headlines: ["收头时刻到了", "判词直接盖章"],
    kickers: ["前面全是铺垫，这下才是重击。", "热度、情绪、舆论一起兑现成终局一拳。"],
    shards: ["收头", "终局", "压死"],
  },
};

const CARD_TEMPLATES: Partial<Record<string, Template>> = {
  "you-urgent": {
    headlines: ["急了急了，这句先挂脸上", "先别讲逻辑，先判你上头"],
    kickers: ["【你急了】不是论证，是把对面情绪值拧到红区。", "先让对手背上“急了”的设定，后面的每句都像狡辩。"],
    shards: ["急了", "上头", "破防"],
  },
  "ask-first": {
    headlines: ["来源先交，结论往后稍", "先问是不是，再问凭什么"],
    kickers: ["一句【先问是不是】就能把攻击链条拆成零件。", "资料没掏出来之前，气势不能算你赢。"],
    shards: ["来源呢", "证据", "质疑"],
  },
  "where-data": {
    headlines: ["数据呢，先把表贴出来", "别讲感觉，先给样本"],
    kickers: ["【数据呢】的乐趣就是让对面瞬间从输出切回补作业。", "把抽象压回表格里，场面自然就站住了。"],
    shards: ["表呢", "样本", "核验"],
  },
  "whatabout": {
    headlines: ["好，话题现在偏航", "坐标一甩，原题先失焦"],
    kickers: ["【顾左右而言他】的精髓不是回答，是把全场拖去隔壁楼层。", "只要转进够快，问题就追不上你。"],
    shards: ["转进", "偏航", "你先说"],
  },
  "quote-out": {
    headlines: ["附加条件先给你抹掉", "花活很多？先只剩底数"],
    kickers: ["【断章取义】专门负责把对方的长句削成干巴巴一句。", "只保留基础数值，剩下的情绪全作废。"],
    shards: ["截断", "干巴", "抹零"],
  },
  "logic-leap": {
    headlines: ["逻辑跳跃过大，现场坠机", "你这一步直接跨出图层"],
    kickers: ["【逻辑跳跃】专治那种中间少了三页 PPT 的论证。", "不接你的结论，先把你的台阶拆了。"],
    shards: ["坠机", "断层", "离谱"],
  },
  "set-pace": {
    headlines: ["节奏我来带，热搜你来追", "这波先把场面点燃"],
    kickers: ["【带节奏】从来不证明什么，它只负责让全场先跟着摆头。", "舆论一旦往这边拐，后面每张牌都像顺水推舟。"],
    shards: ["热度", "控评", "带节奏"],
  },
  "main-narrative": {
    headlines: ["主叙事上线，滤镜已经装好", "从现在开始，这个版本我来写"],
    kickers: ["【主叙事】不是一句话，是后续所有带节奏都能多踩一脚油门。", "只要框架先定住，细节就会自己去排队。"],
    shards: ["框架", "版本", "定调"],
  },
  "hot-search": {
    headlines: ["热度自己长脚了", "这波像是自带热搜体质"],
    kickers: ["【热搜体质】一开，摸牌都像是流量补给。", "有热度的时候再加热度，赢学的油门就锁死了。"],
    shards: ["热搜", "流量", "拱火"],
  },
  "everyone-knows": {
    headlines: ["这还用解释？大家都懂", "共识先默认，判词后补上"],
    kickers: ["【大家都懂】最狠的地方是把含糊其辞硬拧成默认结论。", "当全场都装作早已知道时，反驳会显得像没看懂空气。"],
    shards: ["懂的都懂", "默认", "收尾"],
  },
  "opinion-backfire": {
    headlines: ["舆情反噬，回旋镖飞回来了", "你带的节奏开始反咬自己"],
    kickers: ["【舆情反噬】专挑对面落后时再补一刀情绪。", "本来想借风起势，结果风把自己吹翻了。"],
    shards: ["回旋镖", "反噬", "翻车"],
  },
  "burst-point": {
    headlines: ["节奏爆点来了，直接引爆", "热度攒够了，现在一次兑现"],
    kickers: ["【节奏爆点】属于前面铺多少势，这里就收多少头。", "舆论条越往右，这拳就越像公告。"],
    shards: ["爆点", "兑现", "轰掉"],
  },
  snide: {
    headlines: ["这句阴阳味已经溢出来了", "不正面打，只拿语气扎你"],
    kickers: ["【阴阳怪气】不急着掉体面，先把人逼到想回三页。", "话说得轻，刀子全在字缝里。"],
    shards: ["阴阳", "扎心", "别扭"],
  },
  "poke-spot": {
    headlines: ["专挑痛点往里戳", "一句话，正中最不想提的地方"],
    kickers: ["【戳痛点】就是让体面和情绪一起往下掉。", "不是火力猛，是找得太准。"],
    shards: ["痛点", "戳穿", "破口"],
  },
  "dig-history": {
    headlines: ["旧账翻出来，空气立刻变老", "历史记录已经开始说话了"],
    kickers: ["【翻旧账】最适合配合标签一起下嘴。", "当黑历史被拖上桌，体面就会自动折旧。"],
    shards: ["旧帖", "黑历史", "连坐"],
  },
  "attach-label": {
    headlines: ["标签给你焊死在额头上", "这一贴，后面每句都带前科"],
    kickers: ["【挂标签】的狠不在当前伤害，在它让后续每张牌都更像补刀。", "先把身份写死，再让旧账自己长腿。"],
    shards: ["挂标签", "前科", "定性"],
  },
  "cant-hold": {
    headlines: ["绷不住了，现场开始散架", "情绪阈值已爆，别装稳了"],
    kickers: ["【崩不住了】不是输出，是强行把对面推过失态线。", "前面所有破防都在给这一秒攒火药。"],
    shards: ["崩了", "失态", "爆表"],
  },
  exposed: {
    headlines: ["你这下直接暴露了", "台词刚立完，人设就露馅"],
    kickers: ["【你这就暴露了】专打那种先立论后破功的瞬间。", "上一句刚讲完原则，下一句就把自己卖了。"],
    shards: ["露馅", "现形", "被看穿"],
  },
  "not-the-point": {
    headlines: ["先别打脸，这不是重点", "伤害不算，情绪先结"],
    kickers: ["【这不是重点】的高明之处是把实锤改造成破防。", "数字落不下来没关系，让对方心态先掉线。"],
    shards: ["不是重点", "改判", "转破防"],
  },
  "we-are-discussing": {
    headlines: ["我们讨论的是另外一层", "先把题目重写，再继续讲话"],
    kickers: ["【我们讨论的是】把下一张牌直接镀上一层带节奏光环。", "换完标题之后，同一句话都像新的议程。"],
    shards: ["重写题目", "议程", "换壳"],
  },
  "shift-meaning": {
    headlines: ["概念开始偷换，原标签失效", "状态不变？不，语义已经挪窝"],
    kickers: ["【偷换概念】最适合在对面身上已有设定时发动。", "你以为是在解释，其实是在悄悄改题干。"],
    shards: ["偷换", "挪义", "改题干"],
  },
  redefine: {
    headlines: ["那我重新定义一下", "你的增益我先按另一套标准算"],
    kickers: ["【重新定义】最像赢学里的管理权限。", "先拆掉对面的加成，再顺手把舆论拉回自己这边。"],
    shards: ["重定义", "拆 Buff", "改口径"],
  },
  "dont-derail": {
    headlines: ["别带偏了，回来答题", "转进通道当场封口"],
    kickers: ["【别带偏了】专门抓那种想滑走的瞬间。", "转进可以试，但今天这门先给你焊住。"],
    shards: ["封转进", "回题", "别偏"],
  },
  "topic-swap": {
    headlines: ["场子瞬间翻面，风向倒转", "赢的时候叫事实，输的时候叫语境"],
    kickers: ["【话题切换】一出，舆论符号直接换边。", "这不是逆转，这是把地图上下左右全换了。"],
    shards: ["翻面", "换轨", "倒转"],
  },
  "not-lost": {
    headlines: ["我没输，定义权还在手里", "体面掉了，但嘴上绝不认账"],
    kickers: ["【我没输】属于残血阶段最危险的嘴硬预热。", "先把失败从字典里删掉，后面的牌就能更疯一点。"],
    shards: ["没输", "嘴硬", "逆风"],
  },
  "stubborn-end": {
    headlines: ["嘴硬模式已锁死", "从现在开始，输也得站着说赢"],
    kickers: ["【嘴硬到底】让输出更硬，也让退路更少。", "体面越低，口气越大，这就是残血赢学。"],
    shards: ["嘴硬", "不认", "强撑"],
  },
  "force-explain": {
    headlines: ["解释先上，逻辑后补", "越心虚，字数越长"],
    kickers: ["【强行解释】在残血时特别像最后的连珠炮。", "说得够密，仿佛就能把破绽挤没。"],
    shards: ["解释", "硬拗", "补洞"],
  },
  "headwind-output": {
    headlines: ["逆风也要把输出灌满", "越被压着打，嘴越要硬着顶回去"],
    kickers: ["【逆风输出】会把失去的体面全变成额外火力。", "掉得越多，回来的句子就越像甩门。"],
    shards: ["逆风", "顶回去", "补伤"],
  },
  "not-over": {
    headlines: ["还没结束，香槟先放下", "体面归零？这句先不认"],
    kickers: ["【还没结束】专门负责从失败线边上硬抬一口气。", "你以为已经打空，他偏要用意志力卡住结算。"],
    shards: ["续命", "别开香槟", "硬抬"],
  },
  "win-hard": {
    headlines: ["赢麻了，收尾要带回声", "残血不是弱点，是终结语气"],
    kickers: ["【赢麻了】就是把所有委屈和热度一起砸出去。", "如果前面顶住了，这里就是一锤定音。"],
    shards: ["赢麻了", "终结", "砸穿"],
  },
};

const KEYWORD_SHARDS: Record<string, string[]> = {
  response: ["反手", "截断"],
  redirect: ["转进", "偏航"],
  label: ["挂标签", "定性"],
  momentumShift: ["热度", "控评"],
  stubborn: ["嘴硬", "逆风"],
  bringUpPast: ["旧账", "考古"],
};

const RESPONSE_FALLBACK_PREFIXES = ["反手一句：", "临门插话：", "当场截断："];

const unique = (items: string[]): string[] => [...new Set(items)];

const pick = (rng: () => number, items: string[]): string => {
  return items[Math.floor(rng() * items.length)];
};

const takeShards = (card: CardDefinition, template: Template | undefined): string[] => {
  const keywordShards = card.keywords.flatMap((keyword) => KEYWORD_SHARDS[keyword] ?? []);
  return unique([...(template?.shards ?? []), ...keywordShards, card.name]).slice(0, 4);
};

export const buildActionBeat = (input: {
  id: string;
  side: Side;
  mode: CardContext;
  card: CardDefinition;
  rng: () => number;
}): ActionBeat => {
  const template = CARD_TEMPLATES[input.card.id] ?? TYPE_TEMPLATES[input.card.type];
  const baseTemplate = TYPE_TEMPLATES[input.card.type];

  let headline = pick(input.rng, template.headlines);
  if (input.mode === "response" && !CARD_TEMPLATES[input.card.id]) {
    headline = `${pick(input.rng, RESPONSE_FALLBACK_PREFIXES)}${headline}`;
  }

  return {
    id: input.id,
    side: input.side,
    mode: input.mode,
    cardId: input.card.id,
    cardName: input.card.name,
    cardType: input.card.type,
    headline,
    kicker: pick(input.rng, template.kickers.length > 0 ? template.kickers : baseTemplate.kickers),
    shards: takeShards(input.card, template),
  };
};
