declare module 'vanta/dist/vanta.clouds.min.js' {
  const VANTA: any;
  export default VANTA;
}

declare module 'vanta/dist/vanta.clouds2.min.js' {
  const VANTA: any;
  export default VANTA;
}

declare global {
  interface Window {
    VANTA: {
      CLOUDS: (options: any) => any;
      CLOUDS2: (options: any) => any;
      [key: string]: any;
    };
  }
}
