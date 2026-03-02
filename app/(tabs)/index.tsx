import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  PanResponder,
} from 'react-native';
import ProcessingOverlay from '@/components/ProcessingOverlay';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { identifyAndEnrich } from '@/lib/mistral';
import { findEntry } from '@/lib/catches';
import { setPendingCatch } from '@/lib/catchStore';
import type { CatchResult } from '@/lib/types';
import type { RarityTier } from '@/constants/taxonomy';

type ProcessingStep = 'identifying' | null;

const PHOTO_TIPS = [
  'Step back to show more context',
  'Include packaging or labels if available',
  'Try better lighting or avoid harsh shadows',
  'Photograph from a different angle',
];

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(false);
  const [processing, setProcessing] = useState<ProcessingStep>(null);
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  // Pinch-to-zoom
  const zoomRef = useRef(0);
  const [zoom, setZoom] = useState(0);
  const lastPinchDistance = useRef<number | null>(null);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: evt => evt.nativeEvent.touches.length === 2,
    onMoveShouldSetPanResponder: evt => evt.nativeEvent.touches.length === 2,
    onPanResponderMove: evt => {
      const touches = evt.nativeEvent.touches;
      if (touches.length !== 2) return;
      const dx = touches[0].pageX - touches[1].pageX;
      const dy = touches[0].pageY - touches[1].pageY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDistance.current !== null) {
        const delta = (dist - lastPinchDistance.current) / 400;
        zoomRef.current = Math.max(0, Math.min(1, zoomRef.current + delta));
        setZoom(zoomRef.current);
      }
      lastPinchDistance.current = dist;
    },
    onPanResponderRelease: () => { lastPinchDistance.current = null; },
    onPanResponderTerminate: () => { lastPinchDistance.current = null; },
  })).current;

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      setLocationPermission(status === 'granted');
    });
  }, []);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access is required to use Memoria.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleCapture() {
    if (!cameraRef.current || processing) return;
    setRejectedMessage(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.6,
        exif: false,
      });

      if (!photo?.base64 || !photo?.uri) throw new Error('Photo capture failed');

      // Get location in parallel with Mistral (fire and forget, best-effort)
      const locationPromise = locationPermission
        ? Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            .then(async loc => {
              const geocode = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              });
              return {
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
                country: geocode[0]?.isoCountryCode ?? null,
              };
            })
            .catch(() => ({ lat: null, lng: null, country: null }))
        : Promise.resolve({ lat: null, lng: null, country: null });

      // Single Mistral call: identify + description + fun_fact
      setProcessing('identifying');
      const [vision, location] = await Promise.all([
        identifyAndEnrich(photo.base64),
        locationPromise,
      ]);

      if (vision.entry_type === 'rejected') {
        setProcessing(null);
        setRejectedMessage(
          "This couldn't be added to your Memoria. It may be too common, too difficult to identify clearly, or simply not something we currently track."
        );
        return;
      }

      const { lat, lng, country } = location;

      // Read-only entry lookup for provisional stats (no DB writes)
      let provisionalEntryNumber: number | null = null;
      let provisionalRarityTier: RarityTier | null = null;
      if (vision.entry_type === 'identified' && vision.name) {
        const existingEntry = await findEntry(vision.name, vision.subcategory!);
        if (existingEntry) {
          provisionalEntryNumber = existingEntry.total_catches + 1;
          provisionalRarityTier = existingEntry.rarity_tier;
        } else {
          provisionalEntryNumber = 1;
          provisionalRarityTier = 'legendary';
        }
      }

      const catchResult: CatchResult = {
        entryType: vision.entry_type as 'identified' | 'gallery',
        photoUri: photo.uri,
        photoBase64: photo.base64!,
        name: vision.name,
        category: vision.category!,
        subcategory: vision.subcategory!,
        description: vision.description,
        funFact: vision.fun_fact ?? null,
        isEndangered: vision.is_endangered,
        lat,
        lng,
        country,
        provisionalEntryNumber,
        provisionalRarityTier,
      };

      setProcessing(null);
      setPendingCatch(catchResult);
      router.push('/result');
    } catch (err) {
      setProcessing(null);
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Error', message);
    }
  }

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef} flash={flashMode} zoom={zoom} />

      {/* Flash toggle */}
      {!processing && !rejectedMessage && (
        <TouchableOpacity
          style={styles.flashButton}
          onPress={() => setFlashMode(f => f === 'off' ? 'on' : 'off')}
        >
          <Ionicons
            name={flashMode === 'on' ? 'flash' : 'flash-off-outline'}
            size={22}
            color={flashMode === 'on' ? '#fff' : 'rgba(255,255,255,0.35)'}
          />
        </TouchableOpacity>
      )}

      {processing && <ProcessingOverlay step={processing} />}

      {rejectedMessage && !processing && (
        <View style={styles.rejectedContainer}>
          <Text style={styles.rejectedText}>{rejectedMessage}</Text>
          <View style={styles.tipsList}>
            {PHOTO_TIPS.map(tip => (
              <View key={tip} style={styles.tipRow}>
                <Text style={styles.tipBullet}>·</Text>
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={() => setRejectedMessage(null)} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!processing && !rejectedMessage && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.captureButton} onPress={handleCapture} activeOpacity={0.8}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  flashButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectedContainer: {
    position: 'absolute',
    bottom: 130,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  rejectedText: { color: '#ccc', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  tipsList: { alignSelf: 'stretch', gap: 4 },
  tipRow: { flexDirection: 'row', gap: 6 },
  tipBullet: { color: '#555', fontSize: 13 },
  tipText: { color: '#666', fontSize: 12, flex: 1, lineHeight: 18 },
  retryButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryButtonText: { color: '#000', fontWeight: '700' },
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionText: { color: '#fff', fontSize: 16, textAlign: 'center', marginBottom: 24 },
  permissionButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  permissionButtonText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
