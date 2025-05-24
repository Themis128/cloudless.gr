<template>
  <nav class="relative z-20">
    <button
      @click="toggleMenu"
      class="text-blue-600 text-2xl focus:outline-none"
      aria-label="Toggle navigation"
    >
      ☰
    </button>

    <transition name="fade">
      <ul
        v-if="isMenuOpen"
        class="absolute right-0 mt-2 w-48 bg-white text-blue-700 shadow-lg rounded-lg py-2 space-y-2"
      >
        <li v-for="item in navItems" :key="item.text">
          <NuxtLink
            :to="item.link"
            class="block px-4 py-2 hover:bg-blue-50 hover:text-blue-900"
            @click="closeMenu"
          >
            {{ item.text }}
          </NuxtLink>
        </li>
        
        <!-- Authentication links -->
        <li class="border-t border-gray-200 mt-2 pt-2">
          <template v-if="!isLoggedIn">
            <NuxtLink 
              to="/auth/login" 
              class="block px-4 py-2 hover:bg-blue-50 hover:text-blue-900"
              @click="closeMenu"
            >
              Login
            </NuxtLink>
            <NuxtLink 
              to="/auth/signup" 
              class="block px-4 py-2 hover:bg-blue-50 hover:text-blue-900"
              @click="closeMenu"
            >
              Sign Up
            </NuxtLink>
          </template>
          <template v-else>
            <NuxtLink 
              to="/dashboard" 
              class="block px-4 py-2 hover:bg-blue-50 hover:text-blue-900"
              @click="closeMenu"
            >
              My Dashboard
            </NuxtLink>
            <NuxtLink 
              to="/profile" 
              class="block px-4 py-2 hover:bg-blue-50 hover:text-blue-900"
              @click="closeMenu"
            >
              My Profile
            </NuxtLink>
            <button 
              @click="handleLogout" 
              class="w-full text-left block px-4 py-2 hover:bg-blue-50 hover:text-blue-900"
            >
              Logout
            </button>
          </template>
        </li>
      </ul>
    </transition>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUserAuth } from '~/composables/useUserAuth';

const { isLoggedIn, logout } = useUserAuth();

const isMenuOpen = ref(false);
const toggleMenu = () => (isMenuOpen.value = !isMenuOpen.value);
const closeMenu = () => (isMenuOpen.value = false);

const navItems = [
  { text: 'Home', link: '/' },
  { text: 'Projects', link: '/projects' },
  { text: 'About', link: '/about' },
  { text: 'Contact', link: '/contact' },
  { text: 'Codegen', link: '/codegen' },
];

const handleLogout = () => {
  logout();
  closeMenu();
  navigateTo('/');
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
