import assert from 'node:assert/strict';
import test from 'node:test';
import { TROPICAL_SPECIES } from '../src/data/species';
import { crazyGames, CrazyGamesAdType, CrazyGamesRawSDK } from '../src/sdk/crazyGames';
import {
  clearGuestSessionData,
  createDefaultSaveState,
  loadSaveState,
  mergeSaveStates,
  persistSaveState,
  recordCapturedPhoto,
  updateSettings,
} from '../src/storage/saveManager';
import { CapturedPhoto, CrazyGamesUserProfile } from '../src/types/game';

interface SpyCounts {
  localGet: number;
  localSet: number;
  localRemove: number;
  sdkDataGet: number;
  sdkDataSet: number;
  sdkDataRemove: number;
}

function createHarness(options: {
  environment: 'crazygames' | 'local' | 'disabled';
  initialUser?: CrazyGamesUserProfile | null;
  adBehavior?: (type: CrazyGamesAdType) => { errorCode?: string };
}) {
  const sdkStore = new Map<string, string>();
  const localStore = new Map<string, string>();
  const events: string[] = [];
  const counts: SpyCounts = {
    localGet: 0,
    localSet: 0,
    localRemove: 0,
    sdkDataGet: 0,
    sdkDataSet: 0,
    sdkDataRemove: 0,
  };

  let currentUser: CrazyGamesUserProfile | null = options.initialUser ?? null;
  const authCbs = new Set<(u: CrazyGamesUserProfile | null) => void>();

  const mockStorage = {
    getItem(key: string) {
      counts.localGet++;
      return localStore.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      counts.localSet++;
      localStore.set(key, String(value));
    },
    removeItem(key: string) {
      counts.localRemove++;
      localStore.delete(key);
    },
    clear() {
      localStore.clear();
    },
    key(i: number) {
      return Array.from(localStore.keys())[i] ?? null;
    },
    get length() {
      return localStore.size;
    },
  };

  const rawSdk: CrazyGamesRawSDK = {
    environment: options.environment,
    async init() {
      events.push('init');
    },
    game: {
      loadingStart() {
        events.push('loadingStart');
      },
      loadingStop() {
        events.push('loadingStop');
      },
      gameplayStart() {
        events.push('gameplayStart');
      },
      gameplayStop() {
        events.push('gameplayStop');
      },
      happytime() {
        events.push('happytime');
      },
    },
    ad: {
      requestAd(type, callbacks) {
        events.push(`requestAd:${type}`);
        const outcome = options.adBehavior?.(type) ?? {};
        if (outcome.errorCode) {
          callbacks.adError?.({ code: outcome.errorCode });
          return;
        }
        callbacks.adStarted?.();
        callbacks.adFinished?.();
      },
    },
    user: {
      isUserAccountAvailable: options.environment !== 'disabled',
      async getUser() {
        return currentUser;
      },
      async showAuthPrompt() {
        return currentUser;
      },
      addAuthListener(cb) {
        authCbs.add(cb);
      },
      removeAuthListener(cb) {
        authCbs.delete(cb);
      },
    },
    data: {
      getItem(key) {
        counts.sdkDataGet++;
        return sdkStore.get(key) ?? null;
      },
      setItem(key, value) {
        counts.sdkDataSet++;
        sdkStore.set(key, value);
      },
      removeItem(key) {
        counts.sdkDataRemove++;
        sdkStore.delete(key);
      },
      clear() {
        sdkStore.clear();
      },
    },
  };

  (globalThis as unknown as { window: Record<string, unknown> }).window = {
    localStorage: mockStorage,
    CrazyGames: options.environment === 'disabled' ? undefined : { SDK: rawSdk },
    matchMedia: () => ({ matches: false }),
  };

  crazyGames.resetForTest();

  return {
    events,
    counts,
    sdkStore,
    localStore,
    triggerAuthChange(user: CrazyGamesUserProfile | null) {
      currentUser = user;
      for (const cb of authCbs) cb(user);
    },
  };
}

function makePhoto(speciesId: string, idx: number, payloadLen = 1800): CapturedPhoto {
  return {
    id: `photo_${speciesId}_${idx}`,
    speciesId,
    dataUrl: `data:image/jpeg;base64,${'A'.repeat(payloadLen)}`,
    capturedAt: `2026-11-24T10:00:0${idx % 10}.000Z`,
    habitatLabel: 'Emerald Riverbank',
    timeOfDayLabel: 'Morning Sun',
    weather: 'clear',
    qualityLabel: 'Well Framed',
  };
}

