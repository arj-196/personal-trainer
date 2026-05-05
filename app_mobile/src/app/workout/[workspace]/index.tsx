import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WorkoutPlan } from '@personal-trainer/shared/workout';

import { fetchMobilePlan } from '@/lib/api';
import { colors, sharedStyles } from '@/lib/styles';

export default function WorkoutOverviewScreen() {
  const { workspace } = useLocalSearchParams<{ workspace: string }>();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) {
      setLoading(false);
      setError('Workspace is missing.');
      return;
    }

    fetchMobilePlan(workspace)
      .then((nextPlan) => {
        setPlan(nextPlan);
        setError(nextPlan ? null : 'No plan found for this workspace.');
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load plan.'))
      .finally(() => setLoading(false));
  }, [workspace]);

  if (loading) {
    return (
      <SafeAreaView style={sharedStyles.centered}>
        <ActivityIndicator color={colors.coral} />
        <Text style={sharedStyles.mutedText}>Loading workout...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sharedStyles.safeArea}>
      <ScrollView contentContainerStyle={sharedStyles.scrollContent}>
        <View style={sharedStyles.header}>
          <Text style={sharedStyles.kicker}>Workout overview</Text>
          <Text style={sharedStyles.title}>{plan?.title ?? 'No plan'}</Text>
          <Text style={sharedStyles.bodyText}>Workspace <Text style={sharedStyles.strong}>{workspace}</Text></Text>
        </View>

        {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}

        {plan?.days.map((day, index) => (
          <View key={day.heading} style={sharedStyles.card}>
            <Text style={sharedStyles.kicker}>Day {index + 1}</Text>
            <Text style={sharedStyles.cardTitle}>{day.heading}</Text>
            <View style={styles.blockPreview}>
              <Text style={styles.previewLabel}>Warm-up</Text>
              <Text style={sharedStyles.bodyText}>{day.warmup}</Text>
            </View>
            <View style={styles.exerciseList}>
              {day.exercises.map((exercise) => (
                <Text key={exercise.name} style={styles.exerciseName}>{exercise.name}</Text>
              ))}
            </View>
            {day.finisher ? (
              <View style={styles.blockPreview}>
                <Text style={styles.previewLabel}>Finisher</Text>
                <Text style={sharedStyles.bodyText}>{day.finisher}</Text>
              </View>
            ) : null}
            {day.recovery ? (
              <View style={styles.blockPreview}>
                <Text style={styles.previewLabel}>Recovery</Text>
                <Text style={sharedStyles.bodyText}>{day.recovery}</Text>
              </View>
            ) : null}
            <Pressable
              style={[sharedStyles.primaryButton, styles.startButton]}
              onPress={() => router.push({
                pathname: '/workout/[workspace]/start',
                params: { workspace, day: String(index + 1) },
              })}
            >
              <Text style={sharedStyles.primaryButtonText}>Start workout</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  blockPreview: {
    gap: 4,
    marginTop: 14,
  },
  previewLabel: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  exerciseList: {
    gap: 8,
    marginTop: 14,
  },
  exerciseName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  startButton: {
    marginTop: 18,
  },
});
