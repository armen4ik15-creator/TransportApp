import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../constants/supabase';
import { useAuth } from '../context/AuthContext';

export default function TripForm() {
  const { orderId, stage, unit } = useLocalSearchParams<{
    orderId: string;
    stage: string;
    unit: string;
  }>();
  const { user, profile } = useAuth();

  const [volume, setVolume] = useState('');
  const [ttnNumber, setTtnNumber] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stageText = stage === 'loading' ? 'загрузку' : 'выгрузку';

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите доступ к галерее в настройках телефона');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось открыть галерею');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите доступ к камере в настройках телефона');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось открыть камеру');
    }
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const fileExt = uri.split('.').pop()?.toLowerCase().replace('jpeg', 'jpg') ?? 'jpg';
      const mimeType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${stage}/${fileName}`;

      // Читаем файл как base64 через expo-file-system
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Декодируем base64 в бинарный массив
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error } = await supabase.storage
        .from('ttn-photos')
        .upload(filePath, bytes, { contentType: mimeType, upsert: false });

      if (error) {
        console.error('Storage upload error:', error.message);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('ttn-photos')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (err: any) {
      console.error('uploadPhoto error:', err);
      return null;
    }
  };

  const handleSubmit = async () => {
    const parsedVolume = parseFloat(volume.replace(',', '.'));
    if (!volume || isNaN(parsedVolume) || parsedVolume <= 0) {
      Alert.alert('Ошибка', 'Введите корректный объём');
      return;
    }
    if (!ttnNumber.trim()) {
      Alert.alert('Ошибка', 'Введите номер ТТН');
      return;
    }
    if (!user?.id) {
      Alert.alert('Ошибка', 'Пользователь не авторизован');
      return;
    }
    if (!orderId) {
      Alert.alert('Ошибка', 'Не указан ID заказа');
      return;
    }

    setLoading(true);
    try {
      // Фото необязательно — просто пробуем загрузить, если выбрано
      let photoUrl: string | null = null;
      if (photoUri) {
        photoUrl = await uploadPhoto(photoUri);
        // Если загрузка не удалась — не блокируем сохранение рейса
        if (!photoUrl) {
          console.warn('Photo upload failed, saving trip without photo');
        }
      }

      const { error } = await supabase.from('trips').insert({
        order_id: parseInt(orderId),
        driver_id: user.id,
        car_number: profile?.car_number ?? null,
        trip_date: new Date().toISOString().split('T')[0],
        stage,
        unit,
        volume: parsedVolume,
        ttn_number: ttnNumber.trim(),
        ttn_photo_url: photoUrl,
      });

      if (error) {
        Alert.alert('Ошибка', error.message ?? 'Не удалось сохранить рейс');
        return;
      }

      Alert.alert('Успех', `Рейс (${stageText}) сохранён!`, [
        { text: 'ОК', onPress: () => router.replace('/(driver)') },
      ]);
    } catch (err: any) {
      Alert.alert('Ошибка', err?.message ?? 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Фиксация {stageText}</Text>

      <TextInput
        style={styles.input}
        placeholder={`Объём (${unit ?? 'ед.'})`}
        keyboardType="numeric"
        value={volume}
        onChangeText={setVolume}
      />

      <TextInput
        style={styles.input}
        placeholder="Номер ТТН"
        value={ttnNumber}
        onChangeText={setTtnNumber}
      />

      {/* Фото ТТН — необязательно */}
      <Text style={styles.photoLabel}>Фото ТТН (необязательно)</Text>
      <View style={styles.photoButtons}>
        <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
          <Text style={styles.photoButtonText}>📸 Камера</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
          <Text style={styles.photoButtonText}>🖼 Галерея</Text>
        </TouchableOpacity>
        {photoUri ? (
          <TouchableOpacity
            style={[styles.photoButton, { backgroundColor: '#ef4444' }]}
            onPress={() => setPhotoUri(null)}
          >
            <Text style={styles.photoButtonText}>✕ Убрать</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {photoUri ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
          <Text style={styles.photoStatus}>✅ Фото выбрано</Text>
        </View>
      ) : (
        <Text style={styles.photoHint}>Можно сохранить без фото</Text>
      )}

      <TouchableOpacity
        style={[styles.submitButton, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.submitText}>Сохранить рейс</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1f2937',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    fontSize: 16,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#4b5563',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  photoPreview: {
    alignItems: 'center',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 6,
  },
  photoStatus: {
    color: '#10b981',
    fontWeight: '600',
  },
  photoHint: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
