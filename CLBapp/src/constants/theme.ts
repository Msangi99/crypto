export const Colors = {
  // Primary palette — deep navy + gold (CLB brand)
  primary: '#1A56FF',       // vibrant blue (accent)
  primaryDark: '#0F3ACC',
  primaryLight: '#4D7FFF',

  gold: '#F5A623',          // gold accent
  goldLight: '#FFD166',

  // Background hierarchy
  bg: '#0B0E1A',            // deepest dark
  bgCard: '#131829',        // card surface
  bgElevated: '#1A2035',    // elevated surfaces
  bgInput: '#1E2540',       // input fields

  // Borders / dividers
  border: '#252D45',
  borderLight: '#2E3855',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8E9CC4',
  textMuted: '#4E5A7A',
  textGold: '#F5A623',

  // Status
  success: '#00D68F',
  successBg: 'rgba(0, 214, 143, 0.12)',
  error: '#FF4D6A',
  errorBg: 'rgba(255, 77, 106, 0.12)',
  warning: '#FFB020',
  warningBg: 'rgba(255, 176, 32, 0.12)',

  // Gradients (stop arrays for expo-linear-gradient)
  gradientPrimary: ['#1A56FF', '#0F3ACC'] as const,
  gradientGold: ['#F5A623', '#E08A00'] as const,
  gradientCard: ['#131829', '#1A2035'] as const,
  gradientDark: ['#0B0E1A', '#131829'] as const,
  gradientSuccess: ['#00D68F', '#00A86B'] as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  display: 32,
};

export const Shadow = {
  card: {
    shadowColor: '#1A56FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#F5A623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
};
