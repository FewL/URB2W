import type { ActionBeat, CardType, Phase, Side, StatusId } from "../core/types";
import type { FeedTone } from "../data/showbiz";

type TrackName = "title" | "battle";

type AudioSettings = {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  voiceEnabled: boolean;
};

type AudioState = AudioSettings & {
  available: boolean;
  unlocked: boolean;
};

type SpeechSpeaker = Side | "narrator";

type PersistedAudioSettings = Partial<AudioSettings> & {
  version?: number;
};

type TrackDefinition = {
  tempo: number;
  bass: Array<number | null>;
  lead: Array<number | null>;
  kicks: number[];
  hats: number[];
  pads: [number[], number[]];
};

const STORAGE_KEY = "urb2w:audio-settings";
const STORAGE_VERSION = 2;

const TRACKS: Record<TrackName, TrackDefinition> = {
  title: {
    tempo: 92,
    bass: [41, null, null, 41, 44, null, null, 44, 46, null, null, 46, 44, null, 41, null],
    lead: [65, null, 68, null, 70, null, 68, null, 65, null, 63, null, 61, null, 63, null],
    kicks: [0, 6, 8, 12],
    hats: [2, 4, 7, 10, 14],
    pads: [
      [53, 56, 60],
      [49, 53, 56],
    ],
  },
  battle: {
    tempo: 118,
    bass: [38, null, 38, null, 41, null, 38, null, 43, null, 41, null, 38, null, 36, null],
    lead: [60, null, null, 63, null, 65, null, 63, 67, null, null, 65, null, 63, 60, null],
    kicks: [0, 3, 6, 8, 10, 12, 14],
    hats: [1, 2, 4, 5, 7, 9, 11, 13, 15],
    pads: [
      [50, 53, 57],
      [48, 52, 55],
    ],
  },
};

const SLOT_LINES = {
  agenda: [
    "我们讨论的不是对错，是叙事。",
    "主叙事一换，输赢全变。",
    "热搜一上，道理自动站我这边。",
    "现在的重点是舆论，不是事实。",
    "节奏一起，谁认真谁就输了。",
  ],
  factcheck: [
    "先问是不是，再问为什么。",
    "数据呢？拿数据说话。",
    "你这逻辑跳跃也太大了。",
    "前提都不成立，结论有什么用？",
    "连事实都没搞清楚就开始输出？",
  ],
  redirect: [
    "这不是重点，重点是另一件事。",
    "别带偏，我们回到正题。",
    "经典转进，不谈问题谈态度。",
    "顾左右而言他是吧？",
    "话题切换得真快，不敢正面接？",
  ],
  redefine: [
    "你这是典型偷换概念。",
    "我重新定义一下，你就懂了。",
    "词还是那个词，意思已经不是那个意思。",
    "标准一变，结论自然跟着变。",
    "你对XX的理解完全错了。",
  ],
  label: [
    "你急了，你真的急了。",
    "双标警告，别双标。",
    "直接给你挂个标签算了。",
    "阴阳怪气什么呢？",
    "破防之前先扣帽，传统艺能。",
  ],
  meltdown: [
    "戳到你痛点了是吧？",
    "破防检测，阳性。",
    "舆情反噬来了，挡不住。",
    "你这就暴露真实想法了？",
    "绷不住了，开始乱咬了。",
  ],
  history: [
    "引用旧帖，自己看你以前说的。",
    "别装失忆，翻旧账了。",
    "历史记录不会骗人。",
    "去年你可不是这么说的。",
    "自己打自己脸是吧？",
  ],
  consensus: [
    "群体共识在此，你反对没用。",
    "大家都懂，就你装不懂。",
    "上强度了，准备接好。",
    "节奏爆点已触发。",
    "路人都看明白了。",
  ],
  stubborn: [
    "我没输，只是战略撤退。",
    "嘴硬到底，绝不承认。",
    "强行解释一波，完美闭环。",
    "逆风输出，越逆风越勇。",
    "还没结束，游戏才刚刚开始。",
    "赢麻了，已经赢麻了。",
    "我们赢太多了，都累了。",
    "没人比我们更懂赢。",
    "看似输了，其实全赢。",
    "结果不重要，姿态我赢了。",
  ],
  calm: [
    "我寻思也没多大事。",
    "没必要这么认真，玩玩而已。",
    "你先别急，慢慢说。",
    "冷静点，别上头。",
    "不至于，真不至于。",
  ],
} as const;

