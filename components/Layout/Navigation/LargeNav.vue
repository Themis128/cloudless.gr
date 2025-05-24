<template>
  <nav class="large-nav">
    <ul class="items-center">
      <li v-for="item in navItems" :key="item.text">
        <a :href="item.link">{{ item.text }}</a>
      </li>
      <li v-if="!isLoggedIn" class="auth-links">
        <a href="/auth/login" class="login-btn">Login</a>
        <a href="/auth/signup" class="signup-btn">Sign Up</a>
      </li>
      <li v-else class="auth-links">
        <a href="/dashboard" class="dashboard-btn">My Dashboard</a>
        <a href="/profile" class="profile-btn">My Profile</a>
        <button @click="handleLogout" class="logout-btn">Logout</button>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { useUserAuth } from '~/composables/useUserAuth';

const { isLoggedIn, currentUser, logout } = useUserAuth();

const navItems = [
  { text: 'Home', link: '/' },
  { text: 'Projects', link: '/projects' },
  { text: 'About', link: '/about' },
  { text: 'Contact', link: '/contact' },
  { text: 'Codegen', link: '/codegen' },
];

const handleLogout = () => {
  logout();
  navigateTo('/');
};
</script>

<style scoped>
.large-nav {
  display: flex;
  justify-content: space-around;
  background: transparent !important;
  padding: 1rem;
  z-index: 1002 !important;
  position: relative;
}

.large-nav ul {
  list-style: none;
  display: flex;
  gap: 1rem;
  background: transparent !important;
}

.large-nav a {
  color: #fff !important;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  text-decoration: none;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  transition: color 0.2s;
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  opacity: 1 !important;
  filter: none !important;
}

.large-nav a:hover {
  text-decoration: underline;
  color: #60a5fa !important; /* Tailwind's blue-400 for hover */
}

.large-nav,
.large-nav ul {
  background: transparent !important;
  box-shadow: none !important;
}

.large-nav li {
  opacity: 1 !important;
  filter: none !important;
}

.text-blue-600 {
  color: #2563eb !important; /* Tailwind's blue-600 */
}

.logo-link {
  color: #fff !important;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  transition: color 0.2s;
}

.logo-link:hover,
.logo-link:focus {
  color: #60a5fa !important; /* Tailwind's blue-400 for hover */
}

.logo-link,
.text-indigo-700 {
  color: #fff !important;
}

/* Authentication links styling */
.auth-links {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-left: 1rem;
}

.login-btn,
.profile-btn,
.dashboard-btn {
  color: #fff !important;
  padding: 0.375rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.login-btn:hover,
.profile-btn:hover,
.dashboard-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.signup-btn,
.logout-btn {
  color: #fff !important;
  background: linear-gradient(90deg, #1e40af 0%, #3b82f6 100%);
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.signup-btn:hover,
.logout-btn:hover {
  background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%);
  text-decoration: none;
}

.logout-btn {
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}
</style>
