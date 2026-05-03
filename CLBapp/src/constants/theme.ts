export const Colors = {
  // Primary palette — Gold + Black (CLB / Binance-inspired brand)
  // Trust Wallet/MetaMask inspired modern dark theme
  primary: '#F0B90B',        // Binance gold — accent & primary
  primaryDark: '#C99A00',
  primaryLight: '#FCD535',

  gold: '#F0B90B',           // same as primary
  goldLight: '#FCD535',
  goldDark: '#C99A00',

  blue: '#3B82F6',           // chart / info accent
  purple: '#A855F7',
  cyan: '#06B6D4',

  // Background hierarchy (modern dark theme)
  bg: '#000000',             // pure black background
  bgCard: '#141414',         // card surface
  bgElevated: '#1F1F1F',     // elevated surfaces
  bgInput: '#2A2A2A',        // input fields

  // Borders / dividers
  border: '#2A2A2A',
  borderLight: '#3A3A3A',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#6B6B6B',
  textGold: '#F0B90B',

  // Status
  success: '#00D26A',
  successBg: 'rgba(0, 210, 106, 0.15)',
  error: '#FF4757',
  errorBg: 'rgba(255, 71, 87, 0.15)',
  warning: '#F0B90B',
  warningBg: 'rgba(240, 185, 11, 0.15)',

  // Gradients (stop arrays for expo-linear-gradient) - more vibrant
  gradientPrimary: ['#F0B90B', '#C99A00'] as const,
  gradientGold: ['#C99A00', '#A67C00'] as const,  // Darker gold, less eye-straining
  gradientCard: ['#1F1F1F', '#141414'] as const,
  gradientDark: ['#000000', '#141414'] as const,
  gradientSuccess: ['#00D26A', '#00A852'] as const,
  gradientBlue: ['#3B82F6', '#2563EB'] as const,
  gradientPurple: ['#A855F7', '#7C3AED'] as const,
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
