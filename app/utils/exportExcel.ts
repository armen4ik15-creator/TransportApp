import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import * as XLSX from 'xlsx';

/**
 * Генерирует Excel и открывает диалог «Поделиться / Сохранить».
 * Работает в Expo Go и в APK (Android + iOS).
 */
export async function saveAndShareExcel(
  wb: XLSX.WorkBook,
  filename: string
): Promise<void> {
  // 1. Создаём base64-строку
  const wbout: string = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  if (!wbout || typeof wbout !== 'string') {
    throw new Error('Не удалось сформировать данные файла');
  }

  // 2. Безопасное имя файла (без кириллицы и спецсимволов)
  const safeFilename = filename.replace(/[^\w._-]/g, '_');

  // 3. Подбираем директорию (cache → documents)
  const dir =
    FileSystem.cacheDirectory ??
    FileSystem.documentDirectory ??
    undefined;

  if (!dir) {
    Alert.alert(
      'Ошибка',
      'Файловая система недоступна в Expo Go.\n' +
      'Пересоберите APK через EAS Build для полной поддержки экспорта.'
    );
    return;
  }

  const fileUri = dir + safeFilename;

  // 4. Убеждаемся что директория существует
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch (_) {
    // Директория уже есть — игнорируем
  }

  // 5. Записываем файл
  await FileSystem.writeAsStringAsync(fileUri, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // 6. Делимся файлом
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Открыть / Сохранить Excel',
      UTI: 'com.microsoft.excel.xlsx',
    });
  } else {
    Alert.alert('Готово', `Файл сохранён:\n${fileUri}`);
  }
}
