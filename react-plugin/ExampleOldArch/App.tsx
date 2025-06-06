import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import HyperOta from 'react-native-hyperota';

function App(): React.JSX.Element {
  const [releaseConfig, setReleaseConfig] = useState<string>('');
  const [bundlePath, setBundlePath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadReleaseConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const config = await HyperOta.readReleaseConfig();
      setReleaseConfig(JSON.stringify(config, null, 2));
    } catch (e) {
      setError(`Failed to load release config: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const loadBundlePath = async () => {
    try {
      setLoading(true);
      setError('');
      const path = await HyperOta.getBundlePath();
      setBundlePath(path);
    } catch (e) {
      setError(`Failed to get bundle path: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load initial data
    loadReleaseConfig();
    loadBundlePath();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <Text style={styles.title}>HyperOTA Example</Text>
          <Text style={styles.subtitle}>Old Architecture</Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bundle Path</Text>
          <Text style={styles.sectionContent}>
            {loading ? 'Loading...' : bundlePath || 'Not available'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Release Config</Text>
          <Text style={styles.sectionContent}>
            {loading ? 'Loading...' : releaseConfig || 'Not available'}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={loadReleaseConfig}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Reload Config</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={loadBundlePath}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Reload Bundle Path</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
  },
});

export default App;
