import { K as ShaderStore } from "./babylon-PnzH6wcM.js";
const name = "iblVoxelOpacityAtomicMax";
const shader = `fn voxelOpacityAtomicMax(vidx: u32,value: u32) {let wordIdx: u32=vidx>>2u;let shift: u32=(vidx & 3u)*8u;let mask: u32=0xFFu<<shift;let shifted: u32=(value & 0xFFu)<<shift;loop {let oldWord: u32=atomicLoad(&voxelOpacityBuffer[wordIdx]);if (value<=((oldWord>>shift) & 0xFFu)) {break;}
let newWord: u32=(oldWord & ~mask) | shifted;if (atomicCompareExchangeWeak(&voxelOpacityBuffer[wordIdx],oldWord,newWord).exchanged) {break;}}}
`;
if (!ShaderStore.IncludesShadersStoreWGSL[name]) {
  ShaderStore.IncludesShadersStoreWGSL[name] = shader;
}
const iblVoxelOpacityAtomicMaxWGSL = { name, shader };
export {
  iblVoxelOpacityAtomicMaxWGSL as i
};
