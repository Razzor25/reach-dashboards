/** @type {import('tailwindcss').Config} */
const baseConfig = require('@uhg-netra-ai/core-react-components/tailwind.config');

module.exports = {
  presets: [baseConfig],
  content: [
    ...baseConfig.content,
    /* add additional paths as needed */
  ],
};
