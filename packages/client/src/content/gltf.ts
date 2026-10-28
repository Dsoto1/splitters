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
