// Metro config — ajoute le PDF aux extensions d'assets pour pouvoir
// `require("./assets/docs/foo.pdf")` et le bundler avec l'app.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [
  ...config.resolver.assetExts.filter((ext) => ext !== "pdf"),
  "pdf",
];

module.exports = config;
