import { defineStore } from 'pinia';
import type { DarkModeState } from '../types/darkMode';

export const useDarkModeStore = defineStore('darkMode', {
  state: (): DarkModeState => ({
    isDark: false,
  }),
});
