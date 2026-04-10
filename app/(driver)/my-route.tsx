import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../constants/supabase';
import { useAuth } from '../context/AuthContext';

type Order = {
  id: number;
  task_name: string | null;
  customer: string;
  material: string;
  sender: string | null;
  receiver: string | null;
  load_address: string;
  unload_address: string;
  distance_km: number;
  unit: string;
  company_rate: number;
  driver_rate: number;
  car_number: string | null;
};

export default function MyRouteScreen() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  async function fetchOrders() {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('driver_id', user.id)
        .eq('is_active', true)
        .order('id', { ascending: false });

      if (error) throw error;

      setOrders(data ?? []);
    } catch (err: any) {
      Alert.alert('Ошибка', err?.message ?? 'Не удалось загрузить маршруты');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchOrders();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Загрузка маршрутов...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Мои маршруты</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Text style={styles.refreshButtonText}>Обновить</Text>
        </TouchableOpacity>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Нет активных задач</Text>
          <Text style={styles.emptySubtitle}>Обратитесь к учредителю для получения задания</Text>
        </View>
      ) : (
        orders.map((order) => (
          <View key={order.id} style={styles.card}>
            <View style={styles.cardHeader}>
              {order.task_name ? (
                <Text style={styles.taskName}>{order.task_name}</Text>
              ) : (
                <Text style={styles.taskName}>Задача №{order.id}</Text>
              )}
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Активна</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <InfoRow label="Заказчик" value={order.customer} />
            <InfoRow label="Материал" value={order.material} />

            {order.sender ? (
              <InfoRow label="Отправитель" value={order.sender} />
            ) : null}
            {order.receiver ? (
              <InfoRow label="Получатель" value={order.receiver} />
            ) : null}

            <View style={styles.divider} />

            <InfoRow label="Адрес погрузки" value={order.load_address} />
            <InfoRow label="Адрес выгрузки" value={order.unload_address} />
            <InfoRow label="Расстояние" value={`${order.distance_km} км`} />

            <View style={styles.divider} />

            <InfoRow label="Единица измерения" value={order.unit} />
            <InfoRow
              label="Ставка водителя"
              value={`${order.driver_rate.toLocaleString('ru-RU')} руб. за рейс`}
              highlight
            />

            {order.car_number ? (
              <InfoRow label="Автомобиль" value={order.car_number} />
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  highlight?: boolean;
};

function InfoRow({ label, value, highlight = false }: InfoRowProps) {
  return (
    <View style={infoRowStyles.row}>
      <Text style={infoRowStyles.label}>{label}:</Text>
      <Text style={[infoRowStyles.value, highlight && infoRowStyles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
  },
  label: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  value: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    flex: 2,
    textAlign: 'right',
  },
  valueHighlight: {
    color: '#16a34a',
    fontSize: 14,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6b7280',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  refreshButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
});
