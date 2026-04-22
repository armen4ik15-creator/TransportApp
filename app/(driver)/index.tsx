import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../constants/supabase';
import { updateDriverCarNumber } from '../constants/queries';

type Order = {
  id: number;
  task_name: string | null;
  customer: string;
  material: string;
  load_address: string;
  unload_address: string;
  distance_km: number;
  unit: string;
  driver_rate: number;
  sender: string | null;
  receiver: string | null;
};

export default function DriverHome() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);

  // Car-setup state
  const [carNumber, setCarNumber] = useState('');
  const [savingCar, setSavingCar] = useState(false);

  // Only fetch order when car is set
  useEffect(() => {
    if (user && profile?.car_number) {
      fetchActiveOrder();
    } else {
      setLoadingOrder(false);
    }
  }, [user, profile?.car_number]);

  async function fetchActiveOrder() {
    if (!user) return;
    setLoadingOrder(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('driver_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      console.error('Error fetching order:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить задачу');
    } else {
      setOrder(data);
    }
    setLoadingOrder(false);
  }

  const handleSaveCar = async () => {
    const trimmed = carNumber.trim();
    if (!trimmed) {
      Alert.alert('Ошибка', 'Введите госномер автомобиля');
      return;
    }
    if (!user?.id) return;
    setSavingCar(true);
    try {
      await updateDriverCarNumber(user.id, trimmed);
      await refreshProfile(); // reload profile → car_number will be set → re-render main screen
    } catch (err: any) {
      Alert.alert('Ошибка', err?.message ?? 'Не удалось сохранить');
    } finally {
      setSavingCar(false);
    }
  };

  const handleLoading = () => {
    if (!order) {
      Alert.alert('Нет активной задачи', 'Сначала получите задачу от учредителя');
      return;
    }
    router.push({
      pathname: '/(driver)/trip-form',
      params: { orderId: order.id, stage: 'loading', unit: order.unit },
    });
  };

  const handleUnloading = () => {
    if (!order) {
      Alert.alert('Нет активной задачи', 'Сначала получите задачу от учредителя');
      return;
    }
    router.push({
      pathname: '/(driver)/trip-form',
      params: { orderId: order.id, stage: 'unloading', unit: order.unit },
    });
  };

  // ── Profile still loading ────────────────────────────────────────────────────
  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ── No car number: show setup screen ────────────────────────────────────────
  if (!profile.car_number) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.setupContainer}>
          <View style={styles.setupCard}>
            <Text style={styles.setupIcon}>🚛</Text>
            <Text style={styles.setupTitle}>Укажите ваш автомобиль</Text>
            <Text style={styles.setupSubtitle}>
              Введите государственный номер самосвала, на котором вы будете работать.
              После сохранения он будет закреплён за вашим аккаунтом.
            </Text>
            <TextInput
              style={styles.setupInput}
              placeholder="Госномер (Т400ЕХ96)"
              value={carNumber}
              onChangeText={setCarNumber}
              autoCapitalize="characters"
              autoFocus
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity
              style={[styles.setupSaveBtn, savingCar && { backgroundColor: '#93c5fd' }]}
              onPress={handleSaveCar}
              disabled={savingCar}
              activeOpacity={0.85}
            >
              {savingCar ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.setupSaveBtnText}>Сохранить и продолжить</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Main driver screen ───────────────────────────────────────────────────────
  if (loadingOrder) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>
          Добро пожаловать, {profile.full_name || user?.email}!
        </Text>
        <Text style={styles.car}>Машина: {profile.car_number}</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {order ? (
        <View style={styles.orderCard}>
          <Text style={styles.orderTitle}>Ваша активная задача</Text>
          {order.task_name && <Text style={styles.taskName}>{order.task_name}</Text>}
          <Text style={styles.label}>Заказчик:</Text>
          <Text style={styles.value}>{order.customer}</Text>
          <Text style={styles.label}>Материал:</Text>
          <Text style={styles.value}>{order.material}</Text>
          {order.sender && (
            <>
              <Text style={styles.label}>Отправитель:</Text>
              <Text style={styles.value}>{order.sender}</Text>
            </>
          )}
          {order.receiver && (
            <>
              <Text style={styles.label}>Получатель:</Text>
              <Text style={styles.value}>{order.receiver}</Text>
            </>
          )}
          <Text style={styles.label}>Погрузка:</Text>
          <Text style={styles.value}>{order.load_address}</Text>
          <Text style={styles.label}>Выгрузка:</Text>
          <Text style={styles.value}>{order.unload_address}</Text>
          <Text style={styles.label}>Расстояние:</Text>
          <Text style={styles.value}>{order.distance_km} км</Text>
          <Text style={styles.label}>Ед. изм.:</Text>
          <Text style={styles.value}>{order.unit}</Text>
          <Text style={styles.label}>Ставка водителя:</Text>
          <Text style={styles.value}>{order.driver_rate} руб. за рейс</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLoading}>
              <Text style={styles.actionButtonText}>⬆️ Загрузка</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleUnloading}>
              <Text style={styles.actionButtonText}>⬇️ Разгрузка</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.noOrderCard}>
          <Text style={styles.noOrderText}>У вас нет активных задач</Text>
          <Text style={styles.noOrderSubtext}>Обратитесь к учредителю</Text>
        </View>
      )}

      <View style={styles.navButtons}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/(driver)/my-route')}
        >
          <Text style={styles.navButtonText}>📋 Мой маршрут</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/(driver)/fuel')}
        >
          <Text style={styles.navButtonText}>⛽ Заправка</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/(driver)/earnings')}
        >
          <Text style={styles.navButtonText}>💰 Заработок</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f5f5' },

  // Setup screen
  setupContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  setupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  setupIcon: { fontSize: 48, marginBottom: 12 },
  setupTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  setupSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  setupInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#f9fafb',
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 16,
  },
  setupSaveBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    elevation: 2,
  },
  setupSaveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Main screen
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flexGrow: 1, padding: 20, backgroundColor: '#f5f5f5' },
  header: { marginBottom: 20 },
  welcome: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  car: { fontSize: 16, color: '#666', marginBottom: 12 },
  logoutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  logoutText: { color: 'white', fontWeight: 'bold' },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
    marginBottom: 12,
    textAlign: 'center',
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 8 },
  value: { fontSize: 14, color: '#1f2937', marginBottom: 4 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  noOrderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  noOrderText: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  noOrderSubtext: { fontSize: 14, color: '#6b7280' },
  navButtons: { marginTop: 20, gap: 10 },
  navButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  navButtonText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
