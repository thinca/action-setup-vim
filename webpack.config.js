const webpack = require("webpack");
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  entry: "./src/index.ts",
  output: {
    filename: "action.js",
    path: __dirname,
  },
  target: "node",
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              allowTsInNodeModules: true,
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".js", ".ts"],
  },
  mode: "development",
  devtool: false,
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_fnames: /^AbortSignal$/,
        },
      }),
    ],
  },
  plugins: [
    new webpack.NormalModuleReplacementPlugin(
      /universal-user-agent[/\\]dist-web[/\\]index\.js/,
      "../dist-src/index.js"
    )
  ],
};
