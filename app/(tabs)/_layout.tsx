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
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Контрагенты',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>💰</Text>,
        }}
      />
      <Tabs.Screen
        name="drivers"
        options={{
          title: 'Водители',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Расходы',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>💸</Text>,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Заказы',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="registry"
        options={{
          title: 'Реестр',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📑</Text>,
        }}
      />
      <Tabs.Screen
        name="all-finances"
        options={{
          title: 'Все финансы',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>💼</Text>,
        }}
      />
      <Tabs.Screen
        name="company-settings"
        options={{
          title: 'Компания',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>⚙️</Text>,
        }}
      />

      {/* Скрыты из таббара — открываются через "Все финансы" */}
      <Tabs.Screen
        name="reports"
        options={{ href: null, title: 'Отчёты' }}
      />
      <Tabs.Screen
        name="salary"
        options={{ href: null, title: 'Зарплата' }}
      />
      <Tabs.Screen
        name="finance"
        options={{ href: null, title: 'Финансы' }}
      />
      <Tabs.Screen
        name="taxes"
        options={{ href: null, title: 'Налоги' }}
      />
    </Tabs>
  );
}
