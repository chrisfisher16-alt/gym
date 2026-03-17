import { useMemo } from 'react';
import { useNutritionStore } from '../stores/nutrition-store';

export function useSupplements() {
  const userSupplements = useNutritionStore((s) => s.userSupplements);
  const supplementCatalog = useNutritionStore((s) => s.supplementCatalog);
  const addUserSupplement = useNutritionStore((s) => s.addUserSupplement);
  const removeUserSupplement = useNutritionStore((s) => s.removeUserSupplement);
  const logSupplement = useNutritionStore((s) => s.logSupplement);
  const unlogSupplement = useNutritionStore((s) => s.unlogSupplement);
  const selectedDate = useNutritionStore((s) => s.selectedDate);
  const dailyLogs = useNutritionStore((s) => s.dailyLogs);

  const supplementsTaken = dailyLogs[selectedDate]?.supplementsTaken ?? [];

  const activeSupplements = useMemo(
    () => userSupplements.filter((s) => s.isActive),
    [userSupplements],
  );

  const isSupplementTaken = (userSupplementId: string): boolean => {
    return supplementsTaken.includes(userSupplementId);
  };

  const availableCatalogItems = useMemo(() => {
    const addedIds = new Set(userSupplements.map((s) => s.supplementId));
    return supplementCatalog.filter((s) => !addedIds.has(s.id));
  }, [supplementCatalog, userSupplements]);

  return {
    userSupplements,
    activeSupplements,
    supplementCatalog,
    availableCatalogItems,
    supplementsTaken,
    addUserSupplement,
    removeUserSupplement,
    logSupplement,
    unlogSupplement,
    isSupplementTaken,
  };
}
