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
              {{ isUpdating ? 'Updating...' : 'Update Profile' }}
            </button>
          </form>
        </section>
        
        <section class="settings-section">
          <h2>Change Password</h2>
          <p class="section-description">Update your account password</p>
          
          <form @submit.prevent="updatePassword" class="settings-form">
            <div class="form-group">
              <label for="current-password">Current Password</label>
              <input 
                type="password" 
                id="current-password" 
                v-model="passwordData.currentPassword"
                placeholder="Enter current password"
              />
            </div>
            
            <div class="form-group">
              <label for="new-password">New Password</label>
              <input 
                type="password" 
                id="new-password" 
                v-model="passwordData.newPassword"
                placeholder="Enter new password"
                minlength="6"
              />
            </div>
            
            <div class="form-group">
              <label for="confirm-password">Confirm New Password</label>
              <input 
                type="password" 
                id="confirm-password" 
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

<script setup lang="ts">
import { ref } from 'vue';
import { useUserAuth } from '~/composables/useUserAuth';
import { navigateTo } from '#app'
import { definePageMeta } from '#imports'

const { currentUser, isLoggedIn } = useUserAuth();

// Redirect if not logged in
if (process.client && !isLoggedIn.value) {
  await navigateTo('/auth/login');
}

interface ProfileData {
  name: string;
  email: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Form data
const profileData = ref<ProfileData>({
  name: currentUser.value?.name || '',
  email: currentUser.value?.email || ''
});

const passwordData = ref<PasswordData>({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const isUpdating = ref<boolean>(false);

// Update profile function
const updateProfile = async (): Promise<void> => {
  isUpdating.value = true;
  
  try {
    // In a real app, you would call an API to update the profile
    // For now, we'll just simulate a successful update
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    
    // Update the current user data (in a real app, this would come from the API response)
    if (currentUser.value) {
      currentUser.value.name = profileData.value.name;
    }
    
    alert('Profile updated successfully!');
  } catch (error) {
    alert('Failed to update profile. Please try again.');
    console.error('Profile update error:', error);
  } finally {
    isUpdating.value = false;
  }
};

// Update password function
const updatePassword = async (): Promise<void> => {
  if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
    alert('New passwords do not match');
    return;
  }
  
  if (passwordData.value.newPassword.length < 6) {
    alert('Password must be at least 6 characters long');
    return;
  }
  
  isUpdating.value = true;
  
  try {
    // In a real app, you would call an API to update the password
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
    
    // Clear password fields
    passwordData.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    
    alert('Password updated successfully!');
  } catch (error) {
    alert('Failed to update password. Please try again.');
    console.error('Password update error:', error);
  } finally {
    isUpdating.value = false;
  }
};

// Delete account function
const confirmDeleteAccount = (): void => {
  const confirmed = confirm(
    'Are you sure you want to delete your account? This action cannot be undone.'
  );
  
  if (confirmed) {
    // In a real app, you would call an API to delete the account
    alert('Account deletion feature will be implemented soon.');
  }
};

// Set page meta
definePageMeta({
  layout: 'default',
  middleware: 'user-auth'
});
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
  color: #1e40af;
  font-size: 1.3rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.section-description {
  color: #64748b;
  margin-bottom: 1.5rem;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  color: #374151;
}

input {
  padding: 0.75rem;
  border: 1px solid rgba(203, 213, 225, 0.8);
  border-radius: 0.375rem;
  font-size: 1rem;
  transition: all 0.2s;
  background-color: rgba(255, 255, 255, 0.9);
}

input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

input:disabled {
  background-color: #f8fafc;
  color: #94a3b8;
  cursor: not-allowed;
}

.input-help {
  color: #64748b;
  font-size: 0.875rem;
}

.save-button {
  background-color: #3b82f6;
  color: white;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border-radius: 0.375rem;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  align-self: flex-start;
}

.save-button:hover:not(:disabled) {
  background-color: #2563eb;
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
