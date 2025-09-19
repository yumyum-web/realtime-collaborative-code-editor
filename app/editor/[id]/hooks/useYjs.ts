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
  filesContent: Record<string, string>,
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
            className: undefined,
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

      // CSS for remote cursors
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
          return `.monaco-editor .remoteCursor_${s.clientId} { background: rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, 0.12); border-left: 2px solid ${color}; }`;
        })
        .join("\n");
    },
    [editor, monaco, provider],
  );

  // Create Y.Doc
  useEffect(() => {
    const doc = new Y.Doc();
    setYdoc(doc);
    return () => {
      try {
        doc.destroy?.();
      } catch {}
    };
  }, [activeFile, projectId]);

  // Connect to Yjs server
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
      provider?.destroy?.();
    };
  }, [activeFile, projectId, ydoc]);

  // Setup model for the active file
  useEffect(() => {
    if (!activeFile || !monaco) return;

    const uri = monaco.Uri.parse(`inmemory:///${projectId}/${activeFile}`);
    let model = monaco.editor.getModel(uri);
    if (!model) {
      model = monaco.editor.createModel("", undefined, uri);
    }

    setModel(model);
  }, [activeFile, monaco, projectId]);

  // Update editor with the new model
  useEffect(() => {
    if (!editor || !model) return;
    editor.setModel(model);
  }, [editor, model]);

  // Setup monaco binding
  useEffect(() => {
    let binding: MonacoBinding | undefined;
    import("y-monaco").then(({ MonacoBinding }) => {
      if (!ydoc || !model || !provider) return;
      const ytext = ydoc.getText("monaco");
      const ymap = ydoc.getMap("metadata");

      const initializeContent = () => {
        const isInitialized = ymap.get("initialized");
        const hasContent = ytext.length > 0;

        if (
          !isInitialized &&
          !hasContent &&
          activeFile &&
          filesContent[activeFile]
        ) {
          ytext.insert(0, filesContent[activeFile]);
          ymap.set("initialized", true);
        }
      };

      if (provider.synced) {
        // If already synced, initialize immediately
        initializeContent();
      } else {
        // Wait for initial sync to complete
        const onSync = () => {
          initializeContent();
          provider.off("synced", onSync);
        };
        provider.on("synced", onSync);
      }

      binding = new MonacoBinding(
        ytext,
        model,
        editor ? new Set([editor]) : new Set(),
        provider.awareness,
      );
    });

    return () => {
      binding?.destroy?.();
    };
  }, [model, provider, ydoc, editor, activeFile, filesContent]);

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
      try {
        cursorListener?.dispose();
      } catch {}
      try {
        awareness.off("change", onAwarenessChange);
      } catch {}
    };
  }, [user, updateRemoteCursorDecorations, provider, editor]);

  return {
    presence,
    setEditor,
    setMonaco,
  };
}
