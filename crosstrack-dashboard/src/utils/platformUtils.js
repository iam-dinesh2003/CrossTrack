// Platform grouping for charts and analytics
// ATS platforms (Greenhouse, Lever, etc.) are NOT where users apply — they're backend systems.
// Users apply on "Company Website" or "Job Boards" — that's what matters for insights.

export const PLATFORM_GROUPS = {
  'Job Boards': ['LINKEDIN', 'INDEED', 'HANDSHAKE'],
  'Company Website': [
    'GREENHOUSE', 'LEVER', 'WORKDAY', 'ICIMS', 'SMARTRECRUITERS',
    'ASHBY', 'JOBVITE', 'TALEO', 'SAP_SUCCESSFACTORS', 'BAMBOOHR',
    'BREEZY', 'RECRUITEE', 'JAZZHR', 'COMPANY_DIRECT', 'OTHER',
  ],
};

export const GROUP_COLORS = {
  'Job Boards': '#6C5CE7',
  'Company Website': '#10B981',
};

// Individual platform labels and colors (for detailed view)
export const PLATFORM_LABELS = {
  LINKEDIN: 'LinkedIn', INDEED: 'Indeed', HANDSHAKE: 'Handshake',
  GREENHOUSE: 'Greenhouse', LEVER: 'Lever', WORKDAY: 'Workday',
  ICIMS: 'iCIMS', SMARTRECRUITERS: 'SmartRecruiters', ASHBY: 'Ashby',
  JOBVITE: 'Jobvite', TALEO: 'Taleo', SAP_SUCCESSFACTORS: 'SAP',
  BAMBOOHR: 'BambooHR', COMPANY_DIRECT: 'Company Site', OTHER: 'Other',
};

export const PLATFORM_COLORS = {
  LINKEDIN: '#0077B5', INDEED: '#2164F3', HANDSHAKE: '#FF7043',
  GREENHOUSE: '#22C55E', LEVER: '#14B8A6', WORKDAY: '#F59E0B',
  ICIMS: '#06B6D4', SMARTRECRUITERS: '#A855F7', ASHBY: '#8B5CF6',
  JOBVITE: '#F43F5E', TALEO: '#0EA5E9', SAP_SUCCESSFACTORS: '#60A5FA',
  BAMBOOHR: '#84CC16', COMPANY_DIRECT: '#10B981', OTHER: '#A29BFE',
};

/**
 * Group platform counts into meaningful categories.
 * e.g., { LINKEDIN: 10, GREENHOUSE: 5, LEVER: 3 } → { 'Job Boards': 10, 'Company Website': 8 }
 */
export function groupPlatformCounts(platformCounts) {
  const grouped = {};

  for (const [group, platforms] of Object.entries(PLATFORM_GROUPS)) {
    grouped[group] = 0;
    for (const platform of platforms) {
      if (platformCounts[platform]) {
        grouped[group] += platformCounts[platform];
      }
    }
  }

  // Catch any unknown platforms → Company Website
  for (const [platform, count] of Object.entries(platformCounts)) {
    const isKnown = Object.values(PLATFORM_GROUPS).flat().includes(platform);
    if (!isKnown) {
      grouped['Company Website'] = (grouped['Company Website'] || 0) + count;
    }
  }

  return grouped;
}

/**
 * Get platform label for display
 */
export function getPlatformLabel(platform) {
  return PLATFORM_LABELS[platform] || platform.charAt(0) + platform.slice(1).toLowerCase();
}

/**
 * Get platform color
 */
export function getPlatformColor(platform) {
  return PLATFORM_COLORS[platform] || '#A29BFE';
}
