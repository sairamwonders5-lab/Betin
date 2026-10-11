import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_WEBSITES = [
  'https://betin247.com',
  'https://diamond247.com',
  'https://allpanel.com',
];

export default function App() {
  // Config state
  const [serverUrl, setServerUrl] = useState('https://betin247-production.up.railway.app');
  const [websiteUrl, setWebsiteUrl] = useState('https://betin247.com');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberConfig, setRememberConfig] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [isSenderMode, setIsSenderMode] = useState(true);
  const [serverHealth, setServerHealth] = useState<'idle' | 'testing' | 'online' | 'offline'>('idle');

  // Target Accounts (15 to 30 IDs)
  const [accountCount, setAccountCount] = useState(25);
  const [activeReceivers, setActiveReceivers] = useState(25);

  // Execution state
  const [statusText, setStatusText] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);

  const webViewRef = useRef<WebView>(null);

  // Test Railway Connection
  const testServerConnection = async () => {
    setServerHealth('testing');
    try {
      const res = await fetch(`${serverUrl.trim()}/health`);
      const data = await res.json();
      if (data.status === 'ok') {
        setServerHealth('online');
        setActiveReceivers(data.activeReceivers || 0);
        Alert.alert('Server Connected', `Status: Online\nActive Receivers: ${data.activeReceivers}\nActive Senders: ${data.activeSenders}`);
      } else {
        setServerHealth('offline');
      }
    } catch (err: any) {
      setServerHealth('offline');
      Alert.alert('Connection Failed', `Cannot reach ${serverUrl}:\n${err.message}`);
    }
  };

  // Load saved credentials & prefs
  useEffect(() => {
    (async () => {
      try {
        const savedServer = await AsyncStorage.getItem('bi247_server_url');
        const savedUrl = await AsyncStorage.getItem('bi247_last_url');
        const savedUser = await AsyncStorage.getItem('bi247_user');
        const savedPass = await AsyncStorage.getItem('bi247_pass');
        const savedRemember = await AsyncStorage.getItem('bi247_remember');

        if (savedServer) setServerUrl(savedServer);
        if (savedUrl) setWebsiteUrl(savedUrl);
        if (savedUser && savedPass) {
          setUsername(savedUser);
          setPassword(savedPass);
          setIsSaved(true);
        }
        if (savedRemember !== null) setRememberConfig(savedRemember === 'true');

        // Request location permission like APK
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          setGpsCoords({
            lat: loc.coords.latitude,
            lon: loc.coords.longitude,
          });
        }
      } catch (e) {
        console.warn('Error loading preferences:', e);
      }
    })();
  }, []);

  const handleSaveCredentials = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Required', 'Please enter both username and password');
      return;
    }

    try {
      if (rememberConfig) {
        await AsyncStorage.setItem('bi247_server_url', serverUrl);
        await AsyncStorage.setItem('bi247_user', username);
        await AsyncStorage.setItem('bi247_pass', password);
        await AsyncStorage.setItem('bi247_last_url', websiteUrl);
        await AsyncStorage.setItem('bi247_remember', 'true');
      } else {
        await AsyncStorage.multiRemove(['bi247_user', 'bi247_pass']);
      }
      setIsSaved(true);
      setStatusText('Credentials and Server configured');
    } catch (e) {
      console.warn('Error saving credentials:', e);
    }
  };

  const handleLaunchExchange = () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing Details', 'Please enter and save credentials before launch');
      return;
    }
    setIsLoading(true);
    setStatusText('Preparing engine and loading exchange...');
    setShowWebView(true);
  };

  // Injected JS script to configure proprietary server and load patch
  const cleanServerUrl = serverUrl.trim().replace(/\/$/, '');
  const wsUrl = cleanServerUrl.replace(/^http/, 'ws');
  const injectionScript = `
    (function() {
      window.PROPRIETARY_SERVER_URL = '${cleanServerUrl}';
      window.PROPRIETARY_WS_URL = '${wsUrl}';
      window.someData = {
        username: '${username}',
        password: '${password}',
        website: 'betin247',
        isSender: ${isSenderMode}
      };
      ${
        gpsCoords
          ? `if (typeof window.updateGeoInfo === 'function') {
              window.updateGeoInfo({ lat: ${gpsCoords.lat}, lon: ${gpsCoords.lon} });
            }`
          : ''
      }
      if (!window.__betin247Bootstrapped) {
        var s = document.createElement('script');
        s.src = '${cleanServerUrl}/injector/betin247-patch.js?v=' + Date.now();
        document.head.appendChild(s);
      }
    })();
    true;
  `;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1d" />

      {/* Main Configuration Screen */}
      {!showWebView ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>BI</Text>
            </View>
            <Text style={styles.appTitle}>BI247 SENDER ENGINE</Text>
            <Text style={styles.appSubtitle}>
              Multi-Account Instant Bet Placement System (1 to {accountCount} IDs)
            </Text>
          </View>

          {/* Railway Cloud Server Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>RAILWAY CLOUD SERVER</Text>
            <TextInput
              style={styles.input}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://your-app.up.railway.app"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  serverHealth === 'online' && { borderColor: '#22c55e', backgroundColor: '#064e3b' },
                  serverHealth === 'offline' && { borderColor: '#ef4444', backgroundColor: '#7f1d1d' },
                ]}
                onPress={testServerConnection}
              >
                <Text style={[styles.presetText, { color: '#f8fafc', fontWeight: '700' }]}>
                  {serverHealth === 'testing' ? '⏳ Testing...' : serverHealth === 'online' ? '✅ Server Online' : serverHealth === 'offline' ? '❌ Offline (Retry)' : '⚡ Test Connection'}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: '#94a3b8' }}>
                Active Workers: <Text style={{ color: '#60a5fa', fontWeight: '700' }}>{activeReceivers}</Text>
              </Text>
            </View>
          </View>

          {/* Mode Selector Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>MODE CONFIGURATION</Text>
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.modeTitle}>
                  {isSenderMode ? 'SENDER (Master Account)' : 'RECEIVER (Worker Account)'}
                </Text>
                <Text style={styles.modeDescription}>
                  {isSenderMode
                    ? `Places 1-click bet and dispatches to ${accountCount} worker IDs`
                    : 'Listens for Sender signals and auto-executes bets'}
                </Text>
              </View>
              <Switch
                value={isSenderMode}
                onValueChange={setIsSenderMode}
                trackColor={{ false: '#374151', true: '#1d4ed8' }}
                thumbColor={isSenderMode ? '#60a5fa' : '#9ca3af'}
              />
            </View>
          </View>

          {/* Website Selection Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>EXCHANGE WEBSITE URL</Text>
            <TextInput
              style={styles.input}
              value={websiteUrl}
              onChangeText={setWebsiteUrl}
              placeholder="https://..."
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.presetRow}>
              {DEFAULT_WEBSITES.map((url) => (
                <TouchableOpacity
                  key={url}
                  style={[
                    styles.presetBtn,
                    websiteUrl === url && styles.presetBtnActive,
                  ]}
                  onPress={() => setWebsiteUrl(url)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      websiteUrl === url && styles.presetTextActive,
                    ]}
                  >
                    {url.replace('https://', '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Credentials Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeader}>EXCHANGE ACCOUNT CREDENTIALS</Text>

            {!isSaved ? (
              <View>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter exchange username"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter exchange password"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                />

                <View style={styles.checkboxRow}>
                  <Switch
                    value={rememberConfig}
                    onValueChange={setRememberConfig}
                    trackColor={{ false: '#374151', true: '#2563eb' }}
                  />
                  <Text style={styles.checkboxText}>Remember credentials on this device</Text>
                </View>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleSaveCredentials}
                >
                  <Text style={styles.primaryBtnText}>SAVE CREDENTIALS</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.savedCard}>
                <View style={styles.savedInfoRow}>
                  <Text style={styles.savedLabel}>Active User:</Text>
                  <Text style={styles.savedValue}>{username}</Text>
                </View>
                <View style={styles.savedInfoRow}>
                  <Text style={styles.savedLabel}>Password:</Text>
                  <Text style={styles.savedValue}>••••••••••••</Text>
                </View>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setIsSaved(false)}
                >
                  <Text style={styles.editBtnText}>Edit Credentials</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Multi-Account Target Slider/Selector (For Sender) */}
          {isSenderMode && (
            <View style={styles.card}>
              <Text style={styles.cardHeader}>MULTI-ID BET DISPATCH TARGET</Text>
              <View style={styles.accountSelectorRow}>
                {[15, 20, 25, 30].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[
                      styles.accountNumBtn,
                      accountCount === num && styles.accountNumBtnActive,
                    ]}
                    onPress={() => {
                      setAccountCount(num);
                      setActiveReceivers(num);
                    }}
                  >
                    <Text
                      style={[
                        styles.accountNumText,
                        accountCount === num && styles.accountNumTextActive,
                      ]}
                    >
                      {num} IDs
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.accountNotice}>
                ⚡ Single bet click executes across all {accountCount} IDs simultaneously in &lt;150ms!
              </Text>
            </View>
          )}

          {/* Status & Launch */}
          <View style={styles.statusSection}>
            <Text style={styles.statusText}>Status: {statusText}</Text>
            {isLoading && <ActivityIndicator color="#3b82f6" style={{ marginVertical: 8 }} />}

            <TouchableOpacity
              style={styles.launchBtn}
              onPress={handleLaunchExchange}
            >
              <Text style={styles.launchBtnText}>
                🚀 LAUNCH {isSenderMode ? 'SENDER' : 'RECEIVER'} ENGINE
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        /* In-App Live Exchange View */
        <View style={styles.webViewContainer}>
          <View style={styles.webNavBar}>
            <TouchableOpacity
              style={styles.webBackBtn}
              onPress={() => setShowWebView(false)}
            >
              <Text style={styles.webBackBtnText}>✕ Exit Session</Text>
            </TouchableOpacity>
            <Text style={styles.webNavTitle}>
              {isSenderMode ? `SENDER [1 ➔ ${accountCount} IDs]` : 'RECEIVER'}
            </Text>
            <View style={styles.activeDot} />
          </View>

          <WebView
            ref={webViewRef}
            source={{ uri: websiteUrl }}
            style={styles.webView}
            injectedJavaScriptBeforeContentLoaded={injectionScript}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            geolocationEnabled={true}
            allowsInlineMediaPlayback={true}
            userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 BI247/1.0"
            onLoadStart={() => setStatusText('Loading exchange...')}
            onLoadEnd={() => {
              setIsLoading(false);
              setStatusText('Connected');
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginVertical: 18,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  logoBadgeText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60a5fa',
    letterSpacing: 1,
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  modeDescription: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    maxWidth: 240,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 14,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  presetBtnActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a8a',
  },
  presetText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#93c5fd',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
  },
  checkboxText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  primaryBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  savedCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
  },
  savedInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  savedLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  savedValue: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '700',
  },
  editBtn: {
    marginTop: 6,
    alignItems: 'center',
  },
  editBtnText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: '600',
  },
  accountSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  accountNumBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  accountNumBtnActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  accountNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  accountNumTextActive: {
    color: '#60a5fa',
  },
  accountNotice: {
    fontSize: 11,
    color: '#a7f3d0',
    marginTop: 10,
    fontWeight: '500',
  },
  statusSection: {
    marginTop: 8,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  launchBtn: {
    backgroundColor: '#059669',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  launchBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webNavBar: {
    height: 48,
    backgroundColor: '#111827',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  webBackBtn: {
    padding: 6,
  },
  webBackBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  webNavTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  webView: {
    flex: 1,
  },
});
