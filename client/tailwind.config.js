/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Thème dark space — La Passerelle
      colors: {
        space: {
          // Fonds
          bg:       '#0a0e1a',   // fond principal (bleu nuit très sombre)
          panel:    '#111827',   // fond des panels
          card:     '#1a2235',   // fond des cartes
          border:   '#1e293b',   // bordures subtiles
          // Accents
          blue:     '#3b82f6',   // bleu électrique
          cyan:     '#22d3ee',   // cyan pour les highlights
          // États
          success:  '#10b981',   // vert émeraude (mission terminée)
          warning:  '#f59e0b',   // ambre (attention)
          danger:   '#ef4444',   // rouge (intervention requise)
          info:     '#6366f1',   // violet (info)
          // Texte
          text:     '#e2e8f0',   // texte principal
          muted:    '#64748b',   // texte secondaire
          dim:      '#334155',   // texte très secondaire
        }
      },
      fontFamily: {
        // Monospace ambiance terminal
        mono: ['"JetBrains Mono"', '"Space Mono"', '"Fira Code"', 'monospace'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        // Point clignotant pour les agents actifs
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        // Scan ligne façon terminal
        scan: 'scan 3s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}
