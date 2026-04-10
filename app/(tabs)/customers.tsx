import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addCustomerPayment, getCustomerPaymentHistory, getCustomersWithDebt } from '../constants/queries';

export default function CustomersScreen() {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentComment, setPaymentComment] = useState('');
  const [customerPayments, setCustomerPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    filterCustomers();
  }, [searchQuery, customers]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await getCustomersWithDebt();
      setCustomers(data);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить контрагентов');
    } finally {
      setLoading(false);
    }
  };

  const filterCustomers = () => {
    if (!searchQuery.trim()) {
      setFilteredCustomers(customers);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = customers.filter((c) => c.name.toLowerCase().includes(query));
      setFilteredCustomers(filtered);
    }
  };

  const handleCustomerPress = (customer) => {
    setSelectedCustomer(customer);
    setModalVisible(true);
  };

  const handleAddPayment = () => {
    setPaymentAmount('');
    setPaymentComment('');
    setPaymentModalVisible(true);
    setModalVisible(false);
  };

  const handleViewHistory = async () => {
    if (!selectedCustomer) return;
    try {
      const payments = await getCustomerPaymentHistory(selectedCustomer.name);
      setCustomerPayments(payments);
      setHistoryModalVisible(true);
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить историю платежей');
    }
  };

  const submitPayment = async () => {
    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму');
      return;
    }
    try {
      await addCustomerPayment(selectedCustomer.name, amount, paymentComment);
      Alert.alert('Успешно', 'Платёж сохранён');
      setPaymentModalVisible(false);
      // Обновить данные (пока просто имитация)
      const updatedCustomers = customers.map((c) =>
        c.id === selectedCustomer?.id
          ? { ...c, paid: c.paid + amount, debt: c.debt - amount }
          : c
      );
      setCustomers(updatedCustomers);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить платёж');
    }
  };

  const getDebtColor = (debt) => {
    if (debt === 0) return '#10b981';
    if (debt < 50000) return '#f59e0b';
    return '#ef4444';
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  };

  const renderCustomer = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleCustomerPress(item)}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: '#2563eb' }]}>
          <Text style={styles.avatarText}>{item.name[0]}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.customerName}>{item.name}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Выручка</Text>
              <Text style={styles.statValue}>{formatMoney(item.revenue)} ₽</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Оплачено</Text>
              <Text style={[styles.statValue, { color: '#10b981' }]}>{formatMoney(item.paid)} ₽</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Долг</Text>
              <Text style={[styles.statValue, { color: getDebtColor(item.debt) }]}>{formatMoney(item.debt)} ₽</Text>
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Контрагенты</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск контрагента..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.statsOverview}>
        <Text style={styles.statsOverviewTitle}>Общая статистика</Text>
        <View style={styles.statsOverviewRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statBlockLabel}>Выручка</Text>
            <Text style={styles.statBlockValue}>
              {formatMoney(customers.reduce((sum, c) => sum + c.revenue, 0))} ₽
            </Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statBlockLabel}>Оплачено</Text>
            <Text style={[styles.statBlockValue, { color: '#10b981' }]}>
              {formatMoney(customers.reduce((sum, c) => sum + c.paid, 0))} ₽
            </Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statBlockLabel}>Долг</Text>
            <Text style={[styles.statBlockValue, { color: '#ef4444' }]}>
              {formatMoney(customers.reduce((sum, c) => sum + c.debt, 0))} ₽
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomer}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text style={styles.emptyText}>Контрагенты не найдены</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedCustomer?.name}</Text>
            <View style={styles.modalStats}>
              <View style={styles.modalStatRow}>
                <Text>Выручка:</Text>
                <Text style={styles.modalStatValue}>{formatMoney(selectedCustomer?.revenue || 0)} ₽</Text>
              </View>
              <View style={styles.modalStatRow}>
                <Text>Оплачено:</Text>
                <Text style={[styles.modalStatValue, { color: '#10b981' }]}>{formatMoney(selectedCustomer?.paid || 0)} ₽</Text>
              </View>
              <View style={styles.modalStatRow}>
                <Text>Задолженность:</Text>
                <Text style={[styles.modalStatValue, { color: getDebtColor(selectedCustomer?.debt || 0) }]}>
                  {formatMoney(selectedCustomer?.debt || 0)} ₽
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.modalButton} onPress={handleAddPayment}>
              <Ionicons name="cash" size={20} color="white" />
              <Text style={styles.modalButtonText}>Внести оплату</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#3b82f6' }]} onPress={handleViewHistory}>
              <Ionicons name="time" size={20} color="white" />
              <Text style={styles.modalButtonText}>История платежей</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCancelText}>Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={paymentModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Внести оплату</Text>
            <Text style={styles.modalSubtitle}>{selectedCustomer?.name}</Text>

            <TextInput
              style={styles.input}
              placeholder="Сумма (₽)"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />

            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Комментарий (необязательно)"
              multiline
              value={paymentComment}
              onChangeText={setPaymentComment}
            />

            <TouchableOpacity style={styles.saveButton} onPress={submitPayment}>
              <Text style={styles.saveButtonText}>Сохранить</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setPaymentModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={historyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>История платежей</Text>
            <Text style={styles.modalSubtitle}>{selectedCustomer?.name}</Text>

            <FlatList
              data={customerPayments}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.paymentItem}>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentDate}>{item.payment_date}</Text>
                    <Text style={styles.paymentAmount}>{formatMoney(item.amount)} ₽</Text>
                  </View>
                  {item.comment ? <Text style={styles.paymentComment}>{item.comment}</Text> : null}
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>Нет платежей</Text>}
            />

            <TouchableOpacity style={styles.modalCancel} onPress={() => setHistoryModalVisible(false)}>
              <Text style={styles.modalCancelText}>Закрыть</Text>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  statsOverview: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statsOverviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBlock: {
    alignItems: 'center',
  },
  statBlockLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  statBlockValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
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
    minHeight: 300,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 16,
  },
  modalStats: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalStatValue: {
    fontWeight: '600',
  },
  modalButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalCancel: {
    alignItems: 'center',
    padding: 14,
    marginTop: 8,
  },
  modalCancelText: {
    color: '#6b7280',
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
  paymentItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  paymentDate: {
    color: '#4b5563',
  },
  paymentAmount: {
    fontWeight: '600',
    color: '#10b981',
  },
  paymentComment: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 4,
  },
});