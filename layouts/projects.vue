<template>
  <div class="projects-layout">
    <!-- Starry night sky background -->
    <div class="background-container">
      <!-- Small twinkling stars -->
      <div class="stars stars-small" />
      <div class="stars stars-medium" />
      <div class="stars stars-large" />
      <!-- Falling stars / shooting stars -->
      <div class="falling-star falling-star-1" />
      <div class="falling-star falling-star-2" />
      <div class="falling-star falling-star-3" />
      <div class="falling-star falling-star-4" />
      <!-- Additional shooting stars in different directions -->
      <div class="falling-star falling-star-vertical-1" />
      <div class="falling-star falling-star-vertical-2" />
      <div class="falling-star falling-star-reverse-1" />
      <div class="falling-star falling-star-reverse-2" />
      <div class="falling-star falling-star-steep-1" />
      <div class="falling-star falling-star-steep-2" />
      <div class="falling-star falling-star-horizontal-1" />
      <div class="falling-star falling-star-horizontal-2" />
      <!-- Extra volume shooting stars - Layer 2 -->
      <div class="falling-star falling-star-extra-1" />
      <div class="falling-star falling-star-extra-2" />
      <div class="falling-star falling-star-extra-3" />
      <div class="falling-star falling-star-extra-4" />
      <div class="falling-star falling-star-extra-5" />
      <div class="falling-star falling-star-extra-6" />
      <!-- More volume shooting stars - Layer 3 -->
      <div class="falling-star falling-star-volume-1" />
      <div class="falling-star falling-star-volume-2" />
      <div class="falling-star falling-star-volume-3" />
      <div class="falling-star falling-star-volume-4" />
      <div class="falling-star falling-star-volume-5" />
      <div class="falling-star falling-star-volume-6" />
      <div class="falling-star falling-star-volume-7" />
      <div class="falling-star falling-star-volume-8" />
    </div>

    <!-- Main content area -->
    <main
      id="main-content"
      role="main"
      class="projects-content"
      tabindex="-1"
    >
      <!-- Page content with glass effect -->
      <div class="content-wrapper">
        <NuxtPage />
      </div>
    </main>

    <!-- Footer -->
    <footer class="projects-footer">
      <Suspense>
        <template #default>
          <Footer />
        </template>
      </Suspense>
    </footer>

    <!-- Floating components with fixed positioning -->
    <div class="floating-components">
      <!-- Accessibility menu -->
      <Suspense>
        <template #default>
          <AccessibilityMenu />
        </template>
      </Suspense>

      <!-- Floating Navigation Button -->
      <Suspense>
        <template #default>
          <FloatingNavButton />
        </template>
      </Suspense>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'));
const LargeNav = defineAsyncComponent(() => import('@/components/Layout/Navigation/LargeNav.vue'));
const AccessibilityMenu = defineAsyncComponent(
  () => import('@/components/accessibility/AccessibilityMenu.vue'),
);
const FloatingNavButton = defineAsyncComponent(
  () => import('@/components/ui/FloatingNavButton.vue'),
);
</script>

<style scoped>
/*
Z-INDEX LAYERING SYSTEM:
- Background: z-index: 1
- Content wrapper: z-index: 10
- Main content: z-index: 20
- Footer: z-index: 30
- Navigation: z-index: 100
- Floating components: z-index: 1000
*/

.projects-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* Starry night sky background */
.background-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  background: #121212;
  overflow: hidden;
}

/* Star layers with different sizes */
.stars {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
}

