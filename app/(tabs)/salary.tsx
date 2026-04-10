import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  addDriverPayment,
  getDriverEarnings,
  getDriverPayments,
  getDrivers,
} from '../constants/queries';

interface Driver {
  id: string;
  full_name: string;
  car_number: string;
}

interface DriverSalary {
  driver: Driver;
  earned: number;
  paid: number;
  debt: number;
}

export default function SalaryScreen() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [salaries, setSalaries] = useState<DriverSalary[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [paymentType, setPaymentType] = useState<'salary' | 'advance' | 'bonus'>('salary');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedDriverHistory, setSelectedDriverHistory] = useState<any[]>([]);
  const [historyDriverName, setHistoryDriverName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const driversData = await getDrivers();
      setDrivers(driversData);

      // Загружаем данные о заработке и выплатах для каждого водителя
      const salaryData: DriverSalary[] = await Promise.all(
        driversData.map(async (driver: Driver) => {
          const earned = await getDriverEarnings(driver.id);
          const payments = await getDriverPayments(driver.id);
          const paid = payments.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
          return {
            driver,
            earned,
            paid,
            debt: earned - paid,
          };
        })
      );
      setSalaries(salaryData);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (driver: Driver, type: 'salary' | 'advance' | 'bonus') => {
    setSelectedDriver(driver);
    setPaymentType(type);
    setAmount('');
    setComment('');
    setModalVisible(true);
  };

  const handlePayment = async () => {
    if (!selectedDriver) return;
    const amountNum = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму');
      return;
    }

    try {
      await addDriverPayment({
        driver_id: selectedDriver.id,
        amount: amountNum,
        payment_type: paymentType,
        comment: comment.trim() || null,
      });
      Alert.alert('Успех', 'Платёж сохранён');
      setModalVisible(false);
      loadData(); // перезагрузить данные
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить платёж');
    }
  };

  const openHistory = async (driver: Driver) => {
    try {
      const payments = await getDriverPayments(driver.id);
      setSelectedDriverHistory(payments);
      setHistoryDriverName(driver.full_name);
      setHistoryModalVisible(true);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить историю');
    }
  };

  const renderSalaryCard = ({ item }: { item: DriverSalary }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.driver.full_name[0]}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.driverName}>{item.driver.full_name}</Text>
          <Text style={styles.driverCar}>{item.driver.car_number}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Заработано</Text>
          <Text style={styles.statValue}>{item.earned.toFixed(2)} ₽</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Выплачено</Text>
          <Text style={styles.statValue}>{item.paid.toFixed(2)} ₽</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Долг</Text>
          <Text style={[styles.statValue, item.debt > 0 ? styles.debtNegative : styles.debtZero]}>
            {item.debt.toFixed(2)} ₽
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.salaryBtn]}
          onPress={() => openPaymentModal(item.driver, 'salary')}
        >
          <Text style={styles.actionBtnText}>Выплатить зарплату</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.advanceBtn]}
          onPress={() => openPaymentModal(item.driver, 'advance')}
        >
          <Text style={styles.actionBtnText}>Аванс</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.bonusBtn]}
          onPress={() => openPaymentModal(item.driver, 'bonus')}
        >
          <Text style={styles.actionBtnText}>Премия</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.historyBtn]}
          onPress={() => openHistory(item.driver)}
        >
          <Ionicons name="time-outline" size={20} color="white" />
          <Text style={styles.actionBtnText}>История</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const getPaymentTypeName = (type: string) => {
    switch (type) {
      case 'salary': return 'Зарплата';
      case 'advance': return 'Аванс';
      case 'bonus': return 'Премия';
      default: return type;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Зарплата водителей</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={salaries}
        renderItem={renderSalaryCard}
        keyExtractor={(item) => item.driver.id.toString()}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Нет водителей</Text>
        }
      />

      {/* Модальное окно для выплаты */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {getPaymentTypeName(paymentType)} для {selectedDriver?.full_name}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Сумма (₽)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Комментарий (необязательно)"
              multiline
              value={comment}
              onChangeText={setComment}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handlePayment}>
              <Text style={styles.saveBtnText}>Сохранить</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модальное окно истории выплат */}
      <Modal visible={historyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>История выплат: {historyDriverName}</Text>
            <FlatList
              data={selectedDriverHistory}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View style={styles.historyRow}>
                    <Text style={styles.historyDate}>{item.payment_date}</Text>
                    <Text style={styles.historyAmount}>{item.amount.toFixed(2)} ₽</Text>
                  </View>
                  <Text style={styles.historyType}>{getPaymentTypeName(item.payment_type)}</Text>
                  {item.comment ? <Text style={styles.historyComment}>{item.comment}</Text> : null}
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Нет выплат</Text>}
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setHistoryModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  back: {
    color: '#2563eb',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  driverCar: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  debtNegative: {
    color: '#ef4444',
  },
  debtZero: {
    color: '#10b981',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    minWidth: 80,
  },
  salaryBtn: {
    backgroundColor: '#2563eb',
  },
  advanceBtn: {
    backgroundColor: '#f59e0b',
  },
  bonusBtn: {
    backgroundColor: '#10b981',
  },
  historyBtn: {
    backgroundColor: '#6b7280',
  },
  actionBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelBtn: {
    padding: 16,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#6b7280',
    fontSize: 16,
  },
  historyItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyDate: {
    color: '#4b5563',
  },
  historyAmount: {
    fontWeight: '600',
    color: '#10b981',
  },
  historyType: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  historyComment: {
    fontSize: 12,
    color: '#9ca3af',
  },
});