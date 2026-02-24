'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { useEffect } from 'react';

export default function ThemeInitializer({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  useEffect(() => {
    const html = document.documentElement;
    
    console.log('Applying theme:', theme); // Debug log
    
    if (theme === 'dark') {
      html.classList.add('dark');
      html.style.colorScheme = 'dark';
    } else {
      html.classList.remove('dark');
      html.style.colorScheme = 'light';
    }
  }, [theme]);

  return children;
}
