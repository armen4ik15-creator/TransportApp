import { useState } from 'react';
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
import { supabase } from '../constants/supabase';
import { useAuth } from '../context/AuthContext';

type PaymentMethod = 'cash' | 'noncash';

export default function FuelScreen() {
  const { profile } = useAuth();

  const [amount, setAmount] = useState('');
  const [liters, setLiters] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function getTodayString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function resetForm() {
    setAmount('');
    setLiters('');
    setMethod('cash');
    setComment('');
  }

  async function handleSubmit() {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    const parsedLiters = parseFloat(liters.replace(',', '.'));

    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму в рублях');
      return;
    }

    if (!liters.trim() || isNaN(parsedLiters) || parsedLiters <= 0) {
      Alert.alert('Ошибка', 'Введите корректное количество литров');
      return;
    }

    if (!profile?.car_number) {
      Alert.alert('Ошибка', 'Номер автомобиля не найден в профиле');
      return;
    }

    const litersNote = `${parsedLiters} л`;
    const fullComment = comment.trim() ? `${comment.trim()}, ${litersNote}` : litersNote;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('expenses').insert({
        exp_type: 'fuel',
        method: method,
        amount: parsedAmount,
        comment: fullComment,
        car_number: profile.car_number,
        exp_date: getTodayString(),
      });

      if (error) throw error;

      Alert.alert('Успешно', 'Расход топлива сохранён', [
        { text: 'ОК', onPress: resetForm },
      ]);
    } catch (err: any) {
      Alert.alert('Ошибка', err?.message ?? 'Не удалось сохранить запись');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Запись топлива</Text>
        {profile?.car_number ? (
          <Text style={styles.carInfo}>Автомобиль: {profile.car_number}</Text>
        ) : null}

        <View style={styles.card}>
          {/* Amount */}
          <Text style={styles.label}>Сумма (руб.) *</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="Например: 3500"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            returnKeyType="next"
          />

          {/* Liters */}
          <Text style={styles.label}>Количество литров *</Text>
          <TextInput
            style={styles.input}
            value={liters}
            onChangeText={setLiters}
            placeholder="Например: 50"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
            returnKeyType="next"
          />

          {/* Payment method */}
          <Text style={styles.label}>Способ оплаты *</Text>
          <View style={styles.methodRow}>
            <TouchableOpacity
              style={[styles.methodButton, method === 'cash' && styles.methodButtonActive]}
              onPress={() => setMethod('cash')}
              activeOpacity={0.8}
            >
              <Text style={[styles.methodButtonText, method === 'cash' && styles.methodButtonTextActive]}>
                Наличные
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodButton, method === 'noncash' && styles.methodButtonActive]}
              onPress={() => setMethod('noncash')}
              activeOpacity={0.8}
            >
              <Text style={[styles.methodButtonText, method === 'noncash' && styles.methodButtonTextActive]}>
                Безнал
              </Text>
            </TouchableOpacity>
          </View>

          {/* Comment */}
          <Text style={styles.label}>Комментарий (необязательно)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={comment}
            onChangeText={setComment}
            placeholder="Заправка, название АЗС и т.д."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Сохранить расход</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetForm}
          disabled={submitting}
          activeOpacity={0.7}
        >
          <Text style={styles.resetButtonText}>Очистить форму</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  carInfo: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  inputMultiline: {
    height: 80,
    paddingTop: 10,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 12,
  },
  methodButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  methodButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  methodButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  methodButtonTextActive: {
    color: '#2563eb',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  resetButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  resetButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
});