test('CrazyGames QA (local) environment: lifecycle order and exclusive SDK Data writes', async () => {
  const h = createHarness({ environment: 'local' });

  await crazyGames.init();
  crazyGames.notifyLoadingStop();
  crazyGames.setGameplayActive(true);
  crazyGames.setGameplayActive(true); // Should deduplicate
  crazyGames.triggerHappytime();
  crazyGames.setGameplayActive(false);

  assert.deepEqual(h.events, [
    'loadingStart',
    'init',
    'loadingStop',
    'gameplayStart',
    'happytime',
    'gameplayStop',
  ]);
  assert.equal(crazyGames.isUsingSdkData(), true);

  let state = loadSaveState('guest');
  const res = recordCapturedPhoto(state, makePhoto(TROPICAL_SPECIES[0].id, 1), 'guest');
  state = res.nextState;
  updateSettings(state, { muted: true }, 'guest');

  // Verify ZERO duplicate localStorage calls when CrazyGames SDK Data is active
  assert.equal(h.counts.localGet, 0);
  assert.equal(h.counts.localSet, 0);
  assert.equal(h.counts.localRemove, 0);
  assert.ok(h.counts.sdkDataSet >= 2);
});

test('Offline / disabled environment falls back cleanly to localStorage and Scout Pulse fallback', async () => {
  const h = createHarness({ environment: 'disabled' });

  await crazyGames.init();
  assert.equal(crazyGames.isUsingSdkData(), false);
  assert.equal(crazyGames.isRewardedAdAvailable(), false);

  const state = createDefaultSaveState();
  recordCapturedPhoto(state, makePhoto(TROPICAL_SPECIES[1].id, 1), 'guest');
  assert.ok(h.counts.localSet > 0);
  assert.equal(h.counts.sdkDataSet, 0);

  const mid = await crazyGames.requestAd('midgame', {});
  assert.equal(mid.completed, true);

  const rew = await crazyGames.requestAd('rewarded', {});
  assert.equal(rew.completed, false);
  assert.equal(rew.reason, 'unavailable');
});

test('Rewarded ad lifecycle pauses/resumes gameplay and flips Basic Launch fallback on adsDisabled', async () => {
  let mode: 'ok' | 'adsDisabled' | 'adblock' = 'ok';
  const h = createHarness({
    environment: 'crazygames',
    adBehavior: (type) => {
      if (type === 'rewarded' && mode !== 'ok') {
        return { errorCode: mode };
      }
      return {};
    },
  });

  await crazyGames.init();
  assert.equal(crazyGames.isRewardedAdAvailable(), true);
  crazyGames.setGameplayActive(true);

  let started = 0;
  let ended = 0;
  const okRes = await crazyGames.requestAd('rewarded', {
    onAdStart: () => {
      started++;
    },
    onAdEnd: () => {
      ended++;
    },
  });
  assert.equal(okRes.completed, true);
  assert.equal(started, 1);
  assert.equal(ended, 1);
  assert.ok(h.events.includes('gameplayStop'));
  assert.equal(crazyGames.isRewardedAdAvailable(), true);

  // Simulate adblock: does not disable rewarded ads globally, returns adblock
  mode = 'adblock';
  const blkRes = await crazyGames.requestAd('rewarded', {});
  assert.equal(blkRes.completed, false);
  assert.equal(blkRes.reason, 'adblock');
  assert.equal(crazyGames.isRewardedAdAvailable(), true);

  // Verify midgame ads pass directly to CrazyGames SDK without local cooldown throttling
  await crazyGames.requestAd('midgame', {});
  await crazyGames.requestAd('midgame', {});
  assert.equal(h.events.filter((e) => e === 'requestAd:midgame').length, 2);

  // Simulate CrazyGames Basic Launch (adsDisabled): flips rewardedAdAvailable to false cleanly
  mode = 'adsDisabled';
  const basicRes = await crazyGames.requestAd('rewarded', {});
  assert.equal(basicRes.completed, false);
  assert.equal(basicRes.reason, 'adsDisabled');
  assert.equal(crazyGames.isRewardedAdAvailable(), false);
});

