/**
 * File access for the coach Talent, injected so the engine never imports the app stores.
 * (Same idea as searchAccess.ts: keep execute() free of MobX/store coupling.)
 */
export interface CoachFileAccess {
  /** Ask the person to pick a roster JSON. Resolves the raw text, or null if cancelled. */
  pickRosterJson(): Promise<string | null>;
}

/**
 * Default implementation. Modules are loaded lazily, at call time, so registering the Talent
 * never pulls importUtils -> store -> PalStore -> talents into a circular import.
 */
export const defaultCoachFileAccess: CoachFileAccess = {
  async pickRosterJson() {
    const [{pickJsonFile}, RNFS] = await Promise.all([
      import('../../utils/importUtils'),
      import('@dr.pogodin/react-native-fs'),
    ]);
    const uri = await pickJsonFile();
    if (!uri) return null;
    return RNFS.readFile(uri, 'utf8');
  },
};