const CARD_LINES: Partial<Record<string, readonly string[]>> = {
  "you-urgent": SLOT_LINES.label,
  "ask-first": SLOT_LINES.factcheck,
  "where-data": SLOT_LINES.factcheck,
  whatabout: SLOT_LINES.redirect,
  ponder: SLOT_LINES.calm,
  "double-warning": SLOT_LINES.label,
  "quote-out": SLOT_LINES.factcheck,
  "calm-down": SLOT_LINES.calm,
  "classic-redirect": SLOT_LINES.redirect,
  "quote-old-post": SLOT_LINES.history,
  "not-serious": SLOT_LINES.calm,
  "logic-leap": SLOT_LINES.factcheck,
  "set-pace": SLOT_LINES.agenda,
  "main-narrative": SLOT_LINES.agenda,
  "hot-search": SLOT_LINES.agenda,
  "group-consensus": SLOT_LINES.consensus,
  "everyone-knows": SLOT_LINES.consensus,
  "raise-intensity": SLOT_LINES.consensus,
  "opinion-backfire": SLOT_LINES.meltdown,
  "burst-point": SLOT_LINES.consensus,
  snide: SLOT_LINES.label,
  "poke-spot": SLOT_LINES.meltdown,
  "break-check": SLOT_LINES.meltdown,
  "dig-history": SLOT_LINES.history,
  "attach-label": SLOT_LINES.label,
  "keep-hitting": SLOT_LINES.meltdown,
  "cant-hold": SLOT_LINES.meltdown,
  exposed: SLOT_LINES.meltdown,
  "not-the-point": SLOT_LINES.redirect,
  "we-are-discussing": SLOT_LINES.agenda,
  "shift-meaning": SLOT_LINES.redefine,
  redefine: SLOT_LINES.redefine,
  "dont-derail": SLOT_LINES.redirect,
  "topic-swap": SLOT_LINES.redirect,
  "not-lost": SLOT_LINES.stubborn,
  "stubborn-end": SLOT_LINES.stubborn,
  "force-explain": SLOT_LINES.stubborn,
  "headwind-output": SLOT_LINES.stubborn,
  "not-over": SLOT_LINES.stubborn,
  "win-hard": SLOT_LINES.stubborn,
};

const TYPE_LINES: Record<CardType, readonly string[]> = {
  Thesis: SLOT_LINES.agenda,
  Argument: SLOT_LINES.consensus,
  Counter: SLOT_LINES.factcheck,
  Label: SLOT_LINES.label,
  Redirect: SLOT_LINES.redirect,
  Finisher: SLOT_LINES.stubborn,
};

const OUTCOME_LINES = {
  victory: ["赢麻了，已经赢麻了。", "我们赢太多了，都累了。", "没人比我们更懂赢。"],
  defeat: ["看似输了，其实全赢。", "结果不重要，姿态我赢了。", "我没输，只是战略撤退。"],
} as const;

const STATUS_LINES: Record<StatusId, readonly string[]> = {
  urgent: ["急了急了急了"],
  doubleStandard: ["经典双标，鉴定完毕"],
  stubborn: ["嘴硬王者，永不认输"],
  speechless: ["彻底失语，无话可说"],
  mainNarrative: ["主叙事已占领"],
  labeled: ["标签已挂上，撕不掉"],
  lastWord: ["还没结束，等着"],
};

const PHASE_LINES: Partial<Record<Phase, string>> = {
  "player-turn": "轮到你了",
  "enemy-turn": "对面开始了",
  "response-window": "回应窗口",
  reward: "战后加卡",
};

const hasWindow = (): boolean => typeof window !== "undefined";

