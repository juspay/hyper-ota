import React from 'react';
import {StatusBar, StyleSheet, Text,  View} from 'react-native';
import { getBundlePath, readReleaseConfig } from 'react-native-hyper-ota';

function App(): React.JSX.Element {
  const [result, setResult] = React.useState<number>(0);
  React.useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching data...');
      try {
        const res = await getBundlePath();
        console.log('Result:', res);
        setResult(()=>res);
      } catch (error) {
        console.error("cannot read releaseConfig", error);
      }
    };
    fetchData();
  }, []);
  return (
    <View style={styles.sectionContainer}>
      <StatusBar />
      <Text style={styles.sectionTitle}>{result}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
    display: 'flex',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
});

export default App;
