import { defineNuxtPlugin } from '#app'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { library, config } from '@fortawesome/fontawesome-svg-core'

// Prevent FontAwesome from adding its CSS since we did it manually
config.autoAddCss = false

// Brand icons
import { 
  faTwitter, 
  faGithub, 
  faLinkedin,
  faDocker,
  faReact,
  faVuejs,
  faAngular,
  faNodeJs,
  faPython,
  faAws
} from '@fortawesome/free-brands-svg-icons'

// Add commonly used brand icons for project management
library.add(
  faTwitter, 
  faGithub, 
  faLinkedin,
  faDocker,
  faReact,
  faVuejs,
  faAngular,
  faNodeJs,
  faPython,
  faAws
)

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.component('FontAwesomeIcon', FontAwesomeIcon)
})
