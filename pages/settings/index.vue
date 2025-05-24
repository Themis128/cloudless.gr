<template>
  <div class="settings-container">
    <div class="settings-card">
      <h1>Account Settings</h1>
      
      <div class="settings-sections">
        <section class="settings-section">
          <h2>Profile Information</h2>
          <p class="section-description">Update your account information</p>
          
          <form @submit.prevent="updateProfile" class="settings-form">
            <div class="form-group">
              <label for="name">Full Name</label>
              <input 
                type="text" 
                id="name" 
                v-model="profileData.name" 
                placeholder="Your name"
              />
            </div>
            
            <div class="form-group">
              <label for="email">Email Address</label>
              <input 
                type="email" 
                id="email" 
                v-model="profileData.email" 
                placeholder="Your email"
                disabled
              />
              <small class="input-help">Email cannot be changed</small>
            </div>
            
            <button 
              type="submit" 
              class="save-button" 
              :disabled="isUpdating"
            >
              {{ isUpdating ? 'Saving...' : 'Save Changes' }}
            </button>
          </form>
        </section>

        <section class="settings-section">
          <h2>Password</h2>
          <p class="section-description">Update your password</p>
          
          <form @submit.prevent="updatePassword" class="settings-form">
            <div class="form-group">
              <label for="currentPassword">Current Password</label>
              <input 
                type="password" 
                id="currentPassword" 
                v-model="passwordData.currentPassword" 
                placeholder="Current password"
              />
            </div>
            
            <div class="form-group">
              <label for="newPassword">New Password</label>
              <input 
                type="password" 
                id="newPassword" 
                v-model="passwordData.newPassword" 
                placeholder="New password"
              />
            </div>
            
            <div class="form-group">
              <label for="confirmPassword">Confirm New Password</label>
              <input 
                type="password" 
                id="confirmPassword" 
                v-model="passwordData.confirmPassword" 
                placeholder="Confirm new password"
              />
            </div>
            
            <button 
              type="submit" 
              class="save-button" 
              :disabled="isUpdating"
            >
              {{ isUpdating ? 'Updating...' : 'Update Password' }}
            </button>
          </form>
        </section>
        
        <section class="settings-section danger-section">
          <h2>Danger Zone</h2>
          <p class="section-description">Manage your account deletion</p>
          
          <div class="danger-actions">
            <button 
              @click="confirmDeleteAccount" 
              class="delete-button"
            >
              Delete Account
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useUserAuth } from '~/composables/useUserAuth';

const { currentUser, isLoggedIn } = useUserAuth();

// Redirect if not logged in
if (process.client && !isLoggedIn.value) {
  navigateTo('/auth/login');
}

// Form data
const profileData = ref({
  name: currentUser.value?.name || '',
  email: currentUser.value?.email || ''
});

const passwordData = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const isUpdating = ref(false);

// Form submission handlers
const updateProfile = async () => {
  isUpdating.value = true;
  
  // This is a mock implementation - in a real app, you would call an API
  setTimeout(() => {
    // Update local storage user data
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    userData.name = profileData.value.name;
    localStorage.setItem('user_data', JSON.stringify(userData));
    
    // Update reactive state
    if (currentUser.value) {
      currentUser.value.name = profileData.value.name;
    }
    
    // Show success message (in a real app)
    alert('Profile updated successfully!');
    isUpdating.value = false;
  }, 800);
};

const updatePassword = async () => {
  isUpdating.value = true;
  
  // Validate passwords
  if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
    alert('New passwords do not match');
    isUpdating.value = false;
    return;
  }
  
  if (passwordData.value.newPassword.length < 6) {
    alert('Password must be at least 6 characters');
    isUpdating.value = false;
    return;
  }
  
  // This is a mock implementation - in a real app, you would call an API
  setTimeout(() => {
    // In a real app, you would update the password on the server
    alert('Password updated successfully!');
    
    // Reset form
    passwordData.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    
    isUpdating.value = false;
  }, 800);
};

const confirmDeleteAccount = () => {
  const confirmed = confirm(
    'Are you sure you want to delete your account? This action cannot be undone.'
  );
  
  if (confirmed) {
    // This is a mock implementation - in a real app, you would call an API
    alert('Account deletion is just a demo feature. Your account is still active.');
  }
};
</script>

<style scoped>
.settings-container {
  padding: 2rem 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.settings-card {
  background-color: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 0.75rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

h1 {
  color: #1e40af;
  font-size: 1.8rem;
  margin-bottom: 2rem;
  font-weight: 700;
  text-align: center;
}

.settings-sections {
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.settings-section {
  border-bottom: 1px solid rgba(203, 213, 225, 0.5);
  padding-bottom: 2rem;
}

.settings-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

h2 {
  font-size: 1.25rem;
  color: #334155;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.section-description {
  color: #64748b;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #334155;
}

input {
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid #cbd5e1;
  background-color: white;
  font-size: 1rem;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;
}

input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

input:disabled {
  background-color: #f1f5f9;
  cursor: not-allowed;
}

.input-help {
  font-size: 0.75rem;
  color: #64748b;
}

.save-button {
  background-color: #1e40af;
  color: white;
  font-weight: 600;
  padding: 0.75rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 0.5rem;
  width: fit-content;
}

.save-button:hover {
  background-color: #1e3a8a;
}

.save-button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.danger-section {
  margin-top: 1rem;
}

.danger-section h2 {
  color: #b91c1c;
}

.danger-actions {
  background-color: #fef2f2;
  border: 1px solid #fee2e2;
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-top: 1rem;
}

.delete-button {
  background-color: #ef4444;
  color: white;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
}

.delete-button:hover {
  background-color: #dc2626;
}

@media (max-width: 640px) {
  .settings-card {
    padding: 1.5rem;
  }
}
</style>
