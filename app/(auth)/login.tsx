import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Sign in failed', error.message);
    setLoading(false);
  }

  async function handleSignUp() {
    if (!username.trim()) {
      Alert.alert('Username required', 'Please choose a username.');
      return;
    }
    setLoading(true);

    // Pass username as metadata — a DB trigger picks it up and creates the profile row
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim() } },
    });

    if (error) Alert.alert('Sign up failed', error.message);
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>Memoria</Text>
        <Text style={styles.tagline}>Your living life journal</Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'signin' && styles.activeTab]}
            onPress={() => setMode('signin')}
          >
            <Text style={[styles.tabText, mode === 'signin' && styles.activeTabText]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'signup' && styles.activeTab]}
            onPress={() => setMode('signup')}
          >
            <Text style={[styles.tabText, mode === 'signup' && styles.activeTabText]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={mode === 'signin' ? handleSignIn : handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 42, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
  tagline: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 40 },
  tabs: { flexDirection: 'row', marginBottom: 24, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  activeTab: { backgroundColor: '#fff' },
  tabText: { color: '#666', fontWeight: '600' },
  activeTabText: { color: '#000' },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
