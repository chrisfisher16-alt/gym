import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/theme';
import { ScreenContainer, Card, Button, Divider } from '../src/components/ui';
import { crossPlatformAlert } from '../src/lib/cross-platform-alert';
import {
  getAIConfig,
  setAIConfig,
  getProviderDefaults,
  testAIConnection,
  clearConfigCache,
  fetchAvailableModels,
  type AIConfig,
  type AIModelInfo,
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
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Model dropdown state
  const [availableModels, setAvailableModels] = useState<AIModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    clearConfigCache();
    getAIConfig().then((c) => {
      setConfig(c);
      setIsLoading(false);
    });
    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, []);

  // Fetch models when provider or API key changes
  useEffect(() => {
    if (isLoading || !config) return;
    if (config.provider === 'demo') {
      setAvailableModels([]);
      return;
    }

    // Debounce API key changes
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(() => {
      setIsLoadingModels(true);
      setModelFetchError(null);
      fetchAvailableModels(config).then((models) => {
        setAvailableModels(models);
        setIsLoadingModels(false);
      }).catch(() => {
        setAvailableModels([]);
        setModelFetchError('Could not fetch models');
        setIsLoadingModels(false);
      });
    }, 500);

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [config?.provider, config?.apiKey, config?.baseUrl, isLoading]);

  const updateConfig = useCallback((updates: Partial<AIConfig>) => {
    setConfig((prev) => prev ? { ...prev, ...updates } : { provider: 'demo', ...updates } as AIConfig);
    setHasChanges(true);
  }, []);

  const handleProviderChange = useCallback(
    (provider: AIConfig['provider']) => {
      const defaults = getProviderDefaults(provider);
      // Save current API key for the current provider before switching
      const updatedKeys = { ...config?.providerKeys };
      if (config?.apiKey && config?.provider !== 'demo' && config?.provider !== 'ollama') {
        updatedKeys[config.provider] = config.apiKey;
      }
      // Load the saved API key for the new provider
      const savedKey = updatedKeys[provider];
      updateConfig({
        provider,
        baseUrl: provider === 'demo' || provider === 'claude' ? undefined : defaults.baseUrl,
        model: provider === 'demo' ? undefined : defaults.model,
        apiKey: provider === 'demo' || provider === 'ollama' ? undefined : (savedKey ?? ''),
        providerKeys: updatedKeys,
      });
      setModelDropdownOpen(false);
    },
    [config?.apiKey, config?.provider, config?.providerKeys, updateConfig],
  );

  const handleSave = useCallback(async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      // Trim API key on save
      const configToSave = { ...config, apiKey: config.apiKey?.trim() };
      if (configToSave.apiKey && configToSave.provider !== 'demo' && configToSave.provider !== 'ollama') {
        configToSave.providerKeys = {
          ...configToSave.providerKeys,
          [configToSave.provider]: configToSave.apiKey,
        };
      }
      await setAIConfig(configToSave);
      setConfig(configToSave);
      setHasChanges(false);
      crossPlatformAlert('Saved', 'AI settings updated successfully.');
    } catch {
      crossPlatformAlert('Error', 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  const handleTest = useCallback(async () => {
    setIsTesting(true);
    if (!config) return;
    const result = await testAIConnection(config);
    setIsTesting(false);
    if (result.success) {
      crossPlatformAlert('Connection Successful', `Connected to: ${result.model}`);
    } else {
      crossPlatformAlert('Connection Failed', result.error ?? 'Unknown error');
    }
  }, [config]);

  const handleSelectModel = useCallback((modelId: string) => {
    if (Platform.OS !== 'web') LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    updateConfig({ model: modelId });
    setModelDropdownOpen(false);
  }, [updateConfig]);

  if (isLoading || !config) {
    return (
      <ScreenContainer edges={[]}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </ScreenContainer>
    );
  }

  const needsApiKey = config.provider === 'groq' || config.provider === 'openai' || config.provider === 'claude';
  const showBaseUrl = config.provider === 'openai' || config.provider === 'ollama';
  const showModel = config.provider !== 'demo';
  const currentModel = config.model || getProviderDefaults(config.provider).model;
  const selectedModelInfo = availableModels.find((m) => m.id === currentModel);

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
              API Key (Optional)
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
                onChangeText={(text) => updateConfig({ apiKey: text })}
                placeholder="Leave blank to use built-in key"
                placeholderTextColor={colors.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text
                style={[
                  typography.caption,
                  { color: colors.textTertiary, marginTop: spacing.sm },
                ]}
              >
                AI coaching works without a key. Add your own for higher limits or to use premium models.
              </Text>
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

        {/* Model Selection */}
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
              {/* Selected model button */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setModelDropdownOpen(!modelDropdownOpen);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { color: colors.text, fontSize: 13 }]}>
                    {selectedModelInfo?.name ?? currentModel}
                  </Text>
                  {selectedModelInfo?.description ? (
                    <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                      {selectedModelInfo.description}
                    </Text>
                  ) : null}
                </View>
                {isLoadingModels ? (
                  <ActivityIndicator size="small" color={colors.textTertiary} />
                ) : (
                  <Ionicons
                    name={modelDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textTertiary}
                  />
                )}
              </TouchableOpacity>

              {/* Model dropdown list */}
              {modelDropdownOpen && (
                <View style={{ marginTop: spacing.sm }}>
                  {availableModels.length > 0 ? (
                    <>
                      {availableModels.map((model, index) => {
                        const isSelected = model.id === currentModel;
                        return (
                          <React.Fragment key={model.id}>
                            {index > 0 && (
                              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.xs }} />
                            )}
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => handleSelectModel(model.id)}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: spacing.sm + 2,
                                paddingHorizontal: spacing.sm,
                                backgroundColor: isSelected ? colors.primaryMuted : 'transparent',
                                borderRadius: radius.sm,
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    typography.bodySmall,
                                    {
                                      color: isSelected ? colors.primary : colors.text,
                                      fontWeight: isSelected ? '600' : '400',
                                    },
                                  ]}
                                >
                                  {model.name}
                                </Text>
                                {model.description ? (
                                  <Text
                                    style={[
                                      typography.caption,
                                      { color: colors.textTertiary, marginTop: 1, fontSize: 11 },
                                    ]}
                                  >
                                    {model.description}
                                  </Text>
                                ) : (
                                  <Text
                                    style={[
                                      typography.caption,
                                      { color: colors.textTertiary, marginTop: 1, fontSize: 11 },
                                    ]}
                                  >
                                    {model.id}
                                  </Text>
                                )}
                              </View>
                              {isSelected && (
                                <Ionicons name="checkmark" size={18} color={colors.primary} />
                              )}
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                      {/* Manual entry option */}
                      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.xs }} />
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          setModelDropdownOpen(false);
                        }}
                        style={{
                          paddingVertical: spacing.sm + 2,
                          paddingHorizontal: spacing.sm,
                        }}
                      >
                        <Text style={[typography.caption, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                          Or type a custom model ID below
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : isLoadingModels ? (
                    <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.sm }]}>
                        Fetching available models...
                      </Text>
                    </View>
                  ) : modelFetchError ? (
                    <View style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.sm }}>
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {needsApiKey && !config.apiKey
                          ? 'Enter your API key above to see available models.'
                          : 'Could not fetch models. Enter a model ID manually below.'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.sm }}>
                      <Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {needsApiKey && !config.apiKey
                          ? 'Enter your API key above to see available models.'
                          : 'No models found. Enter a model ID manually below.'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Custom model input (always visible below dropdown) */}
              <View style={{ marginTop: spacing.sm }}>
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
                <Text
                  style={[
                    typography.caption,
                    { color: colors.textTertiary, marginTop: spacing.xs, fontSize: 11 },
                  ]}
                >
                  Select from the list above or type a model ID directly.
                </Text>
              </View>
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
