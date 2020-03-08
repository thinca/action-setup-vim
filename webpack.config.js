const webpack = require("webpack");

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
  plugins: [
    new webpack.NormalModuleReplacementPlugin(
      /universal-user-agent[/\\]dist-web[/\\]index\.js/,
      "../dist-src/index.js"
    )
  ],
};
