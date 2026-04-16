import { useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabBarIcon({ name, focused }: { name: IoniconsName; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 40, height: 40 }}>
      {focused && (
        <View
          style={{
            position: 'absolute',
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(230, 57, 70, 0.18)',
          }}
        />
      )}
      <Ionicons name={name} size={24} color={focused ? '#E63946' : '#8E8E93'} />
    </View>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  // Reserve space for icons (24) + label (14) + paddingTop (8) + gap + bottom inset
  // Web: use generous padding and no explicit height so labels never clip; the
  // home-indicator safe area is covered visually by body::after in +html.tsx.
  // Native: use measured insets so the tab bar lifts above iOS/Android nav bars.
  const TAB_BAR_HEIGHT = 68 + insets.bottom;

  const renderHomeIcon = useCallback(({ focused }: { focused: boolean }) => (
    <TabBarIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
  ), []);

  const renderSearchIcon = useCallback(({ focused }: { focused: boolean }) => (
    <TabBarIcon name={focused ? 'search' : 'search-outline'} focused={focused} />
  ), []);

  const renderProfileIcon = useCallback(({ focused }: { focused: boolean }) => (
    <TabBarIcon name={focused ? 'person' : 'person-outline'} focused={focused} />
  ), []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#E63946',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: isWeb
          ? {
              backgroundColor: '#1C1C1E',
              borderTopColor: '#2C2C2E',
              borderTopWidth: 1,
              paddingTop: 8,
              paddingBottom: 12,
              height: 68,
            }
          : {
              backgroundColor: '#1C1C1E',
              borderTopColor: '#2C2C2E',
              borderTopWidth: 1,
              paddingTop: 8,
              paddingBottom: insets.bottom,
              height: TAB_BAR_HEIGHT,
            },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.rankings'),
          tabBarIcon: renderHomeIcon,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.rate'),
          tabBarIcon: renderSearchIcon,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: renderProfileIcon,
        }}
      />
      {/* Stack screens that hide tab bar */}
      <Tabs.Screen
        name="rate/[placeId]"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="summary/[reviewId]"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
