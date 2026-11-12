import { defineConfig } from 'vite';
export default defineConfig({server:{port:1420,strictPort:true},clearScreen:false,envPrefix:['VITE_','TAURI_ENV_*'],build:{target:'chrome105',minify:process.env.TAURI_ENV_DEBUG?false:'esbuild'}});
