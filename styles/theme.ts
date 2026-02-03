// src/styles/theme.ts

export const NEON = {
  blue: "#00eaff",
  magenta: "#ff2dff",
  purple: "#8a2be2",
  cyan: "#00ffd5",
};

export const RATING_COLORS: Record<number, string> = {
  1: "#00bcd4",
  2: "#29b6f6",
  3: "#42a5f5",
  4: "#5c6bc0",
  5: "#7e57c2",
  6: "#ab47bc",
  7: "#ec407a",
  8: "#ff7043",
  9: "#ffa726",
  10: "#ffca28",
};

/**
 * Generuje styl CSS dla neonowego blasku.
 * @param color - Kolor poświaty.
 */
export const neonGlowStyle = (color: string) => ({
  boxShadow: `0 8px 40px ${color}33, 0 0 18px ${color}66, inset 0 1px 0 ${color}22`,
});
