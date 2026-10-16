import type { ResourceLicense } from '../types/library';

export const LICENSE_LABELS: Record<ResourceLicense, string> = {
  'public-domain': 'Public domain',
  cc0: 'CC0',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  'cc-by-nc': 'CC BY-NC',
  'cc-by-nc-sa': 'CC BY-NC-SA',
  'all-rights-reserved': 'All rights reserved',
  unknown: 'Licence unknown',
};
