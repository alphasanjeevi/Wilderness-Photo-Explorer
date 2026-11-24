import { CrazyGamesUserProfile } from '../types/game';

export type CrazyGamesAdType = 'midgame' | 'rewarded';

export interface AdRequestResult {
  completed: boolean;
  reason?: string;
}

export interface CrazyGamesRawSDK {
  environment?: 'crazygames' | 'local' | 'disabled';
  init: () => Promise<void>;
  game: {
    loadingStart: () => void;
    loadingStop: () => void;
    gameplayStart: () => void;
    gameplayStop: () => void;
    happytime: () => void;
  };
  ad: {
    requestAd: (
      type: CrazyGamesAdType,
      callbacks: {
        adStarted?: () => void;
        adFinished?: () => void;
        adError?: (error: unknown, errorData?: unknown) => void;
      }
    ) => void;
  };
  user: {
    isUserAccountAvailable?: boolean | (() => boolean);
    getUser: () => Promise<CrazyGamesUserProfile | null>;
    showAuthPrompt: () => Promise<CrazyGamesUserProfile | null>;
    addAuthListener: (listener: (user: CrazyGamesUserProfile | null) => void) => void;
    removeAuthListener: (listener: (user: CrazyGamesUserProfile | null) => void) => void;
  };
  data: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
    clear: () => void;
  };
}

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: CrazyGamesRawSDK;
    };
  }
}

class CrazyGamesClient {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private sdkAvailable = false;
  private loadingStarted = false;
  private loadingStopped = false;
  private gameplayActive = false;
  private adPlaying = false;
  private rewardedAdsDisabled = false;
  private lastMidgameAtMs = 0;
  private currentUser: CrazyGamesUserProfile | null = null;
  private authListeners = new Set<(user: CrazyGamesUserProfile | null) => void>();
  private rawAuthListenerBound = false;

  private getRawSdk(): CrazyGamesRawSDK | null {
    if (typeof window === 'undefined') return null;
    return window.CrazyGames?.SDK ?? null;
  }

  public isSdkReady(): boolean {
    return this.initialized && this.sdkAvailable;
  }

  public isUsingSdkData(): boolean {
    const sdk = this.getRawSdk();
    return Boolean(this.initialized && this.sdkAvailable && sdk?.data);
  }

  public getEnvironment(): 'crazygames' | 'local' | 'disabled' {
    const sdk = this.getRawSdk();
    if (!sdk || !this.sdkAvailable) return 'disabled';
    return sdk.environment ?? 'crazygames';
  }

  public isRewardedAdAvailable(): boolean {
    return this.initialized && this.sdkAvailable && !this.rewardedAdsDisabled;
  }

  public isUserAccountAvailable(): boolean {
    const sdk = this.getRawSdk();
    if (!sdk || !this.sdkAvailable || !sdk.user) return false;
    const avail = sdk.user.isUserAccountAvailable;
    if (typeof avail === 'function') {
      try {
        return Boolean(avail());
      } catch {
        return false;
      }
    }
    return Boolean(avail);
  }

  public getCurrentUser(): CrazyGamesUserProfile | null {
    return this.currentUser;
  }

