"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

type ChosenGroup = {
  // The group the user picked last; null is "all".
  current: () => number | null;
  choose: (groupId: number | null) => void;
};

const ChosenGroupContext = createContext<ChosenGroup | null>(null);

// A click on a group filter sets the chosen group right away, before the
// server answers, so the search never puts back the group that was shown
// before the click.
export function ChosenGroupProvider({
  groupId,
  children,
}: {
  // The group in the address.
  groupId: number | null;
  children: React.ReactNode;
}) {
  const chosen = useRef(groupId);
  const [value] = useState<ChosenGroup>(() => ({
    current: () => chosen.current,
    choose: (next) => {
      chosen.current = next;
    },
  }));

  // Once a page with a group lands (a switch, the Back button), the address
  // is the source of truth again.
  useEffect(() => {
    chosen.current = groupId;
  }, [groupId]);

  return (
    <ChosenGroupContext.Provider value={value}>
      {children}
    </ChosenGroupContext.Provider>
  );
}

export function useChosenGroup(): ChosenGroup {
  const chosen = useContext(ChosenGroupContext);
  if (!chosen) throw new Error("useChosenGroup needs a ChosenGroupProvider");
  return chosen;
}
