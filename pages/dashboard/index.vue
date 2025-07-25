<template>
  <div class="dashboard-container">
    <div class="dashboard-header">
      <h1>Dashboard</h1>
      <p class="welcome-message">Welcome back, {{ currentUser?.name || 'User' }}!</p>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-card">
        <h2>Your Activity</h2>
        <div class="activity-stats">
          <div class="stat-item">
            <div class="stat-value">0</div>
            <div class="stat-label">Projects Viewed</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">0</div>
            <div class="stat-label">Comments</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">0</div>
            <div class="stat-label">Likes</div>
          </div>
        </div>
      </div>
      
      <div class="dashboard-card">
        <h2>Recent Updates</h2>
        <div class="updates-list">
          <p class="empty-state">No updates to display yet.</p>
        </div>
      </div>
      
      <div class="dashboard-card">
        <h2>Your Favorites</h2>
        <div class="favorites-list">
          <p class="empty-state">You haven't saved any favorites yet.</p>
        </div>
      </div>
      
      <div class="dashboard-card">
        <h2>Quick Actions</h2>
        <div class="action-buttons">
          <NuxtLink to="/profile" class="action-button">
            Edit Profile
          </NuxtLink>
          <NuxtLink to="/projects" class="action-button">
            Browse Projects
          </NuxtLink>
          <NuxtLink to="/contact" class="action-button">
            Contact Support
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useUserAuth } from '~/composables/useUserAuth';
import { navigateTo } from '#app'
import { definePageMeta } from '#imports'

const { currentUser, isLoggedIn } = useUserAuth();

// Redirect if not logged in
if (process.client && !isLoggedIn.value) {
  await navigateTo('/auth/login');
}

// Set page meta
definePageMeta({
  layout: 'default',
  middleware: 'user-auth'
});
</script>

<style scoped>
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.dashboard-header {
  text-align: center;
  margin-bottom: 3rem;
}

.dashboard-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 0.5rem;
}

.welcome-message {
  font-size: 1.2rem;
  color: #64748b;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.dashboard-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: transform 0.2s;
}

.dashboard-card:hover {
  transform: translateY(-2px);
}

.dashboard-card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1e40af;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.5rem;
}

.activity-stats {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #1e40af;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
}

.empty-state {
  text-align: center;
  color: #94a3b8;
  font-style: italic;
  padding: 2rem 0;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.action-button {
  background-color: #1e40af;
  color: white;
  text-decoration: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  text-align: center;
  font-weight: 500;
  transition: background-color 0.2s;
}

.action-button:hover {
  background-color: #1e3a8a;
}

@media (max-width: 768px) {
  .dashboard-header h1 {
    font-size: 2rem;
  }
  
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  
  .activity-stats {
    flex-direction: column;
    gap: 1rem;
  }
}
</style>
