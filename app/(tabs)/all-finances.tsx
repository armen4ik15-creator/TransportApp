import { router } from 'expo-router';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';

const FINANCE_SECTIONS = [
  {
    title: 'Отчёты',
    subtitle: 'Лист2, Лист3, Excel экспорт',
    icon: '📊',
    color: '#2563eb',
    bg: '#eff6ff',
    route: '/(tabs)/reports',
  },
  {
    title: 'Зарплата',
    subtitle: 'Начисления, выплаты водителям',
    icon: '💵',
    color: '#16a34a',
    bg: '#f0fdf4',
    route: '/(tabs)/salary',
  },
  {
    title: 'Финансы',
    subtitle: 'Выручка, расходы, прибыль',
    icon: '📈',
    color: '#7c3aed',
    bg: '#f5f3ff',
    route: '/(tabs)/finance',
  },
  {
    title: 'Налоги',
    subtitle: 'УСН, ОСН, расчёт и платежи',
    icon: '🏛',
    color: '#dc2626',
    bg: '#fef2f2',
    route: '/(tabs)/taxes',
  },
];

export default function AllFinancesScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Все финансы</Text>
        <Text style={styles.subtitle}>Выберите раздел</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {FINANCE_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.route}
            style={[styles.card, { backgroundColor: section.bg, borderLeftColor: section.color }]}
            onPress={() => router.push(section.route as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>{section.icon}</Text>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: section.color }]}>{section.title}</Text>
              <Text style={styles.cardSubtitle}>{section.subtitle}</Text>
            </View>
            <Text style={[styles.cardArrow, { color: section.color }]}>→</Text>
          </TouchableOpacity>
        ))}

        {/* Настройки компании */}
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => router.push('/(tabs)/company-settings' as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
          <Text style={styles.settingsText}>Настройки компании и налогообложение</Text>
          <Text style={styles.settingsArrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: { fontSize: 26, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#93c5fd' },
  grid: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 18,
    borderLeftWidth: 5,
    elevation: 2,
    gap: 14,
  },
  cardIcon: { fontSize: 32 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 3 },
  cardSubtitle: { fontSize: 13, color: '#6b7280' },
  cardArrow: { fontSize: 20, fontWeight: 'bold' },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    elevation: 1,
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  settingsIcon: { fontSize: 24 },
  settingsText: { flex: 1, fontSize: 15, color: '#374151', fontWeight: '500' },
  settingsArrow: { fontSize: 18, color: '#9ca3af' },
});
