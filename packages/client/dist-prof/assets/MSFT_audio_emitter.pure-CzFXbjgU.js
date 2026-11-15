import { L as Logger, at as ArrayItem, aq as GLTFLoader, V as Vector3, a5 as Tools, ai as GetBlobBufferSource, ar as unregisterGLTFExtension, as as registerGLTFExtension } from "./babylon-PnzH6wcM.js";
import { Sound } from "./sound.pure-DCfCJI4C.js";
import "./spatialWebAudio-DNn_yFfx.js";
import "./webAudioBaseSubGraph-BCodVyiC.js";
import "./abstractAudioNode-CyGHAvf_.js";
import "./webAudioSoundSource-DNwA1I76.js";
import "./abstractSoundSource-BROm-ocX.js";
import "./webAudioStaticSound-B3zBHiUS.js";
import "./abstractSoundInstance-D1fiMt1i.js";
import "./webAudioStreamingSound-DwzrwDYj.js";
import "./audioSceneComponent.pure-BOnctZyD.js";
import "./babylonFileParser.function-CbkFZ5Hm.js";
class AnimationEvent {
  /**
   * Initializes the animation event
   * @param frame The frame for which the event is triggered
   * @param action The event to perform when triggered
   * @param onlyOnce Specifies if the event should be triggered only once
   */
  constructor(frame, action, onlyOnce) {
    this.frame = frame;
    this.action = action;
    this.onlyOnce = onlyOnce;
    this.isDone = false;
  }
  /** @internal */
  _clone() {
    return new AnimationEvent(this.frame, this.action, this.onlyOnce);
  }
}
class WeightedSound {
  /**
   * Creates a new WeightedSound from the list of sounds given.
   * @param loop When true a Sound will be selected and played when the current playing Sound completes.
   * @param sounds Array of Sounds that will be selected from.
   * @param weights Array of number values for selection weights; length must equal sounds, values will be normalized to 1
   */
  constructor(loop, sounds, weights) {
    this.loop = false;
    this._coneInnerAngle = 360;
    this._coneOuterAngle = 360;
    this._volume = 1;
    this.isPlaying = false;
    this.isPaused = false;
    this._sounds = [];
    this._weights = [];
    if (sounds.length !== weights.length) {
      throw new Error("Sounds length does not equal weights length");
    }
    this.loop = loop;
    this._weights = weights;
    let weightSum = 0;
    for (const weight of weights) {
      weightSum += weight;
    }
    const invWeightSum = weightSum > 0 ? 1 / weightSum : 0;
    for (let i = 0; i < this._weights.length; i++) {
      this._weights[i] *= invWeightSum;
    }
    this._sounds = sounds;
    for (const sound of this._sounds) {
      sound.onEndedObservable.add(() => {
        this._onended();
      });
    }
  }
  /**
   * The size of cone in degrees for a directional sound in which there will be no attenuation.
   */
  get directionalConeInnerAngle() {
    return this._coneInnerAngle;
  }
  /**
   * The size of cone in degrees for a directional sound in which there will be no attenuation.
   */
  set directionalConeInnerAngle(value) {
    if (value !== this._coneInnerAngle) {
      if (this._coneOuterAngle < value) {
        Logger.Error("directionalConeInnerAngle: outer angle of the cone must be superior or equal to the inner angle.");
        return;
      }
      this._coneInnerAngle = value;
      for (const sound of this._sounds) {
        sound.directionalConeInnerAngle = value;
      }
    }
  }
  /**
   * Size of cone in degrees for a directional sound outside of which there will be no sound.
   * Listener angles between innerAngle and outerAngle will falloff linearly.
   */
  get directionalConeOuterAngle() {
    return this._coneOuterAngle;
  }
  /**
   * Size of cone in degrees for a directional sound outside of which there will be no sound.
   * Listener angles between innerAngle and outerAngle will falloff linearly.
   */
  set directionalConeOuterAngle(value) {
    if (value !== this._coneOuterAngle) {
      if (value < this._coneInnerAngle) {
        Logger.Error("directionalConeOuterAngle: outer angle of the cone must be superior or equal to the inner angle.");
        return;
      }
      this._coneOuterAngle = value;
      for (const sound of this._sounds) {
        sound.directionalConeOuterAngle = value;
      }
    }
  }
  /**
   * Playback volume.
   */
  get volume() {
    return this._volume;
  }
  /**
   * Playback volume.
   */
  set volume(value) {
    if (value !== this._volume) {
      for (const sound of this._sounds) {
        sound.setVolume(value);
      }
    }
  }
  _onended() {
    if (this._currentIndex !== void 0) {
      this._sounds[this._currentIndex].autoplay = false;
    }
    if (this.loop && this.isPlaying) {
      this.play();
    } else {
      this.isPlaying = false;
    }
  }
  /**
   * Suspend playback
   */
  pause() {
    if (this.isPlaying) {
      this.isPaused = true;
      if (this._currentIndex !== void 0) {
        this._sounds[this._currentIndex].pause();
      }
    }
  }
  /**
   * Stop playback
   */
  stop() {
    this.isPlaying = false;
    if (this._currentIndex !== void 0) {
      this._sounds[this._currentIndex].stop();
    }
  }
  /**
   * Start playback.
   * @param startOffset Position the clip head at a specific time in seconds.
   */
  play(startOffset) {
    if (!this.isPaused) {
      this.stop();
      const randomValue = Math.random();
      let total = 0;
      for (let i = 0; i < this._weights.length; i++) {
        total += this._weights[i];
        if (randomValue <= total) {
          this._currentIndex = i;
          break;
        }
      }
    }
    const sound = this._sounds[this._currentIndex ?? 0];
    if (sound.isReady()) {
      sound.play(0, this.isPaused ? void 0 : startOffset);
    } else {
      sound.autoplay = true;
    }
    this.isPlaying = true;
    this.isPaused = false;
  }
}
const NAME = "MSFT_audio_emitter";
class MSFT_audio_emitter {
  /**
   * @internal
   */
  constructor(loader) {
    this.name = NAME;
    this._loader = loader;
    this.enabled = this._loader.isExtensionUsed(NAME);
  }
  /** @internal */
  dispose() {
    this._loader = null;
    this._clips = null;
    this._emitters = null;
  }
  /** @internal */
  onLoading() {
    const extensions = this._loader.gltf.extensions;
    if (extensions && extensions[this.name]) {
      const extension = extensions[this.name];
      this._clips = extension.clips;
      this._emitters = extension.emitters;
      ArrayItem.Assign(this._clips);
      ArrayItem.Assign(this._emitters);
    }
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadSceneAsync(context, scene) {
    return GLTFLoader.LoadExtensionAsync(context, scene, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      promises.push(this._loader.loadSceneAsync(context, scene));
      for (const emitterIndex of extension.emitters) {
        const emitter = ArrayItem.Get(`${extensionContext}/emitters`, this._emitters, emitterIndex);
        if (emitter.refDistance != void 0 || emitter.maxDistance != void 0 || emitter.rolloffFactor != void 0 || emitter.distanceModel != void 0 || emitter.innerAngle != void 0 || emitter.outerAngle != void 0) {
          throw new Error(`${extensionContext}: Direction or Distance properties are not allowed on emitters attached to a scene`);
        }
        promises.push(this._loadEmitterAsync(`${extensionContext}/emitters/${emitter.index}`, emitter));
      }
      await Promise.all(promises);
    });
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadNodeAsync(context, node, assign) {
    return GLTFLoader.LoadExtensionAsync(context, node, this.name, async (extensionContext, extension) => {
      const promises = new Array();
      const babylonMesh = await this._loader.loadNodeAsync(extensionContext, node, (babylonMesh2) => {
        for (const emitterIndex of extension.emitters) {
          const emitter = ArrayItem.Get(`${extensionContext}/emitters`, this._emitters, emitterIndex);
          promises.push(
            // eslint-disable-next-line github/no-then
            this._loadEmitterAsync(`${extensionContext}/emitters/${emitter.index}`, emitter).then(() => {
              for (const sound of emitter._babylonSounds) {
                sound.attachToMesh(babylonMesh2);
                if (emitter.innerAngle != void 0 || emitter.outerAngle != void 0) {
                  sound.setLocalDirectionToMesh(Vector3.Forward());
                  sound.setDirectionalCone(2 * Tools.ToDegrees(emitter.innerAngle == void 0 ? Math.PI : emitter.innerAngle), 2 * Tools.ToDegrees(emitter.outerAngle == void 0 ? Math.PI : emitter.outerAngle), 0);
                }
              }
            })
          );
        }
        assign(babylonMesh2);
      });
      await Promise.all(promises);
      return babylonMesh;
    });
  }
  /**
   * @internal
   */
  // eslint-disable-next-line no-restricted-syntax
  loadAnimationAsync(context, animation) {
    return GLTFLoader.LoadExtensionAsync(context, animation, this.name, async (extensionContext, extension) => {
      const babylonAnimationGroup = await this._loader.loadAnimationAsync(context, animation);
      const promises = new Array();
      ArrayItem.Assign(extension.events);
      for (const event of extension.events) {
        promises.push(this._loadAnimationEventAsync(`${extensionContext}/events/${event.index}`, context, animation, event, babylonAnimationGroup));
      }
      await Promise.all(promises);
      return babylonAnimationGroup;
    });
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadClipAsync(context, clip) {
    if (clip._objectURL) {
      return clip._objectURL;
    }
    let promise;
    if (clip.uri) {
      promise = this._loader.loadUriAsync(context, clip, clip.uri);
    } else {
      const bufferView = ArrayItem.Get(`${context}/bufferView`, this._loader.gltf.bufferViews, clip.bufferView);
      promise = this._loader.loadBufferViewAsync(`/bufferViews/${bufferView.index}`, bufferView);
    }
    clip._objectURL = promise.then((data) => {
      const buffer = GetBlobBufferSource(data);
      return URL.createObjectURL(new Blob([buffer], { type: clip.mimeType }));
    });
    return clip._objectURL;
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadEmitterAsync(context, emitter) {
    emitter._babylonSounds = emitter._babylonSounds || [];
    if (!emitter._babylonData) {
      const clipPromises = new Array();
      const name = emitter.name || `emitter${emitter.index}`;
      const options = {
        loop: false,
        autoplay: false,
        volume: emitter.volume == void 0 ? 1 : emitter.volume
      };
      for (let i = 0; i < emitter.clips.length; i++) {
        const clipContext = `/extensions/${this.name}/clips`;
        const clip = ArrayItem.Get(clipContext, this._clips, emitter.clips[i].clip);
        clipPromises.push(
          // eslint-disable-next-line github/no-then
          this._loadClipAsync(`${clipContext}/${emitter.clips[i].clip}`, clip).then((objectURL) => {
            const sound = emitter._babylonSounds[i] = new Sound(name, objectURL, this._loader.babylonScene, null, options);
            sound.refDistance = emitter.refDistance || 1;
            sound.maxDistance = emitter.maxDistance || 256;
            sound.rolloffFactor = emitter.rolloffFactor || 1;
            sound.distanceModel = emitter.distanceModel || "exponential";
          })
        );
      }
      const promise = Promise.all(clipPromises).then(() => {
        const weights = emitter.clips.map((clip) => {
          return clip.weight || 1;
        });
        const weightedSound = new WeightedSound(emitter.loop || false, emitter._babylonSounds, weights);
        if (emitter.innerAngle) {
          weightedSound.directionalConeInnerAngle = 2 * Tools.ToDegrees(emitter.innerAngle);
        }
        if (emitter.outerAngle) {
          weightedSound.directionalConeOuterAngle = 2 * Tools.ToDegrees(emitter.outerAngle);
        }
        if (emitter.volume) {
          weightedSound.volume = emitter.volume;
        }
        emitter._babylonData.sound = weightedSound;
      });
      emitter._babylonData = {
        loaded: promise
      };
    }
    return emitter._babylonData.loaded;
  }
  _getEventAction(context, sound, action, time, startOffset) {
    switch (action) {
      case "play": {
        return (currentFrame) => {
          const frameOffset = (startOffset || 0) + (currentFrame - time);
          sound.play(frameOffset);
        };
      }
      case "stop": {
        return () => {
          sound.stop();
        };
      }
      case "pause": {
        return () => {
          sound.pause();
        };
      }
      default: {
        throw new Error(`${context}: Unsupported action ${action}`);
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async, no-restricted-syntax
  _loadAnimationEventAsync(context, animationContext, animation, event, babylonAnimationGroup) {
    if (babylonAnimationGroup.targetedAnimations.length == 0) {
      return Promise.resolve();
    }
    const babylonAnimation = babylonAnimationGroup.targetedAnimations[0];
    const emitterIndex = event.emitter;
    const emitter = ArrayItem.Get(`/extensions/${this.name}/emitters`, this._emitters, emitterIndex);
    return this._loadEmitterAsync(context, emitter).then(() => {
      const sound = emitter._babylonData.sound;
      if (sound) {
        const babylonAnimationEvent = new AnimationEvent(event.time, this._getEventAction(context, sound, event.action, event.time, event.startOffset));
        babylonAnimation.animation.addEvent(babylonAnimationEvent);
        babylonAnimationGroup.onAnimationGroupEndObservable.add(() => {
          sound.stop();
        });
        babylonAnimationGroup.onAnimationGroupPauseObservable.add(() => {
          sound.pause();
        });
      }
    });
  }
}
let _Registered = false;
function RegisterMSFT_audio_emitter() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  unregisterGLTFExtension(NAME);
  registerGLTFExtension(NAME, true, (loader) => new MSFT_audio_emitter(loader));
}
export {
  MSFT_audio_emitter,
  RegisterMSFT_audio_emitter
};
