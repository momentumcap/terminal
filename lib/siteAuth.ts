export const AUTH_COOKIE_NAME = "momentum_terminal_access";

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isPasswordGateEnabled() {
  return Boolean(process.env.SITE_PASSWORD?.trim()) || process.env.NODE_ENV === "production";
}

export async function createAccessToken(password: string) {
  const secret = process.env.AUTH_COOKIE_SECRET?.trim() || process.env.SITE_PASSWORD?.trim() || "momentum-terminal-local";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${secret}:${password}`));
  return toHex(digest);
}

export async function getExpectedAccessToken() {
  const password = process.env.SITE_PASSWORD?.trim();
  if (!password) return null;
  return createAccessToken(password);
}
