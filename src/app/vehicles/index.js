import { Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../components/Button';
import { useDialog } from '../../components/Dialog';
import { ErrorText } from '../../components/ErrorText';
import { IconButton } from '../../components/IconButton';
import { ArchiveIcon, CarIcon, PencilIcon, PlusIcon } from '../../components/icons';
import { radius } from '../../components/theme';
import { useAppTheme, useThemedStyles } from '../../components/ThemeProvider';
import { useDatabase, vehicles } from '../../db';
import { useFocusedLoad } from '../../hooks/useFocusedLoad';

// Cars: add a car, choose the default, rename a car, archive one you no longer use.
export default function Cars() {
  const db = useDatabase();
  const { colours } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const showDialog = useDialog();
  const load = useCallback(() => vehicles.list(db), [db]);
  const { data: cars, error, reload } = useFocusedLoad(load);
  const [actionError, setActionError] = useState(null);

  const run = async (action) => {
    setActionError(null);
    try {
      await action();
      reload();
    } catch (e) {
      setActionError(e);
    }
  };

  const confirmArchive = (car) =>
    showDialog({
      title: `Archive ${car.name}?`,
      message: 'It disappears from Home, but its history is kept.',
      buttons: [
        { text: 'Archive', style: 'destructive', onPress: () => run(() => vehicles.archive(db, car.id)) },
        { text: 'Cancel', style: 'cancel' },
      ],
    });

  if (error) return <ErrorText error={error} />;
  if (!cars) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Cars' }} />
      <ErrorText error={actionError} />
      {cars.length > 0 && (
        <View style={styles.card}>
          {cars.map((car, index) => (
            <View key={car.id} style={[styles.row, index > 0 && styles.divider]}>
              <View style={[styles.avatar, car.is_default && styles.avatarDefault]}>
                <CarIcon size={20} color={car.is_default ? colours.accent : colours.muted} />
              </View>
              <View style={styles.names}>
                <Text style={styles.name} numberOfLines={1}>
                  {car.name}
                </Text>
                {car.is_default ? <Text style={styles.defaultLabel}>Default</Text> : null}
              </View>
              {!car.is_default && (
                <Button
                  title="Make default"
                  variant="secondary"
                  size="small"
                  onPress={() => run(() => vehicles.setDefault(db, car.id))}
                />
              )}
              <IconButton icon={PencilIcon} label={`Rename ${car.name}`} onPress={() => router.navigate(`/vehicles/${car.id}`)} />
              <IconButton icon={ArchiveIcon} label={`Archive ${car.name}`} tone="danger" onPress={() => confirmArchive(car)} />
            </View>
          ))}
        </View>
      )}
      <Button title="Add a car" variant="tonal" size="small" icon={PlusIcon} onPress={() => router.navigate('/vehicles/new')} />
    </ScrollView>
  );
}

const createStyles = (c) =>
  StyleSheet.create({
    container: { padding: 16, gap: 20 },
    card: { backgroundColor: c.card, borderRadius: radius.card, overflow: 'hidden', boxShadow: c.shadow },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 12 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarDefault: { backgroundColor: c.accentSoft },
    names: { flex: 1, gap: 2 },
    name: { fontSize: 16, fontWeight: '600', color: c.text },
    defaultLabel: { fontSize: 13, fontWeight: '600', color: c.accent },
  });
