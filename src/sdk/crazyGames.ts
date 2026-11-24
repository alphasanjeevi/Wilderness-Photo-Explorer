import { CrazyGamesUserProfile } from '../types/game';

export type CrazyGamesAdType = 'midgame' | 'rewarded';

export interface AdRequestResult {
  completed: boolean;
  reason?: string;
}

interface CrazyGamesRawSDK {
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

  public getEnvironment(): 'crazygames' | 'local' | 'disabled' {
    const sdk = this.getRawSdk();
    if (!sdk || !this.sdkAvailable) return 'disabled';
    return sdk.environment ?? 'crazygames';
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

  public getUserStorageScope(): string {
    if (!this.currentUser?.username) return 'guest';
    const clean = this.currentUser.username
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 48);
    return clean ? `user_${clean}` : 'guest';
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
            window.setTimeout(() => reject(new Error('CrazyGames SDK init timeout')), 3500)
          ),
        ]);
        const env = sdk.environment;
        this.sdkAvailable = env !== 'disabled';
        this.initialized = true;

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
      return {
        completed: type === 'midgame',
        reason: type === 'midgame' ? 'skipped_offline' : 'unavailable',
      };
    }

    // Respect gentle pacing for midgame breaks (CrazyGames also manages cooldowns internally)
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
            finish({ completed: false, reason });
          },
        });
      } catch (err) {
        finish({ completed: false, reason: String(err) });
      }
    });
  }

  public dataGetItem(key: string): string | null {
    const sdk = this.getRawSdk();
    if (sdk && this.sdkAvailable && sdk.data?.getItem) {
      try {
        const sdkVal = sdk.data.getItem(key);
        if (sdkVal !== null) return sdkVal;
      } catch {
        // Fallback below
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
    let saved = false;
    const sdk = this.getRawSdk();
    if (sdk && this.sdkAvailable && sdk.data?.setItem) {
      try {
        sdk.data.setItem(key, value);
        saved = true;
      } catch {
        // Fall through to localStorage
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, value);
        saved = true;
      } catch {
        // Ignore quota failure; caller trims when needed
      }
    }
    return saved;
  }

  public dataRemoveItem(key: string): void {
    const sdk = this.getRawSdk();
    if (sdk && this.sdkAvailable && sdk.data?.removeItem) {
      try {
        sdk.data.removeItem(key);
      } catch {
        // Ignore
      }
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    }
  }
}

export const crazyGames = new CrazyGamesClient();
