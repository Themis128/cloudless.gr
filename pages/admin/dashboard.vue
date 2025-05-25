<template>
  <div class="admin-dashboard">
    <h1 class="dashboard-title">Admin Dashboard</h1>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon users-icon">👥</div>
        <div class="stat-content">
          <h3 class="stat-title">Users</h3>
          <p class="stat-value">146</p>
          <p class="stat-change increase">+12% this month</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon projects-icon">📂</div>
        <div class="stat-content">
          <h3 class="stat-title">Projects</h3>
          <p class="stat-value">24</p>
          <p class="stat-change increase">+3 this month</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon contacts-icon">📧</div>
        <div class="stat-content">
          <h3 class="stat-title">Contact Submissions</h3>
          <p class="stat-value">38</p>
          <p class="stat-change increase">+8 this month</p>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon visits-icon">👁️</div>
        <div class="stat-content">
          <h3 class="stat-title">Site Visits</h3>
          <p class="stat-value">2,847</p>
          <p class="stat-change increase">+18% this month</p>
        </div>
      </div>
    </div>
    
    <div class="dashboard-row">
      <div class="dashboard-panel recent-activity">
        <h2 class="panel-title">Recent Activity</h2>
        <ul class="activity-list">
          <li class="activity-item">
            <div class="activity-icon user-activity">👤</div>
            <div class="activity-content">
              <p class="activity-text">
                <strong>John Smith</strong> registered a new account
              </p>
              <p class="activity-time">10 minutes ago</p>
            </div>
          </li>
          <li class="activity-item">
            <div class="activity-icon contact-activity">📧</div>
            <div class="activity-content">
              <p class="activity-text">
                <strong>New contact submission</strong> from Maria Johnson
              </p>
              <p class="activity-time">45 minutes ago</p>
            </div>
          </li>
          <li class="activity-item">
            <div class="activity-icon project-activity">📂</div>
            <div class="activity-content">
              <p class="activity-text">
                <strong>Project updated:</strong> E-commerce Website
              </p>
              <p class="activity-time">2 hours ago</p>
            </div>
          </li>
          <li class="activity-item">
            <div class="activity-icon user-activity">👤</div>
            <div class="activity-content">
              <p class="activity-text">
                <strong>Robert Wilson</strong> updated their profile
              </p>
              <p class="activity-time">3 hours ago</p>
            </div>
          </li>
          <li class="activity-item">
            <div class="activity-icon project-activity">📂</div>
            <div class="activity-content">
              <p class="activity-text">
                <strong>New project added:</strong> AI Content Generator
              </p>
              <p class="activity-time">Yesterday</p>
            </div>
          </li>
        </ul>
        <div class="panel-footer">
          <button class="view-all-button">View All Activity</button>
        </div>
      </div>
      
      <div class="dashboard-panel quick-actions">
        <h2 class="panel-title">Quick Actions</h2>
        <div class="action-buttons">
          <button class="action-button" @click="navigateTo('/admin/users')">
            <span class="action-icon">👥</span>
            Manage Users
          </button>
          <button class="action-button" @click="navigateTo('/admin/projects')">
            <span class="action-icon">📂</span>
            Manage Projects
          </button>
          <button class="action-button" @click="navigateTo('/admin/contact-submissions')">
            <span class="action-icon">📧</span>
            Review Contacts
          </button>
          <button class="action-button">
            <span class="action-icon">⚙️</span>
            Site Settings
          </button>
          <button class="action-button">
            <span class="action-icon">📊</span>
            Analytics
          </button>
          <button class="action-button">
            <span class="action-icon">🔐</span>
            Permissions
          </button>
        </div>
      </div>
    </div>
    
    <div class="dashboard-panel system-status">
      <h2 class="panel-title">System Status</h2>
      <div class="status-items">
        <div class="status-item">
          <div class="status-label">Server Status</div>
          <div class="status-value">
            <span class="status-indicator online"></span>
            Online
          </div>
        </div>
        <div class="status-item">
          <div class="status-label">Database</div>
          <div class="status-value">
            <span class="status-indicator online"></span>
            Connected
          </div>
        </div>
        <div class="status-item">
          <div class="status-label">API Health</div>
          <div class="status-value">
            <span class="status-indicator online"></span>
            100% Uptime
          </div>
        </div>
        <div class="status-item">
          <div class="status-label">Storage</div>
          <div class="status-value">
            <span class="status-indicator warning"></span>
            78% Used
          </div>
        </div>
        <div class="status-item">
          <div class="status-label">Last Backup</div>
          <div class="status-value">Today at 02:00 AM</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'nuxt/app';

const router = useRouter();
</script>

<style scoped>
.admin-dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-title {
  font-size: 2rem;
  margin-bottom: 1.5rem;
  color: #1e40af;
  font-weight: 700;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  display: flex;
  align-items: center;
  border: 1px solid rgba(219, 234, 254, 0.6);
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.15);
}

.stat-icon {
  font-size: 2.5rem;
  margin-right: 1rem;
  opacity: 0.8;
}

.stat-content {
  flex: 1;
}

.stat-title {
  font-size: 0.9rem;
  color: #64748b;
  margin: 0 0 0.25rem;
  font-weight: 500;
}

.stat-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e40af;
  margin: 0;
}

.stat-change {
  font-size: 0.8rem;
  margin: 0.25rem 0 0;
}

.increase {
  color: #10b981;
}

.decrease {
  color: #ef4444;
}

.dashboard-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.dashboard-panel {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
  border: 1px solid rgba(219, 234, 254, 0.6);
}

.panel-title {
  font-size: 1.25rem;
  color: #1e40af;
  margin: 0 0 1rem;
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.75rem;
}

.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.activity-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f1f5f9;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon {
  font-size: 1.25rem;
  margin-right: 1rem;
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: #f1f5f9;
}

.user-activity {
  background-color: #ede9fe;
  color: #6d28d9;
}

.contact-activity {
  background-color: #e0f2fe;
  color: #0369a1;
}

.project-activity {
  background-color: #fef3c7;
  color: #92400e;
}

.activity-content {
  flex: 1;
}

.activity-text {
  margin: 0;
  color: #334155;
}

.activity-time {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: #94a3b8;
}

.panel-footer {
  padding-top: 1rem;
  text-align: center;
}

.view-all-button {
  background-color: transparent;
  color: #2563eb;
  border: 1px solid #2563eb;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s, color 0.2s;
}

.view-all-button:hover {
  background-color: #2563eb;
  color: white;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}

.action-button {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.75rem;
  cursor: pointer;
  font-weight: 500;
  color: #334155;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
}

.action-button:hover {
  background-color: #f1f5f9;
  border-color: #cbd5e1;
  transform: translateY(-1px);
}

.action-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}

.system-status {
  margin-bottom: 2rem;
}

.status-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-radius: 6px;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}

.status-label {
  font-weight: 500;
  color: #334155;
}

.status-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-indicator.online {
  background-color: #10b981;
}

.status-indicator.offline {
  background-color: #ef4444;
}

.status-indicator.warning {
  background-color: #f59e0b;
}

@media (max-width: 768px) {
  .dashboard-row {
    grid-template-columns: 1fr;
  }
  
  .status-items {
    grid-template-columns: 1fr;
  }
}
</style>
