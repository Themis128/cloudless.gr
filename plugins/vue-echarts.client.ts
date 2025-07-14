import { defineNuxtPlugin } from 'nuxt/app'
import VueECharts from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, TitleComponent } from 'echarts/components'

use([CanvasRenderer, BarChart, LineChart, GridComponent, TooltipComponent, TitleComponent])

import type { NuxtApp } from 'nuxt/app'

export default defineNuxtPlugin((nuxtApp: NuxtApp) => {
  nuxtApp.vueApp.component('VChart', VueECharts)
})
