/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Thème Star Trek / Space Opera LCARS — La Passerelle
      colors: {
        space: {
          // Fonds
          bg:       '#050810',   // Noir spatial profond
          panel:    '#0a0f1e',   // Panneaux principaux
          card:     '#0d1428',   // Fond des cartes (legacy compat)
          border:   '#1a2744',   // Bordures bleu nuit
          // Texte
          text:     '#c8d8f0',   // Texte principal (bleu pâle)
          muted:    '#4a6080',   // Texte secondaire
          dim:      '#2a3a50',   // Texte très discret
          // Accents LCARS
          blue:     '#3b82f6',   // Bleu primaire
          cyan:     '#06b6d4',   // Cyan — éléments actifs
          amber:    '#f59e0b',   // Ambre — alertes, highlights
          orange:   '#ea580c',   // Orange — intervention, danger
          // États
          success:  '#10b981',   // Vert émeraude
          warning:  '#f59e0b',   // Ambre (alias pour compat)
          danger:   '#ef4444',   // Rouge
          info:     '#6366f1',   // Violet
        }
      },
      fontFamily: {
        'display': ['Orbitron', 'monospace'],          // Titres, headers
        'body':    ['"Exo 2"', 'sans-serif'],          // Corps de texte
        'mono':    ['"Share Tech Mono"', '"JetBrains Mono"', 'monospace'], // Code, données
        'sans':    ['"Exo 2"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        scan: 'scan 3s linear infinite',
        'border-pulse': 'border-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'border-pulse': {
          '0%, 100%': { borderColor: 'rgba(234, 88, 12, 0.4)' },
          '50%':      { borderColor: 'rgba(234, 88, 12, 0.9)' },
        }
      }
    },
  },
  plugins: [],
}
