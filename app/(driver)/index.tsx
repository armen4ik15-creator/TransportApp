import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../constants/supabase';

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
  const { user, profile, signOut } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchActiveOrder();
    }
  }, [user]);

  async function fetchActiveOrder() {
    if (!user) return;
    setLoading(true);
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
    setLoading(false);
  }

  const handleSignOut = () => {
    signOut();
  };

  const handleLoading = () => {
    if (!order) {
      Alert.alert('Нет активной задачи', 'Сначала получите задачу от учредителя');
      return;
    }
    router.push({
      pathname: '/(driver)/trip-form',
      params: { orderId: order.id, stage: 'loading', unit: order.unit }
    });
  };

  const handleUnloading = () => {
    if (!order) {
      Alert.alert('Нет активной задачи', 'Сначала получите задачу от учредителя');
      return;
    }
    router.push({
      pathname: '/(driver)/trip-form',
      params: { orderId: order.id, stage: 'unloading', unit: order.unit }
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Добро пожаловать, {profile?.full_name || user?.email}!</Text>
        <Text style={styles.car}>Машина: {profile?.car_number || 'не указана'}</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
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
        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/(driver)/my-route')}>
          <Text style={styles.navButtonText}>📋 Мой маршрут</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/(driver)/fuel')}>
          <Text style={styles.navButtonText}>⛽ Заправка</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/(driver)/earnings')}>
          <Text style={styles.navButtonText}>💰 Заработок</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  welcome: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  car: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  logoutText: {
    color: 'white',
    fontWeight: 'bold',
  },
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  value: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 4,
  },
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
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  noOrderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  noOrderText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noOrderSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  navButtons: {
    marginTop: 20,
    gap: 10,
  },
  navButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});