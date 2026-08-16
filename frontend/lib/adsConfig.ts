/**
 * Google AdSense Configuration & Helper Functions for Apollo
 */

// Default AdSense Publisher ID. Swap 'ca-pub-XXXXXXXXXXXXXXXX' or set NEXT_PUBLIC_ADSENSE_PUB_ID in .env.local
export const ADSENSE_PUB_ID =
  process.env.NEXT_PUBLIC_ADSENSE_PUB_ID || "ca-pub-2898195354340118";

// Centralized Ad Slot IDs for various placements across Apollo.
// Replace placeholder values with real slot IDs from your Google AdSense Dashboard.
export const AD_SLOTS = {
  homeRow1: process.env.NEXT_PUBLIC_AD_SLOT_HOME_1 || "1234567890",
  homeRow2: process.env.NEXT_PUBLIC_AD_SLOT_HOME_2 || "2345678901",
  browseGrid: process.env.NEXT_PUBLIC_AD_SLOT_BROWSE || "3456789012",
  animeRow: process.env.NEXT_PUBLIC_AD_SLOT_ANIME || "4567890123",
  preWatch: process.env.NEXT_PUBLIC_AD_SLOT_PREWATCH || "5678901234",
};

// Routes where advertisements must NEVER appear (including all nested sub-routes)
export const EXCLUDED_ROUTES: string[] = [
  "/login",
  "/signup",
  "/account",
  "/billing",
  "/checkout",
  "/admin",
];

/**
 * Checks if ads should be excluded for a given pathname.
 * Sub-routes of excluded paths (e.g. /admin/users or /account/settings) are also excluded.
 */
export function isAdExcluded(pathname: string | null | undefined): boolean {
  if (!pathname) return false;

  const normalized = pathname.toLowerCase();
  return EXCLUDED_ROUTES.some((route) => {
    const lowerRoute = route.toLowerCase();
    return (
      normalized === lowerRoute ||
      normalized.startsWith(`${lowerRoute}/`) ||
      normalized.startsWith(`${lowerRoute}?`)
    );
  });
}

/**
 * Safely initializes an AdSense unit instance on component mount without throwing errors
 * if scripts are blocked by ad-blockers or if AdSense is already populated.
 */
export function pushAdSense(): void {
  try {
    if (typeof window !== "undefined") {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    }
  } catch (err) {
    // Fail silently if blocked by client extension or missing script
    console.debug("[AdSense] Init push caught:", err);
  }
}
