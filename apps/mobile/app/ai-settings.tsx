import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { ScreenContainer, Card, Button, Divider } from '../src/components/ui';
import {
  getAIConfig,
  setAIConfig,
  getProviderDefaults,
  testAIConnection,
  clearConfigCache,
  type AIConfig,
} from '../src/lib/ai-provider';

const PROVIDERS = [
  {
    id: 'demo' as const,
    name: 'Demo Mode',
    description: 'Pre-written responses, no API key needed',
    icon: 'chatbox-outline' as const,
  },
  {
    id: 'groq' as const,
    name: 'Groq (Free)',
    description: 'Fast inference, free tier available',
    icon: 'flash-outline' as const,
  },
  {
    id: 'openai' as const,
    name: 'OpenAI-Compatible',
    description: 'OpenAI, Together, Fireworks, etc.',
    icon: 'globe-outline' as const,
  },
  {
    id: 'claude' as const,
    name: 'Claude (Anthropic)',
    description: 'Advanced AI by Anthropic',
    icon: 'sparkles-outline' as const,
  },
  {
    id: 'ollama' as const,
    name: 'Ollama (Local)',
    description: 'Run models locally, no API key',
    icon: 'desktop-outline' as const,
  },
];

export default function AISettingsScreen() {
  const { colors, spacing, radius, typography } = useTheme();
  const [config, setConfig] = useState<AIConfig>({ provider: 'demo' });
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    clearConfigCache();
    getAIConfig().then((c) => {
      setConfig(c);
      setIsLoading(false);
    });
  }, []);

  const updateConfig = useCallback((updates: Partial<AIConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  const handleProviderChange = useCallback(
    (provider: AIConfig['provider']) => {
      const defaults = getProviderDefaults(provider);
      updateConfig({
        provider,
        baseUrl: provider === 'demo' || provider === 'claude' ? undefined : defaults.baseUrl,
        model: provider === 'demo' ? undefined : defaults.model,
        apiKey: provider === 'demo' || provider === 'ollama' ? undefined : config.apiKey,
      });
    },
    [config.apiKey, updateConfig],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await setAIConfig(config);
      setHasChanges(false);
      Alert.alert('Saved', 'AI settings updated successfully.');
    } catch {
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  const handleTest = useCallback(async () => {
    setIsTesting(true);
    const result = await testAIConnection(config);
    setIsTesting(false);
    if (result.success) {
      Alert.alert('Connection Successful', `Connected to: ${result.model}`);
    } else {
      Alert.alert('Connection Failed', result.error ?? 'Unknown error');
    }
  }, [config]);

  if (isLoading) {
    return (
      <ScreenContainer edges={[]}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </ScreenContainer>
    );
  }

  const needsApiKey = config.provider === 'groq' || config.provider === 'openai' || config.provider === 'claude';
  const showBaseUrl = config.provider === 'openai' || config.provider === 'ollama';
  const showModel = config.provider !== 'demo';

  return (
    <ScreenContainer edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Provider Selection */}
        <Text
          style={[
            typography.labelSmall,
            {
              color: colors.textTertiary,
              marginBottom: spacing.sm,
              marginLeft: spacing.xs,
              marginTop: spacing.base,
              textTransform: 'uppercase',
              letterSpacing: 1,
            },
          ]}
        >
          AI Provider
        </Text>
        <Card style={{ marginBottom: spacing.base }}>
          {PROVIDERS.map((provider, index) => (
            <React.Fragment key={provider.id}>
              {index > 0 && <Divider />}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleProviderChange(provider.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.md,
                }}
              >
                <Ionicons
                  name={provider.icon}
                  size={22}
                  color={config.provider === provider.id ? colors.primary : colors.textSecondary}
                />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[typography.body, { color: colors.text }]}>{provider.name}</Text>
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>
                    {provider.description}
                  </Text>
                </View>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    borderWidth: 2,
                    borderColor: config.provider === provider.id ? colors.primary : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {config.provider === provider.id && (
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: colors.primary,
                      }}
                    />
                  )}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Card>

        {/* API Key */}
        {needsApiKey && (
          <>
            <Text
              style={[
                typography.labelSmall,
                {
                  color: colors.textTertiary,
                  marginBottom: spacing.sm,
                  marginLeft: spacing.xs,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                },
              ]}
            >
              API Key
            </Text>
            <Card style={{ marginBottom: spacing.base }}>
              <TextInput
                style={[
                  typography.body,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    fontSize: 13,
                  },
                ]}
                value={config.apiKey ?? ''}
                onChangeText={(text) => updateConfig({ apiKey: text.trim() })}
                placeholder="Enter your API key..."
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              {config.provider === 'groq' && (
                <TouchableOpacity
                  onPress={() => Linking.openURL('https://console.groq.com')}
                  style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center' }}
                >
                  <Ionicons name="open-outline" size={14} color={colors.primary} />
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: colors.primary, marginLeft: spacing.xs },
                    ]}
                  >
                    Get a free Groq API key
                  </Text>
                </TouchableOpacity>
              )}
            </Card>
          </>
        )}

        {/* Base URL */}
        {showBaseUrl && (
          <>
            <Text
              style={[
                typography.labelSmall,
                {
                  color: colors.textTertiary,
                  marginBottom: spacing.sm,
                  marginLeft: spacing.xs,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                },
              ]}
            >
              Base URL
            </Text>
            <Card style={{ marginBottom: spacing.base }}>
              <TextInput
                style={[
                  typography.body,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    fontSize: 13,
                  },
                ]}
                value={config.baseUrl ?? ''}
                onChangeText={(text) => updateConfig({ baseUrl: text.trim() })}
                placeholder={getProviderDefaults(config.provider).baseUrl}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {config.provider === 'ollama' && (
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textTertiary, marginTop: spacing.sm },
                  ]}
                >
                  Make sure Ollama is running locally. Install from ollama.com, then run: ollama serve
                </Text>
              )}
            </Card>
          </>
        )}

        {/* Model */}
        {showModel && (
          <>
            <Text
              style={[
                typography.labelSmall,
                {
                  color: colors.textTertiary,
                  marginBottom: spacing.sm,
                  marginLeft: spacing.xs,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                },
              ]}
            >
              Model
            </Text>
            <Card style={{ marginBottom: spacing.base }}>
              <TextInput
                style={[
                  typography.body,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    fontSize: 13,
                  },
                ]}
                value={config.model ?? ''}
                onChangeText={(text) => updateConfig({ model: text.trim() })}
                placeholder={getProviderDefaults(config.provider).model}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {config.provider === 'groq' && (
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textTertiary, marginTop: spacing.sm },
                  ]}
                >
                  Recommended: llama-3.3-70b-versatile (fast, free tier: 30 RPM, 14,400/day)
                </Text>
              )}
              {config.provider === 'ollama' && (
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textTertiary, marginTop: spacing.sm },
                  ]}
                >
                  Popular: llama3, mistral, gemma2. Pull models with: ollama pull llama3
                </Text>
              )}
            </Card>
          </>
        )}

        {/* Setup Instructions */}
        {config.provider === 'groq' && (
          <Card style={{ marginBottom: spacing.base, backgroundColor: colors.primaryMuted }}>
            <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>
              Groq Setup (2 minutes)
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, lineHeight: 20 }]}>
              1. Go to console.groq.com and create a free account{'\n'}
              2. Navigate to API Keys and create a new key{'\n'}
              3. Paste the key above{'\n'}
              4. Tap "Test Connection" to verify{'\n'}
              5. Tap "Save" — you're done!{'\n\n'}
              Free tier includes 30 requests/minute and 14,400 requests/day.
            </Text>
          </Card>
        )}

        {config.provider === 'ollama' && (
          <Card style={{ marginBottom: spacing.base, backgroundColor: colors.primaryMuted }}>
            <Text style={[typography.labelLarge, { color: colors.text, marginBottom: spacing.sm }]}>
              Ollama Setup
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, lineHeight: 20 }]}>
              1. Install Ollama from ollama.com{'\n'}
              2. Run: ollama pull llama3{'\n'}
              3. Run: ollama serve{'\n'}
              4. The default URL should work if running locally{'\n'}
              5. Tap "Test Connection" to verify{'\n\n'}
              Note: Local models require your device to be on the same network.
            </Text>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={{ gap: spacing.sm, marginBottom: spacing['3xl'] }}>
          <Button
            title={isTesting ? 'Testing...' : 'Test Connection'}
            variant="secondary"
            onPress={handleTest}
            disabled={isTesting}
          />
          <Button
            title={isSaving ? 'Saving...' : 'Save Settings'}
            variant="primary"
            onPress={handleSave}
            disabled={!hasChanges || isSaving}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
