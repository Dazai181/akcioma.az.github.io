import type { Config } from 'tailwindcss';
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1a3a5c',
        accent: '#e8593c',
      },
    },
  },
  plugins: [],
};
export default config;
