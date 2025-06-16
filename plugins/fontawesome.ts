import { defineNuxtPlugin } from '#app'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faTwitter, faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons'

// Add icons to the library
library.add(faTwitter, faGithub, faLinkedin)

export default defineNuxtPlugin((nuxtApp) => {
    nuxtApp.vueApp.component('FontAwesomeIcon', FontAwesomeIcon)
})
