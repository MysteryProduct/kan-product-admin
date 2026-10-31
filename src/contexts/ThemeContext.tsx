'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [mounted, setMounted] = useState(false);
  const themeRef = useRef<ThemeMode>('light');

  // Apply theme to DOM
  const applyThemeToDOM = (newTheme: ThemeMode) => {
    const html = document.documentElement;
    
    if (newTheme === 'dark') {
      html.classList.add('dark');
      html.style.colorScheme = 'dark';
    } else {
      html.classList.remove('dark');
      html.style.colorScheme = 'light';
    }
    
    localStorage.setItem('theme', newTheme);
  };

  // Initialize theme on first render
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeMode | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    
    themeRef.current = initialTheme;
    setThemeState(initialTheme);
    applyThemeToDOM(initialTheme);
    setMounted(true);
  }, []);

  // Toggle theme function
  const toggleTheme = () => {
    const newTheme = themeRef.current === 'light' ? 'dark' : 'light';
    themeRef.current = newTheme;
    setThemeState(newTheme);
    applyThemeToDOM(newTheme);
  };

  // Set theme function
  const setTheme = (newTheme: ThemeMode) => {
    themeRef.current = newTheme;
    setThemeState(newTheme);
    applyThemeToDOM(newTheme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
