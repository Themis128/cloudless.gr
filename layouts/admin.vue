<template>
  <NuxtLayout name="default" class="admin-layout-wrapper">
    <div class="admin-toolbar" role="navigation" aria-label="Admin Navigation">
      <div class="admin-toolbar-content">
        <div class="admin-branding">
          <h2>Admin Dashboard</h2>
        </div>
        <nav class="admin-nav">
          <NuxtLink to="/admin/contact-submissions" class="nav-link">
            Contact Submissions
          </NuxtLink>
          <button @click="logout" class="logout-button">Logout</button>
        </nav>
      </div>
    </div>
    
    <div class="admin-content">
      <slot />
    </div>
    
    <div class="admin-footer">
      <p>Admin area - For authorized users only</p>
    </div>
  </NuxtLayout>
</template>

<script setup>
// Logout function
const logout = () => {
  // Clear authentication state
  localStorage.removeItem('admin_authenticated');

  // Redirect to login
  navigateTo('/admin/login');
};
</script>

<style scoped>
.admin-layout-wrapper :deep(.layout-root) {
  position: relative;

.admin-layout-wrapper :deep(.main-content-transparent) {
  position: static;
  z-index: 0;
}

.admin-layout-wrapper :deep(div[data-vanta]),
.admin-layout-wrapper :deep(canvas.vanta-canvas) {
  z-index: 5 !important;
  opacity: 0.8 !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  pointer-events: none !important;
}

.admin-toolbar {
  background-color: rgba(30, 64, 175, 0.9);
  color: white;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(10px);
  position: relative;
  z-index: 10;
}

.admin-toolbar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
}

.admin-branding h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(90deg, #ffffff 0%, #e2e8f0 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.admin-nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.nav-link {
  color: white;
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.nav-link:hover {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.logout-button {
  background-color: rgba(239, 68, 68, 0.2);
  color: white;
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-button:hover {
  background-color: rgba(239, 68, 68, 0.4);
}

.admin-content {
  position: relative;
  z-index: 1;
  padding: 2rem;
  margin-bottom: 2rem;
  color: white;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.7);
}

.admin-footer {
  position: relative;
  z-index: 1;
  text-align: center;
  color: white;
  font-size: 0.875rem;
  margin-top: 1rem;
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.7);
}
}

.admin-main {
  flex: 1;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
  color: #64748b;
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 1rem;
  }

  .admin-nav {
    width: 100%;
    justify-content: center;
  }
}
</style>
