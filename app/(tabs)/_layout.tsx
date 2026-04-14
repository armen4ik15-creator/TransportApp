// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#2563eb',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Контрагенты',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>💰</Text>,
        }}
      />
      <Tabs.Screen
        name="drivers"
        options={{
          title: 'Водители',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Расходы',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>💸</Text>,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Заказы',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="registry"
        options={{
          title: 'Реестр',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📑</Text>,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Отчеты',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="salary"
        options={{
          title: 'Зарплата',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>💵</Text>,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Финансы',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📈</Text>,
        }}
      />
      <Tabs.Screen
        name="taxes"
        options={{
          title: 'Налоги',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🏛</Text>,
        }}
      />
      <Tabs.Screen
        name="company-settings"
        options={{
          title: 'Компания',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
