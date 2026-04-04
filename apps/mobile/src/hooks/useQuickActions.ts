import { useState, useCallback } from 'react';
import type { QuickActionSheetProps } from '../components/ui/QuickActionSheet';

type ShowConfig = Omit<QuickActionSheetProps, 'visible' | 'onClose'>;

export function useQuickActions() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ShowConfig | null>(null);

  const hide = useCallback(() => {
    setVisible(false);
  }, []);

  const show = useCallback(
    (props: ShowConfig) => {
      setConfig(props);
      setVisible(true);
    },
    [],
  );

  const sheetProps: QuickActionSheetProps = {
    title: config?.title ?? '',
    actions: config?.actions ?? [],
    subtitle: config?.subtitle,
    preview: config?.preview,
    visible,
    onClose: hide,
  };

  return { show, hide, sheetProps } as const;
}
