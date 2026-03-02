import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

const MESSAGES: Record<'identifying' | 'saving', string[]> = {
  identifying: [
    'Scanning image...',
    'Recognizing patterns...',
    'Searching the global index...',
    'Cross-referencing species...',
    'Analyzing details...',
    'Almost there...',
  ],
  saving: [
    'Logging your discovery...',
    'Checking who was first...',
    'Updating the global index...',
    'Saving to Memoria...',
  ],
};

interface Props {
  step: 'identifying' | 'saving';
}

export default function ProcessingOverlay({ step }: Props) {
  const [messageIndex, setMessageIndex] = useState(0);
  const messageOpacity = useRef(new Animated.Value(1)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  // Reset message index when step changes
  useEffect(() => {
    setMessageIndex(0);
  }, [step]);

  // Scan line sweeping up and down
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 2200,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Rotating ring
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ringRotation, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Pulse scale on the ring
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.08,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Staggered bouncing dots
  useEffect(() => {
    function makeDotAnim(dot: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );
    }
    const a1 = makeDotAnim(dot1, 0);
    const a2 = makeDotAnim(dot2, 200);
    const a3 = makeDotAnim(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  // Cycle messages with fade
  useEffect(() => {
    const messages = MESSAGES[step];
    const interval = setInterval(() => {
      Animated.timing(messageOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setMessageIndex(i => (i + 1) % messages.length);
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }, 2400);
    return () => clearInterval(interval);
  }, [step]);

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-height * 0.25, height * 0.25],
  });

  const ringDeg = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const messages = MESSAGES[step];

  return (
    <View style={styles.container}>
      {/* Scan line */}
      <Animated.View
        style={[
          styles.scanLine,
          { transform: [{ translateY: scanTranslateY }] },
        ]}
        pointerEvents="none"
      />

      {/* Center content */}
      <View style={styles.center}>
        {/* Rotating ring with pulse */}
        <Animated.View style={[styles.ringWrapper, { transform: [{ scale: pulseScale }] }]}>
          <Animated.View style={[styles.ring, { transform: [{ rotate: ringDeg }] }]} />
          <View style={styles.ringInnerDot} />
        </Animated.View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { opacity: dot1 }]} />
          <Animated.View style={[styles.dot, { opacity: dot2 }]} />
          <Animated.View style={[styles.dot, { opacity: dot3 }]} />
        </View>

        {/* Cycling message */}
        <Animated.Text style={[styles.message, { opacity: messageOpacity }]}>
          {messages[messageIndex]}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject as object,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  center: {
    alignItems: 'center',
    gap: 20,
  },
  ringWrapper: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopColor: '#fff',
    borderRightColor: 'rgba(255,255,255,0.4)',
  },
  ringInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    opacity: 0.8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  message: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
