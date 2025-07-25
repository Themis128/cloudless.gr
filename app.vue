<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
<<<<<<< HEAD
// Main app component - no additional logic needed
</script>

<style>
/* Global styles for better visibility over Vanta backgrounds */

/* Enhanced form container visibility */
.v-container {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(20px) !important;
  border-radius: 16px !important;
  padding: 2rem !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  margin-bottom: 2rem !important;
}

/* Enhanced Vuetify form fields */
.v-field {
  background: rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(10px) !important;
  border-radius: 8px !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

.v-field__overlay {
  background: rgba(255, 255, 255, 0.8) !important;
}

/* Enhanced text visibility */
.v-field__input {
  color: #000000 !important;
  font-weight: 500 !important;
}

.v-label {
  color: #333333 !important;
  font-weight: 500 !important;
}

/* Enhanced button visibility */
.v-btn {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  backdrop-filter: blur(10px) !important;
}

/* Enhanced alert visibility */
.v-alert {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(15px) !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
}

/* Enhanced card visibility */
.v-card {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px) !important;
  border-radius: 16px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}

/* Enhanced form card visibility */
.form-card {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(25px) !important;
  border-radius: 20px !important;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  padding: 2rem !important;
}

/* Enhanced text readability */
h1, h2, h3, h4, h5, h6 {
  color: #000000 !important;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5) !important;
}

p, span, div {
  color: #333333 !important;
}

/* Enhanced select dropdown visibility */
.v-menu__content {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(20px) !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
}

/* Comprehensive dropdown text color fixes */
.v-select,
.v-menu,
.v-overlay {
  color: black !important;
}

.v-select .v-field__input,
.v-select .v-field__input input,
.v-select .v-field__input::placeholder {
  color: black !important;
}

.v-select .v-field__label,
.v-select .v-field-label,
.v-select .v-field-label--floating {
  color: rgba(0, 0, 0, 0.6) !important;
}

.v-select__selection,
.v-select__selection-text {
  color: black !important;
}

.v-select__menu-icon,
.v-field__append-inner .v-icon,
.v-input__prepend .v-icon {
  color: black !important;
}

/* Dropdown menu content */
.v-menu .v-list,
.v-overlay .v-list {
  background: white !important;
  color: black !important;
}

.v-menu .v-list-item,
.v-overlay .v-list-item {
  color: black !important;
}

.v-menu .v-list-item-title,
.v-overlay .v-list-item-title {
  color: black !important;
}

.v-menu .v-list-item-subtitle,
.v-overlay .v-list-item-subtitle {
  color: rgba(0, 0, 0, 0.7) !important;
}

/* Hover and active states */
.v-list-item:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

.v-list-item--active {
  background: rgba(0, 0, 0, 0.1) !important;
  color: black !important;
}

.v-list-item--active .v-list-item-title {
  color: black !important;
}

/* Ensure all dropdown elements are black */
.v-select *,
.v-menu *,
.v-overlay * {
  color: black !important;
}

/* Specific fixes for different dropdown types */
.v-autocomplete .v-field__input,
.v-combobox .v-field__input {
  color: black !important;
}

.v-autocomplete .v-field__label,
.v-combobox .v-field__label {
  color: rgba(0, 0, 0, 0.6) !important;
}

/* Enhanced input focus states */
.v-field--focused {
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.3) !important;
}

/* Enhanced form validation messages */
.v-messages {
  color: #d32f2f !important;
  font-weight: 500 !important;
}

/* Enhanced sidebar content */
.sidebar .v-alert {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(25px) !important;
  border-radius: 16px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
}

/* Enhanced form field spacing */
.v-input {
  margin-bottom: 1.5rem !important;
}

/* Enhanced button spacing */
.v-btn + .v-btn {
  margin-left: 1rem !important;
}

/* Enhanced form layout */
.v-form {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px) !important;
  border-radius: 16px !important;
  padding: 2rem !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
=======
// Nothing needed here unless injecting global logic
</script>

<style>
/* Apply global resets and fallback background */
html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  overflow-x: hidden;
  background-color: #7ec0ee; /* fallback sky-blue if Vanta fails */
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
}
</style>
