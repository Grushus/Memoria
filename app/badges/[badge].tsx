import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getDiscoveryBadgeLabel, getRarityColor } from '@/constants/taxonomy';
import type { UserCatch } from '@/lib/types';
import type { DiscoveryBadge as DiscoveryBadgeType } from '@/constants/taxonomy';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 2;

export default function BadgeDetailScreen() {
  const { badge } = useLocalSearchParams<{ badge: string }>();
  const [catches, setCatches] = useState<UserCatch[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!badge) return;
    loadBadgeCatches(badge);
  }, [badge]);

  async function loadBadgeCatches(badgeType: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_catches')
      .select('*, entry:entries(*)')
      .eq('user_id', user.id)
      .eq('discovery_badge', badgeType)
      .order('timestamp', { ascending: false });

    setCatches((data ?? []) as UserCatch[]);
    setLoading(false);
  }

  const label = badge ? getDiscoveryBadgeLabel(badge as DiscoveryBadgeType) : '';

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.subtitle}>{catches.length} {catches.length === 1 ? 'entry' : 'entries'}</Text>
      </View>

      <FlatList
        data={catches}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const entry = item.entry;
          const rarityColor = entry?.rarity_tier ? getRarityColor(entry.rarity_tier) : '#333';

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => entry && router.push(`/entry/${entry.id}`)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: item.photo_url }} style={styles.cardImage} />
              <View style={[styles.rarityStrip, { backgroundColor: rarityColor }]} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{entry?.name ?? item.subcategory}</Text>
                {item.entry_number && (
                  <Text style={styles.cardNumber}>#{item.entry_number} worldwide</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No entries with this badge yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#555', fontSize: 14 },
  header: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#555', fontSize: 13 },
  list: { padding: 12, gap: 12 },
  row: { gap: 12 },
  card: { width: ITEM_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111' },
  cardImage: { width: ITEM_SIZE, height: ITEM_SIZE, backgroundColor: '#1a1a1a' },
  rarityStrip: { height: 3 },
  cardInfo: { padding: 10 },
  cardName: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  cardNumber: { color: '#2ecc71', fontSize: 11 },
});
