import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getDiscoveryBadgeLabel } from '@/constants/taxonomy';
import type { UserProfile } from '@/lib/types';
import type { DiscoveryBadge } from '@/constants/taxonomy';

const BADGE_TYPES: DiscoveryBadge[] = ['first_discoverer', 'first_10', 'first_100', 'first_1000'];

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [profileRes, badgesRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase
        .from('user_catches')
        .select('discovery_badge')
        .eq('user_id', user.id)
        .not('discovery_badge', 'is', null),
    ]);

    if (profileRes.data) setProfile(profileRes.data as UserProfile);

    if (badgesRes.data) {
      const counts: Record<string, number> = {};
      for (const row of badgesRes.data as { discovery_badge: string }[]) {
        counts[row.discovery_badge] = (counts[row.discovery_badge] ?? 0) + 1;
      }
      setBadgeCounts(counts);
    }

    setLoading(false);
  }

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load profile.</Text>
      </View>
    );
  }

  const earnedBadges = BADGE_TYPES.filter(b => b && badgeCounts[b] > 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar placeholder + username */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {profile.username.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.username}>{profile.username}</Text>
        <Text style={styles.memberSince}>
          Member since {new Date(profile.created_at).getFullYear()}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Total Catches" value={profile.total_catches} />
<StatCard label="Countries" value={profile.countries_visited.length} />
      </View>

      {/* Discovery Badges */}
      {earnedBadges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovery Badges</Text>
          {earnedBadges.map(badge => badge && (
            <TouchableOpacity
              key={badge}
              style={styles.badgeRow}
              onPress={() => router.push({ pathname: '/badges/[badge]', params: { badge } })}
            >
              <View style={styles.badgeInfo}>
                <Text style={styles.badgeLabel}>{getDiscoveryBadgeLabel(badge)}</Text>
                <Text style={styles.badgeCount}>{badgeCounts[badge]} {badgeCounts[badge] === 1 ? 'entry' : 'entries'}</Text>
              </View>
              <Text style={styles.badgeArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Countries visited */}
      {profile.countries_visited.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Countries Visited</Text>
          <View style={styles.countriesWrap}>
            {profile.countries_visited.map(code => (
              <View key={code} style={styles.countryChip}>
                <Text style={styles.countryCode}>{code}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#555', fontSize: 15 },
  header: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarLetter: { color: '#fff', fontSize: 28, fontWeight: '700' },
  username: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  memberSince: { color: '#444', fontSize: 13 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  statLabel: { color: '#555', fontSize: 11, textAlign: 'center' },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { color: '#444', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 12 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  badgeInfo: { flex: 1 },
  badgeLabel: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  badgeCount: { color: '#555', fontSize: 12 },
  badgeArrow: { color: '#333', fontSize: 22 },
  countriesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  countryChip: {
    backgroundColor: '#111',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countryCode: { color: '#666', fontSize: 12, fontWeight: '600' },
  signOutButton: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 10,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  signOutText: { color: '#c0392b', fontWeight: '600', fontSize: 15 },
});
