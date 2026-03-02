import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getUserCatches } from '@/lib/catches';
import { getRarityColor, getDiscoveryBadgeLabel } from '@/constants/taxonomy';
import type { UserCatch } from '@/lib/types';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 2;

export default function MemoriaScreen() {
  const [catches, setCatches] = useState<UserCatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getUserCatches(user.id, 60);
      setCatches(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => load(true), []);

  async function togglePrivacy(item: UserCatch) {
    const next = !item.is_public;
    setCatches(prev => prev.map(c => c.id === item.id ? { ...c, is_public: next } : c));
    await supabase.from('user_catches').update({ is_public: next }).eq('id', item.id);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }

  if (catches.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Your Memoria is empty</Text>
        <Text style={styles.emptySubtitle}>Take your first photo to start your journal.</Text>
      </View>
    );
  }

  function renderItem({ item }: { item: UserCatch }) {
    const isGallery = item.catch_type === 'gallery';
    const entry = item.entry;
    const rarityColor = entry?.rarity_tier ? getRarityColor(entry.rarity_tier) : null;
    const label = entry?.name ?? item.subcategory;
    const badgeLabel = item.discovery_badge ? getDiscoveryBadgeLabel(item.discovery_badge) : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => entry ? router.push(`/entry/${entry.id}?logId=${item.id}`) : null}
        activeOpacity={0.8}
      >
        <View style={styles.imageContainer}>
          <Image source={{ uri: item.photo_url }} style={styles.cardImage} />
          {/* Privacy toggle — bottom-right of photo */}
          <TouchableOpacity
            style={styles.privacyBtn}
            onPress={() => togglePrivacy(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={styles.privacyBg}>
              <Ionicons
                name={item.is_public ? 'earth-outline' : 'lock-closed-outline'}
                size={12}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          </TouchableOpacity>
        </View>

        {rarityColor && !isGallery && (
          <View style={[styles.rarityStrip, { backgroundColor: rarityColor }]} />
        )}

        <View style={[styles.cardInfo, isGallery && styles.cardInfoGallery]}>
          <Text style={styles.cardName} numberOfLines={1}>{label}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>{item.category}</Text>

          {badgeLabel && (
            <View style={styles.discoveryBadge}>
              <Text style={styles.discoveryBadgeText}>{badgeLabel}</Text>
            </View>
          )}

          {isGallery && <Text style={styles.galleryLabel}>Gallery</Text>}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={catches}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { color: '#555', fontSize: 14, textAlign: 'center' },
  list: { padding: 12, gap: 12 },
  row: { gap: 12 },
  card: {
    width: ITEM_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  imageContainer: { position: 'relative' },
  cardImage: { width: ITEM_SIZE, height: ITEM_SIZE, backgroundColor: '#1a1a1a' },
  privacyBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  privacyBg: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rarityStrip: { height: 3 },
  cardInfo: { padding: 10 },
  cardInfoGallery: { opacity: 0.7 },
  cardName: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  cardSub: { color: '#555', fontSize: 11 },
  discoveryBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#1a2a1a',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discoveryBadgeText: { color: '#2ecc71', fontSize: 9, fontWeight: '700' },
  galleryLabel: { color: '#444', fontSize: 10, marginTop: 4, fontStyle: 'italic' },
});
