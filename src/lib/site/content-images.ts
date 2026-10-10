// Real product screenshots (SEO denetimi 2026-10-10). Google indexes only <img>
// content, so the public site carries a few genuine images with descriptive
// file names served straight from /images (no hashed /_next/static/media URL).
// Captured at 1120px / 2x from the site itself; regenerate with
// scripts/seo-screenshots.js when the UI changes. The alt
// texts live in messages/*.json next to the copy that references them.
export interface ContentImage { src: string; width: number; height: number }

export const CONTENT_IMAGES = {
  'sample-analysis': { src: '/images/sample-match-analysis-probabilities-confidence-risk.png', width: 1106, height: 836 },
  'standings': { src: '/images/premier-league-standings-table.png', width: 2144, height: 1380 },
  'track-record': { src: '/images/prediction-track-record-hit-rate-roi.png', width: 2240, height: 574 }
} satisfies Record<string, ContentImage>;

export type ContentImageId = keyof typeof CONTENT_IMAGES;
