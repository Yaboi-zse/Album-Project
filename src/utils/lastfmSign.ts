import crypto from "crypto";

export function lastfmSign(params: Record<string, string>) {
  const apiSecret = process.env.LASTFM_API_SECRET;
  if (!apiSecret) throw new Error("Missing LASTFM_API_SECRET");

  // 1. Sort keys alphanumerically
  const sorted = Object.keys(params)
    .sort()
    .map((key) => key + params[key])
    .join("");

  // 2. Add secret at the end
  const str = sorted + apiSecret;

  // 3. MD5 hash
  return crypto.createHash("md5").update(str).digest("hex");
}
