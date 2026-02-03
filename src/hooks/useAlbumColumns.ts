import { useState, useEffect } from 'react';


export function useAlbumColumns() {
  const [cols, setCols] = useState(5);

  useEffect(() => {
    function calc() {
      const w = window.innerWidth;

      if (w < 600) setCols(1);
      else if (w < 900) setCols(2);
      else if (w < 1300) setCols(3);
      else if (w < 1700) setCols(4);
      else setCols(5);
    }

    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  return cols;
}