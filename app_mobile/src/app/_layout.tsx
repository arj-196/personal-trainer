import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#f7f8fb' },
          headerShadowVisible: false,
          headerTintColor: '#17181c',
          headerTitleStyle: { fontWeight: '800' },
          contentStyle: { backgroundColor: '#f7f8fb' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Personal Trainer' }} />
        <Stack.Screen name="workout/[workspace]/index" options={{ title: 'Workout' }} />
        <Stack.Screen name="workout/[workspace]/start" options={{ title: 'Start Session' }} />
      </Stack>
    </ThemeProvider>
  );
}
