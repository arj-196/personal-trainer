import { StyleSheet } from 'react-native';

export const colors = {
  background: '#f7f8fb',
  card: '#ffffff',
  ink: '#17181c',
  muted: '#667085',
  border: '#d8dee8',
  coral: '#ff6359',
  coralDark: '#b54843',
  cyan: '#22b8c7',
  green: '#2f9e63',
};

export const sharedStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    gap: 16,
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: colors.background,
  },
  header: {
    gap: 8,
    paddingTop: 4,
  },
  kicker: {
    color: colors.coral,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#293340',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 24,
  },
  bodyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  mutedText: {
    color: colors.muted,
    fontSize: 14,
  },
  errorText: {
    color: colors.coralDark,
    fontSize: 14,
    fontWeight: '700',
  },
  strong: {
    color: colors.ink,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.coral,
    borderRadius: 999,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
});
