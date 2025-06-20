// TypeScript declaration for the VANTA global object
interface VantaEffect {
  destroy: () => void;
  resize: () => void;
  options: Record<string, any>;
}

interface VantaClouds2 {
  (options: Record<string, any>): VantaEffect;
}

interface VANTA {
  CLOUDS2?: VantaClouds2;
  [key: string]: any;
}

interface Window {
  VANTA?: VANTA;
}
