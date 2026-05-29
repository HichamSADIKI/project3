// Permet à TypeScript d'importer/require les fichiers PDF embarqués
// (ajoutés à metro `assetExts` dans metro.config.js).
declare module "*.pdf" {
  const value: number;
  export default value;
}
