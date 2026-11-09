import { createTheme, type MantineColorsTuple } from "@mantine/core";

// "Saffron & Neel": the lab's brand. Saffron (shade 6 = #C2410C, white text 5.2:1) is the one accent,
// used for the primary action, the selection and the figure that matters. Surfaces stay neutral.
const saffron: MantineColorsTuple = ["#fff3ec", "#ffe4d3", "#fcc6a6", "#f7a575", "#f2874b", "#e5622a", "#c2410c", "#a3360a", "#862c08", "#6b2306"];
const navy: MantineColorsTuple = ["#eceff6", "#d3d9e8", "#a7b3d0", "#7a8cb8", "#5569a3", "#3d5394", "#22396b", "#14264a", "#0e1b36", "#091224"];
const tulsi: MantineColorsTuple = ["#e8f4ec", "#cfe8d9", "#a2d3b6", "#72bd91", "#4aa972", "#2f965d", "#1e7a4f", "#186541", "#125033", "#0c3b25"];
// Graphite neutrals (unslop tokens): people look at these for hours, so they carry no hue.
const gray: MantineColorsTuple = ["#fafafa", "#f4f4f5", "#e7e7e9", "#d4d4d8", "#a1a1a6", "#85858b", "#525252", "#3a3a3d", "#232325", "#171717"];
const dark: MantineColorsTuple = ["#ededed", "#c9c9cc", "#a1a1a6", "#85858b", "#3a3a3d", "#2a2a2c", "#19191b", "#141415", "#0f0f10", "#0a0a0b"];

export const theme = createTheme({
  primaryColor: "saffron",
  primaryShade: { light: 6, dark: 5 },
  colors: { saffron, navy, tulsi, gray, dark },
  fontFamily: "var(--font-geist), system-ui, sans-serif",
  fontFamilyMonospace: "var(--font-geist-mono), ui-monospace, monospace",
  headings: {
    fontFamily: "var(--font-outfit), system-ui, sans-serif",
    fontWeight: "500",
    sizes: {
      h1: { fontSize: "1.875rem", lineHeight: "1.15" },
      h2: { fontSize: "1.375rem", lineHeight: "1.2" },
      h3: { fontSize: "1.0625rem", lineHeight: "1.3" },
    },
  },
  defaultRadius: "md",
  radius: { xs: "4px", sm: "6px", md: "8px", lg: "12px", xl: "16px" },
  spacing: { xs: "8px", sm: "12px", md: "16px", lg: "24px", xl: "32px" },
  cursorType: "pointer",
  focusRing: "auto",
  respectReducedMotion: true,
  shadows: { xs: "0 1px 2px rgba(0,0,0,0.05)", sm: "0 1px 2px rgba(0,0,0,0.05)", md: "0 8px 24px rgba(0,0,0,0.06)" },
  components: {
    Button: { defaultProps: { radius: "md" } },
    Card: { defaultProps: { withBorder: true, radius: "lg", padding: "lg", shadow: undefined } },
    Paper: { defaultProps: { radius: "lg" } },
    Badge: { defaultProps: { variant: "light", radius: "sm", tt: "none", fw: 500 } },
    Modal: { defaultProps: { radius: "lg", centered: true, overlayProps: { backgroundOpacity: 0.4, blur: 2 } } },
    Drawer: { defaultProps: { position: "right", size: "xl", overlayProps: { backgroundOpacity: 0.3 } } },
    TextInput: { defaultProps: { radius: "md" } },
    Select: { defaultProps: { radius: "md", allowDeselect: false } },
    Tooltip: { defaultProps: { withArrow: true, openDelay: 300 } },
  },
});
