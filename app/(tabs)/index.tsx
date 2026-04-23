import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

const MENU_ITEMS = [
  { title: 'Заказы', subtitle: 'Назначить задачи водителям', icon: '📦', route: '/(tabs)/orders' },
  { title: 'Водители', subtitle: 'Список водителей и машины', icon: '👤', route: '/(tabs)/drivers' },
  { title: 'Контрагенты', subtitle: 'Заказчики и задолженности', icon: '💰', route: '/(tabs)/customers' },
  { title: 'Расходы', subtitle: 'Топливо, ремонт, прочее', icon: '💸', route: '/(tabs)/expenses' },
  { title: 'Реестр', subtitle: 'Все рейсы, экспорт Excel', icon: '📑', route: '/(tabs)/registry' },
  { title: 'Все финансы', subtitle: 'Отчёты, зарплата, налоги', icon: '💼', route: '/(tabs)/all-finances' },
  { title: 'Настройки', subtitle: 'Компания и налогообложение', icon: '⚙️', route: '/(tabs)/company-settings' },
];

export default function HomeScreen() {
  const { user, profile, signOut } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Шапка */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Добро пожаловать!</Text>
          <Text style={styles.name}>{profile?.full_name || user?.email}</Text>
          <Text style={styles.role}>Учредитель</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {/* Меню */}
      <Text style={styles.sectionTitle}>Разделы</Text>
      {MENU_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.route}
          style={styles.card}
          onPress={() => router.push(item.route as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.cardIcon}>{item.icon}</Text>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { paddingBottom: 40 },
  header: {
    backgroundColor: '#1e3a5f',
    padding: 24,
    paddingTop: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: { fontSize: 14, color: '#93c5fd', marginBottom: 2 },
  name: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 2 },
  role: { fontSize: 13, color: '#bfdbfe' },
  logoutBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  logoutText: { color: 'white', fontWeight: '700', fontSize: 14 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 1,
    gap: 12,
  },
  cardIcon: { fontSize: 28 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: '#6b7280' },
  cardArrow: { fontSize: 22, color: '#9ca3af', fontWeight: '300' },
});
