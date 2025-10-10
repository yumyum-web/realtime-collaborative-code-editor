import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type * as Monaco from "monaco-editor";
import type { MonacoBinding } from "y-monaco";
import { randomColor } from "../utils/colorHelpers";
import type { PresenceUser, User } from "../types";

export function useYjs(
  activeFile: string,
  user: User | null,
  projectId: string,
  initialFiles: Record<string, string>,
  files: Record<string, string>,
) {
  const [monaco, setMonaco] = useState<typeof import("monaco-editor") | null>(
    null,
  );
  const [editor, setEditor] =
    useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [model, setModel] = useState<Monaco.editor.ITextModel | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const decorationsRef = useRef<string[]>([]);

  // Update remote cursor decorations
  const updateRemoteCursorDecorations = useCallback(
    (states: PresenceUser[]) => {
      if (!provider || !editor || !monaco) return;
      const myClientId = provider.awareness.clientID;
      const decs: Monaco.editor.IModelDeltaDecoration[] = [];

      states.forEach((s) => {
        if (!s.cursor || s.clientId === myClientId) return;
        const line = s.cursor.line ?? 1;
        const col = s.cursor.column ?? 1;
        decs.push({
          range: new monaco.Range(line, col, line, col),
          options: {
            isWholeLine: false,
            stickiness:
              monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            hoverMessage: {
              value: `**${s.user?.name ?? s.user?.email ?? "user"}**`,
            },
            inlineClassName: `remoteCursor_${s.clientId}`,
          },
        });
      });

      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        decs,
      );

      const styleId = "remote-cursors-styles";
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.innerHTML = states
        .map((s) => {
          if (!s.user) return "";
          const color = s.user.color ?? "#888";
          return `.monaco-editor .remoteCursor_${s.clientId} {
            background: rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.12);
            border-left: 2px solid ${color};
          }`;
        })
        .join("\n");
    },
    [editor, monaco, provider],
  );

  // Create new Y.Doc
  useEffect(() => {
    const doc = new Y.Doc();
    setYdoc(doc);
    return () => {
      doc.destroy();
    };
  }, [activeFile, projectId]);

  // Connect to WebSocket provider
  useEffect(() => {
    if (!ydoc) return;
    const safeFile = activeFile.replace(/[\/\\]/g, "--").replace(/\./g, "-");
    const roomName = `${projectId}-${safeFile}`;
    const provider = new WebsocketProvider(
      "ws://localhost:1234",
      roomName,
      ydoc,
    );
    setProvider(provider);

    return () => {
      try {
        provider.destroy();
      } catch {}
    };
  }, [activeFile, projectId, ydoc]);

  // Create Monaco model
  useEffect(() => {
    if (!activeFile || !monaco) return;

    const uri = monaco.Uri.parse(`inmemory:///${projectId}/${activeFile}`);
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel("", undefined, uri);
    }

    setModel(model);

    return () => {
      // Dispose old model safely
      if (model && !model.isDisposed()) {
        model.dispose();
      }
    };
  }, [activeFile, monaco, projectId]);

  // Attach model to editor
  useEffect(() => {
    if (!editor || !model) return;
    if (model.isDisposed()) return;
    editor.setModel(model);
  }, [editor, model]);

  // Yjs binding setup
  useEffect(() => {
    if (!ydoc || !model || !provider || model.isDisposed()) return;

    let binding: MonacoBinding | undefined;
    let ytext: Y.Text | undefined;
    let ymap: Y.Map<boolean> | undefined;

    const observeYText = () => {
      if (!files || !activeFile) return;
      files[activeFile] = ytext?.toString() ?? "";
    };

    import("y-monaco").then(({ MonacoBinding }) => {
      if (!ydoc || !provider || !model || model.isDisposed()) return;

      ytext = ydoc.getText("monaco");
      ymap = ydoc.getMap("metadata");

      const initializeContent = () => {
        const isInitialized = ymap!.get("initialized");
        const hasContent = ytext!.length > 0;

        if (!isInitialized && !hasContent && files[activeFile]) {
          ytext!.insert(0, files[activeFile]);
          ymap!.set("initialized", true);
        }
      };

      const onSync = () => {
        initializeContent();
        provider.off("synced", onSync);
      };
      provider.on("synced", onSync);

      ytext.observe(observeYText);

      binding = new MonacoBinding(
        ytext,
        model,
        editor ? new Set([editor]) : new Set(),
        provider.awareness,
      );
    });

    return () => {
      try {
        binding?.destroy?.();
      } catch {}
      try {
        ytext?.unobserve?.(observeYText);
      } catch {}
    };
  }, [model, provider, ydoc, editor, activeFile, files]);

  // Awareness setup
  useEffect(() => {
    if (!provider || !editor) return;
    const awareness = provider.awareness;

    if (user) {
      awareness.setLocalStateField("user", {
        name: user.username ?? user.email ?? "unknown",
        email: user.email,
        color: randomColor(),
        cursor: null,
      });
    }

    const onAwarenessChange = () => {
      const states = Array.from(awareness.getStates().entries()).map(
        ([clientId, state]) => ({
          clientId: Number(clientId),
          user: state?.user,
          cursor: state?.cursor,
        }),
      );
      setPresence(states);
      updateRemoteCursorDecorations(states);
    };

    awareness.on("change", onAwarenessChange);

    const cursorListener = editor.onDidChangeCursorPosition((e) => {
      awareness.setLocalStateField("cursor", {
        line: e.position.lineNumber,
        column: e.position.column,
      });
    });

    return () => {
      cursorListener?.dispose?.();
      try {
        awareness.off("change", onAwarenessChange);
      } catch {}
    };
  }, [user, updateRemoteCursorDecorations, provider, editor]);

  return { presence, setEditor, setMonaco };
}
