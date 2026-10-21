import {StyleSheet} from 'react-native';
import {EdgeInsets} from 'react-native-safe-area-context';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme, insets: EdgeInsets) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flexGrow: 1,
      padding: theme.spacing.default,
      paddingBottom: theme.spacing.default * 2 + insets.bottom,
      gap: theme.spacing.default,
    },
    banner: {
      ...theme.fonts.labelMedium,
      color: theme.colors.onSurfaceVariant,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.borders.default,
      padding: theme.spacing.default,
    },
    section: {
      gap: theme.spacing.default / 2,
    },
    card: {
      gap: theme.spacing.default / 2,
      padding: theme.spacing.default,
      borderRadius: theme.borders.default,
      backgroundColor: theme.colors.surfaceContainerHighest,
    },
    title: {
      ...theme.fonts.titleLarge,
      color: theme.colors.onSurface,
    },
    label: {
      ...theme.fonts.titleMedium,
      color: theme.colors.onSurface,
    },
    body: {
      ...theme.fonts.bodyLarge,
      color: theme.colors.onSurface,
    },
    quote: {
      ...theme.fonts.bodyLarge,
      color: theme.colors.onSurface,
      fontStyle: 'italic',
      paddingVertical: theme.spacing.default / 2,
    },
    hint: {
      ...theme.fonts.bodyMedium,
      color: theme.colors.onSurfaceVariant,
    },
    success: {
      ...theme.fonts.bodyLarge,
      color: theme.colors.primary,
    },
    error: {
      ...theme.fonts.bodyMedium,
      color: theme.colors.error,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.default / 2,
    },
    chip: {
      maxWidth: '100%',
    },
    input: {
      minHeight: 120,
    },
    button: {
      alignSelf: 'stretch',
    },
    note: {
      paddingVertical: theme.spacing.default / 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.outlineVariant,
    },
  });
