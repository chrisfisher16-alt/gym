import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingScreen } from '../../src/components/onboarding/OnboardingScreen';
import { Input } from '../../src/components/ui';
import { useOnboardingStore } from '../../src/stores/onboarding-store';
import { useTheme } from '../../src/theme';
import { selectionFeedback } from '../../src/lib/haptics';

// ── Curated Gym Chains ──────────────────────────────────────────────

interface GymChain {
  name: string;
  isLargeChain: boolean;
}

const GYM_CHAINS: GymChain[] = [
  { name: 'Anytime Fitness', isLargeChain: true },
  { name: 'Planet Fitness', isLargeChain: true },
  { name: "Gold's Gym", isLargeChain: true },
  { name: 'Equinox', isLargeChain: true },
  { name: 'LA Fitness', isLargeChain: true },
  { name: '24 Hour Fitness', isLargeChain: true },
  { name: 'YMCA', isLargeChain: true },
  { name: 'Crunch Fitness', isLargeChain: true },
  { name: 'Life Time', isLargeChain: true },
  { name: 'Orangetheory', isLargeChain: false },
  { name: 'CrossFit', isLargeChain: false },
  { name: 'F45', isLargeChain: false },
  { name: "Barry's", isLargeChain: false },
  { name: 'Snap Fitness', isLargeChain: true },
  { name: 'Blink Fitness', isLargeChain: true },
  { name: 'Bay Club', isLargeChain: true },
  { name: 'World Gym', isLargeChain: true },
  { name: 'Retro Fitness', isLargeChain: true },
  { name: 'Title Boxing', isLargeChain: false },
  { name: 'Club Pilates', isLargeChain: false },
];

// ── Types ───────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  name: string;
  isLargeChain: boolean;
  isCustom?: boolean;
}

// ── Component ───────────────────────────────────────────────────────

