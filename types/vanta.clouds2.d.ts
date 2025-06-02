declare module 'vanta/dist/vanta.clouds2.min.js' {
  const VANTA: any;
  export default VANTA;
}

declare global {
  interface Window {
    VANTA: {
      CLOUDS2: (options: any) => any;
      [key: string]: any;
    };
  }
}
