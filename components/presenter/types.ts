export type PresenterExperience = 'classic' | 'next_gen_beta';
export type PresenterLibraryTab = 'songs' | 'scripture' | 'media' | 'presentations';
export type PresenterFocusArea = 'schedule' | 'filmstrip' | 'live';
export type HoldScreenMode = 'none' | 'clear' | 'logo';

export interface PresenterLayoutPrefs {
  leftPaneWidth: number;
  rightPaneWidth: number;
  bottomTrayHeight: number;
}
