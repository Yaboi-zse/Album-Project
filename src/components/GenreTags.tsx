import { useState, useEffect } from 'react';

export function GenreTags({
  genre,
  collapseSignal,
}: {
  genre?: string | null;
  collapseSignal: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (collapseSignal) setExpanded(false);
  }, [collapseSignal]);

  const raw = (genre ?? "").trim();
  const list = raw.length
    ? raw.split(",").map(g => g.trim()).filter(Boolean)
    : [];

  if (list.length === 0) return null;

  const visible = expanded ? list : list.slice(0, 2);
  const hiddenCount = Math.max(0, list.length - visible.length);
}