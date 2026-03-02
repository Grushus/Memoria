import { supabase } from './supabase';
import { getRarityTier, getDiscoveryBadge } from '@/constants/taxonomy';
import type { Entry, UserCatch } from './types';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'assorted', 'various', 'random', 'misc', 'unknown',
  'generic', 'some', 'wild', 'common', 'and', 'or', 'of', 'with',
]);

function isSimilarName(a: string, b: string): boolean {
  const tokenize = (s: string) =>
    s.replace(/\([^)]*\)/g, '').toLowerCase().split(/[\s\-_,]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  const smaller = tokensA.size <= tokensB.size ? tokensA : tokensB;
  const larger  = tokensA.size <= tokensB.size ? tokensB : tokensA;
  if (smaller.size === 0) return false;
  return [...smaller].every(t => larger.has(t));
}

export async function findEntry(name: string, subcategory: string): Promise<Entry | null> {
  const { data: existing } = await supabase
    .from('entries')
    .select('*')
    .ilike('name', name)
    .single();
  if (existing) return existing as Entry;

  const { data: siblings } = await supabase
    .from('entries')
    .select('id, name')
    .eq('subcategory', subcategory);

  const fuzzyMatch = (siblings ?? []).find(e => isSimilarName(e.name, name));
  if (!fuzzyMatch) return null;

  const { data: fullEntry } = await supabase
    .from('entries')
    .select('*')
    .eq('id', fuzzyMatch.id)
    .single();
  return (fullEntry as Entry) ?? null;
}

export async function uploadPhoto(base64: string, userId: string): Promise<string> {
  const filename = `${userId}/${Date.now()}.jpg`;

  const byteCharacters = atob(base64);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }

  const { error } = await supabase.storage
    .from('catches')
    .upload(filename, byteArray, { contentType: 'image/jpeg', upsert: false });

  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = supabase.storage.from('catches').getPublicUrl(filename);
  return data.publicUrl;
}

export async function findOrCreateEntry(
  name: string,
  category: string,
  subcategory: string,
  description: string,
  funFact: string | null,
  isEndangered: boolean,
  userId: string
): Promise<{ entry: Entry; isNew: boolean }> {
  // Check for existing entry by name (case-insensitive)
  const { data: existing } = await supabase
    .from('entries')
    .select('*')
    .ilike('name', name)
    .single();

  if (existing) {
    return { entry: existing as Entry, isNew: false };
  }

  // Fuzzy dedupe: check for semantically similar entries in same subcategory
  const { data: siblings } = await supabase
    .from('entries')
    .select('id, name')
    .eq('subcategory', subcategory);

  const fuzzyMatch = (siblings ?? []).find(e => isSimilarName(e.name, name));
  if (fuzzyMatch) {
    const { data: fullEntry } = await supabase
      .from('entries')
      .select('*')
      .eq('id', fuzzyMatch.id)
      .single();
    if (fullEntry) return { entry: fullEntry as Entry, isNew: false };
  }

  // Create new entry
  const { data: newEntry, error } = await supabase
    .from('entries')
    .insert({
      name,
      category,
      subcategory,
      description,
      fun_fact: funFact,
      is_endangered: isEndangered,
      rarity_tier: 'legendary', // starts at legendary (0 catches so far)
      first_discoverer_id: userId,
      total_catches: 0,
    })
    .select()
    .single();

  if (error) {
    // Race condition: another call inserted the same entry concurrently — fetch it
    const { data: racedEntry } = await supabase
      .from('entries')
      .select('*')
      .ilike('name', name)
      .single();
    if (racedEntry) return { entry: racedEntry as Entry, isNew: false };
    throw new Error(`Entry creation failed: ${error.message}`);
  }
  return { entry: newEntry as Entry, isNew: true };
}

export async function logCatch(params: {
  userId: string;
  entryId: string | null;
  catchType: 'identified' | 'gallery';
  category: string;
  subcategory: string;
  photoUrl: string;
  lat: number | null;
  lng: number | null;
  country: string | null;
  isPublic?: boolean;
  note?: string | null;
}): Promise<UserCatch> {
  let entryNumber: number | null = null;

  if (params.entryId) {
    // Increment total_catches and get the new count atomically
    const { data: updatedEntry, error: updateError } = await supabase.rpc('increment_catches', {
      entry_id: params.entryId,
    });

    if (updateError) {
      // Fallback: manual increment
      const { data: entry } = await supabase
        .from('entries')
        .select('total_catches')
        .eq('id', params.entryId)
        .single();

      const newTotal = (entry?.total_catches ?? 0) + 1;
      await supabase
        .from('entries')
        .update({
          total_catches: newTotal,
          rarity_tier: getRarityTier(newTotal),
        })
        .eq('id', params.entryId);

      entryNumber = newTotal;
    } else {
      entryNumber = updatedEntry as number;
      // Update rarity tier
      await supabase
        .from('entries')
        .update({ rarity_tier: getRarityTier(entryNumber) })
        .eq('id', params.entryId);
    }
  }

  const discoveryBadge = entryNumber !== null ? getDiscoveryBadge(entryNumber) : null;

  const { data: catchRow, error } = await supabase
    .from('user_catches')
    .insert({
      user_id: params.userId,
      entry_id: params.entryId,
      catch_type: params.catchType,
      category: params.category,
      subcategory: params.subcategory,
      photo_url: params.photoUrl,
      lat: params.lat,
      lng: params.lng,
      country: params.country,
      is_public: params.isPublic ?? true,
      entry_number: entryNumber,
      discovery_badge: discoveryBadge,
      user_note: params.note ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Catch logging failed: ${error.message}`);

  // Update user stats
  await supabase.rpc('increment_user_catches', { target_user_id: params.userId });

  if (params.country) {
    await supabase.rpc('add_country_visited', {
      target_user_id: params.userId,
      country_code: params.country,
    });
  }

  return catchRow as UserCatch;
}

export async function getUserCatches(userId: string, limit = 30, offset = 0): Promise<UserCatch[]> {
  const { data, error } = await supabase
    .from('user_catches')
    .select(`*, entry:entries(*)`)
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return (data ?? []) as UserCatch[];
}

export async function getGlobalEntries(
  sortBy: 'rarity' | 'recent' | 'popular' = 'recent',
  limit = 30,
  offset = 0,
  category?: string
): Promise<Entry[]> {
  let query = supabase
    .from('entries')
    .select('*')
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }

  if (sortBy === 'rarity') {
    // Supabase doesn't support custom sort arrays directly, sort by total_catches ascending
    query = query.order('total_catches', { ascending: true });
  } else if (sortBy === 'popular') {
    query = query.order('total_catches', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Entry[];
}

export async function deleteCatch(catchId: string, photoUrl: string): Promise<void> {
  // Delete the catch row
  const { error } = await supabase
    .from('user_catches')
    .delete()
    .eq('id', catchId);

  if (error) throw new Error(`Delete failed: ${error.message}`);

  // Best-effort: delete photo from storage
  // Public URL format: .../storage/v1/object/public/catches/userId/timestamp.jpg
  try {
    const marker = '/catches/';
    const idx = photoUrl.indexOf(marker);
    if (idx !== -1) {
      const storagePath = photoUrl.slice(idx + marker.length);
      await supabase.storage.from('catches').remove([storagePath]);
    }
  } catch {
    // ignore storage cleanup errors
  }
}
