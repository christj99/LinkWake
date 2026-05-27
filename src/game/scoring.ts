import type { LevelScript } from "../types/level-script";

export type ScoreSnapshot = {
  score: number;
  bestScore: number;
};

export class ScoreState {
  private readonly level: LevelScript;
  private currentScore: number;

  constructor(level: LevelScript) {
    this.level = level;
    this.currentScore = level.scoring.max_score;
  }

  get score(): number {
    return this.currentScore;
  }

  get bestScore(): number {
    return readBestScore(this.level.url_key);
  }

  applyHit(): number {
    this.currentScore = Math.max(
      0,
      this.currentScore - this.level.scoring.deductions.hit,
    );

    return this.currentScore;
  }

  finish(): ScoreSnapshot {
    const bestScore = Math.max(this.currentScore, this.bestScore);

    writeBestScore(this.level.url_key, bestScore);

    return {
      score: this.currentScore,
      bestScore,
    };
  }
}

export function bestScoreKey(urlKey: string): string {
  return `linkwake:best:${urlKey}`;
}

export function readBestScore(urlKey: string): number {
  try {
    const stored = window.localStorage.getItem(bestScoreKey(urlKey));
    const score = stored ? Number.parseInt(stored, 10) : 0;

    return Number.isFinite(score) ? score : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(urlKey: string, score: number): void {
  try {
    window.localStorage.setItem(bestScoreKey(urlKey), String(score));
  } catch {
    // localStorage may be unavailable in private or restricted contexts.
  }
}

