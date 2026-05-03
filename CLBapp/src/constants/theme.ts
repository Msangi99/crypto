export const Colors = {
  // Primary palette — Gold + Black (CLB / Binance-inspired brand)
  // Must match admin dashboard: globals.css (:root variables)
  primary: '#F0B90B',        // Binance gold — accent & primary
  primaryDark: '#C99A00',
  primaryLight: '#FCD535',

  gold: '#F0B90B',           // same as primary
  goldLight: '#FCD535',
  goldDark: '#C99A00',

  blue: '#3B82F6',           // chart / info accent
  purple: '#A855F7',

  // Background hierarchy (pure blacks, NOT navy)
  bg: '#0D0D0D',             // deepest dark
  bgCard: '#1A1A1A',         // card surface
  bgElevated: '#222222',     // elevated surfaces
  bgInput: '#2A2A2A',        // input fields

  // Borders / dividers
  border: '#2A2A2A',
  borderLight: '#3A3A3A',

  // Text
  textPrimary: '#F5F5F5',
  textSecondary: '#999999',
  textMuted: '#666666',
  textGold: '#F0B90B',

  // Status
  success: '#00C853',
  successBg: 'rgba(0, 200, 83, 0.10)',
  error: '#FF3D57',
  errorBg: 'rgba(255, 61, 87, 0.10)',
  warning: '#FCD535',
  warningBg: 'rgba(252, 213, 53, 0.10)',

  // Gradients (stop arrays for expo-linear-gradient)
  gradientPrimary: ['#F0B90B', '#C99A00'] as const,
  gradientGold: ['#F0B90B', '#C99A00'] as const,
  gradientCard: ['#1A1A1A', '#222222'] as const,
  gradientDark: ['#0D0D0D', '#1A1A1A'] as const,
  gradientSuccess: ['#00C853', '#00A040'] as const,
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
    shadowColor: '#F0B90B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#F0B90B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
};
