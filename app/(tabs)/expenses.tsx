import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addExpense, getDrivers, getExpenses } from '../constants/queries';

interface Expense {
  id: number;
  exp_date: string;
  exp_type: 'fuel' | 'other';
  method: 'cash' | 'noncash';
  amount: number;
  comment: string;
  car_number: string | null;
}

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [expenseData, setExpenseData] = useState({
    exp_type: '' as 'fuel' | 'other' | '',
    method: '' as 'cash' | 'noncash' | '',
    amount: '',
    car_number: '',
    comment: '',
  });
  const [cars, setCars] = useState<{ car_number: string; driver_name: string }[]>([]);

  useEffect(() => {
    loadExpenses();
    loadCars();
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить расходы');
    } finally {
      setLoading(false);
    }
  };

  const loadCars = async () => {
    try {
      const drivers = await getDrivers();
      const carsList = drivers
        .filter(d => d.car_number)
        .map(d => ({ car_number: d.car_number, driver_name: d.full_name }));
      setCars(carsList);
    } catch (error) {
      console.error('Error loading cars:', error);
    }
  };

  const resetForm = () => {
    setExpenseData({
      exp_type: '',
      method: '',
      amount: '',
      car_number: '',
      comment: '',
    });
    setStep(1);
  };

  const handleAddExpense = async () => {
    if (!expenseData.exp_type || !expenseData.method || !expenseData.amount) {
      Alert.alert('Ошибка', 'Заполните все обязательные поля');
      return;
    }
    const amountNum = parseFloat(expenseData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму');
      return;
    }
    try {
      const newExpense = await addExpense({
        exp_type: expenseData.exp_type,
        method: expenseData.method,
        amount: amountNum,
        comment: expenseData.comment || '—',
        car_number: expenseData.car_number || null,
      });
      setExpenses([newExpense, ...expenses]);
      setModalVisible(false);
      resetForm();
      Alert.alert('Успешно', 'Расход добавлен');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось добавить расход');
    }
  };

  const renderExpense = ({ item }: { item: Expense }) => {
    const typeIcon = item.exp_type === 'fuel' ? '⚡' : '📦';
    const typeText = item.exp_type === 'fuel' ? 'Заправка' : 'Прочие';
    const methodText = item.method === 'cash' ? 'Наличные' : 'Безнал';
    const carInfo = item.car_number ? `🚗 ${item.car_number}` : 'Общие';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardType}>
            <Text style={styles.typeIcon}>{typeIcon}</Text>
            <Text style={styles.typeText}>{typeText}</Text>
          </View>
          <Text style={styles.amount}>{item.amount.toFixed(2)} ₽</Text>
        </View>
        <View style={styles.cardDetails}>
          <Text style={styles.detail}>📅 {item.exp_date}</Text>
          <Text style={styles.detail}>{methodText}</Text>
          <Text style={styles.detail}>{carInfo}</Text>
        </View>
        {item.comment && item.comment !== '—' && (
          <Text style={styles.comment}>📝 {item.comment}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Расходы</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Добавить</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        renderItem={renderExpense}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadExpenses}
        ListEmptyComponent={<Text style={styles.emptyText}>Нет расходов</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Добавить расход</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {step === 1 && (
                <>
                  <Text style={styles.stepLabel}>Выберите тип расхода:</Text>
                  <View style={styles.rowButtons}>
                    <TouchableOpacity
                      style={[styles.choiceButton, expenseData.exp_type === 'fuel' && styles.selectedButton]}
                      onPress={() => {
                        setExpenseData({ ...expenseData, exp_type: 'fuel' });
                        setStep(2);
                      }}
                    >
                      <Text style={styles.choiceButtonText}>⛽ Заправка</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.choiceButton, expenseData.exp_type === 'other' && styles.selectedButton]}
                      onPress={() => {
                        setExpenseData({ ...expenseData, exp_type: 'other' });
                        setStep(2);
                      }}
                    >
                      <Text style={styles.choiceButtonText}>📦 Прочие</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {step === 2 && (
                <>
                  <Text style={styles.stepLabel}>Способ оплаты:</Text>
                  <View style={styles.rowButtons}>
                    <TouchableOpacity
                      style={[styles.choiceButton, expenseData.method === 'cash' && styles.selectedButton]}
                      onPress={() => {
                        setExpenseData({ ...expenseData, method: 'cash' });
                        setStep(3);
                      }}
                    >
                      <Text style={styles.choiceButtonText}>💵 Наличные</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.choiceButton, expenseData.method === 'noncash' && styles.selectedButton]}
                      onPress={() => {
                        setExpenseData({ ...expenseData, method: 'noncash' });
                        setStep(3);
                      }}
                    >
                      <Text style={styles.choiceButtonText}>💳 Безнал</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {step === 3 && (
                <>
                  <Text style={styles.stepLabel}>Введите сумму (₽):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={expenseData.amount}
                    onChangeText={(text) => setExpenseData({ ...expenseData, amount: text })}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => setStep(4)}
                  />
                  <View style={styles.rowButtons}>
                    <TouchableOpacity
                      style={[styles.choiceButton, styles.nextButton]}
                      onPress={() => setStep(4)}
                    >
                      <Text style={styles.choiceButtonText}>Далее</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {step === 4 && (
                <>
                  <Text style={styles.stepLabel}>Выберите машину:</Text>
                  <ScrollView style={styles.carsList} nestedScrollEnabled>
                    <TouchableOpacity
                      style={[styles.carOption, expenseData.car_number === '' && styles.selectedCar]}
                      onPress={() => {
                        setExpenseData({ ...expenseData, car_number: '' });
                        setStep(5);
                      }}
                    >
                      <Text style={styles.carText}>Общие расходы (без привязки к авто)</Text>
                    </TouchableOpacity>
                    {cars.map((car) => (
                      <TouchableOpacity
                        key={car.car_number}
                        style={[styles.carOption, expenseData.car_number === car.car_number && styles.selectedCar]}
                        onPress={() => {
                          setExpenseData({ ...expenseData, car_number: car.car_number });
                          setStep(5);
                        }}
                      >
                        <Text style={styles.carText}>
                          🚗 {car.car_number} ({car.driver_name})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}

              {step === 5 && (
                <>
                  <Text style={styles.stepLabel}>Комментарий (необязательно):</Text>
                  <TextInput
                    style={[styles.input, styles.commentInput]}
                    placeholder="Например, номер заправки, цель расхода..."
                    value={expenseData.comment}
                    onChangeText={(text) => setExpenseData({ ...expenseData, comment: text })}
                    multiline
                  />
                  <View style={styles.rowButtons}>
                    <TouchableOpacity style={[styles.choiceButton, styles.saveButton]} onPress={handleAddExpense}>
                      <Text style={styles.choiceButtonText}>Сохранить</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  addBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: 'white',
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  typeIcon: {
    fontSize: 20,
  },
  typeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  cardDetails: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  detail: {
    fontSize: 13,
    color: '#6b7280',
  },
  comment: {
    fontSize: 13,
    color: '#4b5563',
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    justifyContent: 'center',
  },
  choiceButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#2563eb',
  },
  choiceButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  nextButton: {
    backgroundColor: '#2563eb',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  commentInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  carsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  carOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  selectedCar: {
    backgroundColor: '#e0f2fe',
  },
  carText: {
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#10b981',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
  },
});