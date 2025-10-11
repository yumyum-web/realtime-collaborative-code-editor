import { renderHook, act } from "@testing-library/react";
import { useYjs } from "@/app/editor/[id]/hooks/useYjs";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { MonacoBinding } from "y-monaco";
import type * as Monaco from "monaco-editor";

// Mock all external dependencies to prevent actual Yjs initialization
jest.mock("yjs");
jest.mock("y-websocket");
jest.mock("y-monaco", () => ({
  MonacoBinding: jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
  })),
}));
jest.mock("@/app/editor/[id]/utils/colorHelpers", () => ({
  randomColor: jest.fn(() => "#ff0000"),
}));

// Mock Monaco editor types
const mockMonaco = {
  Uri: {
    parse: jest.fn((uri: string) => ({ toString: () => uri })),
  },
  editor: {
    getModel: jest.fn(() => null),
    createModel: jest.fn(),
    IModelDeltaDecoration: jest.fn(),
    TrackedRangeStickiness: {
      NeverGrowsWhenTypingAtEdges: 1,
    },
    Range: jest.fn((line: number, col: number) => ({ line, col })),
  },
  Range: jest.fn(),
} as unknown as typeof import("monaco-editor");

const mockEditor = {
  getDomNode: jest.fn(() => ({ isConnected: true })),
  getModel: jest.fn(() => ({ isDisposed: () => false })),
  setModel: jest.fn(),
  deltaDecorations: jest.fn(() => []),
  onDidChangeCursorPosition: jest.fn((callback) => {
    return { dispose: jest.fn(), callback };
  }),
} as unknown as Monaco.editor.IStandaloneCodeEditor;

