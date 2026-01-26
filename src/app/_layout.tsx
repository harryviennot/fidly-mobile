import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#8B5A2B',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'Scan Loyalty Card',
          }}
        />
        <Stack.Screen
          name="stamp/[id]"
          options={{
            title: 'Add Stamp',
            presentation: 'modal',
          }}
        />
      </Stack>
    </>
  );
}
