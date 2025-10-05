import HtmlWebpackPlugin from "html-webpack-plugin";
import type { Configuration } from "@rspack/core";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: Configuration = {
  entry: {
    main: "./src/_app.tsx",
  },
  output: {
    clean: true,
    path: path.join(__dirname, "dist"),
    filename: "[name].js",
    chunkFilename: "[name].[contenthash:8].js",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "typescript",
                tsx: true,
              },
              transform: {
                react: {
                  runtime: "automatic",
                },
              },
            },
          },
        },
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "index.html",
      chunks: ["main"],
      inject: true,
      title: "Orbo - Suspense Demo",
      template: "./src/ssr.tsx",
      sourceFile: "src/_app.tsx",
    }),
  ],
  mode: "development",
};

export default config;
