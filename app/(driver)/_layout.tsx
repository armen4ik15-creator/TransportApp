import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Главная' }} />
      <Stack.Screen name="trip-form" options={{ title: 'Фиксация рейса' }} />
      <Stack.Screen name="my-route" options={{ title: 'Мой маршрут' }} />
      <Stack.Screen name="fuel" options={{ title: 'Заправка' }} />
      <Stack.Screen name="earnings" options={{ title: 'Заработок' }} />
    </Stack>
  );
}