export interface BrandTheme {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  cardBg: string;
  headerBg: string;
  headerText: string;
  sectionHeaderBg: string;
  sectionHeaderText: string;
  chartColor: string;
  chartColor2: string;
  style: 'light' | 'dark';
  activeBtn: string;
}

export const BRAND_THEMES: Record<string, BrandTheme> = {
  gnc: {
    primary: '#CE112D',
    secondary: '#1A1A1A',
    accent: '#CE112D',
    bg: '#F8F9FA',
    cardBg: '#FFFFFF',
    headerBg: 'linear-gradient(135deg, #CE112D 0%, #8B0000 100%)',
    headerText: '#FFFFFF',
    sectionHeaderBg: '#CE112D',
    sectionHeaderText: '#FFFFFF',
    chartColor: '#CE112D',
    chartColor2: '#4A4A4A',
    style: 'light',
    activeBtn: '#CE112D',
  },
  bellavita: {
    primary: '#D4AF37',
    secondary: '#1A1A1A',
    accent: '#D4AF37',
    bg: '#FAFAF8',
    cardBg: '#FFFFFF',
    headerBg: 'linear-gradient(135deg, #1A1A1A 0%, #333333 100%)',
    headerText: '#FFFFFF',
    sectionHeaderBg: '#1A1A1A',
    sectionHeaderText: '#D4AF37',
    chartColor: '#D4AF37',
    chartColor2: '#475D4B',
    style: 'dark',
    activeBtn: '#1A1A1A',
  },
  clovia: {
    primary: '#E40B92',
    secondary: '#1A1A1A',
    accent: '#E40B92',
    bg: '#FFF5F9',
    cardBg: '#FFFFFF',
    headerBg: 'linear-gradient(135deg, #E40B92 0%, #A00866 100%)',
    headerText: '#FFFFFF',
    sectionHeaderBg: '#E40B92',
    sectionHeaderText: '#FFFFFF',
    chartColor: '#E40B92',
    chartColor2: '#1A1A1A',
    style: 'light',
    activeBtn: '#E40B92',
  },
  neemans: {
    primary: '#6B8E4E',
    secondary: '#8B7355',
    accent: '#6B8E4E',
    bg: '#F8F6F0',
    cardBg: '#FFFFFF',
    headerBg: 'linear-gradient(135deg, #6B8E4E 0%, #4A6B2E 100%)',
    headerText: '#FFFFFF',
    sectionHeaderBg: '#6B8E4E',
    sectionHeaderText: '#FFFFFF',
    chartColor: '#6B8E4E',
    chartColor2: '#8B7355',
    style: 'light',
    activeBtn: '#6B8E4E',
  },
  viega: {
    primary: '#FFD100',
    secondary: '#1A1A1A',
    accent: '#FFD100',
    bg: '#F5F5F0',
    cardBg: '#FFFFFF',
    headerBg: 'linear-gradient(135deg, #1A1A1A 0%, #000000 100%)',
    headerText: '#FFD100',
    sectionHeaderBg: '#1A1A1A',
    sectionHeaderText: '#FFD100',
    chartColor: '#FFD100',
    chartColor2: '#1A1A1A',
    style: 'dark',
    activeBtn: '#1A1A1A',
  },
  exicom: {
    primary: '#003366',
    secondary: '#00B140',
    accent: '#003366',
    bg: '#F0F4F8',
    cardBg: '#FFFFFF',
    headerBg: 'linear-gradient(135deg, #003366 0%, #001B33 100%)',
    headerText: '#FFFFFF',
    sectionHeaderBg: '#003366',
    sectionHeaderText: '#FFFFFF',
    chartColor: '#003366',
    chartColor2: '#00B140',
    style: 'dark',
    activeBtn: '#003366',
  },
  dubangladesh: {
    primary: '#003D6B',
    secondary: '#E8A838',
    accent: '#003D6B',
    bg: '#F0F4FA',
    cardBg: '#FFFFFF',
    headerBg: 'linear-gradient(135deg, #003D6B 0%, #002244 100%)',
    headerText: '#FFFFFF',
    sectionHeaderBg: '#003D6B',
    sectionHeaderText: '#FFFFFF',
    chartColor: '#003D6B',
    chartColor2: '#E8A838',
    style: 'dark',
    activeBtn: '#003D6B',
  },
};
