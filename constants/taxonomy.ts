export const TAXONOMY: Record<string, string[]> = {
  Animals: ['Birds', 'Mammals', 'Reptiles', 'Insects', 'Marine Life', 'Amphibians'],
  Plants: ['Trees', 'Flowers', 'Fungi', 'Cacti', 'Aquatic Plants', 'Berries', 'Fruits', 'Vegetables'],
  'Sky & Celestial': ['Moon Phases', 'Sun Events', 'Clouds', 'Weather Events', 'Stars & Planets', 'Constellations'],
  'Food & Drink': ['Meals', 'Street Food', 'Drinks', 'Desserts', 'Snacks'],
  'Places & Landmarks': ['Natural Wonders', 'Architecture', 'Cities', 'Monuments'],
  Vehicles: ['Cars', 'Aircraft', 'Boats', 'Trains', 'Motorcycles'],
  'People & Culture': ['Art', 'Festivals', 'Street Performance', 'Graffiti', 'Sports Events'],
  'Minerals & Earth': ['Rocks', 'Crystals', 'Fossils', 'Soil Formations'],
};

export const CATEGORIES = Object.keys(TAXONOMY);

export const RARITY_TIERS = [
  { tier: 'legendary', label: 'Legendary', maxCatches: 10, color: '#FF6B35' },
  { tier: 'epic', label: 'Epic', maxCatches: 100, color: '#9B59B6' },
  { tier: 'very_rare', label: 'Very Rare', maxCatches: 1000, color: '#3498DB' },
  { tier: 'rare', label: 'Rare', maxCatches: 10000, color: '#2ECC71' },
  { tier: 'uncommon', label: 'Uncommon', maxCatches: 100000, color: '#F39C12' },
  { tier: 'common', label: 'Common', maxCatches: 1000000, color: '#95A5A6' },
  { tier: 'everyday', label: 'Everyday', maxCatches: Infinity, color: '#BDC3C7' },
] as const;

export type RarityTier = 'legendary' | 'epic' | 'very_rare' | 'rare' | 'uncommon' | 'common' | 'everyday';

export function getRarityTier(totalCatches: number): RarityTier {
  if (totalCatches < 10) return 'legendary';
  if (totalCatches < 100) return 'epic';
  if (totalCatches < 1000) return 'very_rare';
  if (totalCatches < 10000) return 'rare';
  if (totalCatches < 100000) return 'uncommon';
  if (totalCatches < 1000000) return 'common';
  return 'everyday';
}

export function getRarityColor(tier: RarityTier): string {
  return RARITY_TIERS.find(r => r.tier === tier)?.color ?? '#BDC3C7';
}

export function getRarityLabel(tier: RarityTier): string {
  return RARITY_TIERS.find(r => r.tier === tier)?.label ?? 'Unknown';
}

export type DiscoveryBadge = 'first_discoverer' | 'first_10' | 'first_100' | 'first_1000' | null;

export function getDiscoveryBadge(entryNumber: number): DiscoveryBadge {
  if (entryNumber === 1) return 'first_discoverer';
  if (entryNumber <= 10) return 'first_10';
  if (entryNumber <= 100) return 'first_100';
  if (entryNumber <= 1000) return 'first_1000';
  return null;
}

export function getDiscoveryBadgeLabel(badge: DiscoveryBadge): string {
  switch (badge) {
    case 'first_discoverer': return 'First Discoverer';
    case 'first_10': return 'Top 10 Discoverer';
    case 'first_100': return 'Top 100 Discoverer';
    case 'first_1000': return 'Top 1000 Discoverer';
    default: return '';
  }
}