test('Save synchronization across Guest -> Alice -> Bob -> Alice with zero account bleed', async () => {
  const h = createHarness({ environment: 'crazygames' });
  await crazyGames.init();

  const spA = TROPICAL_SPECIES[0].id;
  const spB = TROPICAL_SPECIES[1].id;
  const spC = TROPICAL_SPECIES[2].id;

  // 1. Guest discovers Species A
  let activeSave = loadSaveState('guest');
  activeSave = recordCapturedPhoto(activeSave, makePhoto(spA, 1), 'guest').nextState;
  assert.equal(activeSave.progress[spA].unlocked, true);

  // 2. Guest signs in as Alice -> merges Guest save into user_alice, clears Guest session
  const alice: CrazyGamesUserProfile = { username: 'Alice.Explorer', profilePictureUrl: '' };
  h.triggerAuthChange(alice);
  const aliceScope = crazyGames.getUserStorageScope(alice);
  assert.equal(aliceScope, 'user_alice_explorer');

  const aliceExisting = loadSaveState(aliceScope);
  activeSave = mergeSaveStates(aliceExisting, activeSave);
  persistSaveState(activeSave, aliceScope);
  clearGuestSessionData();

  // Alice also discovers Species B
  activeSave = recordCapturedPhoto(activeSave, makePhoto(spB, 2), aliceScope).nextState;
  assert.equal(activeSave.progress[spA].unlocked, true);
  assert.equal(activeSave.progress[spB].unlocked, true);

  // 3. Switch to Bob -> Bob starts clean with zero leakage from Alice or Guest
  const bob: CrazyGamesUserProfile = { username: 'Bob.Photographer', profilePictureUrl: '' };
  h.triggerAuthChange(bob);
  const bobScope = crazyGames.getUserStorageScope(bob);
  assert.equal(bobScope, 'user_bob_photographer');

  let bobSave = loadSaveState(bobScope);
  assert.equal(bobSave.progress[spA].unlocked, false);
  assert.equal(bobSave.progress[spB].unlocked, false);
  assert.equal(bobSave.photos.length, 0);

  // Bob discovers Species C
  bobSave = recordCapturedPhoto(bobSave, makePhoto(spC, 3), bobScope).nextState;
  assert.equal(bobSave.progress[spC].unlocked, true);

  // 4. Switch back to Alice -> Alice retains A & B and has zero C from Bob
  h.triggerAuthChange(alice);
  const aliceReloaded = loadSaveState(aliceScope);
  assert.equal(aliceReloaded.progress[spA].unlocked, true);
  assert.equal(aliceReloaded.progress[spB].unlocked, true);
  assert.equal(aliceReloaded.progress[spC].unlocked, false);
  assert.equal(aliceReloaded.photos.length, 2);

  // Verify zero localStorage usage throughout
  assert.equal(h.counts.localSet, 0);
  assert.equal(h.counts.localGet, 0);
});

test('1 MB CrazyGames Data module byte budget trims excess photos while preserving species unlocks', async () => {
  const h = createHarness({ environment: 'crazygames' });
  await crazyGames.init();

  const alice: CrazyGamesUserProfile = { username: 'HeavyPhotographer', profilePictureUrl: '' };
  h.triggerAuthChange(alice);
  const scope = crazyGames.getUserStorageScope(alice);

  let state = loadSaveState(scope);
  // Add 35 huge 35KB photos (>1.2 MB raw) across the first 10 species
  for (let i = 0; i < 35; i++) {
    const sp = TROPICAL_SPECIES[i % 10].id;
    state = recordCapturedPhoto(state, makePhoto(sp, i, 35_000), scope).nextState;
  }

  const metaVal = h.sdkStore.get(`wilderness_meta_v2_${scope}`) ?? '';
  const photosVal = h.sdkStore.get(`wilderness_photos_v2_${scope}`) ?? '';
  assert.ok(
    metaVal.length + photosVal.length <= 780_000,
    `Expected total payload <= 780KB, got ${metaVal.length + photosVal.length}`
  );

  // All 10 species must remain unlocked in metadata, and every unlocked species retains at least 1 photo
  const reloaded = loadSaveState(scope);
  const retainedSpecies = new Set(reloaded.photos.map((p) => p.speciesId));
  for (let i = 0; i < 10; i++) {
    const sp = TROPICAL_SPECIES[i].id;
    assert.equal(reloaded.progress[sp].unlocked, true);
    assert.equal(retainedSpecies.has(sp), true);
  }
});
