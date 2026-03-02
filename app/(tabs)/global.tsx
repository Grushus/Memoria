import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getGlobalEntries } from '@/lib/catches';
import { getRarityColor, getRarityLabel, CATEGORIES as TAXONOMY_CATEGORIES } from '@/constants/taxonomy';
import type { Entry } from '@/lib/types';

type SortOption = 'recent' | 'rarity' | 'popular';

const CATEGORIES = ['All', ...TAXONOMY_CATEGORIES];

export default function GlobalScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortOption>('recent');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const router = useRouter();

  async function load(sortBy: SortOption, cat: string | undefined, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await getGlobalEntries(sortBy, 40, 0, cat);
      setEntries(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(sort, category); }, [sort, category]);
  const onRefresh = useCallback(() => load(sort, category, true), [sort, category]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  function renderItem({ item }: { item: Entry }) {
    const rarityColor = getRarityColor(item.rarity_tier);
    const rarityLabel = getRarityLabel(item.rarity_tier);

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/entry/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text style={styles.entryName} numberOfLines={1}>{item.name}</Text>
            {item.is_endangered && (
              <View style={styles.endangeredTag}>
                <Text style={styles.endangeredText}>Endangered</Text>
              </View>
            )}
          </View>
          <Text style={styles.categoryText}>{item.category} / {item.subcategory}</Text>
        </View>
        <View style={styles.rowRight}>
          <View style={[styles.rarityBadge, { borderColor: rarityColor }]}>
            <Text style={[styles.rarityBadgeText, { color: rarityColor }]}>{rarityLabel}</Text>
          </View>
          <Text style={styles.catchCount}>{item.total_catches} logged</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBarContent}
        >
          {CATEGORIES.map(cat => {
            const active = cat === 'All' ? !category : category === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategory(cat === 'All' ? undefined : cat)}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Sort controls */}
      <View style={styles.sortBar}>
        {(['recent', 'rarity', 'popular'] as SortOption[]).map(option => (
          <TouchableOpacity
            key={option}
            style={[styles.sortButton, sort === option && styles.sortButtonActive]}
            onPress={() => setSort(option)}
          >
            <Text style={[styles.sortButtonText, sort === option && styles.sortButtonTextActive]}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        style={styles.flatList}
        data={entries}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No entries yet. Be the first to discover something.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { color: '#555', fontSize: 14, textAlign: 'center' },
  categoryBar: {
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    justifyContent: 'center',
  },
  categoryBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  categoryChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#111',
    flexShrink: 0,
  },
  categoryChipActive: { backgroundColor: '#fff' },
  categoryChipText: { color: '#555', fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: '#000' },
  sortBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#111',
  },
  sortButtonActive: { backgroundColor: '#fff' },
  sortButtonText: { color: '#555', fontSize: 13, fontWeight: '600' },
  sortButtonTextActive: { color: '#000' },
  flatList: { flex: 1 },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    gap: 12,
  },
  rarityDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  rowContent: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryName: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  categoryText: { color: '#555', fontSize: 12 },
  endangeredTag: {
    backgroundColor: '#3d0000',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  endangeredText: { color: '#c0392b', fontSize: 9, fontWeight: '700' },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  rarityBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rarityBadgeText: { fontSize: 10, fontWeight: '700' },
  catchCount: { color: '#444', fontSize: 11 },
});
