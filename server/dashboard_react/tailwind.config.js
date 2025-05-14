// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/react-tailwindcss-datepicker/dist/index.esm.{js,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"inter-variable"', 'sans-serif'],
      },
      animation: {
        'spin': 'spin 1s linear infinite',
        'glow-breathe': 'glow-breathe 2s ease-in-out infinite',
        'logo-float': 'logo-float 2s ease-in-out infinite', 
        'sparkle-rotate': 'sparkle-rotate 8s linear infinite',
        'blob': 'blob 7s infinite',
      },
      keyframes: {
        'glow-breathe': {
          '0%, 100%': { transform: 'scale(1.1)', opacity: '0.9' }, /* Max glow when logo is at bottom */
          '50%': { transform: 'scale(1)', opacity: '0.6' }, /* Min glow when logo is at top */
        },
        'logo-float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' }, /* Corrected bounce height */
        },
        'sparkle-rotate': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'blob': {
          '0%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
          '33%': {
            transform: 'translate(30px, -50px) scale(1.1)',
          },
          '66%': {
            transform: 'translate(-20px, 20px) scale(0.9)',
          },
          '100%': {
            transform: 'tranlate(0px, 0px) scale(1)',
          },
        }
      },
      animationDelay: {
        '2000': '2s',
        '4000': '4s',
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark"],
  },
}
