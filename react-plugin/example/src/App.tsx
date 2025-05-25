import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Button, Alert } from 'react-native';
import {
  readReleaseConfig,
  getFileContent,
  getBundlePath,
} from 'react-native-hyperota';

export default function App() {
  const [releaseConfig, setReleaseConfig] = useState<string | undefined>();
  const [bundlePath, setBundlePath] = useState<string | undefined>();
  const [fileContent, setFileContent] = useState<string | undefined>();
  const [isInitialized, setIsInitialized] = useState(false);

  // HyperOTA is initialized in native code (MainApplication.kt for Android, AppDelegate.swift for iOS)
  // This ensures the instance is ready before React Native starts

  useEffect(() => {
    // Test if HyperOTA is initialized by trying to get the bundle path
    getBundlePath()
      .then(() => setIsInitialized(true))
      .catch(() => setIsInitialized(false));
  }, []);

  const handleReadReleaseConfig = async () => {
    try {
      const config = await readReleaseConfig();
      setReleaseConfig(config);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to read release config');
    }
  };

  const handleGetBundlePath = async () => {
    try {
      const path = await getBundlePath();
      setBundlePath(path);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to get bundle path');
    }
  };

  const handleGetFileContent = async () => {
    try {
      const content = await getFileContent('test.js');
      setFileContent(content);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to get file content');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>React Native HyperOTA</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {isInitialized ? '✅ Initialized' : '❌ Not Initialized'}
        </Text>
      </View>

      <View style={styles.section}>
        <Button title="Read Release Config" onPress={handleReadReleaseConfig} />
        {releaseConfig && (
          <Text style={styles.result}>Release Config: {releaseConfig}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Button title="Get Bundle Path" onPress={handleGetBundlePath} />
        {bundlePath && (
          <Text style={styles.result}>Bundle Path: {bundlePath}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Button
          title="Get File Content (test.js)"
          onPress={handleGetFileContent}
        />
        {fileContent && (
          <Text style={styles.result}>File Content: {fileContent}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  statusContainer: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  result: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
});