const midiToFrequency = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const choose = <T,>(items: readonly T[]): T => {
  return items[Math.floor(Math.random() * items.length)];
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

class WinningAudioDirector {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private schedulerId: number | null = null;
  private activeTrack: TrackName | null = null;
  private stepIndex = 0;
  private nextStepAt = 0;
  private unlocked = false;
  private settings: AudioSettings = {
    musicEnabled: true,
    sfxEnabled: true,
    voiceEnabled: true,
  };
  private lastVoiceTime = 0;
  private speechQueueUntil = 0;

  constructor() {
    this.settings = this.loadSettings();
  }

  getState(): AudioState {
    return {
      ...this.settings,
      available: this.getAudioCtor() !== null,
      unlocked: this.unlocked,
    };
  }

  unlock(): void {
    if (!this.ensureContext() || !this.context) {
      return;
    }
    this.unlocked = true;
    void this.context.resume().then(() => {
      this.syncMusicGain(0.12);
      if (this.settings.musicEnabled && this.activeTrack) {
        this.resetSequenceClock();
        this.startScheduler();
      }
    }).catch(() => undefined);
  }

  startMusic(track: TrackName): void {
    this.activeTrack = track;
    if (!this.ensureContext() || !this.context) {
      return;
    }
    this.resetSequenceClock();
    this.syncMusicGain(0.18);
    if (this.context.state === "running" && this.settings.musicEnabled) {
      this.startScheduler();
    }
  }

  toggleMusic(): boolean {
    this.settings.musicEnabled = !this.settings.musicEnabled;
    this.persistSettings();
    this.syncMusicGain(0.12);
    if (!this.settings.musicEnabled) {
      this.stopScheduler();
      return this.settings.musicEnabled;
    }
    if (this.activeTrack && this.context?.state === "running") {
      this.resetSequenceClock();
      this.startScheduler();
    }
    return this.settings.musicEnabled;
  }

  toggleSfx(): boolean {
    this.settings.sfxEnabled = !this.settings.sfxEnabled;
    this.persistSettings();
    if (this.sfxGain && this.context) {
      const now = this.context.currentTime;
      this.sfxGain.gain.cancelScheduledValues(now);
      this.sfxGain.gain.linearRampToValueAtTime(this.settings.sfxEnabled ? 0.92 : 0.0001, now + 0.08);
    }
    return this.settings.sfxEnabled;
  }

  toggleVoice(): boolean {
    this.settings.voiceEnabled = !this.settings.voiceEnabled;
    this.persistSettings();
    if (!this.settings.voiceEnabled && hasWindow() && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      this.speechQueueUntil = 0;
    }
    return this.settings.voiceEnabled;
  }

  playUiHover(): void {
    if (!this.isSfxReady()) {
      return;
    }
    const now = this.context!.currentTime + 0.01;
    this.playTone(this.sfxGain!, now, midiToFrequency(79), 0.08, 0.045, "triangle", {
      attack: 0.008,
      endFrequency: midiToFrequency(84),
    });
  }

  playUiConfirm(): void {
    if (!this.isSfxReady()) {
      return;
    }
    const now = this.context!.currentTime + 0.01;
    this.playKick(now, 0.1, 78);
    this.playTone(this.sfxGain!, now, midiToFrequency(72), 0.15, 0.06, "square", {
      attack: 0.01,
      endFrequency: midiToFrequency(79),
    });
  }

  playNewsSting(): void {
    if (!this.isSfxReady()) {
      return;
    }
    const now = this.context!.currentTime + 0.01;
    this.playNoiseBurst(this.sfxGain!, now, 0.03, 0.04, "highpass", 4200);
    this.playTone(this.sfxGain!, now, midiToFrequency(76), 0.09, 0.05, "triangle", {
      attack: 0.006,
      endFrequency: midiToFrequency(81),
    });
    this.playTone(this.sfxGain!, now + 0.08, midiToFrequency(83), 0.14, 0.045, "square", {
      attack: 0.01,
      endFrequency: midiToFrequency(88),
    });
  }

  playFeedPulse(tone: FeedTone): void {
    if (!this.isSfxReady()) {
      return;
    }
    const now = this.context!.currentTime + 0.01;
    if (tone === "alert") {
      this.playNoiseBurst(this.sfxGain!, now, 0.04, 0.045, "bandpass", 1800);
      this.playTone(this.sfxGain!, now, midiToFrequency(69), 0.12, 0.06, "sawtooth", {
        attack: 0.008,
        endFrequency: midiToFrequency(76),
      });
      return;
    }
    if (tone === "meltdown") {
      this.playTone(this.sfxGain!, now, midiToFrequency(59), 0.12, 0.05, "square", {
        attack: 0.006,
        endFrequency: midiToFrequency(52),
      });
      this.playNoiseBurst(this.sfxGain!, now + 0.02, 0.03, 0.03, "lowpass", 1200);
      return;
    }
    if (tone === "snark") {
      this.playTone(this.sfxGain!, now, midiToFrequency(78), 0.08, 0.04, "triangle", {
        attack: 0.005,
        endFrequency: midiToFrequency(74),
      });
      this.playTone(this.sfxGain!, now + 0.05, midiToFrequency(73), 0.08, 0.03, "triangle", {
        attack: 0.005,
      });
      return;
    }
    this.playTone(this.sfxGain!, now, midiToFrequency(72), 0.1, 0.042, "square", {
      attack: 0.008,
      endFrequency: midiToFrequency(79),
    });
  }

  playPhaseChange(phase: Phase): void {
    if (!this.isSfxReady()) {
      return;
    }
    if (phase === "run-victory" || phase === "run-defeat") {
      return;
    }
    const now = this.context!.currentTime + 0.01;
    this.playTone(this.sfxGain!, now, midiToFrequency(67), 0.12, 0.05, "triangle", {
      attack: 0.01,
      endFrequency: midiToFrequency(72),
    });
    this.playTone(this.sfxGain!, now + 0.06, midiToFrequency(74), 0.11, 0.04, "triangle", {
      attack: 0.01,
    });
    const spoken = PHASE_LINES[phase];
    if (spoken) {
      this.speak(spoken, 150, 1.02, 0.96, false, {
        speaker: "narrator",
        minGapMs: 720,
      });
    }
  }

  playOutcome(victory: boolean): number {
    if (this.isSfxReady()) {
      const now = this.context!.currentTime + 0.02;
      if (victory) {
        this.playKick(now, 0.16, 60);
        this.playTone(this.sfxGain!, now, midiToFrequency(72), 0.5, 0.09, "sawtooth", {
          attack: 0.02,
          endFrequency: midiToFrequency(79),
        });
        this.playTone(this.sfxGain!, now + 0.14, midiToFrequency(76), 0.48, 0.08, "triangle", {
          attack: 0.02,
        });
      } else {
        this.playKick(now, 0.12, 54);
        this.playTone(this.sfxGain!, now, midiToFrequency(53), 0.42, 0.08, "sawtooth", {
          attack: 0.02,
          endFrequency: midiToFrequency(45),
        });
        this.playNoiseBurst(this.sfxGain!, now + 0.06, 0.18, 0.08, "lowpass", 780);
      }
    }

    return this.speak(
      choose(victory ? OUTCOME_LINES.victory : OUTCOME_LINES.defeat),
      120,
      victory ? 1.08 : 0.92,
      victory ? 0.95 : 0.78,
      true,
      {
        speaker: "narrator",
        minGapMs: 0,
      },
    );
  }

  playStatusLine(statusId: StatusId, side: Side, delayMs = 0): number {
    const lines = STATUS_LINES[statusId];
    if (!lines || lines.length === 0) {
      return 0;
    }
    return this.speak(
      choose(lines),
      delayMs,
      side === "enemy" ? 0.88 : 1.02,
      side === "enemy"
        ? statusId === "mainNarrative" || statusId === "lastWord"
          ? 0.7
          : 0.76
        : statusId === "mainNarrative" || statusId === "lastWord"
          ? 0.92
          : 1.02,
      false,
      {
        speaker: side,
        minGapMs: 520,
      },
    );
  }

  playActionBeat(beat: ActionBeat, delayMs = 0): number {
    if (this.settings.sfxEnabled) {
      this.runLater(delayMs, () => this.playActionBeatNow(beat));
    }
    const extraDelay = beat.mode === "response" ? 60 : beat.cardType === "Finisher" ? 70 : 95;
    return this.speak(
      this.voiceLineForBeat(beat),
      delayMs + extraDelay,
      beat.side === "player"
        ? beat.mode === "response"
          ? 1.06
          : 0.98
        : beat.mode === "response"
          ? 0.94
          : 0.88,
      beat.side === "player"
        ? beat.mode === "response"
          ? 1.14
          : 1.02
        : beat.mode === "response"
          ? 0.82
          : 0.76,
      false,
      {
        speaker: beat.side,
        minGapMs: 140,
      },
    );
  }

  private playActionBeatNow(beat: ActionBeat): void {
    if (!this.isSfxReady()) {
      return;
    }
    const now = this.context!.currentTime + 0.01;
    switch (beat.cardType) {
      case "Thesis":
        this.playTone(this.sfxGain!, now, midiToFrequency(60), 0.12, 0.05, "triangle", {
          attack: 0.01,
          endFrequency: midiToFrequency(65),
        });
        this.playTone(this.sfxGain!, now + 0.09, midiToFrequency(67), 0.16, 0.048, "triangle", {
          attack: 0.01,
        });
        break;
      case "Argument":
        this.playKick(now, 0.11, 72);
        this.playTone(this.sfxGain!, now, midiToFrequency(52), 0.18, 0.075, "sawtooth", {
          attack: 0.008,
          endFrequency: midiToFrequency(43),
        });
        break;
      case "Counter":
        this.playNoiseBurst(this.sfxGain!, now, 0.06, 0.06, "highpass", 2400);
        this.playTone(this.sfxGain!, now, midiToFrequency(82), 0.09, 0.05, "square", {
          attack: 0.004,
          endFrequency: midiToFrequency(73),
        });
        break;
      case "Label":
        this.playTone(this.sfxGain!, now, midiToFrequency(63), 0.14, 0.06, "square", {
          attack: 0.006,
          endFrequency: midiToFrequency(56),
        });
        this.playNoiseBurst(this.sfxGain!, now + 0.02, 0.04, 0.03, "bandpass", 1600);
        break;
      case "Redirect":
        this.playTone(this.sfxGain!, now, midiToFrequency(58), 0.22, 0.055, "triangle", {
          attack: 0.01,
          endFrequency: midiToFrequency(75),
          pan: beat.side === "player" ? -0.5 : 0.5,
        });
        this.playNoiseBurst(this.sfxGain!, now + 0.03, 0.08, 0.035, "highpass", 1700);
        break;
      case "Finisher":
        this.playKick(now, 0.16, 56);
        this.playTone(this.sfxGain!, now, midiToFrequency(48), 0.32, 0.09, "sawtooth", {
          attack: 0.01,
          endFrequency: midiToFrequency(39),
        });
        this.playTone(this.sfxGain!, now + 0.05, midiToFrequency(72), 0.28, 0.065, "triangle", {
          attack: 0.016,
        });
        break;
      default:
        break;
    }
  }

  private voiceLineForBeat(beat: ActionBeat): string {
    const specific = CARD_LINES[beat.cardId];
    if (specific && specific.length > 0) {
      return choose(specific);
    }
    return choose(TYPE_LINES[beat.cardType]);
  }

  private speak(
    text: string,
    delayMs: number,
    rate: number,
    pitch: number,
    force = false,
    options: {
      speaker?: SpeechSpeaker;
      minGapMs?: number;
    } = {},
  ): number {
    if (!this.settings.voiceEnabled || !hasWindow() || !("speechSynthesis" in window)) {
      return 0;
    }

    const now = performance.now();
    const targetAt = now + delayMs;
    const queueGapMs = options.minGapMs ?? 120;
    const estimatedDurationMs = this.estimateSpeechDuration(text, rate);
    const scheduledAt = force
      ? targetAt
      : Math.max(targetAt, this.speechQueueUntil > now ? this.speechQueueUntil + queueGapMs : targetAt);
    this.lastVoiceTime = scheduledAt;
    this.speechQueueUntil = scheduledAt + estimatedDurationMs;

    this.runLater(Math.max(0, scheduledAt - now), () => {
      if (!this.settings.voiceEnabled || !("speechSynthesis" in window)) {
        return;
      }
      const synth = window.speechSynthesis;
      if (force) {
        synth.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = clamp(rate, 0.72, 1.22);
      utterance.pitch = clamp(pitch, 0.68, 1.28);
      utterance.volume = 0.8;
      const voice = this.selectVoice(synth, options.speaker ?? "narrator");
      if (voice) {
        utterance.voice = voice;
      }
      synth.speak(utterance);
    });
    return Math.max(0, scheduledAt - now) + estimatedDurationMs;
  }

  private estimateSpeechDuration(text: string, rate: number): number {
    const normalizedRate = clamp(rate, 0.72, 1.22);
    const punctuationWeight = (text.match(/[，。！？、,.!?]/g) ?? []).length * 90;
    const base = 340;
    const perChar = 165;
    return Math.max(520, Math.round((base + text.length * perChar + punctuationWeight) / normalizedRate));
  }

  private selectVoice(
    synth: SpeechSynthesis,
    speaker: SpeechSpeaker,
  ): SpeechSynthesisVoice | null {
    const zhVoices = synth
      .getVoices()
      .filter((candidate) => candidate.lang.toLowerCase().startsWith("zh"));
    if (zhVoices.length === 0) {
      return null;
    }
    if (speaker === "enemy") {
      return zhVoices[1] ?? zhVoices[zhVoices.length - 1] ?? zhVoices[0];
    }
    return zhVoices[0];
  }

  private loadSettings(): AudioSettings {
    if (!hasWindow()) {
      return {
        musicEnabled: true,
        sfxEnabled: true,
        voiceEnabled: true,
      };
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          musicEnabled: true,
          sfxEnabled: true,
          voiceEnabled: true,
        };
      }
      const parsed = JSON.parse(raw) as PersistedAudioSettings;
      if (parsed.version !== STORAGE_VERSION) {
        return {
          musicEnabled: true,
          sfxEnabled: true,
          voiceEnabled: true,
        };
      }
      return {
        musicEnabled: parsed.musicEnabled ?? true,
        sfxEnabled: parsed.sfxEnabled ?? true,
        voiceEnabled: parsed.voiceEnabled ?? true,
      };
    } catch {
      return {
        musicEnabled: true,
        sfxEnabled: true,
        voiceEnabled: true,
      };
    }
  }

  private persistSettings(): void {
    if (!hasWindow()) {
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        ...this.settings,
      }),
    );
  }

  private ensureContext(): boolean {
    if (this.context) {
      return true;
    }
    const AudioCtor = this.getAudioCtor();
    if (!AudioCtor) {
      return false;
    }
    this.context = new AudioCtor();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.masterGain.gain.value = 0.9;
    this.musicGain.gain.value = this.settings.musicEnabled ? 0.16 : 0.0001;
    this.sfxGain.gain.value = this.settings.sfxEnabled ? 0.92 : 0.0001;
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.noiseBuffer = this.createNoiseBuffer(this.context);
    this.unlocked = this.context.state === "running";
    return true;
  }

  private getAudioCtor(): typeof AudioContext | null {
    if (!hasWindow()) {
      return null;
    }
    const candidate = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return candidate ?? null;
  }

  private syncMusicGain(rampSeconds: number): void {
    if (!this.context || !this.musicGain) {
      return;
    }

    const target =
      this.settings.musicEnabled && this.activeTrack
        ? this.activeTrack === "battle"
          ? 0.18
          : 0.13
        : 0.0001;
    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(target, now + rampSeconds);
  }

  private startScheduler(): void {
    if (this.schedulerId !== null || !hasWindow()) {
      return;
    }
    this.schedulerId = window.setInterval(() => {
      this.scheduleAhead();
    }, 50);
  }

  private stopScheduler(): void {
    if (this.schedulerId === null || !hasWindow()) {
      return;
    }
    window.clearInterval(this.schedulerId);
    this.schedulerId = null;
  }

  private resetSequenceClock(): void {
    if (!this.context || !this.activeTrack) {
      return;
    }
    this.stepIndex = 0;
    this.nextStepAt = this.context.currentTime + 0.08;
  }

  private scheduleAhead(): void {
    if (
      !this.context ||
      !this.activeTrack ||
      !this.settings.musicEnabled ||
      this.context.state !== "running" ||
      !this.musicGain
    ) {
      return;
    }
    const track = TRACKS[this.activeTrack];
    const lookAhead = 0.18;
    while (this.nextStepAt < this.context.currentTime + lookAhead) {
      this.scheduleTrackStep(track, this.stepIndex, this.nextStepAt);
      this.nextStepAt += 60 / track.tempo / 4;
      this.stepIndex = (this.stepIndex + 1) % 16;
    }
  }

  private scheduleTrackStep(track: TrackDefinition, step: number, time: number): void {
    if (track.kicks.includes(step)) {
      this.playKick(time, this.activeTrack === "battle" ? 0.1 : 0.08, this.activeTrack === "battle" ? 60 : 72, true);
    }
    if (track.hats.includes(step)) {
      this.playNoiseBurst(this.musicGain!, time, 0.032, 0.015, "highpass", 5400);
    }

    const bassNote = track.bass[step];
    if (bassNote !== null) {
      this.playTone(this.musicGain!, time, midiToFrequency(bassNote), 0.32, 0.06, "triangle", {
        attack: 0.02,
        endFrequency: midiToFrequency(bassNote - 1),
      });
    }

    const leadNote = track.lead[step];
    if (leadNote !== null) {
      this.playTone(this.musicGain!, time + 0.01, midiToFrequency(leadNote), 0.18, 0.035, "sawtooth", {
        attack: 0.01,
        endFrequency: midiToFrequency(leadNote + 2),
      });
    }

    if (step === 0 || step === 8) {
      const chord = step === 0 ? track.pads[0] : track.pads[1];
      chord.forEach((note, index) => {
        this.playTone(this.musicGain!, time + index * 0.006, midiToFrequency(note), 0.62, 0.026, "triangle", {
          attack: 0.04,
        });
      });
    }
  }

  private playKick(time: number, gain: number, rootHz: number, musicBus = false): void {
    const bus = musicBus ? this.musicGain : this.sfxGain;
    if (!this.context || !bus) {
      return;
    }
    this.playTone(bus, time, rootHz, 0.18, gain, "sine", {
      attack: 0.004,
      endFrequency: Math.max(24, rootHz * 0.42),
    });
    this.playNoiseBurst(bus, time, 0.024, gain * 0.22, "bandpass", 940);
  }

  private playTone(
    bus: GainNode,
    time: number,
    frequency: number,
    duration: number,
    peak: number,
    wave: OscillatorType,
    options?: {
      attack?: number;
      endFrequency?: number;
      filterType?: BiquadFilterType;
      filterFrequency?: number;
      pan?: number;
    },
  ): void {
    if (!this.context) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const amplitude = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (options?.endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(12, options.endFrequency), time + duration);
    }

    let currentNode: AudioNode = oscillator;
    if (options?.filterType && options.filterFrequency) {
      const filter = this.context.createBiquadFilter();
      filter.type = options.filterType;
      filter.frequency.setValueAtTime(options.filterFrequency, time);
      currentNode.connect(filter);
      currentNode = filter;
    }
    if (typeof StereoPannerNode !== "undefined") {
      const panner = this.context.createStereoPanner();
      panner.pan.setValueAtTime(options?.pan ?? 0, time);
      currentNode.connect(panner);
      currentNode = panner;
    }

    currentNode.connect(amplitude);
    amplitude.connect(bus);
    const attack = options?.attack ?? 0.012;
    amplitude.gain.setValueAtTime(0.0001, time);
    amplitude.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + attack);
    amplitude.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
    oscillator.onended = () => {
      oscillator.disconnect();
      amplitude.disconnect();
    };
  }

  private playNoiseBurst(
    bus: GainNode,
    time: number,
    duration: number,
    peak: number,
    filterType: BiquadFilterType,
    filterFrequency: number,
  ): void {
    if (!this.context || !this.noiseBuffer) {
      return;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const amplitude = this.context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFrequency, time);
    source.connect(filter);
    filter.connect(amplitude);
    amplitude.connect(bus);
    amplitude.gain.setValueAtTime(0.0001, time);
    amplitude.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + 0.005);
    amplitude.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.start(time);
    source.stop(time + duration + 0.02);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      amplitude.disconnect();
    };
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private isSfxReady(): boolean {
    return Boolean(this.ensureContext() && this.context && this.context.state === "running" && this.settings.sfxEnabled && this.sfxGain);
  }

  private runLater(delayMs: number, callback: () => void): void {
    if (!hasWindow()) {
      return;
    }
    window.setTimeout(callback, Math.max(0, delayMs));
  }
}

export const winningAudio = new WinningAudioDirector();
