<template>
  <v-card class="glass-card pa-6" width="400" elevation="10">
    <v-card-title class="text-h5 text-white text-center">Register</v-card-title>

    <v-form ref="form" validate-on="submit lazy" @submit.prevent="handleRegister">
      <v-text-field
        v-model="firstName"
        label="First Name"
        prepend-icon="mdi-account"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required]"
        :disabled="isSubmitting"
      />
      <v-text-field
        v-model="lastName"
        label="Last Name"
        prepend-icon="mdi-account"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required]"
        :disabled="isSubmitting"
      />
      <v-text-field
        v-model="email"
        label="Email"
        placeholder="you@example.com"
        prepend-icon="mdi-email-outline"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input mb-4"
        :rules="[rules.required, rules.email]"
        :disabled="isSubmitting"
      />
      <v-text-field
        v-model="password"
        :type="showPassword ? 'text' : 'password'"
        label="Password"
        prepend-icon="mdi-lock-outline"
        :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
        clearable
        variant="solo-inverted"
        color="blue"
        class="glass-input"
        :rules="[rules.required, rules.minLength]"
        :disabled="isSubmitting"
        @click:append="showPassword = !showPassword"
      />

      <v-btn
        type="submit"
        block
        color="blue"
        class="mt-4"
        :loading="isSubmitting"
        :disabled="isSubmitting"
      >Register</v-btn>
    </v-form>

    <NuxtLink to="/auth" class="register-link mt-4">
      <v-icon left size="18" color="#3b82f6">mdi-login</v-icon>
      <span>Already have an account? <span class="gradient-text">Login</span></span>
    </NuxtLink>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { navigateTo } from '#app'
import { useSupabase } from '@/composables/useSupabase'

const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const form = ref(null)

const supabase = useSupabase()

const rules = {
  required: (v: string) => !!v || 'Required',
  email: (v: string) => /.+@.+\..+/.test(v) || 'Invalid email',
  minLength: (v: string) => v.length >= 6 || 'Min 6 characters'
}

const isLocalDev = () =>
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

// No auto-login after registration; always redirect to /auth (login page)

async function handleEmailConfirmationError(data: Record<string, unknown>) {
  if (data && typeof data === 'object' && 'user' in data && (data.user as SupabaseUser)?.id) {
    await setupUserProfile((data.user as SupabaseUser).id)
    alert('Registration successful! Email confirmation failed (this is normal in local development). Your account is ready - you can now log in with your credentials.')
    await navigateTo('/auth')
    return true
  } else if (data) {
    alert('Registration completed! Email confirmation failed (this is normal in local development). Please try logging in with your credentials. If login fails, the account may need to be confirmed manually.')
    await navigateTo('/auth')
    return true
  }
  // If data is not present or not handled above, return false
  return false
}

async function handleAlreadyRegistered() {
  alert('This email is already registered. Please try logging in instead.')
  navigateTo('/auth')
}

interface SupabaseUser {
  id: string
  email?: string
  email_confirmed_at?: string | null
  // Add other known properties here if needed, or remove the index signature to avoid using 'any'
}

async function handleConfirmedUser(user: SupabaseUser) {
  await setupUserProfile(user.id)
  alert('Registration successful! You can now log in.')
  await navigateTo('/auth')
}

async function handleUnconfirmedUser(user: SupabaseUser) {
  await setupUserProfile(user.id)
  alert('Registration successful! Please check your email to confirm your account before logging in.')
  await navigateTo('/auth')
}

async function isFormValid(): Promise<boolean> {
  if (form.value && typeof (form.value as any).validate === 'function') {
    const { valid } = await (form.value as any).validate();
    console.log('✅ Form valid:', valid);
    if (!valid) {
      console.log('❌ Form validation failed, stopping submission');
    }
    return valid;
  }
  return true;
}

async function handleRegistrationError(error: { message: string }, data: unknown) {
  if (error.message.includes('Error sending confirmation email')) {
    if (await handleEmailConfirmationError(data as Record<string, unknown>)) return true
  } else if (error.message.includes('User already registered')) {
    await handleAlreadyRegistered()
    return true
  } else {
    alert('Registration failed: ' + error.message)
    return true
  }
  return false
}

type SupabaseSignUpResponse = {
  user?: SupabaseUser | null;
  [key: string]: unknown;
};

async function handlePostRegistrationUser(data: SupabaseSignUpResponse | null | undefined) {
  if (data && data.user && data.user.id) {
    if (data.user.email_confirmed_at) {
      await handleConfirmedUser(data.user)
    } else {
      await handleUnconfirmedUser(data.user)
    }
    return true
  }
  return false
}

