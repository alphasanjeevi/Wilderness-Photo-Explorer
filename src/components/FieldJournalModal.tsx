import React, { useMemo, useState } from 'react';
import { Check, Lock, Trash2, X } from 'lucide-react';
import { TROPICAL_SPECIES } from '../data/species';
import { SaveState, SpeciesCategory, SpeciesDefinition } from '../types/game';
import { SpeciesIllustration } from './SpeciesIllustration';

interface FieldJournalModalProps {
  saveState: SaveState;
  initialSpeciesId?: string | null;
  onClose: () => void;
  onDeletePhoto: (photoId: string) => void;
}

type CategoryFilter = 'all' | SpeciesCategory;

export const FieldJournalModal: React.FC<FieldJournalModalProps> = ({
  saveState,
  initialSpeciesId,
  onClose,
  onDeletePhoto,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [onlyUnlocked, setOnlyUnlocked] = useState(false);

  const initialSelected = useMemo(() => {
    if (initialSpeciesId) return initialSpeciesId;
    const firstUnlocked = TROPICAL_SPECIES.find((s) => saveState.progress[s.id]?.unlocked);
    return firstUnlocked?.id ?? TROPICAL_SPECIES[0].id;
  }, [initialSpeciesId, saveState.progress]);

  const [selectedId, setSelectedId] = useState<string>(initialSelected);

  const discoveredCount = useMemo(
    () => TROPICAL_SPECIES.filter((s) => saveState.progress[s.id]?.unlocked).length,
    [saveState.progress]
  );

  const filteredSpecies = useMemo(() => {
    return TROPICAL_SPECIES.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (onlyUnlocked && !saveState.progress[s.id]?.unlocked) return false;
      return true;
    });
  }, [categoryFilter, onlyUnlocked, saveState.progress]);

  const selectedSpecies: SpeciesDefinition = useMemo(
    () => TROPICAL_SPECIES.find((s) => s.id === selectedId) ?? TROPICAL_SPECIES[0],
    [selectedId]
  );

  const selectedProgress = saveState.progress[selectedSpecies.id];
  const isUnlocked = Boolean(selectedProgress?.unlocked);

  const speciesPhotos = useMemo(
    () => saveState.photos.filter((p) => p.speciesId === selectedSpecies.id),
    [saveState.photos, selectedSpecies.id]
  );

  const latestPhotoBySpecies = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of saveState.photos) {
      if (p.speciesId && !map[p.speciesId]) {
        map[p.speciesId] = p.dataUrl;
      }
    }
    return map;
  }, [saveState.photos]);

  const categoryLabel = (c: SpeciesCategory) =>
    c === 'mammal' ? 'Mammal' : c === 'bird' ? 'Bird' : 'Insect & Amphibian';

  const activeTimeLabel = (t: SpeciesDefinition['activeTime']) =>
    t === 'dusk' ? 'Golden Dusk' : t === 'day' ? 'Daylight' : 'All Day';

  const weatherLabel = (w: SpeciesDefinition['prefersWeather']) =>
    w === 'rain' ? 'Prefers Rain' : w === 'clear' ? 'Clear Weather' : 'Any Weather';

  return (
    <div className="fixed inset-0 z-40 bg-[#121912]/80 flex items-center justify-center p-3 sm:p-6">
      <div
        className="w-full max-w-5xl h-[88vh] max-h-[760px] bg-[#F4EFE6] text-[#212B22] rounded-2xl shadow-2xl border border-[#2B3A2C]/20 flex flex-col overflow-hidden"
        role="dialog"
        aria-label="Wildlife Field Journal"
      >
        {/* JOURNAL HEADER */}
        <div className="px-5 sm:px-7 py-4 border-b border-[#2B3A2C]/12 bg-[#ECE5D7] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#1D261E] tracking-tight">
              Wildlife Field Journal
            </h2>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-[#556156]">
              <span>Tropical Forest Reserve</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-medium text-[#2B3A2C]">
                {discoveredCount} of {TROPICAL_SPECIES.length} Species Discovered
              </span>
              {discoveredCount === TROPICAL_SPECIES.length && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#3C7A4B]">Reserve Complete!</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Clean completion progress bar */}
            <div className="hidden sm:flex flex-col items-end gap-1">
              <div className="w-36 h-2 rounded-full bg-[#D8D0C0] overflow-hidden">
                <div
                  className="h-full bg-[#4A7C59] transition-all duration-300"
                  style={{
                    width: `${(discoveredCount / TROPICAL_SPECIES.length) * 100}%`,
                  }}
                />
              </div>
              <span className="text-[11px] font-mono tabular-nums text-[#556156]">
                {Math.round((discoveredCount / TROPICAL_SPECIES.length) * 100)}% Documented
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#E1D8C6] hover:bg-[#D4C9B4] text-[#212B22] transition-colors cursor-pointer"
              aria-label="Close Field Journal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FILTER STRIP */}
        <div className="px-5 sm:px-7 py-2.5 border-b border-[#2B3A2C]/10 bg-[#F4EFE6] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-[#E7E0D1] p-1 rounded-xl">
            {(
              [
                ['all', 'All (20)'],
                ['mammal', 'Mammals (10)'],
                ['bird', 'Birds (5)'],
                ['insect', 'Insects & Frogs (5)'],
              ] as [CategoryFilter, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setCategoryFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  categoryFilter === val
                    ? 'bg-[#F4EFE6] text-[#1D261E] shadow-sm'
                    : 'text-[#556156] hover:text-[#1D261E]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOnlyUnlocked((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              onlyUnlocked
                ? 'bg-[#2B3A2C] border-[#2B3A2C] text-[#F4EFE6]'
                : 'bg-transparent border-[#2B3A2C]/20 text-[#49564A] hover:bg-[#E7E0D1]'
            }`}
          >
            {onlyUnlocked ? 'Showing Discovered Only' : 'Show Discovered Only'}
          </button>
        </div>

        {/* TWO-PANE JOURNAL BODY */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12">
          {/* LEFT SPECIES LIST */}
          <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-[#2B3A2C]/12 overflow-y-auto journal-scroll p-3 space-y-1.5 max-h-[34vh] md:max-h-none">
            {filteredSpecies.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5E6A5F]">
                No discovered species in this category yet. Drive out and aim your camera to record your first entry.
              </div>
            ) : (
              filteredSpecies.map((sp) => {
                const prog = saveState.progress[sp.id];
                const unlocked = Boolean(prog?.unlocked);
                const active = sp.id === selectedSpecies.id;
                const thumbUrl = latestPhotoBySpecies[sp.id];

                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSelectedId(sp.id)}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#E3DAC6] border border-[#2B3A2C]/25'
                        : 'hover:bg-[#EAE3D4] border border-transparent'
                    }`}
                  >
                    <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 border border-[#2B3A2C]/12 bg-[#E3DDD0]">
                      {unlocked && thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={sp.commonName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <SpeciesIllustration species={sp} unlocked={unlocked} className="w-full h-full" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-medium truncate ${
                            unlocked ? 'text-[#1D261E]' : 'text-[#6A736B]'
                          }`}
                        >
                          <span className="font-mono tabular-nums text-xs text-[#6A736B] mr-1.5">
                            {String(sp.number).padStart(2, '0')}
                          </span>
                          {unlocked ? sp.commonName : 'Undiscovered Species'}
                        </span>
                        {unlocked ? (
                          <Check className="w-4 h-4 text-[#3C7A4B] shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-[#8A877D] shrink-0" />
                        )}
                      </div>

                      <div className="mt-0.5 text-xs text-[#616C61] truncate">
                        {sp.habitatLabel} · {categoryLabel(sp.category)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* RIGHT DETAIL PANE */}
          <div className="md:col-span-7 overflow-y-auto journal-scroll p-5 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-display text-2xl sm:text-3xl font-semibold text-[#1D261E]">
                  {isUnlocked ? selectedSpecies.commonName : `Species #${String(selectedSpecies.number).padStart(2, '0')} — Undiscovered`}
                </h3>
                <p className="mt-0.5 text-sm italic text-[#5B675C]">
                  {isUnlocked ? selectedSpecies.scientificName : 'Photograph in the wild to identify'}
                </p>
              </div>
              {isUnlocked && (
                <span className="text-xs font-mono tabular-nums text-[#556156]">
                  Photos Taken: {selectedProgress?.discoveryCount ?? 0}
                </span>
              )}
            </div>

            {/* Quiet unboxed metadata line */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#556156]">
              <span>{categoryLabel(selectedSpecies.category)}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedSpecies.habitatLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{activeTimeLabel(selectedSpecies.activeTime)}</span>
              <span aria-hidden="true">·</span>
              <span>{weatherLabel(selectedSpecies.prefersWeather)}</span>
            </div>

            {/* Featured Photo / Silhouette */}
            <div className="mt-5 rounded-xl overflow-hidden border border-[#2B3A2C]/15 bg-[#E6DFD0] aspect-[4/3] max-h-64 w-full flex items-center justify-center">
              {isUnlocked && speciesPhotos[0] ? (
                <img
                  src={speciesPhotos[0].dataUrl}
                  alt={selectedSpecies.commonName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <SpeciesIllustration
                  species={selectedSpecies}
                  unlocked={isUnlocked}
                  className="w-full h-full"
                />
              )}
            </div>

            {isUnlocked ? (
              <div className="mt-6 space-y-5 text-sm leading-relaxed text-[#2C372D]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-[#2B3A2C]/10">
                  <div>
                    <div className="text-xs font-medium text-[#647065]">Diet & Foraging</div>
                    <div className="mt-1 font-medium text-[#1D261E]">{selectedSpecies.diet}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-[#647065]">Field Observation</div>
                    <div className="mt-1 font-medium text-[#1D261E]">
                      {selectedProgress?.behaviorNotesUnlocked
                        ? selectedSpecies.behaviorSummary
                        : 'Capture a 2nd photo to unlock behavior notes.'}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-[#647065]">Naturalist Field Note</div>
                  <p className="mt-1 text-[#242F25]">{selectedSpecies.funFact}</p>
                </div>

                {/* Player's Captured Photo Gallery */}
                <div>
                  <div className="text-xs font-medium text-[#647065] mb-2.5">
                    Your Field Photographs ({speciesPhotos.length})
                  </div>
                  {speciesPhotos.length === 0 ? (
                    <div className="text-xs text-[#647065]">
                      No saved snapshots remaining for this species.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {speciesPhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className="group relative rounded-lg overflow-hidden border border-[#2B3A2C]/15 bg-[#EAE3D3]"
                        >
                          <img
                            src={photo.dataUrl}
                            alt={`${selectedSpecies.commonName} field snapshot`}
                            className="w-full aspect-[4/3] object-cover"
                          />
                          <div className="p-1.5 text-[11px] text-[#49554A] flex items-center justify-between gap-1">
                            <span className="truncate">{photo.qualityLabel}</span>
                            <button
                              type="button"
                              onClick={() => onDeletePhoto(photo.id)}
                              className="p-1 rounded hover:bg-[#D8CFC0] text-[#7A3B2E] cursor-pointer"
                              aria-label="Delete photo"
                              title="Delete photo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 p-4 rounded-xl bg-[#EAE3D4] border border-[#2B3A2C]/10 text-sm text-[#49564A] space-y-2">
                <div className="font-semibold text-[#1D261E]">Field Scout Hint</div>
                <p>
                  Look for this {categoryLabel(selectedSpecies.category).toLowerCase()} near{' '}
                  <span className="font-medium text-[#1D261E]">{selectedSpecies.habitatLabel}</span>.
                  {selectedSpecies.activeTime === 'dusk' &&
                    ' Most active during Golden Dusk light.'}
                  {selectedSpecies.prefersWeather === 'rain' &&
                    ' Gentle rain showers often bring it closer to open trails.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
