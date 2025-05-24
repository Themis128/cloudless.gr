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

<script setup>
import { useUserAuth } from '~/composables/useUserAuth';

const { currentUser, isLoggedIn } = useUserAuth();

// Redirect if not logged in
if (process.client && !isLoggedIn.value) {
  navigateTo('/auth/login');
}
</script>

<style scoped>
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.dashboard-header {
  margin-bottom: 2rem;
  text-align: center;
}

.dashboard-header h1 {
  font-size: 2.25rem;
  color: #1e40af;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.welcome-message {
  font-size: 1.125rem;
  color: #64748b;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.dashboard-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}

.dashboard-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

.dashboard-card h2 {
  color: #334155;
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(203, 213, 225, 0.5);
}

.activity-stats {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-item {
  padding: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e40af;
}

.stat-label {
  font-size: 0.875rem;
  color: #64748b;
}

.empty-state {
  color: #94a3b8;
  text-align: center;
  padding: 1rem 0;
  font-style: italic;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.action-button {
  background-color: #f1f5f9;
  color: #334155;
  padding: 0.75rem;
  border-radius: 0.375rem;
  text-align: center;
  font-weight: 500;
  transition: background-color 0.2s;
  text-decoration: none;
}

.action-button:hover {
  background-color: #e2e8f0;
  text-decoration: none;
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
