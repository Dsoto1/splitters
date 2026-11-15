const BabylonFileParsers = {};
const IndividualBabylonFileParsers = {};
function AddParser(name, parser) {
  BabylonFileParsers[name] = parser;
}
function AddIndividualParser(name, parser) {
  IndividualBabylonFileParsers[name] = parser;
}
function GetIndividualParser(name) {
  if (IndividualBabylonFileParsers[name]) {
    return IndividualBabylonFileParsers[name];
  }
  return null;
}
function Parse(jsonData, scene, container, rootUrl) {
  for (const parserName in BabylonFileParsers) {
    if (Object.prototype.hasOwnProperty.call(BabylonFileParsers, parserName)) {
      BabylonFileParsers[parserName](jsonData, scene, container, rootUrl);
    }
  }
}
export {
  AddParser as A,
  GetIndividualParser as G,
  Parse as P,
  AddIndividualParser as a
};
