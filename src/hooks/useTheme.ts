// src/hooks/useTheme.ts
import { useEffect } from 'react';

const applyTheme = (theme: 'light' | 'dark') => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.style.background = "#03060a";
    document.body.style.background = "#03060a";
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.style.background = "#ffffff";
    document.body.style.background = "#ffffff";
  }
};

export function useTheme() {
  useEffect(() => {
    const checkAndApplyTheme = () => {
      const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const currentTheme = storedTheme || (prefersDark ? 'dark' : 'light');
      applyTheme(currentTheme);
    };

    const handleThemeChange = (event: CustomEvent) => {
      applyTheme(event.detail);
    };

    checkAndApplyTheme();
    window.addEventListener('themeChange', handleThemeChange as EventListener);

    return () => {
      window.removeEventListener('themeChange', handleThemeChange as EventListener);
    };
  }, []);
}
