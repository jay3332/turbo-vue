const defaultTheme = require('tailwindcss/defaultTheme')
const colors = require('tailwindcss/colors')
const plugin = require("tailwindcss/plugin")

const variable = (color) => `rgb(var(--c-${color}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          0: variable('bg-0'),
          1: variable('bg-1'),
          2: variable('bg-2'),
          3: variable('bg-3'),
        },
        fg: variable('fg'),
        accent: {
          DEFAULT: variable('accent'),
          light: variable('accent-light'),
        },
        primary: {
          DEFAULT: variable('primary'),
          hover: variable('primary-hover'),
          content: variable('primary-fg'),
        },
        secondary: variable('secondary'),
        success: {
          DEFAULT: variable('success'),
          hover: variable('success-hover'),
          content: variable('success-fg'),
        },
        danger: {
          DEFAULT: variable('danger'),
          hover: variable('danger-hover'),
          content: variable('danger-fg'),
        },
        neutral: {
          DEFAULT: variable('neutral'),
          hover: variable('neutral-hover'),
          content: variable('neutral-fg'),
        },
        link: {
          DEFAULT: variable('link'),
          hover: variable('link-hover'),
          visited: variable('link-visited'),
        },
        scale: {
          0: variable('scale-0'), // typically 0 or failing
          1: variable('scale-1'), // typically E
          2: variable('scale-2'), // typically D
          3: variable('scale-3'), // typically C
          4: variable('scale-4'), // typically B
          5: variable('scale-5'), // typically A
          6: variable('scale-6'), // typically A+ or 100%
        },
        highlight: {
          DEFAULT: colors.yellow[400],
          content: colors.black,
        },
      },
      screens: {
        'mobile-xs': { max: '369px' },
        'mobile': { max: '767px' },
      },
    },
    fontFamily: {
      title: ['"Plus Jakarta Sans"', "'Inter var'", ...defaultTheme.fontFamily.sans],
      sans: ["'Inter var'", ...defaultTheme.fontFamily.sans],
      mono: [
        '"Geist Mono"', 'Menlo', 'Monaco', 'Lucida Console', 'Liberation Mono',
        'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', 'monospace',
      ],
    },
  },
  plugins: [
    plugin(({ addComponents, addVariant }) => {
      addComponents({
        '.hide-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          }
        }
      })
      addVariant('all', '&, *')
      addVariant('all-children', '& *')
    })
  ],
}