.stars-small {
  background-image:
    radial-gradient(2px 2px at 20px 30px, #eee, transparent),
    radial-gradient(2px 2px at 40px 70px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(1px 1px at 90px 40px, #fff, transparent),
    radial-gradient(1px 1px at 130px 80px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(2px 2px at 160px 30px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(1px 1px at 180px 20px, rgba(248, 248, 255, 0.7), transparent),
    radial-gradient(1px 1px at 10px 95px, rgba(255, 250, 250, 0.8), transparent),
    radial-gradient(2px 2px at 70px 15px, rgba(245, 245, 255, 0.9), transparent),
    radial-gradient(1px 1px at 190px 85px, rgba(255, 248, 248, 0.6), transparent);
  background-repeat: repeat;
  background-size: 200px 100px;
  animation: sparkle 3s linear infinite;
}

.stars-medium {
  background-image:
    radial-gradient(3px 3px at 60px 120px, #fff, transparent),
    radial-gradient(2px 2px at 100px 150px, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(3px 3px at 180px 50px, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(2px 2px at 220px 180px, #eee, transparent),
    radial-gradient(2px 2px at 250px 40px, rgba(250, 250, 255, 0.9), transparent),
    radial-gradient(1px 1px at 30px 190px, rgba(255, 252, 252, 0.7), transparent),
    radial-gradient(3px 3px at 120px 20px, rgba(248, 248, 255, 0.8), transparent),
    radial-gradient(2px 2px at 280px 140px, rgba(255, 255, 248, 0.6), transparent),
    radial-gradient(1px 1px at 10px 60px, rgba(252, 252, 255, 0.8), transparent);
  background-repeat: repeat;
  background-size: 300px 200px;
  animation: sparkle 4s linear infinite reverse;
}

.stars-large {
  background-image:
    radial-gradient(4px 4px at 80px 90px, rgba(255, 255, 255, 0.9), transparent),
    radial-gradient(3px 3px at 200px 160px, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(4px 4px at 120px 200px, #fff, transparent),
    radial-gradient(3px 3px at 350px 80px, rgba(248, 248, 255, 0.8), transparent),
    radial-gradient(4px 4px at 40px 250px, rgba(255, 250, 250, 0.9), transparent),
    radial-gradient(2px 2px at 300px 30px, rgba(250, 250, 255, 0.7), transparent),
    radial-gradient(3px 3px at 160px 40px, rgba(255, 248, 255, 0.8), transparent),
    radial-gradient(2px 2px at 20px 180px, rgba(245, 245, 255, 0.9), transparent),
    radial-gradient(4px 4px at 260px 220px, rgba(255, 255, 250, 0.6), transparent),
    radial-gradient(1px 1px at 380px 150px, rgba(252, 255, 252, 0.8), transparent);
  background-repeat: repeat;
  background-size: 400px 300px;
  animation: sparkle 5s linear infinite;
}

/* Falling stars / shooting stars */
.falling-star {
  position: absolute;
  width: 3px;
  height: 3px;
  background: radial-gradient(circle, #ffffff 0%, rgba(255, 255, 255, 0.8) 40%, transparent 100%);
  border-radius: 50%;
  opacity: 0;
  animation: shoot 8s linear infinite;
  box-shadow:
    0 0 6px rgba(255, 255, 255, 0.8),
    0 0 12px rgba(255, 255, 255, 0.4),
    0 0 18px rgba(255, 255, 255, 0.2);
}

.falling-star::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120px;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 10%,
    rgba(255, 255, 255, 0.3) 20%,
    rgba(255, 255, 255, 0.6) 40%,
    rgba(255, 255, 255, 0.9) 60%,
    rgba(255, 255, 255, 0.7) 80%,
    transparent 100%
  );
  transform: translate(-120px, -50%) rotate(45deg);
  transform-origin: right center;
  border-radius: 50px;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
}

.falling-star::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.2) 20%,
    rgba(255, 255, 255, 0.5) 50%,
    rgba(255, 255, 255, 0.3) 80%,
    transparent 100%
  );
  transform: translate(-60px, -50%) rotate(45deg);
  transform-origin: right center;
  border-radius: 50px;
}

/* Vertical shooting star trails */
.falling-star-vertical-1::before,
.falling-star-vertical-2::before {
  transform: translate(-50%, -120px) rotate(90deg);
  width: 100px;
}

.falling-star-vertical-1::after,
.falling-star-vertical-2::after {
  transform: translate(-50%, -60px) rotate(90deg);
  width: 50px;
}

/* Reverse diagonal shooting star trails */
.falling-star-reverse-1::before,
.falling-star-reverse-2::before {
  transform: translate(120px, -50%) rotate(-45deg);
  transform-origin: left center;
  width: 120px;
}

.falling-star-reverse-1::after,
.falling-star-reverse-2::after {
  transform: translate(60px, -50%) rotate(-45deg);
  transform-origin: left center;
  width: 60px;
}

/* Steep diagonal shooting star trails */
.falling-star-steep-1::before,
.falling-star-steep-2::before {
  transform: translate(-100px, -80px) rotate(75deg);
  width: 110px;
}

.falling-star-steep-1::after,
.falling-star-steep-2::after {
  transform: translate(-50px, -40px) rotate(75deg);
  width: 55px;
}

/* Horizontal shooting star trails */
.falling-star-horizontal-1::before,
.falling-star-horizontal-2::before {
  transform: translate(-140px, -50%) rotate(0deg);
  width: 140px;
}

.falling-star-horizontal-1::after,
.falling-star-horizontal-2::after {
  transform: translate(-70px, -50%) rotate(0deg);
  width: 70px;
}

.falling-star-1 {
  top: 10%;
  left: 20%;
  animation-delay: 0s;
  animation-duration: 6s;
}

.falling-star-2 {
  top: 20%;
  left: 10%;
  animation-delay: 2s;
  animation-duration: 8s;
  background: radial-gradient(circle, #fff5e6 0%, rgba(255, 245, 230, 0.8) 40%, transparent 100%);
  box-shadow:
    0 0 6px rgba(255, 245, 230, 0.8),
    0 0 12px rgba(255, 245, 230, 0.4),
    0 0 18px rgba(255, 245, 230, 0.2);
}

.falling-star-3 {
  top: 30%;
  left: 30%;
  animation-delay: 4s;
  animation-duration: 7s;
  background: radial-gradient(circle, #e6f3ff 0%, rgba(230, 243, 255, 0.8) 40%, transparent 100%);
  box-shadow:
    0 0 6px rgba(230, 243, 255, 0.8),
    0 0 12px rgba(230, 243, 255, 0.4),
    0 0 18px rgba(230, 243, 255, 0.2);
}

.falling-star-4 {
  top: 15%;
  left: 15%;
  animation-delay: 6s;
  animation-duration: 9s;
}

/* Vertical shooting stars (top to bottom) */
.falling-star-vertical-1 {
  top: 5%;
  left: 40%;
  animation: shootVertical 10s linear infinite;
  animation-delay: 3s;
  background: radial-gradient(circle, #fff0f5 0%, rgba(255, 240, 245, 0.8) 40%, transparent 100%);
  box-shadow:
    0 0 6px rgba(255, 240, 245, 0.8),
    0 0 12px rgba(255, 240, 245, 0.4),
    0 0 18px rgba(255, 240, 245, 0.2);
}

.falling-star-vertical-2 {
  top: 8%;
  left: 70%;
  animation: shootVertical 12s linear infinite;
  animation-delay: 8s;
}

/* Reverse diagonal shooting stars (right to left) */
.falling-star-reverse-1 {
  top: 25%;
  right: 10%;
  animation: shootReverse 9s linear infinite;
  animation-delay: 1s;
}

.falling-star-reverse-2 {
  top: 45%;
  right: 20%;
  animation: shootReverse 11s linear infinite;
  animation-delay: 7s;
  background: radial-gradient(circle, #f0fff0 0%, rgba(240, 255, 240, 0.8) 40%, transparent 100%);
  box-shadow:
    0 0 6px rgba(240, 255, 240, 0.8),
    0 0 12px rgba(240, 255, 240, 0.4),
    0 0 18px rgba(240, 255, 240, 0.2);
}

/* Steep diagonal shooting stars */
.falling-star-steep-1 {
  top: 12%;
  left: 55%;
  animation: shootSteep 8s linear infinite;
  animation-delay: 4s;
}

.falling-star-steep-2 {
  top: 35%;
  left: 80%;
  animation: shootSteep 13s linear infinite;
  animation-delay: 9s;
}

/* Horizontal shooting stars (left to right) */
.falling-star-horizontal-1 {
  top: 60%;
  left: 5%;
  animation: shootHorizontal 7s linear infinite;
  animation-delay: 2s;
}

.falling-star-horizontal-2 {
  top: 85%;
  left: 10%;
  animation: shootHorizontal 14s linear infinite;
  animation-delay: 11s;
}

/* Extra volume shooting stars - Layer 2 */
.falling-star-extra-1 {
  top: 35%;
  left: 45%;
  animation: shoot 5s linear infinite;
  animation-delay: 1.5s;
  background: radial-gradient(circle, #ffe6e6 0%, rgba(255, 230, 230, 0.8) 40%, transparent 100%);
  box-shadow:
    0 0 6px rgba(255, 230, 230, 0.8),
    0 0 12px rgba(255, 230, 230, 0.4),
    0 0 18px rgba(255, 230, 230, 0.2);
}

.falling-star-extra-2 {
  top: 50%;
  left: 90%;
  animation: shootReverse 7s linear infinite;
  animation-delay: 3.5s;
}

.falling-star-extra-3 {
  top: 75%;
  left: 30%;
  animation: shootVertical 9s linear infinite;
  animation-delay: 5.5s;
  background: radial-gradient(circle, #e6ffe6 0%, rgba(230, 255, 230, 0.8) 40%, transparent 100%);
  box-shadow:
    0 0 6px rgba(230, 255, 230, 0.8),
    0 0 12px rgba(230, 255, 230, 0.4),
    0 0 18px rgba(230, 255, 230, 0.2);
}

.falling-star-extra-4 {
  top: 18%;
  left: 85%;
  animation: shootSteep 6s linear infinite;
  animation-delay: 0.5s;
}

.falling-star-extra-5 {
  top: 65%;
  left: 75%;
  animation: shootHorizontal 8s linear infinite;
  animation-delay: 4.5s;
}

.falling-star-extra-6 {
  top: 42%;
  left: 8%;
  animation: shoot 11s linear infinite;
  animation-delay: 6.5s;
  background: radial-gradient(circle, #e6e6ff 0%, rgba(230, 230, 255, 0.8) 40%, transparent 100%);
  box-shadow:
    0 0 6px rgba(230, 230, 255, 0.8),
    0 0 12px rgba(230, 230, 255, 0.4),
    0 0 18px rgba(230, 230, 255, 0.2);
}

/* More volume shooting stars - Layer 3 */
.falling-star-volume-1 {
  top: 8%;
  left: 50%;
  animation: shootVertical 4s linear infinite;
  animation-delay: 0.8s;
}

.falling-star-volume-2 {
  top: 28%;
  left: 95%;
  animation: shootReverse 6s linear infinite;
  animation-delay: 2.8s;
}

.falling-star-volume-3 {
  top: 55%;
  left: 50%;
  animation: shoot 9s linear infinite;
  animation-delay: 4.8s;
}

.falling-star-volume-4 {
  top: 22%;
  left: 2%;
  animation: shootHorizontal 5s linear infinite;
  animation-delay: 1.2s;
}

.falling-star-volume-5 {
  top: 72%;
  left: 85%;
  animation: shootSteep 7s linear infinite;
  animation-delay: 3.2s;
}

.falling-star-volume-6 {
  top: 38%;
  left: 25%;
  animation: shootVertical 10s linear infinite;
  animation-delay: 5.2s;
}

.falling-star-volume-7 {
  top: 88%;
  left: 40%;
  animation: shootHorizontal 6s linear infinite;
  animation-delay: 2.2s;
}

.falling-star-volume-8 {
  top: 48%;
  left: 70%;
  animation: shoot 8s linear infinite;
  animation-delay: 7.2s;
}

/* Projects footer styling */
.projects-footer {
  position: relative;
  z-index: 50;
  background: rgba(18, 18, 18, 0.95);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-top: auto;
  padding: 0.125rem 0;
  min-height: auto;
}

.projects-footer :deep(.v-container) {
  padding-top: 0.0625rem !important;
  padding-bottom: 0.0625rem !important;
  max-width: 50% !important;
  margin: 0 auto !important;
}

.projects-footer :deep(.v-row) {
  margin: 0 !important;
}

.projects-footer :deep(.v-col) {
  padding: 0.0625rem !important;
}

.projects-footer :deep(*) {
  color: white !important;
}

/* Elegant typography for footer text */
.projects-footer :deep(.text-body-1),
.projects-footer :deep(.text-body-2),
.projects-footer :deep(p),
.projects-footer :deep(span),
.projects-footer :deep(a) {
  color: rgba(255, 255, 255, 0.9) !important;
  font-family:
    'Inter',
    'Segoe UI',
    -apple-system,
    BlinkMacSystemFont,
    sans-serif !important;
  font-weight: 300 !important;
  letter-spacing: 0.5px !important;
  font-size: 0.875rem !important;
  line-height: 1.4 !important;
}

.projects-footer :deep(b),
.projects-footer :deep(strong) {
  font-weight: 500 !important;
  letter-spacing: 0.8px !important;
}

.projects-footer :deep(a) {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
  text-decoration: none !important;
}

.projects-footer :deep(a:hover) {
  color: rgba(255, 255, 255, 1) !important;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.3) !important;
}

/* Smaller social icons (70% of original size) */
.projects-footer :deep(.v-btn) {
  color: rgba(255, 255, 255, 0.9) !important;
  transform: scale(0.7) !important;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
}

.projects-footer :deep(.v-btn:hover) {
  transform: scale(0.8) !important;
  color: rgba(255, 255, 255, 1) !important;
}

.projects-footer :deep(.fa-social) {
  width: 14px !important;
  height: 14px !important;
}

/* Projects footer layout - social icons to the far right */
.projects-footer :deep(.footer) {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  text-align: left !important;
  padding-left: 0.25rem !important;
  padding-right: 0.25rem !important;
}

.projects-footer :deep(.footer-social) {
  margin-left: auto !important;
  margin-top: 0 !important;
  justify-content: flex-end !important;
}

/* Mobile responsive adjustments for footer layout */
@media (max-width: 640px) {
  .projects-footer :deep(.footer) {
    flex-direction: column !important;
    gap: 0.125rem !important;
    text-align: center !important;
    padding-left: 0.125rem !important;
    padding-right: 0.125rem !important;
  }

  .projects-footer :deep(.footer-social) {
    margin-left: 0 !important;
    justify-content: center !important;
  }
}

/* Content wrapper with simple styling */
.projects-content {
  flex: 1;
  position: relative;
  z-index: 20;
  padding-top: 0; /* No navigation, so no top padding needed */
  padding-bottom: 0; /* No footer, so no bottom padding needed */
}

.content-wrapper {
  position: relative;
  min-height: 100vh;
  z-index: 10;
  padding: 1rem;
}

/* Ensure all content is above background */
.content-wrapper :deep(*) {
  position: relative;
  z-index: inherit;
}

.content-wrapper :deep(.v-container) {
  position: relative;
  z-index: 12;
}

/* Floating components container */
.floating-components {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1000;
}

.floating-components > * {
  pointer-events: auto;
}

/* Content cards enhancement for projects pages */
.content-wrapper :deep(.v-card) {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 2px 8px rgba(255, 255, 255, 0.1) inset;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  z-index: 15;
}

.content-wrapper :deep(.v-card:hover) {
  transform: translateY(-8px);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.4),
    0 4px 16px rgba(255, 255, 255, 0.15) inset;
  border-color: rgba(var(--v-theme-primary), 0.5);
}

/* Statistics cards special effects */
.content-wrapper :deep(.stats-card) {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.9) 0%,
    rgba(var(--v-theme-primary-darken-1), 0.95) 100%
  ) !important;
  box-shadow:
    0 8px 32px rgba(var(--v-theme-primary), 0.3),
    0 2px 8px rgba(255, 255, 255, 0.2) inset;
}

.content-wrapper :deep(.stats-card:hover) {
  box-shadow:
    0 16px 48px rgba(var(--v-theme-primary), 0.4),
    0 4px 16px rgba(255, 255, 255, 0.3) inset;
}

/* Enhanced button effects */
.content-wrapper :deep(.v-btn) {
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.content-wrapper :deep(.v-btn:hover) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

/* Star twinkling animation */
@keyframes sparkle {
  0% {
    opacity: 0.3;
  }
  25% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
  75% {
    opacity: 0.6;
  }
  100% {
    opacity: 0.3;
  }
}

/* Falling star animation */
@keyframes shoot {
  0% {
    opacity: 0;
    transform: translateX(0) translateY(0) scale(0.5);
  }
  5% {
    opacity: 0.3;
    transform: translateX(20px) translateY(20px) scale(0.8);
  }
  15% {
    opacity: 1;
    transform: translateX(80px) translateY(80px) scale(1);
  }
  85% {
    opacity: 0.9;
    transform: translateX(420px) translateY(420px) scale(1.1);
  }
  95% {
    opacity: 0.3;
    transform: translateX(480px) translateY(480px) scale(0.8);
  }
  100% {
    opacity: 0;
    transform: translateX(500px) translateY(500px) scale(0.3);
  }
}

/* Vertical shooting star animation */
@keyframes shootVertical {
  0% {
    opacity: 0;
    transform: translateY(0) scale(0.5);
  }
  5% {
    opacity: 0.3;
    transform: translateY(30px) scale(0.8);
  }
  15% {
    opacity: 1;
    transform: translateY(120px) scale(1);
  }
  85% {
    opacity: 0.9;
    transform: translateY(580px) scale(1.1);
  }
  95% {
    opacity: 0.3;
    transform: translateY(680px) scale(0.8);
  }
  100% {
    opacity: 0;
    transform: translateY(700px) scale(0.3);
  }
}

/* Reverse diagonal shooting star animation */
@keyframes shootReverse {
  0% {
    opacity: 0;
    transform: translateX(0) translateY(0) scale(0.5);
  }
  5% {
    opacity: 0.3;
    transform: translateX(-20px) translateY(20px) scale(0.8);
  }
  15% {
    opacity: 1;
    transform: translateX(-80px) translateY(80px) scale(1);
  }
  85% {
    opacity: 0.9;
    transform: translateX(-420px) translateY(420px) scale(1.1);
  }
  95% {
    opacity: 0.3;
    transform: translateX(-480px) translateY(480px) scale(0.8);
  }
  100% {
    opacity: 0;
    transform: translateX(-500px) translateY(500px) scale(0.3);
  }
}

/* Steep diagonal shooting star animation */
@keyframes shootSteep {
  0% {
    opacity: 0;
    transform: translateX(0) translateY(0) scale(0.5);
  }
  5% {
    opacity: 0.3;
    transform: translateX(10px) translateY(30px) scale(0.8);
  }
  15% {
    opacity: 1;
    transform: translateX(40px) translateY(120px) scale(1);
  }
  85% {
    opacity: 0.9;
    transform: translateX(180px) translateY(580px) scale(1.1);
  }
  95% {
    opacity: 0.3;
    transform: translateX(230px) translateY(680px) scale(0.8);
  }
  100% {
    opacity: 0;
    transform: translateX(250px) translateY(700px) scale(0.3);
  }
}

/* Horizontal shooting star animation */
@keyframes shootHorizontal {
  0% {
    opacity: 0;
    transform: translateX(0) scale(0.5);
  }
  5% {
    opacity: 0.3;
    transform: translateX(40px) scale(0.8);
  }
  15% {
    opacity: 1;
    transform: translateX(160px) scale(1);
  }
  85% {
    opacity: 0.9;
    transform: translateX(760px) scale(1.1);
  }
  95% {
    opacity: 0.3;
    transform: translateX(860px) scale(0.8);
  }
  100% {
    opacity: 0;
    transform: translateX(900px) scale(0.3);
  }
}

/* Dark mode adjustments for form elements */
.content-wrapper :deep(.v-field--variant-outlined) {
  background: rgba(255, 255, 255, 0.95);
  z-index: 16;
}

.content-wrapper :deep(.v-field--variant-filled) {
  background: rgba(255, 255, 255, 0.9);
  z-index: 16;
}

/* Ensure text elements are visible */
.content-wrapper :deep(.text-h1),
.content-wrapper :deep(.text-h2),
.content-wrapper :deep(.text-h3),
.content-wrapper :deep(.text-h4),
.content-wrapper :deep(.text-h5),
.content-wrapper :deep(.text-h6) {
  position: relative;
  z-index: 18;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.content-wrapper :deep(p),
.content-wrapper :deep(.text-body-1),
.content-wrapper :deep(.text-body-2) {
  position: relative;
  z-index: 17;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .content-wrapper :deep(.v-card:hover) {
    transform: none;
  }

  .projects-content {
    z-index: 20;
  }

  .content-wrapper {
    padding: 0.5rem;
    min-height: 100vh;
    z-index: 10;
  }
}
</style>