  public getUserStorageScope(user: CrazyGamesUserProfile | null = this.currentUser): string {
    if (!user?.username) return 'guest';
    const clean = user.username
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 48);
    return clean ? `user_${clean}` : 'guest';
  }

  public resetForTest(): void {
    this.initialized = false;
    this.initPromise = null;
    this.sdkAvailable = false;
    this.loadingStarted = false;
    this.loadingStopped = false;
    this.gameplayActive = false;
    this.adPlaying = false;
    this.rewardedAdsDisabled = false;
    this.lastMidgameAtMs = 0;
    this.currentUser = null;
    this.rawAuthListenerBound = false;
    this.authListeners.clear();
  }

  public async init(): Promise<CrazyGamesUserProfile | null> {
    if (this.initPromise) {
      await this.initPromise;
      return this.currentUser;
    }

    this.initPromise = (async () => {
      const sdk = this.getRawSdk();
      if (!sdk) {
        this.initialized = true;
        this.sdkAvailable = false;
        this.rewardedAdsDisabled = true;
        return;
      }

      try {
        if (!this.loadingStarted) {
          this.loadingStarted = true;
          sdk.game?.loadingStart?.();
        }
      } catch {
        // Ignore if environment disables loadingStart before init
      }

      try {
        await Promise.race([
          sdk.init(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('CrazyGames SDK init timeout')), 3500)
          ),
        ]);
        const env = sdk.environment;
        this.sdkAvailable = env !== 'disabled';
        this.initialized = true;
        this.rewardedAdsDisabled = !this.sdkAvailable;

        if (this.sdkAvailable && sdk.user) {
          if (!this.rawAuthListenerBound && sdk.user.addAuthListener) {
            this.rawAuthListenerBound = true;
            sdk.user.addAuthListener((user) => {
              this.currentUser = user ?? null;
              for (const cb of this.authListeners) {
                cb(this.currentUser);
              }
            });
          }

          if (this.isUserAccountAvailable()) {
            try {
              const user = await sdk.user.getUser();
              this.currentUser = user ?? null;
            } catch {
              this.currentUser = null;
            }
          }
        }
      } catch {
        this.initialized = true;
        this.sdkAvailable = false;
        this.rewardedAdsDisabled = true;
        this.currentUser = null;
      }
    })();

    await this.initPromise;
    return this.currentUser;
  }

  public notifyLoadingStop(): void {
    if (this.loadingStopped) return;
    this.loadingStopped = true;
    const sdk = this.getRawSdk();
    if (!sdk || !this.sdkAvailable) return;
    try {
      sdk.game?.loadingStop?.();
    } catch {
      // Ignore
    }
  }

  public setGameplayActive(active: boolean): void {
    const desired = active && !this.adPlaying;
    if (desired === this.gameplayActive) return;
    this.gameplayActive = desired;

    const sdk = this.getRawSdk();
    if (!sdk || !this.sdkAvailable) return;
    try {
      if (desired) {
        sdk.game?.gameplayStart?.();
      } else {
        sdk.game?.gameplayStop?.();
      }
    } catch {
      // Ignore
    }
  }

  public triggerHappytime(): void {
    const sdk = this.getRawSdk();
    if (!sdk || !this.sdkAvailable) return;
    try {
      sdk.game?.happytime?.();
    } catch {
      // Ignore
    }
  }

  public subscribeAuth(listener: (user: CrazyGamesUserProfile | null) => void): () => void {
    this.authListeners.add(listener);
    return () => {
      this.authListeners.delete(listener);
    };
  }

  public async promptSignIn(): Promise<{
    user: CrazyGamesUserProfile | null;
    errorCode?: string;
  }> {
    const sdk = this.getRawSdk();
    if (!sdk || !this.sdkAvailable || !this.isUserAccountAvailable()) {
      return { user: null, errorCode: 'unavailable' };
    }

    try {
      const user = await sdk.user.showAuthPrompt();
      this.currentUser = user ?? null;
      for (const cb of this.authListeners) {
        cb(this.currentUser);
      }
      return { user: this.currentUser };
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : 'cancelled';
      return { user: this.currentUser, errorCode: code };
    }
  }

  public async requestAd(
    type: CrazyGamesAdType,
    handlers: {
      onAdStart?: () => void;
      onAdEnd?: () => void;
    }
  ): Promise<AdRequestResult> {
    if (this.adPlaying) {
      return { completed: false, reason: 'adInProgress' };
    }

    const sdk = this.getRawSdk();
    if (!sdk || !this.sdkAvailable || !sdk.ad?.requestAd) {
      if (type === 'rewarded') {
        this.rewardedAdsDisabled = true;
      }
      return {
        completed: type === 'midgame',
        reason: type === 'midgame' ? 'skipped_offline' : 'unavailable',
      };
    }

    if (type === 'midgame') {
      const now = Date.now();
      if (now - this.lastMidgameAtMs < 45_000) {
        return { completed: true, reason: 'localCooldown' };
      }
      this.lastMidgameAtMs = now;
    }

    return new Promise<AdRequestResult>((resolve) => {
      let settled = false;
      const finish = (result: AdRequestResult) => {
        if (settled) return;
        settled = true;
        this.adPlaying = false;
        handlers.onAdEnd?.();
        resolve(result);
      };

      try {
        sdk.ad.requestAd(type, {
          adStarted: () => {
            this.adPlaying = true;
            this.setGameplayActive(false);
            handlers.onAdStart?.();
          },
          adFinished: () => {
            finish({ completed: true });
          },
          adError: (error) => {
            const reason =
              typeof error === 'object' && error !== null && 'code' in error
                ? String((error as { code?: unknown }).code)
                : String(error ?? 'adError');
            if (
              type === 'rewarded' &&
              (reason === 'adsDisabled' || reason === 'adsNotEnabled' || reason === 'unavailable')
            ) {
              this.rewardedAdsDisabled = true;
            }
            finish({ completed: false, reason });
          },
        });
      } catch (err) {
        finish({ completed: false, reason: String(err) });
      }
    });
  }

  public dataGetItem(key: string): string | null {
    // Exclusively use CrazyGames SDK Data module when running on CrazyGames / local QA
    if (this.isUsingSdkData()) {
      try {
        return this.getRawSdk()!.data.getItem(key);
      } catch {
        return null;
      }
    }

    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  public dataSetItem(key: string, value: string): boolean {
    // Exclusively use CrazyGames SDK Data module when running on CrazyGames / local QA (no duplicate localStorage writes)
    if (this.isUsingSdkData()) {
      try {
        this.getRawSdk()!.data.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }

    if (typeof window === 'undefined') return false;
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  public dataRemoveItem(key: string): void {
    if (this.isUsingSdkData()) {
      try {
        this.getRawSdk()!.data.removeItem(key);
      } catch {
        // Ignore
      }
      return;
    }

    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  }
}

export const crazyGames = new CrazyGamesClient();
