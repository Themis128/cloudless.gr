import { defineStore } from 'pinia';
import type { NavigationStore } from '../types/navigation';

export const useNavigationStore = defineStore('navigationStore', {
  state: (): NavigationStore => ({
    isDesktop: true,
  }),
});
