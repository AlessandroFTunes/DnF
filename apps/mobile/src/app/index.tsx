import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { pb } from '../lib/pocketbase';

export default function Home() {
  const [status, setStatus] = useState('verificando…');

  useEffect(() => {
    pb.health
      .check()
      .then(() => setStatus(`conectado em ${pb.baseURL}`))
      .catch(() => setStatus(`sem conexão com ${pb.baseURL}`));
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'DnF' }} />
      <Text>PocketBase: {status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
