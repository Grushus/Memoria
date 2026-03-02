import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { File, Paths } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { deleteCatch } from '@/lib/catches';
import { narrateText, stopNarration } from '@/lib/narration';
import { getRarityColor, getRarityLabel, getDiscoveryBadgeLabel } from '@/constants/taxonomy';
import type { Entry, UserCatch } from '@/lib/types';

const { width } = Dimensions.get('window');
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('screen');

export default function EntryDetailScreen() {
  const { id, logId } = useLocalSearchParams<{ id: string; logId?: string }>();
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [myCatch, setMyCatch] = useState<UserCatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [isNarratingDesc, setIsNarratingDesc] = useState(false);
  const [isNarratingFact, setIsNarratingFact] = useState(false);
  const [imageExpanded, setImageExpanded] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadEntry(id);
  }, [id]);

  async function loadEntry(entryId: string) {
    const { data: { user } } = await supabase.auth.getUser();

    let catchQuery = user
      ? supabase.from('user_catches').select('*').eq('user_id', user.id)
      : null;

    if (catchQuery) {
      catchQuery = logId
        ? catchQuery.eq('id', logId)
        : catchQuery.eq('entry_id', entryId).order('timestamp', { ascending: false }).limit(1);
    }

    const [entryRes, catchRes] = await Promise.all([
      supabase.from('entries').select('*').eq('id', entryId).single(),
      catchQuery ? catchQuery.single() : Promise.resolve({ data: null }),
    ]);

    if (entryRes.data) setEntry(entryRes.data as Entry);
    if (catchRes.data) {
      const c = catchRes.data as UserCatch;
      setMyCatch(c);
      setNote(c.user_note ?? '');
      setIsPublic(c.is_public);
    }
    setLoading(false);
  }

  async function saveNote() {
    if (!myCatch) return;
    setNoteSaving(true);
    const { error } = await supabase
      .from('user_catches')
      .update({ user_note: note.trim() || null })
      .eq('id', myCatch.id);
    setNoteSaving(false);
    if (error) Alert.alert('Could not save note', error.message);
    else setMyCatch(prev => prev ? { ...prev, user_note: note.trim() || null } : prev);
  }

  async function togglePublic() {
    if (!myCatch) return;
    const next = !isPublic;
    setIsPublic(next);
    await supabase.from('user_catches').update({ is_public: next }).eq('id', myCatch.id);
  }

  async function handleDownload() {
    if (!myCatch) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access in Settings to save photos.');
      return;
    }
    try {
      const dest = new File(Paths.cache, 'memoria_photo.jpg');
      const downloaded = await File.downloadFileAsync(myCatch.photo_url, dest);
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);
      Alert.alert('Saved', 'Photo saved to your camera roll.');
    } catch {
      Alert.alert('Error', 'Could not save photo.');
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete this entry?',
      'Are you sure? You can set it to Private instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCatch(myCatch!.id, myCatch!.photo_url);
              stopNarration();
              router.back();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
            }
          },
        },
      ]
    );
  }

  async function toggleDescription() {
    if (isNarratingDesc) {
      stopNarration();
      setIsNarratingDesc(false);
      return;
    }
    setIsNarratingFact(false);
    setIsNarratingDesc(true);
    await narrateText(entry!.description!);
    setIsNarratingDesc(false);
  }

  async function toggleFunFact() {
    if (isNarratingFact) {
      stopNarration();
      setIsNarratingFact(false);
      return;
    }
    setIsNarratingDesc(false);
    setIsNarratingFact(true);
    await narrateText(entry!.fun_fact!);
    setIsNarratingFact(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#fff" /></View>;
  }

  if (!entry) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Entry not found.</Text>
      </View>
    );
  }

  const rarityColor = getRarityColor(entry.rarity_tier);
  const rarityLabel = getRarityLabel(entry.rarity_tier);
  const badgeLabel = myCatch?.discovery_badge ? getDiscoveryBadgeLabel(myCatch.discovery_badge) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: entry.name,
          headerRight: myCatch ? () => (
            <TouchableOpacity onPress={handleDownload} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="download-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {myCatch && (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setImageExpanded(true)}>
            <Image source={{ uri: myCatch.photo_url }} style={styles.photo} resizeMode="cover" />
          </TouchableOpacity>
        )}

        <View style={[styles.rarityBar, { backgroundColor: rarityColor }]} />

        <View style={styles.body}>
          {/* Name + category + rarity badge + endangered */}
          <View style={styles.headerBlock}>
            <Text style={styles.name}>{entry.name}</Text>
            <Text style={styles.category}>{entry.category} / {entry.subcategory}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.rarityBadge, { borderColor: rarityColor }]}>
                <Text style={[styles.rarityText, { color: rarityColor }]}>{rarityLabel}</Text>
              </View>
              {entry.is_endangered && (
                <View style={styles.endangeredTag}>
                  <Text style={styles.endangeredTagText}>Endangered</Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsBlock}>
            <Text style={styles.statLine}>
              Found by {entry.total_catches.toLocaleString()} explorer{entry.total_catches !== 1 ? 's' : ''} worldwide
            </Text>
            {myCatch?.entry_number && (
              <Text style={styles.statLine}>
                You were #{myCatch.entry_number} to discover this
              </Text>
            )}
          </View>

          {/* Discovery badge */}
          {badgeLabel && (
            <View style={styles.discoveryCard}>
              <Text style={styles.discoveryTitle}>{badgeLabel}</Text>
              {myCatch?.entry_number && (
                <Text style={styles.discoverySub}>#{myCatch.entry_number} to log this worldwide</Text>
              )}
            </View>
          )}

          {/* Note */}
          {myCatch && (
            <View style={styles.noteCard}>
              <Text style={styles.noteLabel}>Your Note</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a personal note..."
                placeholderTextColor="#555"
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={280}
              />
              {note !== (myCatch.user_note ?? '') && (
                <TouchableOpacity style={styles.saveNoteButton} onPress={saveNote} disabled={noteSaving}>
                  <Text style={styles.saveNoteButtonText}>{noteSaving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {entry.description && (
            <View style={styles.textBlock}>
              <Text style={styles.description}>{entry.description}</Text>
              <TouchableOpacity style={styles.playButton} onPress={toggleDescription}>
                <Ionicons
                  name={isNarratingDesc ? 'stop-circle-outline' : 'volume-medium-outline'}
                  size={14}
                  color="#aaa"
                />
                <Text style={styles.playButtonText}>{isNarratingDesc ? 'Stop' : 'Read'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {entry.fun_fact && (
            <View style={styles.funFactCard}>
              <Text style={styles.funFactLabel}>Fun Fact</Text>
              <Text style={styles.funFactText}>{entry.fun_fact}</Text>
              <TouchableOpacity style={styles.playButton} onPress={toggleFunFact}>
                <Ionicons
                  name={isNarratingFact ? 'stop-circle-outline' : 'volume-medium-outline'}
                  size={14}
                  color="#aaa"
                />
                <Text style={styles.playButtonText}>{isNarratingFact ? 'Stop' : 'Read'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {myCatch?.country && (
            <Text style={styles.location}>Logged in {myCatch.country}</Text>
          )}

          {/* Privacy + Delete — only for own catches */}
          {myCatch && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.visibilityButton} onPress={togglePublic}>
                <Ionicons
                  name={isPublic ? 'earth-outline' : 'lock-closed-outline'}
                  size={16}
                  color={isPublic ? '#fff' : '#888'}
                />
                <Text style={[styles.visibilityText, !isPublic && styles.visibilityTextPrivate]}>
                  {isPublic ? 'Public' : 'Private'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Delete Entry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Full-screen image modal */}
      {myCatch && (
        <Modal
          visible={imageExpanded}
          transparent
          animationType="fade"
          onRequestClose={() => setImageExpanded(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setImageExpanded(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Image
              source={{ uri: myCatch.photo_url }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#555', fontSize: 15 },
  photo: { width, height: width, backgroundColor: '#111' },
  rarityBar: { height: 4 },
  body: { padding: 20 },
  headerBlock: { marginBottom: 16 },
  name: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  category: { color: '#555', fontSize: 13, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rarityBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  rarityText: { fontSize: 11, fontWeight: '700' },
  endangeredTag: {
    backgroundColor: '#3d0000',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  endangeredTagText: { color: '#c0392b', fontWeight: '700', fontSize: 11 },
  statsBlock: { gap: 4, marginBottom: 16 },
  statLine: { color: '#666', fontSize: 13 },
  discoveryCard: {
    backgroundColor: '#0d1a0d',
    borderWidth: 1,
    borderColor: '#2ecc71',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  discoveryTitle: { color: '#2ecc71', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  discoverySub: { color: '#27ae60', fontSize: 12 },
  noteCard: {
    backgroundColor: '#0d1a0d',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  noteLabel: { color: '#2ecc71', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  noteInput: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    minHeight: 48,
    textAlignVertical: 'top',
  },
  saveNoteButton: {
    marginTop: 8,
    alignSelf: 'flex-end',
    backgroundColor: '#1a3a1a',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  saveNoteButtonText: { color: '#2ecc71', fontSize: 12, fontWeight: '700' },
  textBlock: { marginBottom: 16 },
  description: { color: '#bbb', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    gap: 5,
  },
  playButtonText: { color: '#aaa', fontSize: 12, fontWeight: '600' },
  funFactCard: { backgroundColor: '#111', borderRadius: 10, padding: 14, marginBottom: 16, gap: 8 },
  funFactLabel: { color: '#444', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  funFactText: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  location: { color: '#333', fontSize: 12, marginTop: 8, marginBottom: 24 },
  actions: { gap: 12, marginTop: 8 },
  visibilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 13,
  },
  visibilityText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  visibilityTextPrivate: { color: '#888' },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#7a1a1a',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteButtonText: { color: '#c0392b', fontSize: 14, fontWeight: '600' },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
});
