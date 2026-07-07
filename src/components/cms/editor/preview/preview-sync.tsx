/**
 * Preview ↔ Editor selection / hover sync.
 *
 * Tracks both block-level (path key) and section-level selection so the
 * preview can act as the primary editing surface alongside the structured
 * content panel. `lastSelectedFrom` lets contextual UI (e.g. floating
 * toolbar) prefer the source the user is currently interacting with.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type SelectionSource = "preview" | "editor";

export interface PreviewSync {
  selectedKey?: string;
  hoverKey?: string;
  setHover: (key: string | undefined) => void;
  select: (key: string, source?: SelectionSource) => void;

  selectedSectionId?: string;
  hoverSectionId?: string;
  setSectionHover: (id: string | undefined) => void;
  selectSection: (id: string, source?: SelectionSource) => void;

  lastSelectedFrom: SelectionSource;
  /** True only inside a SectionWorkspace preview — used to gate overlays. */
  active: boolean;
}

const NOOP: PreviewSync = {
  selectedKey: undefined,
  hoverKey: undefined,
  setHover: () => {},
  select: () => {},
  selectedSectionId: undefined,
  hoverSectionId: undefined,
  setSectionHover: () => {},
  selectSection: () => {},
  lastSelectedFrom: "editor",
  active: false,
};

const PreviewSyncContext = createContext<PreviewSync>(NOOP);

export function usePreviewSync(): PreviewSync {
  return useContext(PreviewSyncContext);
}

interface ProviderProps {
  selectedKey?: string;
  hoverKey?: string;
  onHoverChange?: (key: string | undefined) => void;
  onSelect: (key: string) => void;

  selectedSectionId?: string;
  hoverSectionId?: string;
  onSectionHoverChange?: (id: string | undefined) => void;
  onSelectSection?: (id: string) => void;

  children: ReactNode;
}

export function PreviewSyncProvider({
  selectedKey,
  hoverKey: controlledHover,
  onHoverChange,
  onSelect,
  selectedSectionId,
  hoverSectionId: controlledSectionHover,
  onSectionHoverChange,
  onSelectSection,
  children,
}: ProviderProps) {
  const [uncontrolledHover, setUncontrolledHover] = useState<string | undefined>();
  const [uncontrolledSectionHover, setUncontrolledSectionHover] = useState<string | undefined>();
  const hoverKey = controlledHover ?? uncontrolledHover;
  const hoverSectionId = controlledSectionHover ?? uncontrolledSectionHover;
  const setHover = onHoverChange ?? setUncontrolledHover;
  const setSectionHover = onSectionHoverChange ?? setUncontrolledSectionHover;

  const lastSourceRef = useRef<SelectionSource>("editor");
  const [lastSelectedFrom, setLastSelectedFrom] = useState<SelectionSource>("editor");

  const select = useCallback(
    (key: string, source: SelectionSource = "editor") => {
      lastSourceRef.current = source;
      setLastSelectedFrom(source);
      onSelect(key);
    },
    [onSelect],
  );
  const selectSection = useCallback(
    (id: string, source: SelectionSource = "editor") => {
      lastSourceRef.current = source;
      setLastSelectedFrom(source);
      onSelectSection?.(id);
    },
    [onSelectSection],
  );

  const value = useMemo<PreviewSync>(
    () => ({
      selectedKey,
      hoverKey,
      setHover,
      select,
      selectedSectionId,
      hoverSectionId,
      setSectionHover,
      selectSection,
      lastSelectedFrom,
      active: true,
    }),
    [selectedKey, hoverKey, setHover, select, selectedSectionId, hoverSectionId, setSectionHover, selectSection, lastSelectedFrom],
  );
  return <PreviewSyncContext.Provider value={value}>{children}</PreviewSyncContext.Provider>;
}

/** Section id passed down by SectionPreview so nested block renderers can
 *  call store actions (e.g. inline-text commits) without prop drilling. */
export const PreviewSectionContext = createContext<string | undefined>(undefined);
export function usePreviewSectionId(): string | undefined {
  return useContext(PreviewSectionContext);
}
