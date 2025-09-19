import { useEffect } from "react";

export function useMonaco() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    type MonacoEnv = {
      MonacoEnvironment?: {
        getWorker?: (moduleId: string, label: string) => Worker;
      };
    };

    const monacoEnv = (window as MonacoEnv).MonacoEnvironment || {};
    (window as MonacoEnv).MonacoEnvironment = monacoEnv;

    monacoEnv.getWorker = function (_moduleId: string, label: string) {
      if (label === "json")
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/json/json.worker",
            import.meta.url,
          ),
          { type: "module" },
        );
      if (label === "css" || label === "scss" || label === "less")
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/css/css.worker",
            import.meta.url,
          ),
          { type: "module" },
        );
      if (label === "html" || label === "handlebars" || label === "razor")
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/html/html.worker",
            import.meta.url,
          ),
          { type: "module" },
        );
      if (label === "typescript" || label === "javascript")
        return new Worker(
          new URL(
            "monaco-editor/esm/vs/language/typescript/ts.worker",
            import.meta.url,
          ),
          { type: "module" },
        );
      return new Worker(
        new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url),
        { type: "module" },
      );
    };
  }, []);
}