export default function GymSearchScreen() {
  const { colors, typography, spacing, radius } = useTheme();
  const setGymName = useOnboardingStore((s) => s.setGymName);

  const [searchText, setSearchText] = useState('');
  const [selectedGym, setSelectedGym] = useState<SearchResult | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  // ── Location ────────────────────────────────────────────────────

  const requestLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLoading(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setLocationEnabled(true);
    } catch {
      // Location unavailable — continue without it
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // ── Filtered Results ────────────────────────────────────────────

  const results = useMemo((): SearchResult[] => {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];

    const matched: SearchResult[] = GYM_CHAINS.filter(
      (g) =>
        g.name.toLowerCase().startsWith(query) ||
        g.name.toLowerCase().includes(query),
    )
      // Sort: startsWith matches first, then alphabetical
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query);
        const bStarts = b.name.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((g) => ({
        id: g.name.toLowerCase().replace(/\s+/g, '-'),
        name: g.name,
        isLargeChain: g.isLargeChain,
      }));

    // Always add a custom entry at the bottom
    const exactMatch = matched.some(
      (m) => m.name.toLowerCase() === query,
    );
    if (!exactMatch) {
      matched.push({
        id: '__custom__',
        name: searchText.trim(),
        isLargeChain: false,
        isCustom: true,
      });
    }

    return matched;
  }, [searchText]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (item: SearchResult) => {
      selectionFeedback();
      setSelectedGym(item);
      setSearchText(item.name);
    },
    [],
  );

  const handleContinue = () => {
    if (selectedGym) {
      setGymName(selectedGym.name);
    } else if (searchText.trim()) {
      setGymName(searchText.trim());
    }
    router.push('/(onboarding)/equipment');
  };

  const handleSkip = () => {
    router.push('/(onboarding)/equipment');
  };

  // ── Derived State ───────────────────────────────────────────────

  const showResults = searchText.trim().length > 0 && results.length > 0 && !selectedGym;
  const showLargeChainNote =
    selectedGym?.isLargeChain && !selectedGym.isCustom;

  // ── Render Helpers ──────────────────────────────────────────────

  const renderResultItem = useCallback(
    ({ item }: { item: SearchResult }) => {
      const isSelected =
        selectedGym?.id === item.id && selectedGym?.name === item.name;

      return (
        <Pressable
          onPress={() => handleSelect(item)}
          style={({ pressed }) => [
            styles.resultRow,
            {
              backgroundColor: isSelected
                ? colors.primaryMuted
                : pressed
                  ? colors.surfaceSecondary
                  : 'transparent',
              borderRadius: radius.md,
              paddingHorizontal: spacing.base,
              paddingVertical: spacing.md,
            },
          ]}
        >
          <View style={styles.resultContent}>
            {item.isCustom ? (
              <Text
                style={[typography.body, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                Use custom name:{' '}
                <Text style={{ color: colors.primary, fontWeight: '600' }}>
                  &lsquo;{item.name}&rsquo;
                </Text>
              </Text>
            ) : (
              <Text
                style={[typography.body, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.radioOuter,
              {
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 2 : 1.5,
              },
            ]}
          >
            {isSelected && (
              <View
                style={[
                  styles.radioInner,
                  { backgroundColor: colors.primary },
                ]}
              />
            )}
          </View>
        </Pressable>
      );
    },
    [
      selectedGym,
      colors,
      typography,
      spacing,
      radius,
      handleSelect,
    ],
  );

  const keyExtractor = useCallback(
    (item: SearchResult) => item.id + item.name,
    [],
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <OnboardingScreen
      step="gym-search"
      title="Which gym do you go to?"
      subtitle="We'll customize your equipment list."
      ctaLabel={selectedGym ? 'Continue' : 'Select Gym'}
      ctaEnabled={!!(selectedGym || searchText.trim())}
      onCtaPress={handleContinue}
      secondaryLabel="Skip"
      onSecondaryPress={handleSkip}
      showSkip={false}
      keyboardAvoiding
    >
      {/* Search Input */}
      <Input
        placeholder="Search gym name…"
        value={searchText}
        onChangeText={(text) => {
          setSearchText(text);
          // Clear selection if user edits text away from selected name
          if (selectedGym && text !== selectedGym.name) {
            setSelectedGym(null);
          }
        }}
        leftIcon="search-outline"
        autoFocus
        returnKeyType="done"
        autoCapitalize="words"
        autoCorrect={false}
      />

      {/* Location Button / Badge */}
      <Pressable
        onPress={!locationEnabled ? requestLocation : undefined}
        style={[
          styles.locationRow,
          {
            marginTop: spacing.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radius.sm,
            backgroundColor: locationEnabled
              ? colors.primaryDim
              : 'transparent',
          },
        ]}
      >
        {locationLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons
            name={locationEnabled ? 'location' : 'location-outline'}
            size={18}
            color={colors.primary}
          />
        )}
        <Text
          style={[
            typography.bodySmall,
            {
              color: locationEnabled ? colors.primary : colors.textSecondary,
              marginLeft: spacing.sm,
              fontWeight: locationEnabled ? '600' : '400',
            },
          ]}
        >
          {locationLoading
            ? 'Getting location…'
            : locationEnabled
              ? 'Location enabled'
              : 'Use my location'}
        </Text>
      </Pressable>

      {/* Selected Gym Card */}
      {selectedGym && (
        <View
          style={[
            styles.selectedCard,
            {
              backgroundColor: colors.primaryMuted,
              borderRadius: radius.md,
              marginTop: spacing.md,
              padding: spacing.base,
              borderWidth: 1.5,
              borderColor: colors.primary,
            },
          ]}
        >
          <View style={styles.selectedCardContent}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.primary}
              style={{ marginRight: spacing.sm }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.body,
                  { color: colors.text, fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                {selectedGym.name}
              </Text>
              {showLargeChainNote && (
                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.primary, marginTop: 2 },
                  ]}
                >
                  Full equipment profile selected
                </Text>
              )}
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setSelectedGym(null);
                setSearchText('');
              }}
            >
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Results Dropdown */}
      {showResults && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <FlatList
            data={results}
            renderItem={renderResultItem}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 280 }}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: colors.divider,
                  marginHorizontal: spacing.base,
                }}
              />
            )}
          />
        </View>
      )}

      {/* Helper text */}
      {!showResults && !searchText.trim() && (
        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.textTertiary,
              marginTop: spacing.lg,
              textAlign: 'center',
            },
          ]}
        >
          Start typing to search popular gym chains,{'\n'}or enter any gym
          name.
        </Text>
      )}
    </OnboardingScreen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  selectedCard: {},
  selectedCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dropdown: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultContent: {
    flex: 1,
    marginRight: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