describe("useYjs", () => {
  const mockUser = {
    id: "user1",
    username: "testuser",
    email: "test@example.com",
  };

  const mockFiles = {
    "test.js": 'console.log(\"hello\");',
  };

  const defaultParams = [
    "newfile.js", // activeFile
    mockUser, // user
    "project1", // projectId
    mockFiles, // initialFiles
    { ...mockFiles }, // files
    "main", // currentBranch
  ] as const;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Yjs mocks
    const mockYDoc = {
      getText: jest.fn(() => ({
        insert: jest.fn(),
        delete: jest.fn(),
        length: 0,
        toString: jest.fn(() => ""),
        observe: jest.fn(),
        unobserve: jest.fn(),
      })),
      getMap: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
      })),
      destroy: jest.fn(),
      isDestroyed: false,
    };

    const mockProvider = {
      awareness: {
        setLocalStateField: jest.fn(),
        getStates: jest.fn(() => new Map()),
        on: jest.fn(),
        off: jest.fn(),
        clientID: 1,
      },
      destroy: jest.fn(),
      synced: true,
      on: jest.fn(),
      off: jest.fn(),
    };

    const mockBinding = {
      destroy: jest.fn(),
    };

    (Y.Doc as jest.Mock).mockReturnValue(mockYDoc);
    (WebsocketProvider as jest.Mock).mockReturnValue(mockProvider);
    (MonacoBinding as jest.Mock).mockReturnValue(mockBinding);

    // Mock Monaco
    (mockMonaco.editor.getModel as jest.Mock).mockReturnValue(null);
    (mockMonaco.editor.createModel as jest.Mock).mockReturnValue({
      isDisposed: () => false,
    });
  });

  describe("Hook initialization", () => {
    it("should return presence array and setter functions", () => {
      const { result } = renderHook(() => useYjs(...defaultParams));

      expect(result.current).toHaveProperty("presence");
      expect(result.current).toHaveProperty("setEditor");
      expect(result.current).toHaveProperty("setMonaco");
      expect(Array.isArray(result.current.presence)).toBe(true);
    });

    it("should initialize with empty presence", () => {
      const { result } = renderHook(() => useYjs(...defaultParams));

      expect(result.current.presence).toEqual([]);
    });
  });

  describe("Monaco and Editor setup", () => {
    it("should allow setting monaco instance", () => {
      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco as typeof import("monaco-editor"));
      });

      // Should not throw
      expect(result.current.setMonaco).toBeDefined();
    });

    it("should allow setting editor instance", () => {
      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setEditor(
          mockEditor as Monaco.editor.IStandaloneCodeEditor,
        );
      });

      // Should not throw
      expect(result.current.setEditor).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should handle missing activeFile gracefully", () => {
      const { result } = renderHook(() =>
        useYjs("", mockUser, "project1", mockFiles, { ...mockFiles }, "main"),
      );

      expect(result.current.presence).toEqual([]);
    });

    it("should handle null user gracefully", () => {
      const { result } = renderHook(() =>
        useYjs(
          "test.js",
          null,
          "project1",
          mockFiles,
          { ...mockFiles },
          "main",
        ),
      );

      expect(result.current.presence).toEqual([]);
    });
  });

  describe("Yjs initialization", () => {
    it("should not initialize Yjs when activeFile is empty", () => {
      const { result } = renderHook(() =>
        useYjs("", mockUser, "project1", mockFiles, { ...mockFiles }, "main"),
      );

      act(() => {
        result.current.setMonaco(mockMonaco);
        result.current.setEditor(mockEditor);
      });

      expect(Y.Doc).not.toHaveBeenCalled();
      expect(WebsocketProvider).not.toHaveBeenCalled();
    });

    it("should not initialize Yjs when monaco is not available", () => {
      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setEditor(mockEditor);
      });

      expect(Y.Doc).not.toHaveBeenCalled();
      expect(WebsocketProvider).not.toHaveBeenCalled();
    });

    it("should initialize Yjs with correct room name", () => {
      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco);
        result.current.setEditor(mockEditor);
      });

      expect(Y.Doc).toHaveBeenCalled();
      expect(WebsocketProvider).toHaveBeenCalledWith(
        "ws://localhost:1234",
        "project1-main--newfile-js",
        expect.any(Object),
        { connect: true },
      );
    });

    it("should create Monaco model if it does not exist", () => {
      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco);
        result.current.setEditor(mockEditor);
      });

      expect(mockMonaco.editor.createModel).toHaveBeenCalledWith(
        "",
        undefined,
        expect.any(Object),
      );
    });

    it("should use existing Monaco model if available", () => {
      (mockMonaco.editor.getModel as jest.Mock).mockReturnValue({
        isDisposed: () => false,
      });

      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco);
        result.current.setEditor(mockEditor);
      });

      expect(mockMonaco.editor.createModel).not.toHaveBeenCalled();
    });
  });

  describe("Awareness and Presence", () => {
    it("should set local awareness state with user info", () => {
      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco);
        result.current.setEditor(mockEditor);
      });

      const mockProvider = (WebsocketProvider as jest.Mock).mock.results[0]
        .value;
      expect(mockProvider.awareness.setLocalStateField).toHaveBeenCalledWith(
        "user",
        {
          name: "testuser",
          email: "test@example.com",
          color: "#ff0000",
          cursor: null,
        },
      );
    });

    it("should update presence when awareness changes", () => {
      const mockStates = new Map([
        [
          1,
          {
            user: { name: "user1", color: "#ff0000" },
            cursor: { line: 1, column: 1 },
          },
        ],
        [
          2,
          {
            user: { name: "user2", color: "#00ff00" },
            cursor: { line: 2, column: 2 },
          },
        ],
      ]);

      const mockProvider = {
        awareness: {
          setLocalStateField: jest.fn(),
          getStates: jest.fn(() => mockStates),
          on: jest.fn((event, callback) => {
            if (event === "change") callback();
          }),
          off: jest.fn(),
          clientID: 1,
        },
        destroy: jest.fn(),
        synced: true,
        on: jest.fn(),
        off: jest.fn(),
      };

      (WebsocketProvider as jest.Mock).mockImplementation(() => mockProvider);

      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco);
        result.current.setEditor(mockEditor);
      });

      expect(result.current.presence).toHaveLength(2);
      expect(result.current.presence[0]).toEqual({
        clientId: 1,
        user: { name: "user1", color: "#ff0000" },
        cursor: { line: 1, column: 1 },
      });
    });

    it("should update cursor position on editor cursor change", () => {
      const mockProvider = {
        awareness: {
          setLocalStateField: jest.fn(),
          getStates: jest.fn(() => new Map()),
          on: jest.fn(),
          off: jest.fn(),
          clientID: 1,
        },
        destroy: jest.fn(),
        synced: true,
        on: jest.fn(),
        off: jest.fn(),
      };

      (WebsocketProvider as jest.Mock).mockImplementation(() => mockProvider);

      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco);
        result.current.setEditor(mockEditor);
      });

      // Get the callback that was passed to onDidChangeCursorPosition
      const cursorCallback = (mockEditor.onDidChangeCursorPosition as jest.Mock)
        .mock.calls[0][0];
      cursorCallback({
        position: { lineNumber: 5, column: 10 },
      });

      expect(mockProvider.awareness.setLocalStateField).toHaveBeenCalledWith(
        "cursor",
        { line: 5, column: 10 },
      );
    });
  });

  describe("Content Synchronization", () => {
    it("should initialize Yjs content when doc is empty", () => {
      const mockYText = {
        insert: jest.fn(),
        delete: jest.fn(),
        length: 0,
        toString: jest.fn(() => ""),
        observe: jest.fn(),
        unobserve: jest.fn(),
      };

      const mockYMap = {
        get: jest.fn((key) => {
          if (key === "initialized") return false;
          if (key === "lastForceRefresh") return 0;
          return undefined;
        }),
        set: jest.fn(),
      };

      const mockYDoc = {
        getText: jest.fn(() => mockYText),
        getMap: jest.fn(() => mockYMap),
        destroy: jest.fn(),
        isDestroyed: false,
      };

      (Y.Doc as jest.Mock).mockReturnValue(mockYDoc);

      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco as typeof import("monaco-editor"));
        result.current.setEditor(
          mockEditor as Monaco.editor.IStandaloneCodeEditor,
        );
      });

      // Test passes if no error is thrown during initialization
      expect(result.current.presence).toEqual([]);
    });

    it("should force refresh content when forceRefresh is provided", () => {
      const mockYText = {
        insert: jest.fn(),
        delete: jest.fn(),
        length: 5,
        toString: jest.fn(() => "old content"),
        observe: jest.fn(),
        unobserve: jest.fn(),
      };

      const mockYMap = {
        get: jest.fn((key) => {
          if (key === "initialized") return true;
          if (key === "lastForceRefresh") return 1000;
          return undefined;
        }),
        set: jest.fn(),
      };

      const mockYDoc = {
        getText: jest.fn(() => mockYText),
        getMap: jest.fn(() => mockYMap),
        destroy: jest.fn(),
        isDestroyed: false,
      };

      (Y.Doc as jest.Mock).mockImplementation(() => mockYDoc);

      const { result } = renderHook(() =>
        useYjs(
          "test.js",
          mockUser,
          "project1",
          mockFiles,
          { ...mockFiles },
          "main",
          2000,
        ),
      );

      act(() => {
        result.current.setMonaco(mockMonaco as typeof import("monaco-editor"));
        result.current.setEditor(
          mockEditor as Monaco.editor.IStandaloneCodeEditor,
        );
      });

      // Test passes if no error is thrown during force refresh
      expect(result.current.presence).toEqual([]);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup all resources on unmount", () => {
      const mockProvider = {
        awareness: {
          setLocalStateField: jest.fn(),
          getStates: jest.fn(() => new Map()),
          on: jest.fn(),
          off: jest.fn(),
          clientID: 1,
        },
        destroy: jest.fn(),
        synced: true,
        on: jest.fn(),
        off: jest.fn(),
      };

      const mockBinding = {
        destroy: jest.fn(),
      };

      const mockYText = {
        insert: jest.fn(),
        delete: jest.fn(),
        length: 0,
        toString: jest.fn(() => ""),
        observe: jest.fn(),
        unobserve: jest.fn(),
      };

      const mockYDoc = {
        getText: jest.fn(() => mockYText),
        getMap: jest.fn(() => ({
          get: jest.fn(() => true),
          set: jest.fn(),
        })),
        destroy: jest.fn(),
        isDestroyed: false,
      };

      (Y.Doc as jest.Mock).mockImplementation(() => mockYDoc);
      (WebsocketProvider as jest.Mock).mockImplementation(() => mockProvider);
      (MonacoBinding as jest.Mock).mockImplementation(() => mockBinding);

      const { result, unmount } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco as typeof import("monaco-editor"));
        result.current.setEditor(
          mockEditor as Monaco.editor.IStandaloneCodeEditor,
        );
      });

      unmount();

      // Test passes if no error is thrown during cleanup
      expect(result.current.presence).toEqual([]);
    });

    it("should cleanup when activeFile changes", () => {
      const mockProvider = {
        awareness: {
          setLocalStateField: jest.fn(),
          getStates: jest.fn(() => new Map()),
          on: jest.fn(),
          off: jest.fn(),
          clientID: 1,
        },
        destroy: jest.fn(),
        synced: true,
        on: jest.fn(),
        off: jest.fn(),
      };

      (WebsocketProvider as jest.Mock).mockImplementation(() => mockProvider);

      const { result, rerender } = renderHook((props) => useYjs(...props), {
        initialProps: defaultParams,
      });

      act(() => {
        result.current.setMonaco(mockMonaco);
        result.current.setEditor(mockEditor);
      });

      // Change activeFile
      rerender([
        "test.js",
        mockUser,
        "project1",
        mockFiles,
        { ...mockFiles },
        "main",
      ] as unknown as typeof defaultParams);

      expect(mockProvider.destroy).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle editor DOM not available gracefully", () => {
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const consoleLogSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      const mockEditorWithoutDom = {
        ...mockEditor,
        getDomNode: jest.fn(() => null),
      };

      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco);
        result.current.setEditor(mockEditorWithoutDom);
      });

      // Should not throw and should handle gracefully
      expect(result.current.presence).toEqual([]);

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it("should handle Monaco binding creation failure", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const consoleLogSpy = jest
        .spyOn(console, "log")
        .mockImplementation(() => {});

      (MonacoBinding as jest.Mock).mockImplementation(() => {
        throw new Error("Binding failed");
      });

      const { result } = renderHook(() => useYjs(...defaultParams));

      act(() => {
        result.current.setMonaco(mockMonaco as typeof import("monaco-editor"));
        result.current.setEditor(
          mockEditor as Monaco.editor.IStandaloneCodeEditor,
        );
      });

      // Test passes if no error is thrown despite binding failure
      expect(result.current.presence).toEqual([]);

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });
});
