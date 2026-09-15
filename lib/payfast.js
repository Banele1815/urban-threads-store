import crypto from "crypto";

/**
 * PayFast wants values URL-encoded with spaces as "+", uppercase hex
 * escapes, and trimmed of surrounding whitespace before signing.
 */
export function encodePayfastValue(value) {
  return encodeURIComponent(String(value).trim())
    .replace(/%20/g, "+")
    .replace(/[!'()*]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );
}

/**
 * Builds the MD5 signature PayFast expects. `fields` must be an object
 * whose key order matches the order the fields are sent in (insertion
 * order on a plain JS object is preserved for string keys, which is
 * what both the initiate and notify handlers rely on).
 */
export function buildSignature(fields, passphrase) {
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    if (key === "signature") continue;
    if (value === undefined || value === null || value === "") continue;

    parts.push(`${key}=${encodePayfastValue(value)}`);
  }

  let signatureString = parts.join("&");

  if (passphrase) {
    signatureString += `&passphrase=${encodePayfastValue(passphrase)}`;
  }

  return crypto.createHash("md5").update(signatureString).digest("hex");
}

export const PAYFAST_URLS = {
  sandbox: {
    process: "https://sandbox.payfast.co.za/eng/process",
    validate: "https://sandbox.payfast.co.za/eng/query/validate"
  },
  live: {
    process: "https://www.payfast.co.za/eng/process",
    validate: "https://www.payfast.co.za/eng/query/validate"
  }
};

export function payfastMode() {
  return process.env.PAYFAST_MODE === "live" ? "live" : "sandbox";
}