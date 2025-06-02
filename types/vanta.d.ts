declare module 'vanta/dist/vanta.clouds2.min'
declare module 'three'

export interface VantaClouds2Effect {
  destroy: () => void
}

export interface VantaClouds2Options {
  el: HTMLElement
  THREE: any
  mouseControls: boolean
  touchControls: boolean
  gyroControls: boolean
  minHeight: number
  minWidth: number
  scale: number
  backgroundColor: number
  skyColor: number
  cloudColor: number
  lightColor: number
  speed: number
  texturePath: string
  cloudShadowColor: number
  sunGlareColor: number
  sunlightColor: number
}

declare global {
  interface Window {
    VANTA?: {
      CLOUDS2: (options: VantaClouds2Options) => VantaClouds2Effect
    }
  }
}
