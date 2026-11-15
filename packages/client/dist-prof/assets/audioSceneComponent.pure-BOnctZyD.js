import { I as EngineStore, U as AbstractEngine, S as Scene, aI as SceneComponentConstants, V as Vector3, M as Matrix, aJ as PrecisionDate } from "./babylon-PnzH6wcM.js";
import { A as AddParser } from "./babylonFileParser.function-CbkFZ5Hm.js";
class SoundTrack {
  /**
   * Creates a new sound track.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/audio/playingSoundsMusic#using-sound-tracks
   * @param scene Define the scene the sound track belongs to
   * @param options
   */
  constructor(scene, options = {}) {
    this.id = -1;
    this._isInitialized = false;
    scene = scene || EngineStore.LastCreatedScene;
    if (!scene) {
      return;
    }
    this._scene = scene;
    this.soundCollection = [];
    this._options = options;
    if (!this._options.mainTrack && this._scene.soundTracks) {
      this._scene.soundTracks.push(this);
      this.id = this._scene.soundTracks.length - 1;
    }
  }
  _initializeSoundTrackAudioGraph() {
    if (AbstractEngine.audioEngine?.canUseWebAudio && AbstractEngine.audioEngine.audioContext) {
      this._outputAudioNode = AbstractEngine.audioEngine.audioContext.createGain();
      this._outputAudioNode.connect(AbstractEngine.audioEngine.masterGain);
      if (this._options) {
        if (this._options.volume) {
          this._outputAudioNode.gain.value = this._options.volume;
        }
      }
      this._isInitialized = true;
    }
  }
  /**
   * Release the sound track and its associated resources
   */
  dispose() {
    if (AbstractEngine.audioEngine && AbstractEngine.audioEngine.canUseWebAudio) {
      if (this._connectedAnalyser) {
        this._connectedAnalyser.stopDebugCanvas();
      }
      while (this.soundCollection.length) {
        this.soundCollection[0].dispose();
      }
      if (this._outputAudioNode) {
        this._outputAudioNode.disconnect();
      }
      this._outputAudioNode = null;
    }
  }
  /**
   * Adds a sound to this sound track
   * @param sound define the sound to add
   * @ignoreNaming
   */
  addSound(sound) {
    if (!this._isInitialized) {
      this._initializeSoundTrackAudioGraph();
    }
    if (AbstractEngine.audioEngine?.canUseWebAudio && this._outputAudioNode) {
      sound.connectToSoundTrackAudioNode(this._outputAudioNode);
    }
    if (sound.soundTrackId !== void 0) {
      if (sound.soundTrackId === -1) {
        this._scene.mainSoundTrack.removeSound(sound);
      } else if (this._scene.soundTracks) {
        this._scene.soundTracks[sound.soundTrackId].removeSound(sound);
      }
    }
    this.soundCollection.push(sound);
    sound.soundTrackId = this.id;
  }
  /**
   * Removes a sound to this sound track
   * @param sound define the sound to remove
   * @ignoreNaming
   */
  removeSound(sound) {
    const index = this.soundCollection.indexOf(sound);
    if (index !== -1) {
      this.soundCollection.splice(index, 1);
    }
  }
  /**
   * Set a global volume for the full sound track.
   * @param newVolume Define the new volume of the sound track
   */
  setVolume(newVolume) {
    if (AbstractEngine.audioEngine?.canUseWebAudio && this._outputAudioNode) {
      this._outputAudioNode.gain.value = newVolume;
    }
  }
  /**
   * Switch the panning model to HRTF:
   * Renders a stereo output of higher quality than equalpower — it uses a convolution with measured impulse responses from human subjects.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/audio/playingSoundsMusic#creating-a-spatial-3d-sound
   */
  switchPanningModelToHRTF() {
    if (AbstractEngine.audioEngine?.canUseWebAudio) {
      for (let i = 0; i < this.soundCollection.length; i++) {
        this.soundCollection[i].switchPanningModelToHRTF();
      }
    }
  }
  /**
   * Switch the panning model to Equal Power:
   * Represents the equal-power panning algorithm, generally regarded as simple and efficient. equalpower is the default value.
   * @see https://doc.babylonjs.com/features/featuresDeepDive/audio/playingSoundsMusic#creating-a-spatial-3d-sound
   */
  switchPanningModelToEqualPower() {
    if (AbstractEngine.audioEngine?.canUseWebAudio) {
      for (let i = 0; i < this.soundCollection.length; i++) {
        this.soundCollection[i].switchPanningModelToEqualPower();
      }
    }
  }
  /**
   * Connect the sound track to an audio analyser allowing some amazing
   * synchronization between the sounds/music and your visualization (VuMeter for instance).
   * @see https://doc.babylonjs.com/features/featuresDeepDive/audio/playingSoundsMusic#using-the-analyser
   * @param analyser The analyser to connect to the engine
   */
  connectToAnalyser(analyser) {
    if (this._connectedAnalyser) {
      this._connectedAnalyser.stopDebugCanvas();
    }
    this._connectedAnalyser = analyser;
    if (AbstractEngine.audioEngine?.canUseWebAudio && this._outputAudioNode) {
      this._outputAudioNode.disconnect();
      this._connectedAnalyser.connectAudioNodes(this._outputAudioNode, AbstractEngine.audioEngine.masterGain);
    }
  }
}
class AudioSceneComponent {
  /**
   * Gets whether audio is enabled or not.
   * Please use related enable/disable method to switch state.
   */
  get audioEnabled() {
    return this._audioEnabled;
  }
  /**
   * Gets whether audio is outputting to headphone or not.
   * Please use the according Switch methods to change output.
   */
  get headphone() {
    return this._headphone;
  }
  /**
   * Creates a new instance of the component for the given scene
   * @param scene Defines the scene to register the component in
   */
  constructor(scene) {
    this.name = SceneComponentConstants.NAME_AUDIO;
    this._audioEnabled = true;
    this._headphone = false;
    this.audioPositioningRefreshRate = 500;
    this.audioListenerPositionProvider = null;
    this.audioListenerRotationProvider = null;
    this._cachedCameraDirection = new Vector3();
    this._cachedCameraPosition = new Vector3();
    this._lastCheck = 0;
    this._invertMatrixTemp = new Matrix();
    this._cameraDirectionTemp = new Vector3();
    scene = scene || EngineStore.LastCreatedScene;
    if (!scene) {
      return;
    }
    this.scene = scene;
    scene.soundTracks = [];
    scene.sounds = [];
  }
  /**
   * Registers the component in a given scene
   */
  register() {
    this.scene._afterRenderStage.registerStep(SceneComponentConstants.STEP_AFTERRENDER_AUDIO, this, this._afterRender);
  }
  /**
   * Rebuilds the elements related to this component in case of
   * context lost for instance.
   */
  rebuild() {
  }
  /**
   * Serializes the component data to the specified json object
   * @param serializationObject The object to serialize to
   */
  serialize(serializationObject) {
    serializationObject.sounds = [];
    if (this.scene.soundTracks) {
      for (let index = 0; index < this.scene.soundTracks.length; index++) {
        const soundtrack = this.scene.soundTracks[index];
        for (let soundId = 0; soundId < soundtrack.soundCollection.length; soundId++) {
          serializationObject.sounds.push(soundtrack.soundCollection[soundId].serialize());
        }
      }
    }
  }
  /**
   * Adds all the elements from the container to the scene
   * @param container the container holding the elements
   */
  addFromContainer(container) {
    if (!container.sounds) {
      return;
    }
    for (const sound of container.sounds) {
      sound.play();
      sound.autoplay = true;
      this.scene.mainSoundTrack.addSound(sound);
    }
  }
  /**
   * Removes all the elements in the container from the scene
   * @param container contains the elements to remove
   * @param dispose if the removed element should be disposed (default: false)
   */
  removeFromContainer(container, dispose = false) {
    if (!container.sounds) {
      return;
    }
    for (const sound of container.sounds) {
      sound.stop();
      sound.autoplay = false;
      this.scene.mainSoundTrack.removeSound(sound);
      if (dispose) {
        sound.dispose();
      }
    }
  }
  /**
   * Disposes the component and the associated resources.
   */
  dispose() {
    const scene = this.scene;
    if (scene._mainSoundTrack) {
      scene.mainSoundTrack.dispose();
    }
    if (scene.soundTracks) {
      for (let scIndex = 0; scIndex < scene.soundTracks.length; scIndex++) {
        scene.soundTracks[scIndex].dispose();
      }
    }
  }
  /**
   * Disables audio in the associated scene.
   */
  disableAudio() {
    const scene = this.scene;
    this._audioEnabled = false;
    if (AbstractEngine.audioEngine && AbstractEngine.audioEngine.audioContext) {
      AbstractEngine.audioEngine.audioContext.suspend();
    }
    let i;
    for (i = 0; i < scene.mainSoundTrack.soundCollection.length; i++) {
      scene.mainSoundTrack.soundCollection[i].pause();
    }
    if (scene.soundTracks) {
      for (i = 0; i < scene.soundTracks.length; i++) {
        for (let j = 0; j < scene.soundTracks[i].soundCollection.length; j++) {
          scene.soundTracks[i].soundCollection[j].pause();
        }
      }
    }
  }
  /**
   * Enables audio in the associated scene.
   */
  enableAudio() {
    const scene = this.scene;
    this._audioEnabled = true;
    if (AbstractEngine.audioEngine && AbstractEngine.audioEngine.audioContext) {
      AbstractEngine.audioEngine.audioContext.resume();
    }
    let i;
    for (i = 0; i < scene.mainSoundTrack.soundCollection.length; i++) {
      if (scene.mainSoundTrack.soundCollection[i].isPaused) {
        scene.mainSoundTrack.soundCollection[i].play();
      }
    }
    if (scene.soundTracks) {
      for (i = 0; i < scene.soundTracks.length; i++) {
        for (let j = 0; j < scene.soundTracks[i].soundCollection.length; j++) {
          if (scene.soundTracks[i].soundCollection[j].isPaused) {
            scene.soundTracks[i].soundCollection[j].play();
          }
        }
      }
    }
  }
  /**
   * Switch audio to headphone output.
   */
  switchAudioModeForHeadphones() {
    const scene = this.scene;
    this._headphone = true;
    scene.mainSoundTrack.switchPanningModelToHRTF();
    if (scene.soundTracks) {
      for (let i = 0; i < scene.soundTracks.length; i++) {
        scene.soundTracks[i].switchPanningModelToHRTF();
      }
    }
  }
  /**
   * Switch audio to normal speakers.
   */
  switchAudioModeForNormalSpeakers() {
    const scene = this.scene;
    this._headphone = false;
    scene.mainSoundTrack.switchPanningModelToEqualPower();
    if (scene.soundTracks) {
      for (let i = 0; i < scene.soundTracks.length; i++) {
        scene.soundTracks[i].switchPanningModelToEqualPower();
      }
    }
  }
  _afterRender() {
    const now = PrecisionDate.Now;
    if (this._lastCheck && now - this._lastCheck < this.audioPositioningRefreshRate) {
      return;
    }
    this._lastCheck = now;
    const scene = this.scene;
    if (!this._audioEnabled || !scene._mainSoundTrack || !scene.soundTracks || scene._mainSoundTrack.soundCollection.length === 0 && scene.soundTracks.length === 1) {
      return;
    }
    const audioEngine = AbstractEngine.audioEngine;
    if (!audioEngine) {
      return;
    }
    if (audioEngine.audioContext) {
      let listeningCamera = scene.activeCamera;
      if (scene.activeCameras && scene.activeCameras.length > 0) {
        listeningCamera = scene.activeCameras[0];
      }
      if (this.audioListenerPositionProvider) {
        const position = this.audioListenerPositionProvider();
        audioEngine.audioContext.listener.setPosition(position.x || 0, position.y || 0, position.z || 0);
      } else if (listeningCamera) {
        if (!this._cachedCameraPosition.equals(listeningCamera.globalPosition)) {
          this._cachedCameraPosition.copyFrom(listeningCamera.globalPosition);
          audioEngine.audioContext.listener.setPosition(listeningCamera.globalPosition.x, listeningCamera.globalPosition.y, listeningCamera.globalPosition.z);
        }
      } else {
        audioEngine.audioContext.listener.setPosition(0, 0, 0);
      }
      if (this.audioListenerRotationProvider) {
        const rotation = this.audioListenerRotationProvider();
        audioEngine.audioContext.listener.setOrientation(rotation.x || 0, rotation.y || 0, rotation.z || 0, 0, 1, 0);
      } else if (listeningCamera) {
        if (listeningCamera.rigCameras && listeningCamera.rigCameras.length > 0) {
          listeningCamera = listeningCamera.rigCameras[0];
        }
        listeningCamera.getViewMatrix().invertToRef(this._invertMatrixTemp);
        Vector3.TransformNormalToRef(AudioSceneComponent._CameraDirection, this._invertMatrixTemp, this._cameraDirectionTemp);
        this._cameraDirectionTemp.normalize();
        if (!isNaN(this._cameraDirectionTemp.x) && !isNaN(this._cameraDirectionTemp.y) && !isNaN(this._cameraDirectionTemp.z)) {
          if (!this._cachedCameraDirection.equals(this._cameraDirectionTemp)) {
            this._cachedCameraDirection.copyFrom(this._cameraDirectionTemp);
            audioEngine.audioContext.listener.setOrientation(this._cameraDirectionTemp.x, this._cameraDirectionTemp.y, this._cameraDirectionTemp.z, 0, 1, 0);
          }
        }
      } else {
        audioEngine.audioContext.listener.setOrientation(0, 0, 0, 0, 1, 0);
      }
      let i;
      for (i = 0; i < scene.mainSoundTrack.soundCollection.length; i++) {
        const sound = scene.mainSoundTrack.soundCollection[i];
        if (sound.useCustomAttenuation) {
          sound.updateDistanceFromListener();
        }
      }
      if (scene.soundTracks) {
        for (i = 0; i < scene.soundTracks.length; i++) {
          for (let j = 0; j < scene.soundTracks[i].soundCollection.length; j++) {
            const sound = scene.soundTracks[i].soundCollection[j];
            if (sound.useCustomAttenuation) {
              sound.updateDistanceFromListener();
            }
          }
        }
      }
    }
  }
}
AudioSceneComponent._CameraDirection = /* @__PURE__ */ new Vector3(0, 0, -1);
let _Registered = false;
function RegisterAudioSceneComponent(soundClass) {
  if (_Registered) {
    return;
  }
  _Registered = true;
  AddParser(SceneComponentConstants.NAME_AUDIO, (parsedData, scene, container, rootUrl) => {
    const loadedSounds = [];
    let loadedSound;
    container.sounds = container.sounds || [];
    if (parsedData.sounds !== void 0 && parsedData.sounds !== null) {
      for (let index = 0, cache = parsedData.sounds.length; index < cache; index++) {
        const parsedSound = parsedData.sounds[index];
        if (AbstractEngine.audioEngine?.canUseWebAudio) {
          if (!parsedSound.url) {
            parsedSound.url = parsedSound.name;
          }
          if (!loadedSounds[parsedSound.url]) {
            loadedSound = soundClass.Parse(parsedSound, scene, rootUrl);
            loadedSounds[parsedSound.url] = loadedSound;
            container.sounds.push(loadedSound);
          } else {
            container.sounds.push(soundClass.Parse(parsedSound, scene, rootUrl, loadedSounds[parsedSound.url]));
          }
        } else {
          container.sounds.push(new soundClass(parsedSound.name, null, scene));
        }
      }
    }
  });
  Object.defineProperty(Scene.prototype, "mainSoundTrack", {
    get: function() {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      if (!this._mainSoundTrack) {
        this._mainSoundTrack = new SoundTrack(this, { mainTrack: true });
      }
      return this._mainSoundTrack;
    },
    enumerable: true,
    configurable: true
  });
  Scene.prototype.getSoundByName = function(name) {
    let index;
    for (index = 0; index < this.mainSoundTrack.soundCollection.length; index++) {
      if (this.mainSoundTrack.soundCollection[index].name === name) {
        return this.mainSoundTrack.soundCollection[index];
      }
    }
    if (this.soundTracks) {
      for (let sdIndex = 0; sdIndex < this.soundTracks.length; sdIndex++) {
        for (index = 0; index < this.soundTracks[sdIndex].soundCollection.length; index++) {
          if (this.soundTracks[sdIndex].soundCollection[index].name === name) {
            return this.soundTracks[sdIndex].soundCollection[index];
          }
        }
      }
    }
    return null;
  };
  Object.defineProperty(Scene.prototype, "audioEnabled", {
    get: function() {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      return compo.audioEnabled;
    },
    set: function(value) {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      if (value) {
        compo.enableAudio();
      } else {
        compo.disableAudio();
      }
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(Scene.prototype, "headphone", {
    get: function() {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      return compo.headphone;
    },
    set: function(value) {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      if (value) {
        compo.switchAudioModeForHeadphones();
      } else {
        compo.switchAudioModeForNormalSpeakers();
      }
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(Scene.prototype, "audioListenerPositionProvider", {
    get: function() {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      return compo.audioListenerPositionProvider;
    },
    set: function(value) {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      if (value && typeof value !== "function") {
        throw new Error("The value passed to [Scene.audioListenerPositionProvider] must be a function that returns a Vector3");
      } else {
        compo.audioListenerPositionProvider = value;
      }
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(Scene.prototype, "audioListenerRotationProvider", {
    get: function() {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      return compo.audioListenerRotationProvider;
    },
    set: function(value) {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      if (value && typeof value !== "function") {
        throw new Error("The value passed to [Scene.audioListenerRotationProvider] must be a function that returns a Vector3");
      } else {
        compo.audioListenerRotationProvider = value;
      }
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(Scene.prototype, "audioPositioningRefreshRate", {
    get: function() {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      return compo.audioPositioningRefreshRate;
    },
    set: function(value) {
      let compo = this._getComponent(SceneComponentConstants.NAME_AUDIO);
      if (!compo) {
        compo = new AudioSceneComponent(this);
        this._addComponent(compo);
      }
      compo.audioPositioningRefreshRate = value;
    },
    enumerable: true,
    configurable: true
  });
  soundClass._SceneComponentInitialization = (scene) => {
    let compo = scene._getComponent(SceneComponentConstants.NAME_AUDIO);
    if (!compo) {
      compo = new AudioSceneComponent(scene);
      scene._addComponent(compo);
    }
  };
}
export {
  AudioSceneComponent,
  RegisterAudioSceneComponent
};
