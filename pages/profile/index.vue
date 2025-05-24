<template>
  <div class="profile-container">
    <div class="profile-card">
      <div class="profile-header">
        <h1>My Profile</h1>
        <div v-if="currentUser" class="user-avatar">
          {{ userInitials }}
        </div>
      </div>

      <div v-if="currentUser" class="profile-content">
        <div class="profile-section">
          <h2>Account Information</h2>
          <div class="profile-field">
            <label>Name</label>
            <p>{{ currentUser.name }}</p>
          </div>
          <div class="profile-field">
            <label>Email</label>
            <p>{{ currentUser.email }}</p>
          </div>
          <div class="profile-field">
            <label>Member Since</label>
            <p>{{ formattedDate }}</p>
          </div>
        </div>        <div class="profile-section">
          <h2>Account Settings</h2>
          <div class="profile-actions">
            <NuxtLink to="/settings" class="settings-button">
              Manage Settings
            </NuxtLink>
            <button @click="handleLogout" class="logout-button">
              Log Out
            </button>
          </div>
        </div>
      </div>

      <div v-else class="profile-loading">
        <p>Loading your profile...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useUserAuth } from '~/composables/useUserAuth';

const { currentUser, logout } = useUserAuth();

// Redirect if not logged in
if (process.client && !currentUser.value) {
  navigateTo('/auth/login');
}

// Computed properties
const userInitials = computed(() => {
  if (!currentUser.value?.name) return '?';
  return currentUser.value.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
});

const formattedDate = computed(() => {
  if (!currentUser.value?.createdAt) return 'N/A';
  return new Date(currentUser.value.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Logout handler
const handleLogout = () => {
  logout();
  navigateTo('/');
};
</script>

<style scoped>
.profile-container {
  min-height: 90vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem 1rem;
}

.profile-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  width: 100%;
  max-width: 600px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid rgba(203, 213, 225, 0.5);
}

.profile-header h1 {
  color: #1e40af;
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
}

.user-avatar {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 1.5rem;
  letter-spacing: 1px;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.profile-section {
  margin-bottom: 1.5rem;
}

.profile-section h2 {
  font-size: 1.2rem;
  color: #334155;
  margin-bottom: 1rem;
  font-weight: 600;
}

.profile-field {
  margin-bottom: 1rem;
}

.profile-field label {
  display: block;
  font-size: 0.875rem;
  color: #64748b;
  margin-bottom: 0.25rem;
}

.profile-field p {
  font-size: 1rem;
  color: #0f172a;
  padding: 0.5rem 0;
}

.profile-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.settings-button {
  background-color: #1e40af;
  color: white;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  text-decoration: none;
  display: inline-block;
}

.settings-button:hover {
  background-color: #1e3a8a;
  text-decoration: none;
}

.logout-button {
  background-color: #ef4444;
  color: white;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.logout-button:hover {
  background-color: #dc2626;
}

.profile-loading {
  text-align: center;
  padding: 2rem 0;
  color: #64748b;
}

@media (max-width: 640px) {
  .profile-card {
    padding: 1.5rem;
  }
  
  .profile-header {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }
}
</style>
