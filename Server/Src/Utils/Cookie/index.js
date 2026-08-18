/**
 * Set HTTP-only cookie
 */
export const setCookie = (res, name, value, options = {}) => {
  const isProduction = process.env.NODE_ENV === "production";
  const forceSecure = process.env.FORCE_SECURE_COOKIES === "true";

  res.cookie(name, value, {
    httpOnly: true,
    secure: isProduction || forceSecure,
    sameSite: "strict",
    maxAge: options.maxAge || 30 * 24 * 60 * 60 * 1000, // 30 days default
    domain: process.env.COOKIE_DOMAIN,
    ...options,
  });
};

/**
 * Clear cookie
 */
export const clearCookie = (res, name, options = {}) => {
  const cookieDomain = process.env.COOKIE_DOMAIN;
  const hostCandidates = [
    undefined,
    cookieDomain || undefined,
    cookieDomain?.startsWith(".")
      ? cookieDomain
      : cookieDomain
        ? `.${cookieDomain}`
        : undefined,
  ].filter(Boolean);

  const domains = Array.from(new Set([undefined, ...hostCandidates]));
  const paths = ["/", "/api", "/api/v1"];
  const sameSiteValues = ["strict", "lax", "none"];
  const secureValues = [false, true];

  for (const domain of domains) {
    for (const path of paths) {
      for (const sameSite of sameSiteValues) {
        for (const secure of secureValues) {
          res.clearCookie(name, {
            httpOnly: true,
            secure,
            sameSite,
            path,
            ...(domain ? { domain } : {}),
            ...options,
          });
        }
      }
    }
  }
};
