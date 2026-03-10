import { PUBLIC_DOMAIN_HYMNS } from '../seed/publicDomainHymns.ts';
import type { Hymn, HymnLibrarySourceKind } from '../types/hymns.ts';
import { filterHymnsByCatalogRules, searchHymns, type HymnSearchOptions, type HymnSearchResult } from './hymnSearch.ts';

export type HymnCatalogProviderAvailability = 'active' | 'dark' | 'disabled';

export interface HymnCatalogListOptions extends HymnSearchOptions {
  limit?: number;
}

export interface HymnCatalogProviderCapabilities {
  search: boolean;
  hydration: boolean;
  entitlementCheck: boolean;
}

export interface HymnCatalogProviderDescriptor {
  id: string;
  label: string;
  sourceKinds: HymnLibrarySourceKind[];
  availability: HymnCatalogProviderAvailability;
  isVisibleInLibrary: boolean;
  providerId?: string;
  providerName?: string;
  capabilities: HymnCatalogProviderCapabilities;
}

export interface HymnCatalogProvider extends HymnCatalogProviderDescriptor {
  listHymns: (options?: HymnCatalogListOptions) => Hymn[];
  search: (query: string, options?: HymnCatalogListOptions) => HymnSearchResult[];
  getById: (id: string) => Hymn | null;
}

const dedupeHymns = (hymns: Hymn[]) => {
  const seen = new Set<string>();
  return hymns.filter((hymn) => {
    if (seen.has(hymn.id)) return false;
    seen.add(hymn.id);
    return true;
  });
};

const createStaticCatalogProvider = (
  descriptor: Omit<HymnCatalogProviderDescriptor, 'capabilities'> & { capabilities?: Partial<HymnCatalogProviderCapabilities> },
  hymns: Hymn[],
): HymnCatalogProvider => ({
  ...descriptor,
  capabilities: {
    search: descriptor.capabilities?.search ?? true,
    hydration: descriptor.capabilities?.hydration ?? true,
    entitlementCheck: descriptor.capabilities?.entitlementCheck ?? false,
  },
  listHymns: (options = {}) => {
    const filtered = filterHymnsByCatalogRules(hymns, { ...options, sourceKinds: options.sourceKinds || descriptor.sourceKinds });
    return typeof options.limit === 'number' ? filtered.slice(0, options.limit) : filtered;
  },
  search: (query, options = {}) => searchHymns(hymns, query, options.limit || 25, { ...options, sourceKinds: options.sourceKinds || descriptor.sourceKinds }),
  getById: (hymnId) => hymns.find((hymn) => hymn.id === hymnId) || null,
});

const createDarkLicensedCatalogProvider = (
  id: string,
  label: string,
  providerId: string,
  providerName: string,
): HymnCatalogProvider => ({
  id,
  label,
  sourceKinds: ['licensed'],
  availability: 'dark',
  isVisibleInLibrary: false,
  providerId,
  providerName,
  capabilities: {
    search: false,
    hydration: false,
    entitlementCheck: false,
  },
  listHymns: () => [],
  search: () => [],
  getById: () => null,
});

export const bundledHymnCatalogProvider = createStaticCatalogProvider(
  {
    id: 'lumina-bundled-hymns',
    label: 'Lumina Bundled Hymns',
    sourceKinds: ['bundled-pd'],
    availability: 'active',
    isVisibleInLibrary: true,
    providerId: 'lumina-bundled',
    providerName: 'Lumina Bundled Hymns',
  },
  PUBLIC_DOMAIN_HYMNS,
);

export const darkLicensedHymnCatalogProvider = createDarkLicensedCatalogProvider(
  'licensed-hymn-provider-dark',
  'Licensed Hymn Provider',
  'future-licensed-provider',
  'Future Licensed Provider',
);

export const HYMN_CATALOG_PROVIDERS: HymnCatalogProvider[] = [
  bundledHymnCatalogProvider,
  darkLicensedHymnCatalogProvider,
];

export const listAllHymnCatalogProviders = () => [...HYMN_CATALOG_PROVIDERS];

export const listVisibleHymnCatalogProviders = () => (
  HYMN_CATALOG_PROVIDERS.filter((provider) => provider.availability === 'active' && provider.isVisibleInLibrary)
);

export const listCatalogHymns = (options: HymnCatalogListOptions = {}) => {
  const visibleProviders = listVisibleHymnCatalogProviders();
  const hymns = dedupeHymns(visibleProviders.flatMap((provider) => provider.listHymns(options)));
  return typeof options.limit === 'number' ? hymns.slice(0, options.limit) : hymns;
};

export const searchCatalogHymns = (query: string, options: HymnCatalogListOptions = {}) => {
  const visibleProviders = listVisibleHymnCatalogProviders();
  const results = visibleProviders.flatMap((provider) => provider.search(query, options));
  const deduped = new Map<string, HymnSearchResult>();

  results.forEach((result) => {
    const existing = deduped.get(result.hymn.id);
    if (!existing || result.score > existing.score) {
      deduped.set(result.hymn.id, result);
    }
  });

  return Array.from(deduped.values())
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.hymn.title.localeCompare(right.hymn.title);
    })
    .slice(0, options.limit || 25);
};

export const getCatalogHymnById = (id: string) => {
  const visibleProviders = listVisibleHymnCatalogProviders();
  for (const provider of visibleProviders) {
    const hymn = provider.getById(id);
    if (hymn) return hymn;
  }
  return null;
};
