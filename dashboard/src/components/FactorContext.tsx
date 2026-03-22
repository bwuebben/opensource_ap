import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { SignalDoc, FactorStats } from "../types";
import { loadSignalDoc, loadFactorStats } from "../dataLoader";
import FactorInfoModal from "./FactorInfoModal";

interface FactorContextValue {
  openFactor: (acronym: string) => void;
  signalLookup: Record<string, SignalDoc>;
  statsLookup: Record<string, FactorStats>;
}

const FactorContext = createContext<FactorContextValue>({
  openFactor: () => {},
  signalLookup: {},
  statsLookup: {},
});

export function useFactorContext() {
  return useContext(FactorContext);
}

export function FactorProvider({ children }: { children: React.ReactNode }) {
  const [signalLookup, setSignalLookup] = useState<Record<string, SignalDoc>>({});
  const [statsLookup, setStatsLookup] = useState<Record<string, FactorStats>>({});
  const [activeFactor, setActiveFactor] = useState<string | null>(null);

  useEffect(() => {
    loadSignalDoc().then((docs) => {
      const m: Record<string, SignalDoc> = {};
      for (const d of docs) {
        if (d.Acronym) m[d.Acronym] = d;
      }
      setSignalLookup(m);
    });
    loadFactorStats().then((stats) => setStatsLookup(stats));
  }, []);

  const openFactor = useCallback((acronym: string) => {
    setActiveFactor(acronym);
  }, []);

  return (
    <FactorContext.Provider value={{ openFactor, signalLookup, statsLookup }}>
      {children}
      {activeFactor && (
        <FactorInfoModal
          signal={signalLookup[activeFactor] || null}
          stats={statsLookup[activeFactor] || null}
          onClose={() => setActiveFactor(null)}
        />
      )}
    </FactorContext.Provider>
  );
}
