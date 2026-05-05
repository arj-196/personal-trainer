import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  advanceTimerPhase,
  buildWorkoutDayBlocks,
  googleImagesSearchUrl,
  type TimerPhase,
  type WorkoutBlock,
  type WorkoutPlan,
} from '@personal-trainer/shared/workout';

import { fetchMobilePlan } from '@/lib/api';
import { readWorkoutProgress, toggleWorkoutBlock, writeWorkoutProgress } from '@/lib/progress';
import { colors, sharedStyles } from '@/lib/styles';

export default function StartWorkoutScreen() {
  const { workspace, day } = useLocalSearchParams<{ workspace: string; day?: string }>();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [timerPhase, setTimerPhase] = useState<TimerPhase>('idle');
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);

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

  const selectedDayIndex = useMemo(() => {
    const parsed = Number.parseInt(day ?? '1', 10);
    if (!Number.isInteger(parsed) || parsed < 1) return 0;
    return Math.min(parsed - 1, Math.max((plan?.days.length ?? 1) - 1, 0));
  }, [day, plan?.days.length]);
  const selectedDay = plan?.days[selectedDayIndex] ?? null;
  const blocks = useMemo(() => selectedDay ? buildWorkoutDayBlocks(selectedDay) : [], [selectedDay]);
  const currentBlock = blocks[Math.min(currentBlockIndex, Math.max(blocks.length - 1, 0))];
  const isCurrentExercise = currentBlock?.kind === 'exercise';

  useEffect(() => {
    if (!workspace || !selectedDay || blocks.length === 0) {
      return;
    }

    setProgressLoaded(false);
    readWorkoutProgress(workspace, selectedDay.heading).then((storedProgress) => {
      setCompletedIds(storedProgress);
      const firstIncompleteIndex = blocks.findIndex((block) => !storedProgress.includes(block.id));
      setCurrentBlockIndex(firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0);
      setTimerPhase('idle');
      setIsRunning(false);
      setRemainingSeconds(0);
      setCurrentSet(1);
      setProgressLoaded(true);
    });
  }, [workspace, selectedDay, blocks]);

  useEffect(() => {
    if (!workspace || !selectedDay || !progressLoaded) {
      return;
    }
    writeWorkoutProgress(workspace, selectedDay.heading, completedIds).catch(() => undefined);
  }, [workspace, selectedDay, completedIds, progressLoaded]);

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) {
      return;
    }

    const tick = setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => clearInterval(tick);
  }, [isRunning, remainingSeconds]);

  useEffect(() => {
    if (!isRunning || remainingSeconds > 0 || !currentBlock) {
      return;
    }

    const nextState = advanceTimerPhase({
      phase: timerPhase,
      isExercise: isCurrentExercise,
      currentSet,
      setCount: currentBlock.setCount,
      activeSeconds: currentBlock.activeSeconds,
      restBetweenSetsSeconds: currentBlock.restBetweenSetsSeconds,
      restBetweenExercisesSeconds: currentBlock.restBetweenExercisesSeconds,
      currentBlockIndex,
      blockCount: blocks.length,
    });

    if (nextState.markBlockComplete) {
      setCompletedIds((current) => current.includes(currentBlock.id) ? current : [...current, currentBlock.id]);
    }

    let nextRemaining = nextState.remainingSeconds;
    if (nextState.selectBlockIndex !== null) {
      const nextBlock = blocks[nextState.selectBlockIndex];
      setCurrentBlockIndex(nextState.selectBlockIndex);
      setCurrentSet(1);
      nextRemaining = nextState.phase === 'idle' ? nextBlock?.activeSeconds ?? 0 : nextRemaining;
    } else {
      setCurrentSet(nextState.currentSet);
    }

    setTimerPhase(nextState.phase);
    setIsRunning(nextState.isRunning);
    setRemainingSeconds(nextRemaining);
  }, [blocks, currentBlock, currentBlockIndex, currentSet, isCurrentExercise, isRunning, remainingSeconds, timerPhase]);

  const startBlock = useCallback((blockIndex: number) => {
    const block = blocks[blockIndex];
    if (!block) return;
    setCurrentBlockIndex(blockIndex);
    setCurrentSet(1);
    setTimerPhase('active');
    setRemainingSeconds(block.activeSeconds);
    setIsRunning(true);
  }, [blocks]);

  const handleStartPauseToggle = () => {
    if (!currentBlock) return;
    if (isRunning) {
      setIsRunning(false);
      return;
    }
    if (timerPhase === 'idle' || timerPhase === 'complete') {
      startBlock(currentBlockIndex);
      return;
    }
    if (remainingSeconds > 0) {
      setIsRunning(true);
    }
  };

  const jumpToBlock = (offset: -1 | 1) => {
    const targetIndex = currentBlockIndex + offset;
    const block = blocks[targetIndex];
    if (!block) return;
    setCurrentBlockIndex(targetIndex);
    setCurrentSet(1);
    setTimerPhase('idle');
    setRemainingSeconds(block.activeSeconds);
    setIsRunning(false);
  };

  const toggleBlock = (blockId: string) => {
    setCompletedIds((current) => toggleWorkoutBlock(current, blockId));
  };

  if (loading) {
    return (
      <SafeAreaView style={sharedStyles.centered}>
        <ActivityIndicator color={colors.coral} />
        <Text style={sharedStyles.mutedText}>Loading session...</Text>
      </SafeAreaView>
    );
  }

  if (error || !selectedDay || blocks.length === 0) {
    return (
      <SafeAreaView style={sharedStyles.centered}>
        <Text style={sharedStyles.errorText}>{error ?? 'No workout blocks found.'}</Text>
      </SafeAreaView>
    );
  }

  const completedCount = completedIds.length;
  const totalCount = blocks.length;
  const isRestPhase = timerPhase === 'rest-between-sets' || timerPhase === 'rest-between-exercises';
  const coachMode = timerPhase === 'active' ? 'Exercise' : isRestPhase ? 'Rest' : 'Ready';
  const coachCopy = timerPhase === 'active'
    ? 'Push now. Keep form clean.'
    : isRestPhase
      ? 'Recover now. Breathe and reset.'
      : 'Tap Start when you begin the next block.';

  return (
    <SafeAreaView style={sharedStyles.safeArea}>
      <View style={styles.timerPanel}>
        <View style={styles.timerCopy}>
          <Text style={styles.timerTitle} numberOfLines={1}>{currentBlock?.name ?? 'No block selected'}</Text>
          <View style={styles.timerRow}>
            <Text style={styles.timerValue}>{formatDuration(remainingSeconds)}</Text>
            {isCurrentExercise && currentBlock ? (
              <Text style={styles.setText}>Set <Text style={styles.setTextStrong}>{currentSet}/{currentBlock.setCount}</Text></Text>
            ) : null}
          </View>
          <View style={[styles.coachBox, coachMode === 'Exercise' ? styles.coachExercise : isRestPhase ? styles.coachRest : null]}>
            <Text style={styles.coachMode}>{coachMode}</Text>
            <Text style={styles.coachCopy}>{coachCopy}</Text>
          </View>
        </View>
        <View style={styles.timerActions}>
          <View style={styles.navRow}>
            <Pressable style={styles.navButton} onPress={() => jumpToBlock(-1)} disabled={currentBlockIndex === 0}>
              <Text style={styles.navButtonText}>‹</Text>
            </Pressable>
            <Pressable style={styles.navButton} onPress={() => jumpToBlock(1)} disabled={currentBlockIndex >= blocks.length - 1}>
              <Text style={styles.navButtonText}>›</Text>
            </Pressable>
          </View>
          <Pressable style={styles.playButton} onPress={handleStartPauseToggle}>
            <Text style={styles.playButtonText}>{isRunning ? 'Pause' : 'Start'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={sharedStyles.scrollContent}>
        <View style={sharedStyles.card}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionTitleBlock}>
              <Text style={sharedStyles.kicker}>Current session</Text>
              <Text style={sharedStyles.cardTitle}>{selectedDay.heading}</Text>
              <Text style={sharedStyles.bodyText}>Work through one block at a time and keep the phone on this screen.</Text>
            </View>
            <View style={styles.progressBadge}>
              <Text style={styles.progressCount}>{completedCount}/{totalCount}</Text>
              <Text style={styles.progressLabel}>completed</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(completedCount / Math.max(totalCount, 1)) * 100}%` }]} />
          </View>
        </View>

        {blocks.map((block) => (
          <WorkoutBlockCard
            key={block.id}
            block={block}
            checked={completedIds.includes(block.id)}
            onToggle={toggleBlock}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function WorkoutBlockCard({
  block,
  checked,
  onToggle,
}: {
  block: WorkoutBlock;
  checked: boolean;
  onToggle: (blockId: string) => void;
}) {
  const collapsed = checked;

  return (
    <View style={[styles.blockCard, checked ? styles.blockCardDone : null]}>
      {!collapsed ? (
        block.imageUrl ? (
          <Image source={{ uri: block.imageUrl }} style={styles.blockImage} />
        ) : (
          <View style={styles.blockArt}>
            <Text style={styles.blockArtText}>{block.kind}</Text>
          </View>
        )
      ) : null}
      <View style={styles.blockBody}>
        <View style={styles.blockHeader}>
          <Text style={[sharedStyles.kicker, checked ? styles.doneKicker : null]}>{block.kind}</Text>
          <Pressable style={[styles.doneButton, checked ? styles.doneButtonActive : null]} onPress={() => onToggle(block.id)}>
            <Text style={[styles.doneButtonText, checked ? styles.doneButtonTextActive : null]}>{checked ? 'Done' : 'Mark done'}</Text>
          </Pressable>
        </View>
        <Text style={sharedStyles.sectionTitle}>{block.name}</Text>
        {!collapsed ? (
          <>
            <Text style={styles.prescription}>{block.prescription}</Text>
            {block.notes ? <Text style={sharedStyles.bodyText}>{block.notes}</Text> : null}
            {block.searchName ? (
              <Pressable
                style={[sharedStyles.secondaryButton, styles.imageSearchButton]}
                onPress={() => Linking.openURL(googleImagesSearchUrl(block.searchName ?? block.name))}
              >
                <Text style={sharedStyles.secondaryButtonText}>Google Images</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

const styles = StyleSheet.create({
  timerPanel: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    flexDirection: 'row',
    gap: 12,
    margin: 12,
    marginBottom: 0,
    padding: 12,
  },
  timerCopy: {
    flex: 1,
    gap: 8,
  },
  timerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  timerRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 10,
  },
  timerValue: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
  },
  setText: {
    color: '#d5dae2',
    fontSize: 14,
  },
  setTextStrong: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  coachBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  coachExercise: {
    backgroundColor: 'rgba(255,99,89,0.22)',
    borderColor: 'rgba(255,99,89,0.55)',
  },
  coachRest: {
    backgroundColor: 'rgba(34,184,199,0.2)',
    borderColor: 'rgba(34,184,199,0.55)',
  },
  coachMode: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachCopy: {
    color: '#edf1f6',
    fontSize: 13,
    marginTop: 2,
  },
  timerActions: {
    gap: 8,
    width: 94,
  },
  navRow: {
    flexDirection: 'row',
    gap: 6,
  },
  navButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    flex: 1,
    height: 36,
    justifyContent: 'center',
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 86,
  },
  playButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  sessionHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  sessionTitleBlock: {
    flex: 1,
    gap: 4,
  },
  progressBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  progressCount: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  progressLabel: {
    color: '#d5dae2',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  progressTrack: {
    backgroundColor: '#e6e9ef',
    borderRadius: 999,
    height: 10,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.cyan,
    height: '100%',
  },
  blockCard: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  blockCardDone: {
    backgroundColor: '#eefaf3',
    borderColor: '#9bd8b8',
    opacity: 0.82,
  },
  blockImage: {
    height: 190,
    width: '100%',
  },
  blockArt: {
    alignItems: 'center',
    backgroundColor: '#eefbfd',
    height: 160,
    justifyContent: 'center',
  },
  blockArtText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  blockBody: {
    gap: 10,
    padding: 16,
  },
  blockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  doneKicker: {
    color: colors.green,
  },
  doneButton: {
    backgroundColor: '#f0f3f7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneButtonActive: {
    backgroundColor: '#d9f5e6',
  },
  doneButtonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
  },
  doneButtonTextActive: {
    color: colors.green,
  },
  prescription: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  imageSearchButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});
