<template>
  <v-container class="legal-page" fluid>
    <div class="page-header mb-8">
      <v-row justify="center">
        <v-col cols="12" md="8">
          <h1 class="text-h2 font-weight-bold primary--text text-center mb-4">
            Cookie Policy
          </h1>
          <p class="text-subtitle-1 text-center text-grey-darken-1 mb-4">
            Last updated: {{ lastUpdated }}
          </p>
          <v-divider />
        </v-col>
      </v-row>
    </div>

    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="pa-6">
          <div class="legal-content">
            <section class="mb-8">
              <h2 class="text-h4 mb-4">What Are Cookies</h2>
              <p class="text-body-1 mb-4">
                Cookies are small text files that are stored on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our Service.
              </p>
              <p class="text-body-1">
                This Cookie Policy explains what cookies are, how we use them, the types of cookies we use, and how you can control your cookie preferences.
              </p>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">How We Use Cookies</h2>
              <p class="text-body-1 mb-4">
                We use cookies for several purposes:
              </p>
              <ul class="text-body-1 mb-4">
                <li><strong>Essential cookies:</strong> These are necessary for the website to function properly</li>
                <li><strong>Performance cookies:</strong> These help us understand how visitors interact with our website</li>
                <li><strong>Functionality cookies:</strong> These enable enhanced functionality and personalization</li>
                <li><strong>Targeting cookies:</strong> These may be set through our site by advertising partners</li>
              </ul>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Types of Cookies We Use</h2>
              
              <div class="mb-6">
                <h3 class="text-h5 mb-3">Strictly Necessary Cookies</h3>
                <p class="text-body-1 mb-4">
                  These cookies are essential for you to browse the website and use its features, such as accessing secure areas of the site.
                </p>
                <v-table class="mb-4">
                  <thead>
                    <tr>
                      <th>Cookie Name</th>
                      <th>Purpose</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>session_id</td>
                      <td>Maintains user session</td>
                      <td>Session</td>
                    </tr>
                    <tr>
                      <td>csrf_token</td>
                      <td>Security protection</td>
                      <td>Session</td>
                    </tr>
                    <tr>
                      <td>auth_token</td>
                      <td>User authentication</td>
                      <td>30 days</td>
                    </tr>
                  </tbody>
                </v-table>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Performance Cookies</h3>
                <p class="text-body-1 mb-4">
                  These cookies collect information about how visitors use our website, such as which pages are most popular and if visitors get error messages.
                </p>
                <v-table class="mb-4">
                  <thead>
                    <tr>
                      <th>Cookie Name</th>
                      <th>Purpose</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>_ga</td>
                      <td>Google Analytics tracking</td>
                      <td>2 years</td>
                    </tr>
                    <tr>
                      <td>_gid</td>
                      <td>Google Analytics tracking</td>
                      <td>24 hours</td>
                    </tr>
                    <tr>
                      <td>cloudless_analytics</td>
                      <td>Internal analytics</td>
                      <td>1 year</td>
                    </tr>
                  </tbody>
                </v-table>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Functionality Cookies</h3>
                <p class="text-body-1 mb-4">
                  These cookies allow the website to remember choices you make and provide enhanced, more personal features.
                </p>
                <v-table class="mb-4">
                  <thead>
                    <tr>
                      <th>Cookie Name</th>
                      <th>Purpose</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>user_preferences</td>
                      <td>Store user settings</td>
                      <td>1 year</td>
                    </tr>
                    <tr>
                      <td>theme_mode</td>
                      <td>Remember dark/light mode</td>
                      <td>1 year</td>
                    </tr>
                    <tr>
                      <td>language_pref</td>
                      <td>Language preference</td>
                      <td>1 year</td>
                    </tr>
                  </tbody>
                </v-table>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Targeting Cookies</h3>
                <p class="text-body-1 mb-4">
                  These cookies are used to deliver advertisements more relevant to you and your interests.
                </p>
                <v-table class="mb-4">
                  <thead>
                    <tr>
                      <th>Cookie Name</th>
                      <th>Purpose</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>ads_preferences</td>
                      <td>Personalized advertising</td>
                      <td>30 days</td>
                    </tr>
                    <tr>
                      <td>marketing_id</td>
                      <td>Marketing tracking</td>
                      <td>90 days</td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Third-Party Cookies</h2>
              <p class="text-body-1 mb-4">
                In addition to our own cookies, we may also use various third-party cookies to report usage statistics of the Service and deliver advertisements.
              </p>
              
              <div class="mb-4">
                <h3 class="text-h5 mb-3">Google Analytics</h3>
                <p class="text-body-1 mb-4">
                  We use Google Analytics to help analyze how users use the site. Learn more about Google Analytics cookies at: 
                  <a href="https://developers.google.com/analytics/devguides/collection/analyticsjs/cookie-usage" target="_blank" class="text-primary">
                    Google Analytics Cookie Usage
                  </a>
                </p>
              </div>

              <div class="mb-4">
                <h3 class="text-h5 mb-3">Supabase</h3>
                <p class="text-body-1 mb-4">
                  Our authentication system uses Supabase, which may set cookies for authentication and session management.
                </p>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Managing Your Cookie Preferences</h2>
              
              <div class="mb-6">
                <h3 class="text-h5 mb-3">Browser Settings</h3>
                <p class="text-body-1 mb-4">
                  Most web browsers allow you to control cookies through their settings preferences. You can set your browser to:
                </p>
                <ul class="text-body-1 mb-4">
                  <li>Refuse all cookies</li>
                  <li>Allow only first-party cookies</li>
                  <li>Delete cookies when you close your browser</li>
                  <li>Have the browser notify you each time a cookie is sent</li>
                </ul>
                <p class="text-body-1 mb-4">
                  Please note that disabling cookies may affect the functionality of our website.
                </p>
              </div>

              <div class="mb-6">
                <h3 class="text-h5 mb-3">Cookie Management Tool</h3>
                <p class="text-body-1 mb-4">
                  You can manage your cookie preferences for our website using the tool below:
                </p>
                <v-card variant="outlined" class="pa-4 mb-4">
                  <div class="d-flex flex-column gap-3">
                    <div>
                      <v-switch
                        v-model="cookiePrefs.essential"
                        :disabled="true"
                        label="Essential Cookies (Required)"
                        color="primary"
                        hide-details
                      />
                      <p class="text-caption text-grey-darken-1 ml-12">
                        These cookies are necessary for the website to function and cannot be disabled.
                      </p>
                    </div>
                    
                    <div>
                      <v-switch
                        v-model="cookiePrefs.performance"
                        label="Performance Cookies"
                        color="primary"
                        hide-details
                      />
                      <p class="text-caption text-grey-darken-1 ml-12">
                        Help us understand how visitors interact with our website.
                      </p>
                    </div>
                    
                    <div>
                      <v-switch
                        v-model="cookiePrefs.functionality"
                        label="Functionality Cookies"
                        color="primary"
                        hide-details
                      />
                      <p class="text-caption text-grey-darken-1 ml-12">
                        Enable enhanced functionality and personalization.
                      </p>
                    </div>
                    
                    <div>
                      <v-switch
                        v-model="cookiePrefs.targeting"
                        label="Targeting Cookies"
                        color="primary"
                        hide-details
                      />
                      <p class="text-caption text-grey-darken-1 ml-12">
                        Used to deliver more relevant advertisements.
                      </p>
                    </div>
                    
                    <v-btn
                      color="primary"
                      variant="flat"
                      class="mt-3"
                      @click="saveCookiePreferences"
                    >
                      Save Preferences
                    </v-btn>
                  </div>
                </v-card>
              </div>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Browser-Specific Instructions</h2>
              <p class="text-body-1 mb-4">
                For specific instructions on how to manage cookies in your browser, please visit:
              </p>
              <ul class="text-body-1 mb-4">
                <li>
                  <strong>Chrome:</strong> 
                  <a href="https://support.google.com/chrome/answer/95647" target="_blank" class="text-primary">
                    Chrome Cookie Settings
                  </a>
                </li>
                <li>
                  <strong>Firefox:</strong> 
                  <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" class="text-primary">
                    Firefox Cookie Settings
                  </a>
                </li>
                <li>
                  <strong>Safari:</strong> 
                  <a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" class="text-primary">
                    Safari Cookie Settings
                  </a>
                </li>
                <li>
                  <strong>Edge:</strong> 
                  <a href="https://support.microsoft.com/en-us/help/4027947/microsoft-edge-delete-cookies" target="_blank" class="text-primary">
                    Edge Cookie Settings
                  </a>
                </li>
              </ul>
            </section>

            <section class="mb-8">
              <h2 class="text-h4 mb-4">Changes to This Cookie Policy</h2>
              <p class="text-body-1 mb-4">
                We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. When we make changes, we will update the "Last updated" date at the top of this policy.
              </p>
              <p class="text-body-1">
                We encourage you to review this Cookie Policy periodically to stay informed about our use of cookies.
              </p>
            </section>

            <section>
              <h2 class="text-h4 mb-4">Contact Us</h2>
              <p class="text-body-1 mb-4">
                If you have any questions about this Cookie Policy or our use of cookies, please contact us:
              </p>
              <v-card variant="outlined" class="pa-4">
                <ul class="text-body-1 list-style-none">
                  <li class="mb-2">
                    <v-icon class="mr-2">mdi-email</v-icon>
                    Email: <a href="mailto:privacy@cloudless.dev" class="text-primary">privacy@cloudless.dev</a>
                  </li>
                  <li class="mb-2">
                    <v-icon class="mr-2">mdi-web</v-icon>
                    Website: <a href="https://cloudless.dev" class="text-primary" target="_blank">cloudless.dev</a>
                  </li>
                  <li>
                    <v-icon class="mr-2">mdi-map-marker</v-icon>
                    Address: 123 Tech Street, San Francisco, CA 94102, USA
                  </li>
                </ul>
              </v-card>
            </section>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

