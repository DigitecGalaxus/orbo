import React from "react";
import { renderToPipeableStream } from "react-dom/server.node";
import { Writable } from "stream";
import type HtmlWebpackPlugin from "html-webpack-plugin";
import App from "./_app";

interface RequireContext {
  (id: string): any;
  keys(): string[];
  resolve(id: string): string;
  id: string;
}

declare const require: {
  context(
    directory: string,
    useSubdirectories?: boolean,
    regExp?: RegExp
  ): RequireContext;
};

/** Executed by html-webpack-plugin (see rspack.config.ts) */
export default async function ssrTemplate(
  templateParameters: HtmlWebpackPlugin.TemplateParameter,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = templateParameters.htmlWebpackPlugin?.options || {};
    try {
      // Use require.context to pre-bundle all tsx files including lazy-loaded ones
      const requireContext: RequireContext = require.context(
        "./",
        true,
        /\.tsx$/,
      );
      const element = React.createElement(App);
      const { pipe } = renderToPipeableStream(element, {
        onShellReady() {
          const chunks: Buffer[] = [];
          const writableStream = new Writable({
            write(
              chunk: any,
              _encoding: BufferEncoding,
              callback: (error?: Error | null) => void,
            ) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
              callback();
            },
          });

          writableStream.on("finish", () => {
            console.log(chunks);
            const html = Buffer.concat(chunks).toString("utf8");
            // Create complete HTML document
            const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${options.title}</title>
</head>
<body>
    <div id="root">${html}</div>
</body>
</html>`;
            resolve(fullHtml);
          });

          writableStream.on("error", reject);
          pipe(writableStream);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          console.error("SSR Error:", error);
        },
      });
    } catch (error) {
      reject(error);
    }
  });
}
