export type CvExperienceItem = {
  role: string;
  company: string;
  period: string;
  highlights: string[];
};

export type CvEducationItem = {
  title: string;
  institution: string;
  period: string;
};

export type CvProjectItem = {
  title: string;
  url: string;
  description: string;
};

export type ServiceItem = {
  eyebrow: string;
  title: string;
  description: string;
};

export type TestimonialItem = {
  quote: string;
  name: string;
  role: string;
};

export type SeoContent = {
  title: string;
  description: string;
  ogImage?: string;
};

export type SocialLinks = {
  instagram?: string;
  youtube?: string;
  spotify?: string;
};

export type CvContent = {
  fullName: string;
  headline: string;
  location: string;
  address: string;
  email: string;
  phone: string;
  summary: string;
  skills: string[];
  experience: CvExperienceItem[];
  education: CvEducationItem[];
  showProjects?: boolean;
  projects: CvProjectItem[];
};

export type SiteLocale = "en" | "es";

export type BannerStyle = "editorial" | "blurred" | "split" | "floating";
export type ThemeSurfaceSettings = {
  wallpaperVisibility: number;
  surfaceVisibility: number;
  strongScrim: number;
  mediumScrim: number;
  borderRadius: number;
  borderWidth: number;
  blurStrength: number;
};

export type ThemeSettings = {
  accent: string;
  accentAlt: string;
  background: string;
  backgroundImage: string;
  contrast: "soft" | "balanced" | "high" | "editorial";
  bannerStyle?: BannerStyle;
  surface?: ThemeSurfaceSettings;
  applyVenueConsoleWallpaper?: boolean;
  applyEventPosterConsoleWallpaper?: boolean;
};

export type SiteTheme = ThemeSettings & {
  light: ThemeSettings;
};

export type ThemeRevision = {
  id: string;
  savedAt: string;
  theme: SiteTheme;
};

export type HomeSectionText = {
  builtByLabel: string;
  downloadCvLabel: string;
  generatePdfLabel: string;
  generatePdfButtonLabel: string;
  experienceTitle: string;
  skillsTitle: string;
  educationTitle: string;
  projectsTitle: string;
  locationLabel: string;
  contactLabel: string;
};

export type LocalizedSiteContent = {
  siteTitle?: string;
  homeText?: Partial<HomeSectionText>;
  cv?: Partial<CvContent>;
  subtitle?: string;
  heroText?: string;
  primaryCta?: string;
  secondaryCta?: string;
  bioTitle?: string;
  bioText?: string;
  credentials?: string[];
  servicesIntro?: string;
  services?: ServiceItem[];
  bookingInfo?: string;
  contactTitle?: string;
  contactText?: string;
  contactEmail?: string;
  testimonials?: TestimonialItem[];
};

export type SiteContent = {
  siteTitle: string;
  homeText?: HomeSectionText;
  cv: CvContent;
  cvUploadedAt?: string;
  cvFileUrl?: string;
  sourceFileName?: string;
  subtitle?: string;
  heroText?: string;
  primaryCta?: string;
  secondaryCta?: string;
  bioTitle?: string;
  bioText?: string;
  credentials?: string[];
  servicesIntro?: string;
  services?: ServiceItem[];
  bookingInfo?: string;
  contactTitle?: string;
  contactText?: string;
  contactEmail?: string;
  testimonials?: TestimonialItem[];
  seo?: SeoContent;
  socialLinks?: SocialLinks;
  theme: SiteTheme;
  themeHistory?: ThemeRevision[];
  locales?: {
    es?: LocalizedSiteContent;
  };
};
