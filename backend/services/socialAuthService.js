/**
 * Verifies ID tokens from Google and Apple sign-in.
 *
 * The browser gets a signed ID token (JWT) from Google/Apple and sends it
 * here. We check its signature against the provider's public keys, the
 * issuer and the audience (our client id), so it cannot be forged.
 */
const { createRemoteJWKSet, jwtVerify } = require("jose");
const { config } = require("../config/env");
const ApiError = require("../utils/ApiError");

const PROVIDERS = {
  google: {
    jwks: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    clientId: () => config.social.googleClientId,
    label: "Google"
  },
  apple: {
    jwks: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
    issuer: "https://appleid.apple.com",
    clientId: () => config.social.appleClientId,
    label: "Apple"
  }
};

function isEnabled(provider) {
  return Boolean(PROVIDERS[provider] && PROVIDERS[provider].clientId());
}

/**
 * @param {"google"|"apple"} provider
 * @param {string} idToken
 * @returns {Promise<{ provider: string, sub: string, email: string|null, emailVerified: boolean, name: string|null }>}
 */
async function verifyIdToken(provider, idToken) {
  const p = PROVIDERS[provider];
  if (!p) throw ApiError.badRequest("অজানা লগইন পদ্ধতি।", "Unknown sign-in provider.");
  if (!p.clientId()) {
    throw ApiError.badRequest(
      `${p.label} লগইন এখনো চালু করা হয়নি।`,
      `${p.label} sign-in is not set up on the server yet.`
    );
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, p.jwks, { issuer: p.issuer, audience: p.clientId() }));
  } catch {
    throw ApiError.unauthorized(`${p.label} লগইন যাচাই করা যায়নি। আবার চেষ্টা করুন।`, `Could not verify the ${p.label} sign-in. Please try again.`);
  }

  const verified = payload.email_verified === true || payload.email_verified === "true";
  return {
    provider,
    sub: String(payload.sub),
    email: payload.email && verified ? String(payload.email).toLowerCase() : null,
    emailVerified: verified,
    name: payload.name ? String(payload.name).slice(0, 100) : null
  };
}

module.exports = { verifyIdToken, isEnabled };
