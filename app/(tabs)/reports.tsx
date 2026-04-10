import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getFinancialSummary, getTransactions } from '../constants/queries';

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [summary, setSummary] = useState({ revenue: 0, expenses: 0, salary: 0, profit: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, transactionsData] = await Promise.all([
        getFinancialSummary(period),
        getTransactions(period),
      ]);
      setSummary(summaryData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Error loading report:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить отчёт');
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  };

  const periodNames: Record<Period, string> = {
    today: 'Сегодня',
    week: 'Неделя',
    month: 'Месяц',
    quarter: 'Квартал',
    year: 'Год',
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'revenue': return 'arrow-up-circle';
      case 'expense': return 'arrow-down-circle';
      case 'salary': return 'cash';
      default: return 'alert-circle';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'revenue': return '#10b981';
      case 'expense': return '#ef4444';
      case 'salary': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const handleExport = () => {
    // Формируем CSV
    const headers = [
      'Тип', 'Дата', 'Описание', 'Сумма', 'Машина',
    ];
    const rows = transactions.map(t => [
      t.type === 'revenue' ? 'Выручка' : t.type === 'expense' ? 'Расход' : 'Зарплата',
      t.date,
      t.description,
      t.amount,
      t.car || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Добавляем сводку в начало
    const summaryCsv = `\n"Сводка за период ${periodNames[period]}",,,,\n"Выручка","${formatMoney(summary.revenue)}",,,,,\n"Расходы","${formatMoney(summary.expenses)}",,,,,\n"Зарплата","${formatMoney(summary.salary)}",,,,,\n"Прибыль","${formatMoney(summary.profit)}",,,,,\n`;
    const fullCsv = summaryCsv + '\n' + csv;

    setCsvContent(fullCsv);
    setModalVisible(true);
  };

  const shareCsv = async () => {
    try {
      await Share.share({
        message: csvContent,
        title: `Финансовый отчёт ${periodNames[period]}`,
      });
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось поделиться отчётом');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Отчёты</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="document-text-outline" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Выбор периода */}
        <View style={styles.periodRow}>
          {(['today', 'week', 'month', 'quarter', 'year'] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodButton, period === p && styles.periodButtonActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodButtonText, period === p && styles.periodButtonTextActive]}>
                {periodNames[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
        ) : (
          <>
            {/* Сводные карточки */}
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Ionicons name="trending-up" size={28} color="#10b981" />
                <Text style={styles.summaryLabel}>Выручка</Text>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>{formatMoney(summary.revenue)} ₽</Text>
              </View>
              <View style={styles.summaryCard}>
                <Ionicons name="trending-down" size={28} color="#ef4444" />
                <Text style={styles.summaryLabel}>Расходы</Text>
                <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{formatMoney(summary.expenses)} ₽</Text>
              </View>
              <View style={styles.summaryCard}>
                <Ionicons name="cash" size={28} color="#f59e0b" />
                <Text style={styles.summaryLabel}>Зарплата</Text>
                <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>{formatMoney(summary.salary)} ₽</Text>
              </View>
              <View style={styles.summaryCard}>
                <Ionicons name="stats-chart" size={28} color="#2563eb" />
                <Text style={styles.summaryLabel}>Прибыль</Text>
                <Text style={[styles.summaryValue, { color: '#2563eb' }]}>{formatMoney(summary.profit)} ₽</Text>
              </View>
            </View>

            {/* Таблица операций */}
            <Text style={styles.sectionTitle}>Последние операции</Text>
            {transactions.map((item) => (
              <View key={item.id} style={styles.transactionItem}>
                <View style={styles.transactionLeft}>
                  <Ionicons name={getTypeIcon(item.type)} size={20} color={getTypeColor(item.type)} />
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc}>{item.description}</Text>
                    <Text style={styles.transactionDate}>{item.date}</Text>
                    {item.car && <Text style={styles.transactionCar}>🚗 {item.car}</Text>}
                  </View>
                </View>
                <Text style={[styles.transactionAmount, { color: item.amount > 0 ? '#10b981' : '#ef4444' }]}>
                  {item.amount > 0 ? '+' : ''}{formatMoney(Math.abs(item.amount))} ₽
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Отчёт ({periodNames[period]})</Text>
            <ScrollView style={styles.csvContainer}>
              <Text selectable style={styles.csvText}>
                {csvContent}
              </Text>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButton} onPress={shareCsv}>
                <Text style={styles.modalButtonText}>📤 Поделиться</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.closeButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Закрыть</Text>
              </TouchableOpacity>
            </View>
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
  exportBtn: {
    padding: 8,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#2563eb',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#1f2937',
  },
  periodButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  loader: {
    marginTop: 40,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  transactionItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  transactionDesc: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  transactionCar: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  csvContainer: {
    maxHeight: 400,
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 8,
  },
  csvText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#1f2937',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#e5e7eb',
  },
  closeButtonText: {
    color: '#1f2937',
    fontWeight: '600',
  },
});