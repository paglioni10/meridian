const plugin = require("tailwindcss/plugin");

module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    screens: {
      xs: "360px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
      "3xl": "1920px",
      "4xl": "2560px",
    },
    extend: {
      colors: {
        background: "var(--paper)",
        surface: "var(--surface)",
        foreground: "var(--ink)",
        muted: "var(--ink-muted)",
        border: {
          DEFAULT: "var(--ink)",
          soft: "var(--rule)",
        },
        primary: {
          DEFAULT: "var(--ink)",
          foreground: "var(--paper)",
        },
        secondary: {
          DEFAULT: "var(--blue)",
          foreground: "var(--on-accent)",
        },
        status: {
          online: "var(--ink)",
          offline: "var(--red)",
          warning: "var(--red)",
          active: "var(--blue)",
        },
        danger: "var(--red)",
        accent: "var(--on-accent)",
      },
      fontFamily: {
        display: ["var(--font-archivo)", "sans-serif"],
        sans: ["var(--font-public-sans)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      fontSize: {
        label: ["11px", { lineHeight: "1.4", letterSpacing: "0.04em" }],
        data: ["13px", { lineHeight: "1.5" }],
        body: ["14px", { lineHeight: "1.5" }],
        h2: ["20px", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        figure: ["32px", { lineHeight: "1.2", letterSpacing: "-0.03em" }],
        h1: ["44px", { lineHeight: "1", letterSpacing: "-0.03em" }],
        display: ["56px", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      },
      spacing: {
        sidebar: "200px",
        tap: "44px",
        nav: "64px",
      },
      borderRadius: {
        none: "0",
        DEFAULT: "0",
        sm: "0",
        md: "0",
        lg: "0",
        full: "9999px",
      },
      borderWidth: {
        DEFAULT: "1px",
        3: "3px",
      },
      boxShadow: {
        none: "none",
        modal: "8px 8px 0 0 var(--ink)",
        sheet: "0 -3px 0 0 var(--ink)",
      },
      backdropBlur: {
        overlay: "6px",
      },
      maxWidth: {
        content: "1760px",
      },
      gridTemplateColumns: {
        app: "var(--sidebar-w) minmax(0,1fr)",
        kanban: "repeat(3,minmax(0,1fr))",
      },
      keyframes: {
        rise: {
          from: { transform: "translateY(12px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        pulse: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        rise: "rise 160ms ease-out",
        pulse: "pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant("pwa", "@media (display-mode: standalone)");
      addVariant("touch", "@media (hover: none) and (pointer: coarse)");
    }),
  ],
};