const handleRegister = async () => {
  if (isSubmitting.value) return

  console.log('🚀 Registration form submitted!')
  console.log('📧 Email:', email.value)
  console.log('👤 Name:', firstName.value, lastName.value)
  console.log('🔧 Using Supabase client:', supabase)

  // Check form validation
  const valid = await isFormValid()
  if (!valid) return

  isSubmitting.value = true

  try {
    console.log('📤 Sending registration request...')
    const { data, error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          first_name: firstName.value,
          last_name: lastName.value
        }
      }
    })

    console.log('📊 Registration response:')
    console.log('Data:', data)
    console.log('Error:', error)

    if (error) {
      if (await handleRegistrationError(error, data)) return
    }

    if (await handlePostRegistrationUser(data)) return

  } catch (e) {
    console.error('Registration error:', e)
    alert('Registration failed: ' + (e as Error).message)
  } finally {
    isSubmitting.value = false
  }
}

async function setupUserProfile(userId: string) {
  try {
    // Insert user profile into 'user_profiles' table
    const { error: profileError } = await supabase
      .from('user_profiles')
      // @ts-ignore - Supabase insert typing issue with database schema inference
      .insert([{
        id: userId,
        full_name: `${firstName.value} ${lastName.value}`.trim() || null,
        role: 'user'
      }])
    
    if (profileError) {
      console.warn('Profile creation error:', profileError)
      // Don't throw error - user can still log in even if profile creation fails
    }
  } catch (err) {
    console.warn('Profile setup failed:', err)
    // Don't throw error - user can still log in even if profile creation fails
  }
}
</script>

<style scoped>
.register-outer {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  padding: 1.5rem 0;
}

/* Card flip container */
.card-flip-container {
  position: relative;
  width: 100%;
  max-width: 400px;
  min-height: auto;
  perspective: 1000px;
}

.card-flip-container.flipped .card-front {
  transform: rotateY(-180deg);
}

.card-flip-container.flipped .card-back {
  transform: rotateY(0deg);
}

/* Card sides */
.card-front,
.card-back {
  position: absolute;
  width: 100%;
  min-height: auto;
  backface-visibility: hidden;
  transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  transform-style: preserve-3d;
}

.card-front {
  transform: rotateY(0deg);
}

.card-back {
  transform: rotateY(180deg);
}

.glass-card {
  width: 100%;
  height: auto;
  background: rgba(255, 255, 255, 0.13);
  border-radius: 22px;
  box-shadow: 0 12px 40px 0 rgba(40, 40, 80, 0.18), 0 1.5px 8px 0 rgba(80, 80, 160, 0.10);
  backdrop-filter: blur(18px);
  border: 1.5px solid rgba(168, 85, 247, 0.13);
  display: flex;
  flex-direction: column;
}

/* Success content styling */
.success-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2rem 1rem;
  min-height: 400px;
}

.success-icon-container {
  animation: successPulse 2s ease-in-out infinite;
}

@keyframes successPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.success-icon {
  filter: drop-shadow(0 0 10px rgba(76, 175, 80, 0.5));
}

.countdown-container {
  animation: fadeInUp 0.5s ease-out 0.5s both;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Form input styling */
.glass-input input {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
  letter-spacing: 0.02em;
  padding: 12px 16px !important;
  font-size: 1.08rem;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  background: rgba(255, 255, 255, 0.10) !important;
  backdrop-filter: blur(2px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(31, 38, 135, 0.10);
}

.v-label {
  color: #fff !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.45), 0 0px 1px #000;
}

::placeholder {
  color: #f3f6fa !important;
  text-shadow: 0 1px 6px rgba(30, 30, 60, 0.35);
  opacity: 1;
}

/* Form layout improvements */
.card-front .v-card-title {
  padding-bottom: 0.5rem !important;
}

.card-front .v-form {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.card-front .login-link {
  margin-top: 0.5rem;
}

/* Make form fields more compact */
.glass-input {
  margin-bottom: 0.75rem !important;
}

.glass-input .v-field {
  margin-bottom: 0 !important;
}

.login-link {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  font-weight: 500;
  color: #3b82f6;
  gap: 0.4em;
  text-decoration: none;
  transition: color 0.2s;
}

.login-link:hover {
  color: #a855f7;
}

.gradient-text {
  background: linear-gradient(90deg, #3b82f6 30%, #a855f7 70%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .card-flip-container {
    max-width: 360px;
  }
  
  .register-outer {
    padding: 1rem;
  }
  
  .glass-card {
    border-radius: 18px;
  }
  
  .success-content {
    padding: 1.5rem 1rem;
    min-height: 350px;
  }
}

@media (max-width: 480px) {
  .card-flip-container {
    max-width: 320px;
  }
  
  .register-outer {
    padding: 0.5rem;
  }
  
  .glass-card {
    border-radius: 16px;
  }
  
  .success-content {
    padding: 1rem;
    min-height: 320px;
  }
  
  .glass-input input {
    font-size: 1rem;
  }
}
</style>
