import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { UserProfileSummary, WorkoutPlan } from '@personal-trainer/shared/workout';

import { fetchMobilePlan, fetchMobileProfile, fetchMobileWorkspaces } from '@/lib/api';
import { colors, sharedStyles } from '@/lib/styles';

export default function HomeScreen() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileSummary | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    setError(null);
    const workspaceList = await fetchMobileWorkspaces();
    setWorkspaces(workspaceList);
    setSelectedWorkspace((current) => current && workspaceList.includes(current) ? current : workspaceList[0] ?? null);
  }, []);

  useEffect(() => {
    loadWorkspaces()
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load workspaces.'))
      .finally(() => setLoading(false));
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!selectedWorkspace) {
      setProfile(null);
      setPlan(null);
      return;
    }

    let active = true;
    Promise.all([
      fetchMobileProfile(selectedWorkspace),
      fetchMobilePlan(selectedWorkspace),
    ])
      .then(([nextProfile, nextPlan]) => {
        if (!active) return;
        setProfile(nextProfile);
        setPlan(nextPlan);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setProfile(null);
        setPlan(null);
        setError(loadError instanceof Error ? loadError.message : 'Could not load plan.');
      });

    return () => {
      active = false;
    };
  }, [selectedWorkspace]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadWorkspaces();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not refresh workspaces.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={sharedStyles.centered}>
        <ActivityIndicator color={colors.coral} />
        <Text style={sharedStyles.mutedText}>Loading workspaces...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sharedStyles.safeArea}>
      <ScrollView
        contentContainerStyle={sharedStyles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={sharedStyles.header}>
          <Text style={sharedStyles.kicker}>Workspace</Text>
          <Text style={sharedStyles.title}>Pick your active plan</Text>
          <Text style={sharedStyles.bodyText}>
            Load a generated workspace from the web app API, then run a phone-first workout session.
          </Text>
        </View>

        {error ? <Text style={sharedStyles.errorText}>{error}</Text> : null}

        {workspaces.length === 0 ? (
          <View style={sharedStyles.card}>
            <Text style={sharedStyles.cardTitle}>No workspaces yet</Text>
            <Text style={sharedStyles.bodyText}>Create a workspace with the trainer CLI, publish it, and refresh.</Text>
          </View>
        ) : (
          <>
            <View style={styles.workspaceList}>
              {workspaces.map((workspace) => (
                <Pressable
                  key={workspace}
                  onPress={() => setSelectedWorkspace(workspace)}
                  style={[
                    styles.workspacePill,
                    workspace === selectedWorkspace ? styles.workspacePillActive : null,
                  ]}
                >
                  <Text style={[
                    styles.workspacePillText,
                    workspace === selectedWorkspace ? styles.workspacePillTextActive : null,
                  ]}>
                    {workspace}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={sharedStyles.card}>
              <Text style={sharedStyles.kicker}>Current plan</Text>
              <Text style={sharedStyles.cardTitle}>{plan?.title ?? 'No plan found'}</Text>
              <Text style={sharedStyles.bodyText}>
                Workspace <Text style={sharedStyles.strong}>{selectedWorkspace}</Text>
                {profile ? ` · ${profile.name} · ${profile.goal}` : ''}
              </Text>

              {plan ? (
                <>
                  <View style={styles.metaGrid}>
                    {plan.meta.slice(0, 4).map((item) => (
                      <View key={item.label} style={styles.metaCard}>
                        <Text style={styles.metaLabel}>{item.label}</Text>
                        <Text style={styles.metaValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={sharedStyles.bodyText}>{plan.summary}</Text>
                  <View style={styles.actions}>
                    <Pressable
                      style={sharedStyles.primaryButton}
                      onPress={() => router.push({ pathname: '/workout/[workspace]', params: { workspace: selectedWorkspace ?? '' } })}
                    >
                      <Text style={sharedStyles.primaryButtonText}>Open workout</Text>
                    </Pressable>
                    <Pressable
                      style={sharedStyles.secondaryButton}
                      onPress={() => router.push({ pathname: '/workout/[workspace]/start', params: { workspace: selectedWorkspace ?? '' } })}
                    >
                      <Text style={sharedStyles.secondaryButtonText}>Start session</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Text style={sharedStyles.bodyText}>Run a plan for this workspace, then refresh the mobile app.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  workspaceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workspacePill: {
    borderColor: '#cfd6df',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#ffffff',
  },
  workspacePillActive: {
    borderColor: colors.ink,
    backgroundColor: colors.ink,
  },
  workspacePillText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  workspacePillTextActive: {
    color: '#ffffff',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 14,
  },
  metaCard: {
    minWidth: '46%',
    flex: 1,
    borderRadius: 18,
    backgroundColor: '#eefbfd',
    padding: 12,
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metaValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  actions: {
    gap: 10,
    marginTop: 18,
  },
});
