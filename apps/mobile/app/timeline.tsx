import React, { useState, useCallback } from 'react';
import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { ScreenContainer } from '../src/components/ui';
import { TimelineView } from '../src/components/ui/TimelineView';

export default function TimelineScreen() {
  const { colors } = useTheme();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleDateChange = useCallback((newDate: string) => {
    setDate(newDate);
  }, []);

  return (
    <ScreenContainer scrollable={false}>
      <Stack.Screen
        options={{
          title: 'Timeline',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      <TimelineView date={date} onDateChange={handleDateChange} />
    </ScreenContainer>
  );
}
