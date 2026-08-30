/**
 * Adsterra Ad Configuration for Apollo
 */

// Adsterra ad unit definitions
export const ADSTERRA_UNITS = {
  // 300x250 banner (IFRAME SYNC)
  banner300x250: {
    key: "287263a21170b0b4fcc6f62ad64c9425",
    width: 300,
    height: 250,
  },
  // 728x90 leaderboard (IFRAME SYNC)
  leaderboard728x90: {
    key: "fed15ec2b808ad78b95f3757737d2162",
    width: 728,
    height: 90,
  },
} as const;

// Adsterra async script URLs
export const ADSTERRA_SCRIPTS = {
  nativeBanner: "https://pl31098606.profitableratecpmnetwork.com/57a45f319b0d3f47845ad8b9059b61de/invoke.js",
  nativeBannerContainerId: "container-57a45f319b0d3f47845ad8b9059b61de",
  popunder: "https://pl31098602.profitableratecpmnetwork.com/25/ea/fd/25eafdc0d5b5c73fff96db5f26b3fd80.js",
  socialBar: "https://pl31098603.profitableratecpmnetwork.com/a7/af/9d/a7af9dd53724b72f361ecca2360aad8a.js",
} as const;

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
