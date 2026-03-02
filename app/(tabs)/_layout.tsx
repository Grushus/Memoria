import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarStyle: { backgroundColor: colorScheme === 'dark' ? '#0a0a0a' : '#fff' },
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Camera',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'camera.fill', android: 'camera_alt', web: 'camera_alt' }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="memoria"
        options={{
          title: 'My Memoria',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'book.fill', android: 'menu_book', web: 'menu_book' }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="global"
        options={{
          title: 'Global',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'globe', android: 'language', web: 'language' }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'person.fill', android: 'person', web: 'person' }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
    </Tabs>
  );
}
