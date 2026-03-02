import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Alert,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getPendingCatch, clearPendingCatch } from '@/lib/catchStore';
import { uploadPhoto, findOrCreateEntry, logCatch, findEntry } from '@/lib/catches';
import { relabelEntry, reinsistLabel, type RelabelResult } from '@/lib/mistral';
import { narrateText, stopNarration } from '@/lib/narration';
import ProcessingOverlay from '@/components/ProcessingOverlay';
import { TAXONOMY, getRarityColor, getRarityLabel, getDiscoveryBadge, getDiscoveryBadgeLabel } from '@/constants/taxonomy';

const { width } = Dimensions.get('window');

const PHOTO_TIPS = [
  'Step back to show more context',
  'Include packaging or labels if available',
  'Try better lighting or avoid harsh shadows',
  'Photograph from a different angle',
];

export default function ResultScreen() {
  const router = useRouter();
  const result = getPendingCatch();
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isNarratingDesc, setIsNarratingDesc] = useState(false);
  const [isNarratingFact, setIsNarratingFact] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Re-label state
  const [relabelMode, setRelabelMode] = useState(false);
  const [relabelSuggestion, setRelabelSuggestion] = useState('');
  const [relabelLoading, setRelabelLoading] = useState(false);
  const [relabelDisagreement, setRelabelDisagreement] = useState<string | null>(null);
  const [hasInsisted, setHasInsisted] = useState(false);
  const [pendingRelabel, setPendingRelabel] = useState<Extract<RelabelResult, { agreed: true }> | null>(null);

  // Mutable display state (updated after successful re-label)
  const [displayName, setDisplayName] = useState(result?.name ?? null);
  const [displayCategory, setDisplayCategory] = useState(result?.category ?? '');
  const [displaySubcategory, setDisplaySubcategory] = useState(result?.subcategory ?? '');
  const [displayDescription, setDisplayDescription] = useState(result?.description ?? null);
  const [displayFunFact, setDisplayFunFact] = useState(result?.funFact ?? null);
  const [displayRarityTier, setDisplayRarityTier] = useState(result?.provisionalRarityTier ?? null);
  const [displayEntryNumber, setDisplayEntryNumber] = useState(result?.provisionalEntryNumber ?? null);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isSaving) return true;
        Alert.alert(
          'Leave without saving?',
          'This photo will not be added to your Memoria.',
          [
            { text: 'Stay', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: () => {
                stopNarration();
                clearPendingCatch();
                router.replace('/(tabs)');
              },
            },
          ]
        );
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [isSaving])
  );

  if (!result) {
    router.replace('/(tabs)');
    return null;
  }

  async function handleDone() {
    if (!result) return;
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const photoUrl = await uploadPhoto(result.photoBase64, user.id);

      let entryId: string | null = null;
      let catchCategory = displayCategory;
      let catchSubcategory = displaySubcategory;

      const effectiveEntryType = pendingRelabel ? 'identified' : result.entryType;

      if (effectiveEntryType === 'identified') {
        const data = pendingRelabel ?? {
          name: result.name!,
          category: result.category,
          subcategory: result.subcategory,
          description: result.description ?? '',
          fun_fact: result.funFact,
          is_endangered: result.isEndangered,
        };
        const { entry } = await findOrCreateEntry(
          data.name,
          data.category,
          data.subcategory,
          data.description ?? '',
          data.fun_fact ?? null,
          data.is_endangered,
          user.id
        );
        entryId = entry.id;
        catchCategory = data.category;
        catchSubcategory = data.subcategory;
      }

      await logCatch({
        userId: user.id,
        entryId,
        catchType: effectiveEntryType,
        category: catchCategory,
        subcategory: catchSubcategory,
        photoUrl,
        lat: result.lat,
        lng: result.lng,
        country: result.country,
        isPublic,
        note: note.trim() || null,
      });

      stopNarration();
      clearPendingCatch();
      router.replace('/(tabs)');
    } catch (e) {
      setIsSaving(false);
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save entry.');
    }
  }

  function handleDiscard() {
    Alert.alert(
      'Discard this entry?',
      'This photo will not be added to your Memoria.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            stopNarration();
            clearPendingCatch();
            router.replace('/(tabs)');
          },
        },
      ]
    );
  }

  function togglePublic() {
    setIsPublic(prev => !prev);
  }

  async function toggleDescription() {
    if (isNarratingDesc) {
      stopNarration();
      setIsNarratingDesc(false);
      return;
    }
    setIsNarratingFact(false);
    setIsNarratingDesc(true);
    await narrateText(displayDescription!);
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
    await narrateText(displayFunFact!);
    setIsNarratingFact(false);
  }

  async function handleReinsist() {
    if (!relabelSuggestion.trim()) return;
    setRelabelLoading(true);
    setRelabelDisagreement(null);
    setHasInsisted(true);
    try {
      const response = await reinsistLabel(relabelSuggestion.trim());

      if (!response.agreed) {
        setRelabelDisagreement(response.reason);
        setRelabelLoading(false);
        return;
      }

      const validSubcategories = TAXONOMY[response.category];
      if (!validSubcategories || !validSubcategories.includes(response.subcategory)) {
        setRelabelDisagreement(
          "That label couldn't be classified — it may not fit our current taxonomy. Try a more specific label."
        );
        setRelabelLoading(false);
        return;
      }

      setPendingRelabel(response);
      const reinsistEntry = await findEntry(response.name, response.subcategory);
      setDisplayRarityTier(reinsistEntry ? reinsistEntry.rarity_tier : 'legendary');
      setDisplayEntryNumber(reinsistEntry ? reinsistEntry.total_catches + 1 : 1);
      setDisplayName(response.name);
      setDisplayCategory(response.category);
      setDisplaySubcategory(response.subcategory);
      setDisplayDescription(response.description ?? null);
      setDisplayFunFact(response.fun_fact ?? null);
      setRelabelMode(false);
      setRelabelSuggestion('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Override failed.');
    }
    setRelabelLoading(false);
  }

  async function handleRelabel() {
    if (!relabelSuggestion.trim()) return;
    setRelabelLoading(true);
    setRelabelDisagreement(null);
    try {
      const response = await relabelEntry(result!.photoBase64, relabelSuggestion.trim(), displayName ?? '');

      if (!response.agreed) {
        setRelabelDisagreement(response.reason);
        setRelabelLoading(false);
        return;
      }

      // Validate taxonomy before accepting — catches hallucinated categories/subcategories
      const validSubcategories = TAXONOMY[response.category];
      if (!validSubcategories || !validSubcategories.includes(response.subcategory)) {
        setRelabelDisagreement(
          "That label couldn't be confirmed — it may not fit our current taxonomy or may be a background element rather than the main subject. Try a more specific label."
        );
        setRelabelLoading(false);
        return;
      }

      // Mistral agreed and taxonomy is valid — update display and store pending relabel for Done
      setPendingRelabel(response);
      const relabelEntry2 = await findEntry(response.name, response.subcategory);
      setDisplayRarityTier(relabelEntry2 ? relabelEntry2.rarity_tier : 'legendary');
      setDisplayEntryNumber(relabelEntry2 ? relabelEntry2.total_catches + 1 : 1);
      setDisplayName(response.name);
      setDisplayCategory(response.category);
      setDisplaySubcategory(response.subcategory);
      setDisplayDescription(response.description ?? null);
      setDisplayFunFact(response.fun_fact ?? null);
      setRelabelMode(false);
      setRelabelSuggestion('');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Re-label failed.');
    }
    setRelabelLoading(false);
  }

  const tipIndex = result.photoBase64.charCodeAt(0) % PHOTO_TIPS.length;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Image source={{ uri: result.photoUri }} style={styles.photo} resizeMode="cover" />

        {displayRarityTier && (
          <View style={{ height: 4, backgroundColor: getRarityColor(displayRarityTier) }} />
        )}

        <View style={styles.badgeRow}>
          {result.entryType === 'gallery' && !pendingRelabel && (
            <View style={[styles.badge, { backgroundColor: '#444' }]}>
              <Text style={styles.badgeText}>Gallery</Text>
            </View>
          )}
          {displayRarityTier && (
            <View style={[styles.badge, { backgroundColor: getRarityColor(displayRarityTier) }]}>
              <Text style={styles.badgeText}>{getRarityLabel(displayRarityTier)}</Text>
            </View>
          )}
          {result.isEndangered && (
            <View style={[styles.badge, { backgroundColor: '#c0392b' }]}>
              <Text style={styles.badgeText}>Endangered</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.name}>{displayName ?? displaySubcategory}</Text>
          <Text style={styles.category}>{displayCategory} / {displaySubcategory}</Text>

          {/* Wrong label — below title */}
          {!relabelMode && (
            <TouchableOpacity onPress={() => { setRelabelMode(true); setRelabelDisagreement(null); }}>
              <Text style={styles.relabelLink}>Wrong label?</Text>
            </TouchableOpacity>
          )}
          {relabelMode && (
            <View style={styles.relabelPanel}>
              <Text style={styles.relabelPanelLabel}>What do you think this is?</Text>
              <TextInput
                style={styles.relabelInput}
                placeholder="e.g. Blue Jay, Eiffel Tower..."
                placeholderTextColor="#555"
                value={relabelSuggestion}
                onChangeText={text => { setRelabelSuggestion(text); setHasInsisted(false); setRelabelDisagreement(null); }}
              />
              {relabelDisagreement && (
                <View style={styles.relabelDisagreementBlock}>
                  <Text style={styles.relabelDisagreement}>{relabelDisagreement}</Text>
                  {!hasInsisted && (
                    <TouchableOpacity onPress={handleReinsist} disabled={relabelLoading}>
                      <Text style={styles.overrideLink}>I'm still certain — override</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <View style={styles.relabelActions}>
                <TouchableOpacity
                  style={styles.relabelCheckButton}
                  onPress={handleRelabel}
                  disabled={relabelLoading || !relabelSuggestion.trim()}
                >
                  {relabelLoading
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={styles.relabelCheckButtonText}>Check</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.relabelCancelButton}
                  onPress={() => { setRelabelMode(false); setRelabelDisagreement(null); setRelabelSuggestion(''); }}
                >
                  <Text style={styles.relabelCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {displayEntryNumber && (
            <Text style={styles.entryNumber}>#{displayEntryNumber} worldwide</Text>
          )}

          {displayEntryNumber && displayEntryNumber > 1 && (
            <Text style={styles.foundByText}>
              Found by {displayEntryNumber - 1} explorer{displayEntryNumber - 1 === 1 ? '' : 's'} worldwide
            </Text>
          )}

          {displayEntryNumber && getDiscoveryBadge(displayEntryNumber) && (
            <View style={styles.discoveryCard}>
              <Text style={styles.discoveryBadgeLabel}>
                {getDiscoveryBadgeLabel(getDiscoveryBadge(displayEntryNumber)!)}
              </Text>
              <Text style={styles.discoverySubtitle}>#{displayEntryNumber} to log this worldwide</Text>
            </View>
          )}

          {displayDescription && (
            <View style={styles.textBlock}>
              <Text style={styles.description}>{displayDescription}</Text>
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

          {displayFunFact && (
            <View style={styles.funFactCard}>
              <Text style={styles.funFactLabel}>Fun Fact</Text>
              <Text style={styles.funFactText}>{displayFunFact}</Text>
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

          {/* Gallery photo tip */}
          {result.entryType === 'gallery' && !tipDismissed && (
            <View style={styles.tipCard}>
              <Text style={styles.tipCardText}>Tip: {PHOTO_TIPS[tipIndex]}</Text>
              <TouchableOpacity onPress={() => setTipDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={14} color="#555" />
              </TouchableOpacity>
            </View>
          )}

          {/* Public / Private toggle */}
          <TouchableOpacity style={styles.visibilityToggle} onPress={togglePublic}>
            <Ionicons
              name={isPublic ? 'earth-outline' : 'lock-closed-outline'}
              size={16}
              color={isPublic ? '#fff' : '#888'}
            />
            <Text style={[styles.visibilityText, !isPublic && styles.visibilityTextPrivate]}>
              {isPublic ? 'Public' : 'Private'}
            </Text>
          </TouchableOpacity>

          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>Add a personal note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="What do you want to remember about this?"
              placeholderTextColor="#555"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={280}
            />
          </View>

          <TouchableOpacity style={[styles.doneButton, isSaving && styles.doneButtonDisabled]} onPress={handleDone} disabled={isSaving}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.discardButton} onPress={handleDiscard} disabled={isSaving}>
            <Text style={styles.discardButtonText}>Discard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {isSaving && <ProcessingOverlay step="saving" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { paddingBottom: 32 },
  photo: { width, height: width, backgroundColor: '#111' },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  name: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 4 },
  category: { fontSize: 13, color: '#666', marginBottom: 4 },
  entryNumber: { fontSize: 13, color: '#888', marginBottom: 4 },
  foundByText: { fontSize: 13, color: '#888', marginBottom: 8 },
  discoveryCard: {
    backgroundColor: '#0d1a0d',
    borderWidth: 1,
    borderColor: '#2ecc71',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  discoveryBadgeLabel: { color: '#2ecc71', fontSize: 13, fontWeight: '700' },
  discoverySubtitle: { color: '#27ae60', fontSize: 12, marginTop: 2 },
  relabelLink: { color: '#444', fontSize: 12, marginBottom: 16, textDecorationLine: 'underline' },
  relabelPanel: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  relabelPanelLabel: { color: '#888', fontSize: 12, fontWeight: '600' },
  relabelInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
  },
  relabelDisagreementBlock: { gap: 6 },
  relabelDisagreement: { color: '#c0392b', fontSize: 13, lineHeight: 18 },
  overrideLink: { color: '#555', fontSize: 12, textDecorationLine: 'underline' },
  relabelActions: { flexDirection: 'row', gap: 10 },
  relabelCheckButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  relabelCheckButtonText: { color: '#000', fontWeight: '700', fontSize: 13 },
  relabelCancelButton: { paddingVertical: 9 },
  relabelCancelText: { color: '#555', fontSize: 13 },
  textBlock: { marginBottom: 16 },
  description: { color: '#ccc', fontSize: 15, lineHeight: 22, marginBottom: 8 },
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
  funFactCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  funFactLabel: { color: '#666', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  funFactText: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  tipCardText: { color: '#555', fontSize: 12, flex: 1 },
  visibilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  visibilityText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  visibilityTextPrivate: { color: '#888' },
  noteSection: { marginBottom: 16 },
  noteLabel: { color: '#555', fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  noteInput: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  doneButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  doneButtonDisabled: { opacity: 0.4 },
  doneButtonText: { color: '#000', fontWeight: '700', fontSize: 16 },
  discardButton: {
    alignItems: 'center',
    marginBottom: 32,
  },
  discardButtonText: { color: '#444', fontSize: 13 },
});