definePageMeta({
  layout: 'default',
})

const lastUpdated = 'January 20, 2024'

const cookiePrefs = ref({
  essential: true,
  performance: true,
  functionality: true,
  targeting: false
})

const saveCookiePreferences = () => {
  // Save preferences to localStorage or send to backend
  localStorage.setItem('cookiePreferences', JSON.stringify(cookiePrefs.value))
  
  // Show success message
  alert('Cookie preferences saved successfully!')
  
  // You could also emit an event or call a composable to update global state
}

// Load existing preferences on mount
onMounted(() => {
  const saved = localStorage.getItem('cookiePreferences')
  if (saved) {
    cookiePrefs.value = { ...cookiePrefs.value, ...JSON.parse(saved) }
  }
})
</script>

<style scoped>
.legal-page {
  max-width: 1200px;
  margin: 0 auto;
}

.legal-content {
  line-height: 1.7;
}

.legal-content h2 {
  color: rgb(var(--v-theme-primary));
  border-bottom: 2px solid rgba(var(--v-theme-primary), 0.2);
  padding-bottom: 8px;
}

.legal-content h3 {
  color: rgb(var(--v-theme-secondary));
}

.legal-content ul {
  padding-left: 1.5rem;
}

.legal-content li {
  margin-bottom: 0.5rem;
}

.list-style-none {
  list-style: none;
  padding-left: 0;
}

.gap-3 > * + * {
  margin-top: 1rem;
}
</style>
