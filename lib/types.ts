import type { RarityTier, DiscoveryBadge } from '@/constants/taxonomy';

export type EntryType = 'identified' | 'gallery' | 'rejected';

// Mistral pixtral-12b response
export interface MistralVisionResult {
  entry_type: EntryType;
  name: string | null;
  category: string | null;
  subcategory: string | null;
  is_endangered: boolean;
}

// Mistral ministral-8b response
export interface MistralEnrichResult {
  description: string;
  fun_fact: string | null;
}

// Global entry in the entries table
export interface Entry {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  fun_fact: string | null;
  is_endangered: boolean;
  rarity_tier: RarityTier;
  first_discoverer_id: string;
  total_catches: number;
  created_at: string;
}

// Individual user catch in user_catches table
export interface UserCatch {
  id: string;
  user_id: string;
  entry_id: string | null;
  catch_type: 'identified' | 'gallery';
  category: string;
  subcategory: string;
  photo_url: string;
  lat: number | null;
  lng: number | null;
  country: string | null;
  entry_number: number | null;
  discovery_badge: DiscoveryBadge;
  user_note: string | null;
  is_public: boolean;
  timestamp: string;
  // Joined fields
  entry?: Entry;
}

// User profile
export interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  total_catches: number;
  first_discovery_count: number;
  countries_visited: string[];
  created_at: string;
}

// Result passed to the result screen after a catch (no DB writes yet — all deferred to Done)
export interface CatchResult {
  entryType: 'identified' | 'gallery';
  photoUri: string;        // local URI for display
  photoBase64: string;     // for re-label Mistral call + upload at Done
  name: string | null;
  category: string;
  subcategory: string;
  description: string | null;
  funFact: string | null;
  isEndangered: boolean;
  lat: number | null;
  lng: number | null;
  country: string | null;
  provisionalEntryNumber: number | null;   // null for gallery
  provisionalRarityTier: RarityTier | null; // null for gallery
}
