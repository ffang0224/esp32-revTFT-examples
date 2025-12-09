import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface Prophecy {
  text: string;
  imageUrl: string;
  usedValues: [number, number]; // Indices of the 2 values used
}

export interface Dilemma {
  id: string;
  text: string;
  values: string[];
  prophecy?: Prophecy;
  createdAt: number;
}

interface DilemmaContextType {
  // Saved dilemmas
  dilemmas: Dilemma[];
  addDilemma: (dilemma: Dilemma) => void;
  updateDilemma: (id: string, updates: Partial<Dilemma>) => void;
  getDilemma: (id: string) => Dilemma | undefined;
  
  // Currently selected/viewed dilemma
  currentDilemma: Dilemma | null;
  setCurrentDilemma: (dilemma: Dilemma | null) => void;
  
  // Current draft (being created)
  draft: Partial<Dilemma>;
  setDraftText: (text: string) => void;
  setDraftValue: (index: number, value: string) => void;
  setDraftProphecy: (prophecy: Prophecy) => void;
  clearDraft: () => void;
  saveDraft: () => Dilemma | null;
  
  // Helper to get random 2 values
  getRandomValueIndices: () => [number, number];
}

const DilemmaContext = createContext<DilemmaContextType | null>(null);

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function DilemmaProvider({ children }: { children: React.ReactNode }) {
  const [dilemmas, setDilemmas] = useState<Dilemma[]>([]);
  const [currentDilemma, setCurrentDilemma] = useState<Dilemma | null>(null);
  const [draft, setDraft] = useState<Partial<Dilemma>>({
    values: ["", "", "", ""],
  });

  // Auto-select the most recent dilemma when dilemmas change
  useEffect(() => {
    if (dilemmas.length > 0 && !currentDilemma) {
      setCurrentDilemma(dilemmas[0]);
    } else if (dilemmas.length === 0) {
      setCurrentDilemma(null);
    }
  }, [dilemmas]);

  const addDilemma = useCallback((dilemma: Dilemma) => {
    setDilemmas((prev) => [dilemma, ...prev]);
    setCurrentDilemma(dilemma); // Auto-select newly added dilemma
  }, []);

  const updateDilemma = useCallback((id: string, updates: Partial<Dilemma>) => {
    setDilemmas((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
    // Keep currentDilemma in sync
    setCurrentDilemma((prev) => 
      prev?.id === id ? { ...prev, ...updates } : prev
    );
  }, []);

  const getDilemma = useCallback(
    (id: string) => {
      return dilemmas.find((d) => d.id === id);
    },
    [dilemmas]
  );

  const setDraftText = useCallback((text: string) => {
    setDraft((prev) => ({ ...prev, text }));
  }, []);

  const setDraftValue = useCallback((index: number, value: string) => {
    setDraft((prev) => {
      const values = [...(prev.values || ["", "", "", ""])];
      values[index] = value;
      return { ...prev, values };
    });
  }, []);

  const setDraftProphecy = useCallback((prophecy: Prophecy) => {
    setDraft((prev) => ({ ...prev, prophecy }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft({ values: ["", "", "", ""] });
  }, []);

  const saveDraft = useCallback(() => {
    if (!draft.text || !draft.values || draft.values.some((v) => !v)) {
      return null;
    }

    const newDilemma: Dilemma = {
      id: generateId(),
      text: draft.text,
      values: draft.values,
      prophecy: draft.prophecy,
      createdAt: Date.now(),
    };

    addDilemma(newDilemma);
    clearDraft();
    return newDilemma;
  }, [draft, addDilemma, clearDraft]);

  const getRandomValueIndices = useCallback((): [number, number] => {
    const indices = [0, 1, 2, 3];
    // Fisher-Yates shuffle first 2
    for (let i = 0; i < 2; i++) {
      const j = i + Math.floor(Math.random() * (4 - i));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return [indices[0], indices[1]] as [number, number];
  }, []);

  return (
    <DilemmaContext.Provider
      value={{
        dilemmas,
        addDilemma,
        updateDilemma,
        getDilemma,
        currentDilemma,
        setCurrentDilemma,
        draft,
        setDraftText,
        setDraftValue,
        setDraftProphecy,
        clearDraft,
        saveDraft,
        getRandomValueIndices,
      }}
    >
      {children}
    </DilemmaContext.Provider>
  );
}

export function useDilemma() {
  const context = useContext(DilemmaContext);
  if (!context) {
    throw new Error("useDilemma must be used within a DilemmaProvider");
  }
  return context;
}
