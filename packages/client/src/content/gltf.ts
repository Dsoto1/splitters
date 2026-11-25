// The glTF 2.0 loader for our models. '@babylonjs/loaders/glTF/2.0' bundles every
// built-in extension up front (interactivity and its flow graph, audio emitters,
// splats, Draco…), most of it never used by our files. Instead: every built-in
// extension is registered as an on-demand import (Babylon's own dynamic
// registration: the same set, each loaded the first time a model uses it), and
// the ones our models do use (tools/content: KHR_mesh_quantization, texture
// transforms, the material extensions below) plus the always-on ExtrasAsMetadata
// are registered eagerly, so loading a model never waits for a chunk.
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import { registerBuiltInGLTFExtensions } from '@babylonjs/loaders/glTF/2.0/Extensions/dynamic';
import { RegisterExtrasAsMetadata } from '@babylonjs/loaders/glTF/2.0/Extensions/ExtrasAsMetadata.pure';
import { RegisterKHR_mesh_quantization } from '@babylonjs/loaders/glTF/2.0/Extensions/KHR_mesh_quantization.pure';
import { RegisterKHR_texture_transform } from '@babylonjs/loaders/glTF/2.0/Extensions/KHR_texture_transform.pure';
import { RegisterKHR_materials_unlit } from '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_unlit.pure';
import { RegisterKHR_materials_specular } from '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_specular.pure';
import { RegisterKHR_materials_ior } from '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_ior.pure';
import { RegisterKHR_materials_emissive_strength } from '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_emissive_strength.pure';
import { RegisterKHR_materials_transmission } from '@babylonjs/loaders/glTF/2.0/Extensions/KHR_materials_transmission.pure';
import { RegisterKHR_texture_basisu } from '@babylonjs/loaders/glTF/2.0/Extensions/KHR_texture_basisu.pure';
import { KhronosTextureContainer2 } from '@babylonjs/core/Misc/khronosTextureContainer2';
import { versioned } from '../assetUrl.ts';

// GPU-compressed maps (KTX2 with Basis Universal: the characters' colour and normal maps, tools/content/ktx2.mjs).
// Babylon's decoder transcodes each to what the GPU takes (BC7 on desktops, ASTC or ETC on phones; plain RGBA where
// none is supported, so a texture always shows), in workers, with its transcoders served from our own public/ktx2/
// (Babylon's default is its CDN: the game loads nothing from other hosts). The files are babylonjs-ktx2decoder's and
// the transcoders of the same Babylon release (docs/CONTENT_PIPELINE.md, "GPU-compressed textures").
const KTX2 = (file: string): string => versioned(`${import.meta.env.BASE_URL}ktx2/${file}`);
KhronosTextureContainer2.URLConfig = {
  jsDecoderModule: KTX2('babylon.ktx2Decoder.js'),
  wasmUASTCToASTC: KTX2('uastc_astc.wasm'),
  wasmUASTCToBC7: KTX2('uastc_bc7.wasm'),
  wasmUASTCToRGBA_UNORM: KTX2('uastc_rgba8_unorm_v2.wasm'),
  wasmUASTCToRGBA_SRGB: KTX2('uastc_rgba8_srgb_v2.wasm'),
  wasmUASTCToR8_UNORM: KTX2('uastc_r8_unorm.wasm'),
  wasmUASTCToRG8_UNORM: KTX2('uastc_rg8_unorm.wasm'),
  jsMSCTranscoder: KTX2('msc_basis_transcoder.js'),
  wasmMSCTranscoder: KTX2('msc_basis_transcoder.wasm'),
  wasmZSTDDecoder: KTX2('zstddec.wasm'),
};

// First the on-demand factories for all of them, then the eager ones replace theirs (order matters).
registerBuiltInGLTFExtensions();
RegisterExtrasAsMetadata();
RegisterKHR_mesh_quantization();
RegisterKHR_texture_transform();
RegisterKHR_materials_unlit();
RegisterKHR_materials_specular();
RegisterKHR_materials_ior();
RegisterKHR_materials_emissive_strength();
RegisterKHR_materials_transmission();
RegisterKHR_texture_basisu();
