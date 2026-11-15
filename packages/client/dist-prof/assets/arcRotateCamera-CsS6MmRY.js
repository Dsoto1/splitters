import { a2 as PointerEventTypes, aJ as PrecisionDate, c3 as Epsilon, an as Animation, O as Observable, V as Vector3, a8 as __runInitializers, a5 as Tools, a7 as __esDecorate, bm as serialize, c4 as CameraInputTypes, a0 as Vector2, c5 as KeyboardEventTypes, c6 as EventConstants, a4 as Clamp, c7 as Plane, M as Matrix, l as TmpVectors, c8 as CameraInputsManager, br as _MissingSideEffect, c9 as CameraMovement, ca as InputMapper, Q as Quaternion, h as Mesh, f as Camera, cb as TargetCamera, bz as serializeAsVector3, cc as serializeAsMeshReference, bY as serializeAsVector2, bC as Node, z as RegisterClass } from "./babylon-PnzH6wcM.js";
import { b as BackEase, e as EasingFunction, E as ExponentialEase } from "./easing-CT5FBt-r.js";
class AutoRotationBehavior {
  constructor() {
    this._zoomStopsAnimation = false;
    this._idleRotationSpeed = 0.05;
    this._idleRotationWaitTime = 2e3;
    this._idleRotationSpinupTime = 2e3;
    this.targetAlpha = null;
    this._attachedCamera = null;
    this._isPointerDown = false;
    this._lastFrameTime = null;
    this._lastInteractionTime = -Infinity;
    this._cameraRotationSpeed = 0;
    this._lastFrameRadius = 0;
  }
  /**
   * Gets the name of the behavior.
   */
  get name() {
    return "AutoRotation";
  }
  /**
   * Sets the flag that indicates if user zooming should stop animation.
   */
  set zoomStopsAnimation(flag) {
    this._zoomStopsAnimation = flag;
  }
  /**
   * Gets the flag that indicates if user zooming should stop animation.
   */
  get zoomStopsAnimation() {
    return this._zoomStopsAnimation;
  }
  /**
   * Sets the default speed at which the camera rotates around the model.
   */
  set idleRotationSpeed(speed) {
    this._idleRotationSpeed = speed;
  }
  /**
   * Gets the default speed at which the camera rotates around the model.
   */
  get idleRotationSpeed() {
    return this._idleRotationSpeed;
  }
  /**
   * Sets the time (in milliseconds) to wait after user interaction before the camera starts rotating.
   */
  set idleRotationWaitTime(time) {
    this._idleRotationWaitTime = time;
  }
  /**
   * Gets the time (milliseconds) to wait after user interaction before the camera starts rotating.
   */
  get idleRotationWaitTime() {
    return this._idleRotationWaitTime;
  }
  /**
   * Sets the time (milliseconds) to take to spin up to the full idle rotation speed.
   */
  set idleRotationSpinupTime(time) {
    this._idleRotationSpinupTime = time;
  }
  /**
   * Gets the time (milliseconds) to take to spin up to the full idle rotation speed.
   */
  get idleRotationSpinupTime() {
    return this._idleRotationSpinupTime;
  }
  /**
   * Gets a value indicating if the camera is currently rotating because of this behavior
   */
  get rotationInProgress() {
    return Math.abs(this._cameraRotationSpeed) > 0;
  }
  /**
   * Attached node of this behavior
   */
  get attachedNode() {
    return this._attachedCamera;
  }
  /**
   * Initializes the behavior.
   */
  init() {
  }
  /**
   * Attaches the behavior to its arc rotate camera.
   * @param camera Defines the camera to attach the behavior to
   */
  attach(camera) {
    this._attachedCamera = camera;
    const scene = this._attachedCamera.getScene();
    this._onPrePointerObservableObserver = scene.onPrePointerObservable.add((pointerInfoPre) => {
      if (pointerInfoPre.type === PointerEventTypes.POINTERDOWN) {
        this._isPointerDown = true;
        return;
      }
      if (pointerInfoPre.type === PointerEventTypes.POINTERUP) {
        this._isPointerDown = false;
      }
    });
    this._onAfterCheckInputsObserver = camera.onAfterCheckInputsObservable.add(() => {
      if (this._reachTargetAlpha()) {
        return;
      }
      const now = PrecisionDate.Now;
      let dt = 0;
      if (this._lastFrameTime != null) {
        dt = now - this._lastFrameTime;
      }
      this._lastFrameTime = now;
      this._applyUserInteraction();
      const timeToRotation = now - this._lastInteractionTime - this._idleRotationWaitTime;
      const scale = Math.max(Math.min(timeToRotation / this._idleRotationSpinupTime, 1), 0);
      this._cameraRotationSpeed = this._idleRotationSpeed * scale;
      if (this._attachedCamera) {
        this._attachedCamera.alpha -= this._cameraRotationSpeed * (dt / 1e3);
      }
    });
  }
  /**
   * Detaches the behavior from its current arc rotate camera.
   */
  detach() {
    if (!this._attachedCamera) {
      return;
    }
    const scene = this._attachedCamera.getScene();
    if (this._onPrePointerObservableObserver) {
      scene.onPrePointerObservable.remove(this._onPrePointerObservableObserver);
    }
    this._attachedCamera.onAfterCheckInputsObservable.remove(this._onAfterCheckInputsObserver);
    this._attachedCamera = null;
    this._lastFrameTime = null;
  }
  /**
   * Force-reset the last interaction time
   * @param customTime an optional time that will be used instead of the current last interaction time. For example `Date.now()`
   */
  resetLastInteractionTime(customTime) {
    this._lastInteractionTime = customTime ?? PrecisionDate.Now;
  }
  /**
   * Returns true if camera alpha reaches the target alpha
   * @returns true if camera alpha reaches the target alpha
   */
  _reachTargetAlpha() {
    if (this._attachedCamera && this.targetAlpha !== null) {
      return Math.abs(this._attachedCamera.alpha - this.targetAlpha) < Epsilon;
    }
    return false;
  }
  /**
   * Returns true if user is scrolling.
   * @returns true if user is scrolling.
   */
  _userIsZooming() {
    if (!this._attachedCamera) {
      return false;
    }
    return this._attachedCamera.inertialRadiusOffset !== 0;
  }
  _shouldAnimationStopForInteraction() {
    if (!this._attachedCamera) {
      return false;
    }
    let zoomHasHitLimit = false;
    if (this._lastFrameRadius === this._attachedCamera.radius && this._attachedCamera.inertialRadiusOffset !== 0) {
      zoomHasHitLimit = true;
    }
    this._lastFrameRadius = this._attachedCamera.radius;
    return this._zoomStopsAnimation ? zoomHasHitLimit : this._userIsZooming();
  }
  /**
   *  Applies any current user interaction to the camera. Takes into account maximum alpha rotation.
   */
  _applyUserInteraction() {
    if (this._userIsMoving() && !this._shouldAnimationStopForInteraction()) {
      this._lastInteractionTime = PrecisionDate.Now;
    }
  }
  // Tools
  _userIsMoving() {
    if (!this._attachedCamera) {
      return false;
    }
    return this._attachedCamera.inertialAlphaOffset !== 0 || this._attachedCamera.inertialBetaOffset !== 0 || this._attachedCamera.inertialRadiusOffset !== 0 || this._attachedCamera.inertialPanningX !== 0 || this._attachedCamera.inertialPanningY !== 0 || this._isPointerDown;
  }
}
class BouncingBehavior {
  constructor() {
    this.transitionDuration = 450;
    this.lowerRadiusTransitionRange = 2;
    this.upperRadiusTransitionRange = -2;
    this._autoTransitionRange = false;
    this._attachedCamera = null;
    this._radiusIsAnimating = false;
    this._radiusBounceTransition = null;
    this._animatables = new Array();
  }
  /**
   * Gets the name of the behavior.
   */
  get name() {
    return "Bouncing";
  }
  /**
   * Gets a value indicating if the lowerRadiusTransitionRange and upperRadiusTransitionRange are defined automatically
   */
  get autoTransitionRange() {
    return this._autoTransitionRange;
  }
  /**
   * Sets a value indicating if the lowerRadiusTransitionRange and upperRadiusTransitionRange are defined automatically
   * Transition ranges will be set to 5% of the bounding box diagonal in world space
   */
  set autoTransitionRange(value) {
    if (this._autoTransitionRange === value) {
      return;
    }
    this._autoTransitionRange = value;
    const camera = this._attachedCamera;
    if (!camera) {
      return;
    }
    if (value) {
      this._onMeshTargetChangedObserver = camera.onMeshTargetChangedObservable.add((transformNode) => {
        if (!transformNode) {
          return;
        }
        transformNode.computeWorldMatrix(true);
        if (transformNode.getBoundingInfo) {
          const diagonal = transformNode.getBoundingInfo().diagonalLength;
          this.lowerRadiusTransitionRange = diagonal * 0.05;
          this.upperRadiusTransitionRange = diagonal * 0.05;
        }
      });
    } else if (this._onMeshTargetChangedObserver) {
      camera.onMeshTargetChangedObservable.remove(this._onMeshTargetChangedObserver);
    }
  }
  /**
   * Attached node of this behavior
   */
  get attachedNode() {
    return this._attachedCamera;
  }
  /**
   * Initializes the behavior.
   */
  init() {
  }
  /**
   * Attaches the behavior to its arc rotate camera.
   * @param camera Defines the camera to attach the behavior to
   */
  attach(camera) {
    this._attachedCamera = camera;
    this._onAfterCheckInputsObserver = camera.onAfterCheckInputsObservable.add(() => {
      if (!this._attachedCamera) {
        return;
      }
      if (this._isRadiusAtLimit(this._attachedCamera.lowerRadiusLimit)) {
        this._applyBoundRadiusAnimation(this.lowerRadiusTransitionRange);
      }
      if (this._isRadiusAtLimit(this._attachedCamera.upperRadiusLimit)) {
        this._applyBoundRadiusAnimation(this.upperRadiusTransitionRange);
      }
    });
  }
  /**
   * Detaches the behavior from its current arc rotate camera.
   */
  detach() {
    if (!this._attachedCamera) {
      return;
    }
    if (this._onAfterCheckInputsObserver) {
      this._attachedCamera.onAfterCheckInputsObservable.remove(this._onAfterCheckInputsObserver);
    }
    if (this._onMeshTargetChangedObserver) {
      this._attachedCamera.onMeshTargetChangedObservable.remove(this._onMeshTargetChangedObserver);
    }
    this._attachedCamera = null;
  }
  /**
   * Checks if the camera radius is at the specified limit. Takes into account animation locks.
   * @param radiusLimit The limit to check against.
   * @returns Bool to indicate if at limit.
   */
  _isRadiusAtLimit(radiusLimit) {
    if (!this._attachedCamera) {
      return false;
    }
    if (this._attachedCamera.radius === radiusLimit && !this._radiusIsAnimating) {
      return true;
    }
    return false;
  }
  /**
   * Applies an animation to the radius of the camera, extending by the radiusDelta.
   * @param radiusDelta The delta by which to animate to. Can be negative.
   */
  _applyBoundRadiusAnimation(radiusDelta) {
    if (!this._attachedCamera) {
      return;
    }
    if (!this._radiusBounceTransition) {
      BouncingBehavior.EasingFunction.setEasingMode(BouncingBehavior.EasingMode);
      this._radiusBounceTransition = Animation.CreateAnimation("radius", Animation.ANIMATIONTYPE_FLOAT, 60, BouncingBehavior.EasingFunction);
    }
    this._cachedWheelPrecision = this._attachedCamera.wheelPrecision;
    this._attachedCamera.wheelPrecision = Infinity;
    this._attachedCamera.inertialRadiusOffset = 0;
    this.stopAllAnimations();
    this._radiusIsAnimating = true;
    const animatable = Animation.TransitionTo("radius", this._attachedCamera.radius + radiusDelta, this._attachedCamera, this._attachedCamera.getScene(), 60, this._radiusBounceTransition, this.transitionDuration, () => this._clearAnimationLocks());
    if (animatable) {
      this._animatables.push(animatable);
    }
  }
  /**
   * Removes all animation locks. Allows new animations to be added to any of the camera properties.
   */
  _clearAnimationLocks() {
    this._radiusIsAnimating = false;
    if (this._attachedCamera) {
      this._attachedCamera.wheelPrecision = this._cachedWheelPrecision;
    }
  }
  /**
   * Stops and removes all animations that have been applied to the camera
   */
  stopAllAnimations() {
    if (this._attachedCamera) {
      this._attachedCamera.animations = [];
    }
    while (this._animatables.length) {
      this._animatables[0].onAnimationEnd = null;
      this._animatables[0].stop();
      this._animatables.shift();
    }
  }
}
BouncingBehavior.EasingFunction = new BackEase(0.3);
BouncingBehavior.EasingMode = EasingFunction.EASINGMODE_EASEOUT;
class FramingBehavior {
  constructor() {
    this.onTargetFramingAnimationEndObservable = new Observable();
    this._mode = FramingBehavior.FitFrustumSidesMode;
    this._radiusScale = 1;
    this._positionScale = 0.5;
    this._defaultElevation = 0.3;
    this._elevationReturnTime = 1500;
    this._elevationReturnWaitTime = 1e3;
    this._zoomStopsAnimation = false;
    this._framingTime = 1500;
    this.autoCorrectCameraLimitsAndSensibility = true;
    this._attachedCamera = null;
    this._isPointerDown = false;
    this._lastInteractionTime = -Infinity;
    this._animatables = new Array();
    this._betaIsAnimating = false;
  }
  /**
   * Gets the name of the behavior.
   */
  get name() {
    return "Framing";
  }
  /**
   * Sets the current mode used by the behavior
   */
  set mode(mode) {
    this._mode = mode;
  }
  /**
   * Gets current mode used by the behavior.
   */
  get mode() {
    return this._mode;
  }
  /**
   * Sets the scale applied to the radius (1 by default)
   */
  set radiusScale(radius) {
    this._radiusScale = radius;
  }
  /**
   * Gets the scale applied to the radius
   */
  get radiusScale() {
    return this._radiusScale;
  }
  /**
   * Sets the scale to apply on Y axis to position camera focus. 0.5 by default which means the center of the bounding box.
   */
  set positionScale(scale) {
    this._positionScale = scale;
  }
  /**
   * Gets the scale to apply on Y axis to position camera focus. 0.5 by default which means the center of the bounding box.
   */
  get positionScale() {
    return this._positionScale;
  }
  /**
   * Sets the angle above/below the horizontal plane to return to when the return to default elevation idle
   * behaviour is triggered, in radians.
   */
  set defaultElevation(elevation) {
    this._defaultElevation = elevation;
  }
  /**
   * Gets the angle above/below the horizontal plane to return to when the return to default elevation idle
   * behaviour is triggered, in radians.
   */
  get defaultElevation() {
    return this._defaultElevation;
  }
  /**
   * Sets the time (in milliseconds) taken to return to the default beta position.
   * Negative value indicates camera should not return to default.
   */
  set elevationReturnTime(speed) {
    this._elevationReturnTime = speed;
  }
  /**
   * Gets the time (in milliseconds) taken to return to the default beta position.
   * Negative value indicates camera should not return to default.
   */
  get elevationReturnTime() {
    return this._elevationReturnTime;
  }
  /**
   * Sets the delay (in milliseconds) taken before the camera returns to the default beta position.
   */
  set elevationReturnWaitTime(time) {
    this._elevationReturnWaitTime = time;
  }
  /**
   * Gets the delay (in milliseconds) taken before the camera returns to the default beta position.
   */
  get elevationReturnWaitTime() {
    return this._elevationReturnWaitTime;
  }
  /**
   * Sets the flag that indicates if user zooming should stop animation.
   */
  set zoomStopsAnimation(flag) {
    this._zoomStopsAnimation = flag;
  }
  /**
   * Gets the flag that indicates if user zooming should stop animation.
   */
  get zoomStopsAnimation() {
    return this._zoomStopsAnimation;
  }
  /**
   * Sets the transition time when framing the mesh, in milliseconds
   */
  set framingTime(time) {
    this._framingTime = time;
  }
  /**
   * Gets the transition time when framing the mesh, in milliseconds
   */
  get framingTime() {
    return this._framingTime;
  }
  /**
   * Attached node of this behavior
   */
  get attachedNode() {
    return this._attachedCamera;
  }
  /**
   * Initializes the behavior.
   */
  init() {
  }
  /**
   * Attaches the behavior to its arc rotate camera.
   * @param camera Defines the camera to attach the behavior to
   */
  attach(camera) {
    this._attachedCamera = camera;
    const scene = this._attachedCamera.getScene();
    FramingBehavior.EasingFunction.setEasingMode(FramingBehavior.EasingMode);
    this._onPrePointerObservableObserver = scene.onPrePointerObservable.add((pointerInfoPre) => {
      if (pointerInfoPre.type === PointerEventTypes.POINTERDOWN) {
        this._isPointerDown = true;
        return;
      }
      if (pointerInfoPre.type === PointerEventTypes.POINTERUP) {
        this._isPointerDown = false;
      }
    });
    this._onMeshTargetChangedObserver = camera.onMeshTargetChangedObservable.add((transformNode) => {
      if (transformNode && transformNode.getBoundingInfo) {
        this.zoomOnMesh(transformNode, void 0, () => {
          this.onTargetFramingAnimationEndObservable.notifyObservers();
        });
      }
    });
    this._onAfterCheckInputsObserver = camera.onAfterCheckInputsObservable.add(() => {
      this._applyUserInteraction();
      this._maintainCameraAboveGround();
    });
  }
  /**
   * Detaches the behavior from its current arc rotate camera.
   */
  detach() {
    if (!this._attachedCamera) {
      return;
    }
    const scene = this._attachedCamera.getScene();
    if (this._onPrePointerObservableObserver) {
      scene.onPrePointerObservable.remove(this._onPrePointerObservableObserver);
    }
    if (this._onAfterCheckInputsObserver) {
      this._attachedCamera.onAfterCheckInputsObservable.remove(this._onAfterCheckInputsObserver);
    }
    if (this._onMeshTargetChangedObserver) {
      this._attachedCamera.onMeshTargetChangedObservable.remove(this._onMeshTargetChangedObserver);
    }
    this._attachedCamera = null;
  }
  /**
   * Targets the given mesh and updates zoom level accordingly.
   * @param mesh  The mesh to target.
   * @param focusOnOriginXZ Determines if the camera should focus on 0 in the X and Z axis instead of the mesh
   * @param onAnimationEnd Callback triggered at the end of the framing animation
   */
  zoomOnMesh(mesh, focusOnOriginXZ = false, onAnimationEnd = null) {
    mesh.computeWorldMatrix(true);
    const boundingBox = mesh.getBoundingInfo().boundingBox;
    this.zoomOnBoundingInfo(boundingBox.minimumWorld, boundingBox.maximumWorld, focusOnOriginXZ, onAnimationEnd);
  }
  /**
   * Targets the given mesh with its children and updates zoom level accordingly.
   * @param mesh The mesh to target.
   * @param focusOnOriginXZ Determines if the camera should focus on 0 in the X and Z axis instead of the mesh
   * @param onAnimationEnd Callback triggered at the end of the framing animation
   */
  zoomOnMeshHierarchy(mesh, focusOnOriginXZ = false, onAnimationEnd = null) {
    mesh.computeWorldMatrix(true);
    const boundingBox = mesh.getHierarchyBoundingVectors(true);
    this.zoomOnBoundingInfo(boundingBox.min, boundingBox.max, focusOnOriginXZ, onAnimationEnd);
  }
  /**
   * Targets the given meshes with their children and updates zoom level accordingly.
   * @param meshes  The mesh to target.
   * @param focusOnOriginXZ Determines if the camera should focus on 0 in the X and Z axis instead of the mesh
   * @param onAnimationEnd Callback triggered at the end of the framing animation
   */
  zoomOnMeshesHierarchy(meshes, focusOnOriginXZ = false, onAnimationEnd = null) {
    const min = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    const max = new Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);
    for (let i = 0; i < meshes.length; i++) {
      const boundingInfo = meshes[i].getHierarchyBoundingVectors(true);
      Vector3.CheckExtends(boundingInfo.min, min, max);
      Vector3.CheckExtends(boundingInfo.max, min, max);
    }
    this.zoomOnBoundingInfo(min, max, focusOnOriginXZ, onAnimationEnd);
  }
  /**
   * Targets the bounding box info defined by its extends and updates zoom level accordingly.
   * @param minimumWorld Determines the smaller position of the bounding box extend
   * @param maximumWorld Determines the bigger position of the bounding box extend
   * @param focusOnOriginXZ Determines if the camera should focus on 0 in the X and Z axis instead of the mesh
   * @param onAnimationEnd Callback triggered at the end of the framing animation
   * @returns true if the zoom was done
   */
  zoomOnBoundingInfo(minimumWorld, maximumWorld, focusOnOriginXZ = false, onAnimationEnd = null) {
    let zoomTarget;
    if (!this._attachedCamera) {
      return false;
    }
    const bottom = minimumWorld.y;
    const top = maximumWorld.y;
    const zoomTargetY = bottom + (top - bottom) * this._positionScale;
    const radiusWorld = maximumWorld.subtract(minimumWorld).scale(0.5);
    if (!isFinite(zoomTargetY)) {
      return false;
    }
    if (focusOnOriginXZ) {
      zoomTarget = new Vector3(0, zoomTargetY, 0);
    } else {
      const centerWorld = minimumWorld.add(radiusWorld);
      zoomTarget = new Vector3(centerWorld.x, zoomTargetY, centerWorld.z);
    }
    if (!this._vectorTransition) {
      this._vectorTransition = Animation.CreateAnimation("target", Animation.ANIMATIONTYPE_VECTOR3, 60, FramingBehavior.EasingFunction);
    }
    this._betaIsAnimating = true;
    let animatable = Animation.TransitionTo("target", zoomTarget, this._attachedCamera, this._attachedCamera.getScene(), 60, this._vectorTransition, this._framingTime);
    if (animatable) {
      this._animatables.push(animatable);
    }
    let radius = 0;
    if (this._mode === FramingBehavior.FitFrustumSidesMode) {
      const position = this._calculateLowerRadiusFromModelBoundingSphere(minimumWorld, maximumWorld);
      if (this.autoCorrectCameraLimitsAndSensibility) {
        this._attachedCamera.lowerRadiusLimit = radiusWorld.length() + this._attachedCamera.minZ;
      }
      radius = position;
    } else if (this._mode === FramingBehavior.IgnoreBoundsSizeMode) {
      radius = this._calculateLowerRadiusFromModelBoundingSphere(minimumWorld, maximumWorld);
      if (this.autoCorrectCameraLimitsAndSensibility && this._attachedCamera.lowerRadiusLimit === null) {
        this._attachedCamera.lowerRadiusLimit = this._attachedCamera.minZ;
      }
    }
    if (this.autoCorrectCameraLimitsAndSensibility) {
      const extend = maximumWorld.subtract(minimumWorld).length();
      this._attachedCamera.panningSensibility = 5e3 / extend;
      this._attachedCamera.wheelPrecision = 100 / radius;
    }
    if (!this._radiusTransition) {
      this._radiusTransition = Animation.CreateAnimation("radius", Animation.ANIMATIONTYPE_FLOAT, 60, FramingBehavior.EasingFunction);
    }
    animatable = Animation.TransitionTo("radius", radius, this._attachedCamera, this._attachedCamera.getScene(), 60, this._radiusTransition, this._framingTime, () => {
      this.stopAllAnimations();
      if (onAnimationEnd) {
        onAnimationEnd();
      }
      if (this._attachedCamera && this._attachedCamera.useInputToRestoreState) {
        this._attachedCamera.storeState();
      }
    });
    if (animatable) {
      this._animatables.push(animatable);
    }
    return true;
  }
  /**
   * Calculates the lowest radius for the camera based on the bounding box of the mesh.
   * @param minimumWorld
   * @param maximumWorld
   * @returns The minimum distance from the primary mesh's center point at which the camera must be kept in order
   *		 to fully enclose the mesh in the viewing frustum.
   */
  _calculateLowerRadiusFromModelBoundingSphere(minimumWorld, maximumWorld) {
    const camera = this._attachedCamera;
    if (!camera) {
      return 0;
    }
    let distance = camera._calculateLowerRadiusFromModelBoundingSphere(minimumWorld, maximumWorld, this._radiusScale);
    if (camera.lowerRadiusLimit && this._mode === FramingBehavior.IgnoreBoundsSizeMode) {
      distance = distance < camera.lowerRadiusLimit ? camera.lowerRadiusLimit : distance;
    }
    if (camera.upperRadiusLimit) {
      distance = distance > camera.upperRadiusLimit ? camera.upperRadiusLimit : distance;
    }
    return distance;
  }
  /**
   * Keeps the camera above the ground plane. If the user pulls the camera below the ground plane, the camera
   * is automatically returned to its default position (expected to be above ground plane).
   */
  _maintainCameraAboveGround() {
    if (this._elevationReturnTime < 0) {
      return;
    }
    const timeSinceInteraction = PrecisionDate.Now - this._lastInteractionTime;
    const defaultBeta = Math.PI * 0.5 - this._defaultElevation;
    const limitBeta = Math.PI * 0.5;
    if (this._attachedCamera && !this._betaIsAnimating && this._attachedCamera.beta > limitBeta && timeSinceInteraction >= this._elevationReturnWaitTime) {
      this._betaIsAnimating = true;
      this.stopAllAnimations();
      if (!this._betaTransition) {
        this._betaTransition = Animation.CreateAnimation("beta", Animation.ANIMATIONTYPE_FLOAT, 60, FramingBehavior.EasingFunction);
      }
      const animatable = Animation.TransitionTo("beta", defaultBeta, this._attachedCamera, this._attachedCamera.getScene(), 60, this._betaTransition, this._elevationReturnTime, () => {
        this._clearAnimationLocks();
        this.stopAllAnimations();
      });
      if (animatable) {
        this._animatables.push(animatable);
      }
    }
  }
  /**
   * Removes all animation locks. Allows new animations to be added to any of the arcCamera properties.
   */
  _clearAnimationLocks() {
    this._betaIsAnimating = false;
  }
  /**
   *  Applies any current user interaction to the camera. Takes into account maximum alpha rotation.
   */
  _applyUserInteraction() {
    if (this.isUserIsMoving) {
      this._lastInteractionTime = PrecisionDate.Now;
      this.stopAllAnimations();
      this._clearAnimationLocks();
    }
  }
  /**
   * Stops and removes all animations that have been applied to the camera
   */
  stopAllAnimations() {
    if (this._attachedCamera) {
      this._attachedCamera.animations = [];
    }
    while (this._animatables.length) {
      if (this._animatables[0]) {
        this._animatables[0].onAnimationEnd = null;
        this._animatables[0].stop();
      }
      this._animatables.shift();
    }
  }
  /**
   * Gets a value indicating if the user is moving the camera
   */
  get isUserIsMoving() {
    if (!this._attachedCamera) {
      return false;
    }
    return this._attachedCamera.inertialAlphaOffset !== 0 || this._attachedCamera.inertialBetaOffset !== 0 || this._attachedCamera.inertialRadiusOffset !== 0 || this._attachedCamera.inertialPanningX !== 0 || this._attachedCamera.inertialPanningY !== 0 || this._isPointerDown;
  }
}
FramingBehavior.EasingFunction = new ExponentialEase();
FramingBehavior.EasingMode = EasingFunction.EASINGMODE_EASEINOUT;
FramingBehavior.IgnoreBoundsSizeMode = 0;
FramingBehavior.FitFrustumSidesMode = 1;
let BaseCameraPointersInput = (() => {
  var _a2;
  let _buttons_decorators;
  let _buttons_initializers = [];
  let _buttons_extraInitializers = [];
  return _a2 = class BaseCameraPointersInput {
    constructor() {
      this._currentMousePointerIdDown = -1;
      this.buttons = __runInitializers(this, _buttons_initializers, [0, 1, 2]);
      this._pointerInput = __runInitializers(this, _buttons_extraInitializers);
    }
    /**
     * Attach the input controls to a specific dom element to get the input from.
     * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
     */
    attachControl(noPreventDefault) {
      noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
      const engine = this.camera.getEngine();
      const element = engine.getInputElement();
      let previousPinchSquaredDistance = 0;
      let previousMultiTouchPanPosition = null;
      this._pointA = null;
      this._pointB = null;
      this._altKey = false;
      this._ctrlKey = false;
      this._metaKey = false;
      this._shiftKey = false;
      this._buttonsPressed = 0;
      this._pointerInput = (p) => {
        const evt = p.event;
        const isTouch = evt.pointerType === "touch";
        if (p.type !== PointerEventTypes.POINTERMOVE && this.buttons.indexOf(evt.button) === -1) {
          return;
        }
        const srcElement = evt.target;
        this._altKey = evt.altKey;
        this._ctrlKey = evt.ctrlKey;
        this._metaKey = evt.metaKey;
        this._shiftKey = evt.shiftKey;
        this._buttonsPressed = evt.buttons;
        if (engine.isPointerLock) {
          const offsetX = evt.movementX;
          const offsetY = evt.movementY;
          this.onTouch(null, offsetX, offsetY);
          this._pointA = null;
          this._pointB = null;
        } else if (p.type !== PointerEventTypes.POINTERDOWN && p.type !== PointerEventTypes.POINTERDOUBLETAP && isTouch && this._pointA?.pointerId !== evt.pointerId && this._pointB?.pointerId !== evt.pointerId) {
          return;
        } else if (p.type === PointerEventTypes.POINTERDOWN && (this._currentMousePointerIdDown === -1 || isTouch)) {
          try {
            srcElement?.setPointerCapture(evt.pointerId);
          } catch (e) {
          }
          if (this._pointA === null) {
            this._pointA = {
              x: evt.clientX,
              y: evt.clientY,
              pointerId: evt.pointerId,
              type: evt.pointerType,
              button: evt.button
            };
          } else if (this._pointB === null) {
            this._pointB = {
              x: evt.clientX,
              y: evt.clientY,
              pointerId: evt.pointerId,
              type: evt.pointerType,
              button: evt.button
            };
          } else {
            return;
          }
          if (this._currentMousePointerIdDown === -1 && !isTouch) {
            this._currentMousePointerIdDown = evt.pointerId;
          }
          this.onButtonDown(evt);
          if (!noPreventDefault) {
            evt.preventDefault();
            if (element) {
              element.focus();
            }
          }
        } else if (p.type === PointerEventTypes.POINTERDOUBLETAP) {
          this.onDoubleTap(evt.pointerType, evt);
        } else if (p.type === PointerEventTypes.POINTERUP && (this._currentMousePointerIdDown === evt.pointerId || isTouch)) {
          try {
            srcElement?.releasePointerCapture(evt.pointerId);
          } catch (e) {
          }
          if (!isTouch) {
            this._pointB = null;
          }
          if (engine._badOS) {
            this._pointA = this._pointB = null;
          } else {
            if (this._pointB && this._pointA && this._pointA.pointerId == evt.pointerId) {
              this._pointA = this._pointB;
              this._pointB = null;
            } else if (this._pointA && this._pointB && this._pointB.pointerId == evt.pointerId) {
              this._pointB = null;
            } else {
              this._pointA = this._pointB = null;
            }
          }
          if (previousPinchSquaredDistance !== 0 || previousMultiTouchPanPosition) {
            this.onMultiTouch(
              this._pointA,
              this._pointB,
              previousPinchSquaredDistance,
              0,
              // pinchSquaredDistance
              previousMultiTouchPanPosition,
              null
              // multiTouchPanPosition
            );
            previousPinchSquaredDistance = 0;
            previousMultiTouchPanPosition = null;
          }
          this._currentMousePointerIdDown = -1;
          this.onButtonUp(evt);
          if (!noPreventDefault) {
            evt.preventDefault();
          }
        } else if (p.type === PointerEventTypes.POINTERMOVE) {
          if (!noPreventDefault) {
            evt.preventDefault();
          }
          if (this._pointA && this._pointB === null) {
            const offsetX = evt.clientX - this._pointA.x;
            const offsetY = evt.clientY - this._pointA.y;
            this._pointA.x = evt.clientX;
            this._pointA.y = evt.clientY;
            this.onTouch(this._pointA, offsetX, offsetY);
          } else if (this._pointA && this._pointB) {
            const ed = this._pointA.pointerId === evt.pointerId ? this._pointA : this._pointB;
            ed.x = evt.clientX;
            ed.y = evt.clientY;
            const distX = this._pointA.x - this._pointB.x;
            const distY = this._pointA.y - this._pointB.y;
            const pinchSquaredDistance = distX * distX + distY * distY;
            const multiTouchPanPosition = {
              x: (this._pointA.x + this._pointB.x) / 2,
              y: (this._pointA.y + this._pointB.y) / 2,
              pointerId: evt.pointerId,
              type: p.type
            };
            this.onMultiTouch(this._pointA, this._pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition);
            previousMultiTouchPanPosition = multiTouchPanPosition;
            previousPinchSquaredDistance = pinchSquaredDistance;
          }
        }
      };
      this._observer = this.camera.getScene()._inputManager._addCameraPointerObserver(this._pointerInput, PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERUP | PointerEventTypes.POINTERMOVE | PointerEventTypes.POINTERDOUBLETAP);
      this._onLostFocus = () => {
        this._pointA = this._pointB = null;
        previousPinchSquaredDistance = 0;
        previousMultiTouchPanPosition = null;
        this.onLostFocus();
      };
      this._contextMenuBind = (evt) => this.onContextMenu(evt);
      if (element) {
        element.addEventListener("contextmenu", this._contextMenuBind, false);
      }
      const hostWindow = this.camera.getScene().getEngine().getHostWindow();
      if (hostWindow) {
        Tools.RegisterTopRootEvents(hostWindow, [{ name: "blur", handler: this._onLostFocus }]);
      }
    }
    /**
     * Detach the current controls from the specified dom element.
     */
    detachControl() {
      if (this._onLostFocus) {
        const hostWindow = this.camera.getScene().getEngine().getHostWindow();
        if (hostWindow) {
          Tools.UnregisterTopRootEvents(hostWindow, [{ name: "blur", handler: this._onLostFocus }]);
        }
      }
      if (this._observer) {
        this.camera.getScene()._inputManager._removeCameraPointerObserver(this._observer);
        this._observer = null;
        if (this._contextMenuBind) {
          const inputElement = this.camera.getScene().getEngine().getInputElement();
          if (inputElement) {
            inputElement.removeEventListener("contextmenu", this._contextMenuBind);
          }
        }
        this._onLostFocus = null;
      }
      this._altKey = false;
      this._ctrlKey = false;
      this._metaKey = false;
      this._shiftKey = false;
      this._buttonsPressed = 0;
      this._currentMousePointerIdDown = -1;
    }
    /**
     * Gets the class name of the current input.
     * @returns the class name
     */
    getClassName() {
      return "BaseCameraPointersInput";
    }
    /**
     * Get the friendly name associated with the input class.
     * @returns the input friendly name
     */
    getSimpleName() {
      return "pointers";
    }
    /**
     * Called on pointer POINTERDOUBLETAP event.
     * Override this method to provide functionality on POINTERDOUBLETAP event.
     * @param type type of event
     * @param evt the pointer event that triggered the double tap (carries button / buttons state)
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onDoubleTap(type, evt) {
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    /**
     * Called on pointer POINTERMOVE event if only a single touch is active.
     * Override this method to provide functionality.
     * @param point The current position of the pointer
     * @param offsetX The offsetX of the pointer when the event occurred
     * @param offsetY The offsetY of the pointer when the event occurred
     */
    onTouch(point, offsetX, offsetY) {
    }
    /**
     * Called on pointer POINTERMOVE event if multiple touches are active.
     * Override this method to provide functionality.
     * @param _pointA First point in the pair
     * @param _pointB Second point in the pair
     * @param previousPinchSquaredDistance Sqr Distance between the points the last time this event was fired (by this input)
     * @param pinchSquaredDistance Sqr Distance between the points this time
     * @param previousMultiTouchPanPosition Previous center point between the points
     * @param multiTouchPanPosition Current center point between the points
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onMultiTouch(_pointA, _pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition) {
    }
    /**
     * Called on JS contextmenu event.
     * Override this method to provide functionality.
     * @param evt the event to be handled
     */
    onContextMenu(evt) {
      evt.preventDefault();
    }
    /**
     * Called each time a new POINTERDOWN event occurs. Ie, for each button
     * press.
     * Override this method to provide functionality.
     * @param _evt Defines the event to track
     */
    onButtonDown(_evt) {
    }
    /**
     * Called each time a new POINTERUP event occurs. Ie, for each button
     * release.
     * Override this method to provide functionality.
     * @param _evt Defines the event to track
     */
    onButtonUp(_evt) {
    }
    /**
     * Called when window becomes inactive.
     * Override this method to provide functionality.
     */
    onLostFocus() {
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? /* @__PURE__ */ Object.create(null) : void 0;
    _buttons_decorators = [serialize()];
    __esDecorate(null, null, _buttons_decorators, { kind: "field", name: "buttons", static: false, private: false, access: { has: (obj) => "buttons" in obj, get: (obj) => obj.buttons, set: (obj, value) => {
      obj.buttons = value;
    } }, metadata: _metadata }, _buttons_initializers, _buttons_extraInitializers);
    if (_metadata) Object.defineProperty(_a2, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a2;
})();
let OrbitCameraPointersInput = (() => {
  var _a2;
  let _classSuper = BaseCameraPointersInput;
  let _pinchZoom_decorators;
  let _pinchZoom_initializers = [];
  let _pinchZoom_extraInitializers = [];
  let _multiTouchPanning_decorators;
  let _multiTouchPanning_initializers = [];
  let _multiTouchPanning_extraInitializers = [];
  let _multiTouchPanAndZoom_decorators;
  let _multiTouchPanAndZoom_initializers = [];
  let _multiTouchPanAndZoom_extraInitializers = [];
  return _a2 = class OrbitCameraPointersInput extends _classSuper {
    constructor() {
      super(...arguments);
      this.pinchZoom = __runInitializers(this, _pinchZoom_initializers, true);
      this.multiTouchPanning = (__runInitializers(this, _pinchZoom_extraInitializers), __runInitializers(this, _multiTouchPanning_initializers, true));
      this.multiTouchPanAndZoom = (__runInitializers(this, _multiTouchPanning_extraInitializers), __runInitializers(this, _multiTouchPanAndZoom_initializers, true));
      this._isPinching = (__runInitializers(this, _multiTouchPanAndZoom_extraInitializers), false);
      this._twoFingerActivityCount = 0;
      this._shouldStartPinchZoom = false;
    }
    _computePinchZoom(_previousPinchSquaredDistance, _pinchSquaredDistance) {
    }
    _computeMultiTouchPanning(_previousMultiTouchPanPosition, _multiTouchPanPosition) {
    }
    /**
     * Called on pointer POINTERMOVE event if multiple touches are active.
     * Override this method to provide functionality.
     * @param _pointA First point in the pair
     * @param _pointB Second point in the pair
     * @param previousPinchSquaredDistance Sqr Distance between the points the last time this event was fired (by this input)
     * @param pinchSquaredDistance Sqr Distance between the points this time
     * @param previousMultiTouchPanPosition Previous center point between the points
     * @param multiTouchPanPosition Current center point between the points
     */
    onMultiTouch(_pointA, _pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition) {
      if (previousPinchSquaredDistance === 0 && previousMultiTouchPanPosition === null) {
        return;
      }
      if (pinchSquaredDistance === 0 && multiTouchPanPosition === null) {
        return;
      }
      if (this.multiTouchPanAndZoom) {
        this._computePinchZoom(previousPinchSquaredDistance, pinchSquaredDistance);
        this._computeMultiTouchPanning(previousMultiTouchPanPosition, multiTouchPanPosition);
      } else if (this.multiTouchPanning && this.pinchZoom) {
        this._twoFingerActivityCount++;
        if (this._isPinching || this._shouldStartPinchZoom) {
          this._computePinchZoom(previousPinchSquaredDistance, pinchSquaredDistance);
          this._isPinching = true;
        } else {
          this._computeMultiTouchPanning(previousMultiTouchPanPosition, multiTouchPanPosition);
        }
      } else if (this.multiTouchPanning) {
        this._computeMultiTouchPanning(previousMultiTouchPanPosition, multiTouchPanPosition);
      } else if (this.pinchZoom) {
        this._computePinchZoom(previousPinchSquaredDistance, pinchSquaredDistance);
      }
    }
    /**
     * Called each time a new POINTERUP event occurs. Ie, for each button
     * release.
     * @param _evt Defines the event to track
     */
    onButtonUp(_evt) {
      this._twoFingerActivityCount = 0;
      this._isPinching = false;
    }
    /**
     * Called when window becomes inactive.
     */
    onLostFocus() {
      this._twoFingerActivityCount = 0;
      this._isPinching = false;
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _pinchZoom_decorators = [serialize()];
    _multiTouchPanning_decorators = [serialize()];
    _multiTouchPanAndZoom_decorators = [serialize()];
    __esDecorate(null, null, _pinchZoom_decorators, { kind: "field", name: "pinchZoom", static: false, private: false, access: { has: (obj) => "pinchZoom" in obj, get: (obj) => obj.pinchZoom, set: (obj, value) => {
      obj.pinchZoom = value;
    } }, metadata: _metadata }, _pinchZoom_initializers, _pinchZoom_extraInitializers);
    __esDecorate(null, null, _multiTouchPanning_decorators, { kind: "field", name: "multiTouchPanning", static: false, private: false, access: { has: (obj) => "multiTouchPanning" in obj, get: (obj) => obj.multiTouchPanning, set: (obj, value) => {
      obj.multiTouchPanning = value;
    } }, metadata: _metadata }, _multiTouchPanning_initializers, _multiTouchPanning_extraInitializers);
    __esDecorate(null, null, _multiTouchPanAndZoom_decorators, { kind: "field", name: "multiTouchPanAndZoom", static: false, private: false, access: { has: (obj) => "multiTouchPanAndZoom" in obj, get: (obj) => obj.multiTouchPanAndZoom, set: (obj, value) => {
      obj.multiTouchPanAndZoom = value;
    } }, metadata: _metadata }, _multiTouchPanAndZoom_initializers, _multiTouchPanAndZoom_extraInitializers);
    if (_metadata) Object.defineProperty(_a2, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a2;
})();
let ArcRotateCameraPointersInput = (() => {
  var _a2;
  let _classSuper = OrbitCameraPointersInput;
  let _buttons_decorators;
  let _buttons_initializers = [];
  let _buttons_extraInitializers = [];
  let _angularSensibilityX_decorators;
  let _angularSensibilityX_initializers = [];
  let _angularSensibilityX_extraInitializers = [];
  let _angularSensibilityY_decorators;
  let _angularSensibilityY_initializers = [];
  let _angularSensibilityY_extraInitializers = [];
  let _pinchPrecision_decorators;
  let _pinchPrecision_initializers = [];
  let _pinchPrecision_extraInitializers = [];
  let _pinchDeltaPercentage_decorators;
  let _pinchDeltaPercentage_initializers = [];
  let _pinchDeltaPercentage_extraInitializers = [];
  let _useNaturalPinchZoom_decorators;
  let _useNaturalPinchZoom_initializers = [];
  let _useNaturalPinchZoom_extraInitializers = [];
  let _panningSensibility_decorators;
  let _panningSensibility_initializers = [];
  let _panningSensibility_extraInitializers = [];
  return _a2 = class ArcRotateCameraPointersInput extends _classSuper {
    constructor() {
      super(...arguments);
      this.buttons = __runInitializers(this, _buttons_initializers, [0, 1, 2]);
      this.angularSensibilityX = (__runInitializers(this, _buttons_extraInitializers), __runInitializers(this, _angularSensibilityX_initializers, 1e3));
      this.angularSensibilityY = (__runInitializers(this, _angularSensibilityX_extraInitializers), __runInitializers(this, _angularSensibilityY_initializers, 1e3));
      this.pinchPrecision = (__runInitializers(this, _angularSensibilityY_extraInitializers), __runInitializers(this, _pinchPrecision_initializers, 12));
      this.pinchDeltaPercentage = (__runInitializers(this, _pinchPrecision_extraInitializers), __runInitializers(this, _pinchDeltaPercentage_initializers, 0));
      this.useNaturalPinchZoom = (__runInitializers(this, _pinchDeltaPercentage_extraInitializers), __runInitializers(this, _useNaturalPinchZoom_initializers, false));
      this.panningSensibility = (__runInitializers(this, _useNaturalPinchZoom_extraInitializers), __runInitializers(this, _panningSensibility_initializers, 1e3));
      this.pinchInwards = (__runInitializers(this, _panningSensibility_extraInitializers), true);
      this._activeEntry = null;
      this._pointerLockConditions = { button: 0, modifiers: {} };
      this._pointerModifiers = { ctrl: false, alt: false, shift: false };
      this._pointerConditions = { modifiers: this._pointerModifiers };
    }
    /**
     * Gets the class name of the current input.
     * @returns the class name
     */
    getClassName() {
      return "ArcRotateCameraPointersInput";
    }
    /**
     * Move camera from multi touch panning positions.
     * @param previousMultiTouchPanPosition
     * @param multiTouchPanPosition
     */
    _computeMultiTouchPanning(previousMultiTouchPanPosition, multiTouchPanPosition) {
      if (previousMultiTouchPanPosition && multiTouchPanPosition) {
        const moveDeltaX = multiTouchPanPosition.x - previousMultiTouchPanPosition.x;
        const moveDeltaY = multiTouchPanPosition.y - previousMultiTouchPanPosition.y;
        const panEntry = this.camera.movement.input.getEntry("pointer", "pan");
        const panScale = panEntry?.sensitivity ?? (this.panningSensibility !== 0 ? 1 / this.panningSensibility : 0);
        if (panScale !== 0) {
          this.camera.movement.activeInput = true;
          this.camera.movement.panAccumulatedPixels.x += -moveDeltaX * panScale;
          this.camera.movement.panAccumulatedPixels.y += moveDeltaY * panScale;
        }
      }
    }
    /**
     * Move camera from multitouch (pinch) zoom distances.
     * @param previousPinchSquaredDistance
     * @param pinchSquaredDistance
     */
    _computePinchZoom(previousPinchSquaredDistance, pinchSquaredDistance) {
      const radius = this.camera.radius || _a2.MinimumRadiusForPinch;
      if (this.useNaturalPinchZoom) {
        this.camera.radius = radius * Math.sqrt(previousPinchSquaredDistance) / Math.sqrt(pinchSquaredDistance);
      } else if (this.pinchDeltaPercentage) {
        const delta = (pinchSquaredDistance - previousPinchSquaredDistance) * 1e-3 * radius * this.pinchDeltaPercentage;
        this.camera.movement.activeInput = true;
        this.camera.movement.zoomAccumulatedPixels += delta;
      } else {
        const delta = (pinchSquaredDistance - previousPinchSquaredDistance) / (this.pinchPrecision * (this.pinchInwards ? 1 : -1) * (this.angularSensibilityX + this.angularSensibilityY) / 2);
        this.camera.movement.activeInput = true;
        this.camera.movement.zoomAccumulatedPixels += delta;
      }
    }
    /**
     * Called on pointer POINTERMOVE event if only a single touch is active.
     * @param point current touch point
     * @param offsetX offset on X
     * @param offsetY offset on Y
     */
    onTouch(point, offsetX, offsetY) {
      const entry = this._activeEntry ?? (this.camera.getEngine().isPointerLock ? this.camera.movement.input.resolveInteraction("pointer", this._pointerLockConditions) : null);
      if (entry) {
        if (entry.interaction === "pan") {
          const panScale = entry.sensitivity ?? (this.panningSensibility !== 0 ? 1 / this.panningSensibility : 0);
          if (panScale !== 0) {
            this.camera.movement.activeInput = true;
            this.camera.movement.panAccumulatedPixels.x += -offsetX * panScale;
            this.camera.movement.panAccumulatedPixels.y += offsetY * panScale;
          }
        } else if (entry.interaction === "rotate") {
          const rotateScaleX = entry.sensitivityX ?? entry.sensitivity ?? 1 / this.angularSensibilityX;
          const rotateScaleY = entry.sensitivityY ?? entry.sensitivity ?? 1 / this.angularSensibilityY;
          this.camera.movement.activeInput = true;
          this.camera.movement.rotationAccumulatedPixels.x += -offsetX * rotateScaleX;
          this.camera.movement.rotationAccumulatedPixels.y += -offsetY * rotateScaleY;
        }
      }
    }
    /**
     * Called on pointer POINTERDOUBLETAP event.
     */
    onDoubleTap() {
      if (this.camera.useInputToRestoreState) {
        this.camera.restoreState();
      }
    }
    /**
     * Called on pointer POINTERMOVE event if multiple touches are active.
     * @param pointA point A
     * @param pointB point B
     * @param previousPinchSquaredDistance distance between points in previous pinch
     * @param pinchSquaredDistance distance between points in current pinch
     * @param previousMultiTouchPanPosition multi-touch position in previous step
     * @param multiTouchPanPosition multi-touch position in current step
     */
    onMultiTouch(pointA, pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition) {
      this._shouldStartPinchZoom = this._twoFingerActivityCount < 20 && Math.abs(Math.sqrt(pinchSquaredDistance) - Math.sqrt(previousPinchSquaredDistance)) > this.camera.pinchToPanMaxDistance;
      super.onMultiTouch(pointA, pointB, previousPinchSquaredDistance, pinchSquaredDistance, previousMultiTouchPanPosition, multiTouchPanPosition);
    }
    /**
     * Called each time a new POINTERDOWN event occurs. Ie, for each button
     * press.
     * @param evt Defines the event to track
     */
    onButtonDown(evt) {
      this._pointerConditions.button = evt.button;
      this._pointerModifiers.ctrl = evt.ctrlKey;
      this._pointerModifiers.alt = evt.altKey;
      this._pointerModifiers.shift = evt.shiftKey;
      this._activeEntry = this.camera.movement.input.resolveInteraction("pointer", this._pointerConditions);
      super.onButtonDown(evt);
    }
    /**
     * Called each time a new POINTERUP event occurs. Ie, for each button
     * release.
     * @param _evt Defines the event to track
     */
    onButtonUp(_evt) {
      this._activeEntry = null;
      super.onButtonUp(_evt);
    }
    /**
     * Called when window becomes inactive.
     */
    onLostFocus() {
      this._activeEntry = null;
      super.onLostFocus();
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _buttons_decorators = [serialize()];
    _angularSensibilityX_decorators = [serialize()];
    _angularSensibilityY_decorators = [serialize()];
    _pinchPrecision_decorators = [serialize()];
    _pinchDeltaPercentage_decorators = [serialize()];
    _useNaturalPinchZoom_decorators = [serialize()];
    _panningSensibility_decorators = [serialize()];
    __esDecorate(null, null, _buttons_decorators, { kind: "field", name: "buttons", static: false, private: false, access: { has: (obj) => "buttons" in obj, get: (obj) => obj.buttons, set: (obj, value) => {
      obj.buttons = value;
    } }, metadata: _metadata }, _buttons_initializers, _buttons_extraInitializers);
    __esDecorate(null, null, _angularSensibilityX_decorators, { kind: "field", name: "angularSensibilityX", static: false, private: false, access: { has: (obj) => "angularSensibilityX" in obj, get: (obj) => obj.angularSensibilityX, set: (obj, value) => {
      obj.angularSensibilityX = value;
    } }, metadata: _metadata }, _angularSensibilityX_initializers, _angularSensibilityX_extraInitializers);
    __esDecorate(null, null, _angularSensibilityY_decorators, { kind: "field", name: "angularSensibilityY", static: false, private: false, access: { has: (obj) => "angularSensibilityY" in obj, get: (obj) => obj.angularSensibilityY, set: (obj, value) => {
      obj.angularSensibilityY = value;
    } }, metadata: _metadata }, _angularSensibilityY_initializers, _angularSensibilityY_extraInitializers);
    __esDecorate(null, null, _pinchPrecision_decorators, { kind: "field", name: "pinchPrecision", static: false, private: false, access: { has: (obj) => "pinchPrecision" in obj, get: (obj) => obj.pinchPrecision, set: (obj, value) => {
      obj.pinchPrecision = value;
    } }, metadata: _metadata }, _pinchPrecision_initializers, _pinchPrecision_extraInitializers);
    __esDecorate(null, null, _pinchDeltaPercentage_decorators, { kind: "field", name: "pinchDeltaPercentage", static: false, private: false, access: { has: (obj) => "pinchDeltaPercentage" in obj, get: (obj) => obj.pinchDeltaPercentage, set: (obj, value) => {
      obj.pinchDeltaPercentage = value;
    } }, metadata: _metadata }, _pinchDeltaPercentage_initializers, _pinchDeltaPercentage_extraInitializers);
    __esDecorate(null, null, _useNaturalPinchZoom_decorators, { kind: "field", name: "useNaturalPinchZoom", static: false, private: false, access: { has: (obj) => "useNaturalPinchZoom" in obj, get: (obj) => obj.useNaturalPinchZoom, set: (obj, value) => {
      obj.useNaturalPinchZoom = value;
    } }, metadata: _metadata }, _useNaturalPinchZoom_initializers, _useNaturalPinchZoom_extraInitializers);
    __esDecorate(null, null, _panningSensibility_decorators, { kind: "field", name: "panningSensibility", static: false, private: false, access: { has: (obj) => "panningSensibility" in obj, get: (obj) => obj.panningSensibility, set: (obj, value) => {
      obj.panningSensibility = value;
    } }, metadata: _metadata }, _panningSensibility_initializers, _panningSensibility_extraInitializers);
    if (_metadata) Object.defineProperty(_a2, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), /**
   * The minimum radius used for pinch, to avoid radius lock at 0
   */
  _a2.MinimumRadiusForPinch = 1e-3, _a2;
})();
CameraInputTypes["ArcRotateCameraPointersInput"] = ArcRotateCameraPointersInput;
let ArcRotateCameraKeyboardMoveInput = (() => {
  var _a2;
  let _instanceExtraInitializers = [];
  let _keysUp_decorators;
  let _keysUp_initializers = [];
  let _keysUp_extraInitializers = [];
  let _keysDown_decorators;
  let _keysDown_initializers = [];
  let _keysDown_extraInitializers = [];
  let _keysLeft_decorators;
  let _keysLeft_initializers = [];
  let _keysLeft_extraInitializers = [];
  let _keysRight_decorators;
  let _keysRight_initializers = [];
  let _keysRight_extraInitializers = [];
  let _keysReset_decorators;
  let _keysReset_initializers = [];
  let _keysReset_extraInitializers = [];
  let _keysZoomIn_decorators;
  let _keysZoomIn_initializers = [];
  let _keysZoomIn_extraInitializers = [];
  let _keysZoomOut_decorators;
  let _keysZoomOut_initializers = [];
  let _keysZoomOut_extraInitializers = [];
  let _panningSensibility_decorators;
  let _panningSensibility_initializers = [];
  let _panningSensibility_extraInitializers = [];
  let _zoomingSensibility_decorators;
  let _zoomingSensibility_initializers = [];
  let _zoomingSensibility_extraInitializers = [];
  let _angularSpeed_decorators;
  let _angularSpeed_initializers = [];
  let _angularSpeed_extraInitializers = [];
  let _get_useAltToZoom_decorators;
  return _a2 = class ArcRotateCameraKeyboardMoveInput {
    constructor() {
      this.camera = __runInitializers(this, _instanceExtraInitializers);
      this.keysUp = __runInitializers(this, _keysUp_initializers, [38]);
      this.keysDown = (__runInitializers(this, _keysUp_extraInitializers), __runInitializers(this, _keysDown_initializers, [40]));
      this.keysLeft = (__runInitializers(this, _keysDown_extraInitializers), __runInitializers(this, _keysLeft_initializers, [37]));
      this.keysRight = (__runInitializers(this, _keysLeft_extraInitializers), __runInitializers(this, _keysRight_initializers, [39]));
      this.keysReset = (__runInitializers(this, _keysRight_extraInitializers), __runInitializers(this, _keysReset_initializers, [220]));
      this.keysZoomIn = (__runInitializers(this, _keysReset_extraInitializers), __runInitializers(this, _keysZoomIn_initializers, [187, 107]));
      this.keysZoomOut = (__runInitializers(this, _keysZoomIn_extraInitializers), __runInitializers(this, _keysZoomOut_initializers, [189, 109]));
      this.panningSensibility = (__runInitializers(this, _keysZoomOut_extraInitializers), __runInitializers(this, _panningSensibility_initializers, 50));
      this.zoomingSensibility = (__runInitializers(this, _panningSensibility_extraInitializers), __runInitializers(this, _zoomingSensibility_initializers, 25));
      this.angularSpeed = (__runInitializers(this, _zoomingSensibility_extraInitializers), __runInitializers(this, _angularSpeed_initializers, 0.01));
      this._useAltToZoom = (__runInitializers(this, _angularSpeed_extraInitializers), true);
      this._keys = new Array();
      this._keyboardModifiers = { ctrl: false, alt: false };
      this._keyboardConditions = { modifiers: this._keyboardModifiers };
      this._rotateDirection = new Vector2();
      this._panDirection = new Vector2();
    }
    /**
     * Defines whether alt+arrows/wasd triggers zoom instead of rotation/pan.
     * When disabled, alt+keyboard events are ignored by the zoom inputMap entry.
     * Setting this updates the corresponding inputMap entry on the camera's movement system.
     * If set before the camera is attached, the value is cached and applied during `attachControl`.
     */
    get useAltToZoom() {
      return this._useAltToZoom;
    }
    set useAltToZoom(value) {
      this._useAltToZoom = value;
      this._applyUseAltToZoomToInputMap();
    }
    /**
     * Applies the cached `_useAltToZoom` value to the camera's inputMap.
     * Safe to call before the camera is attached: it is a no-op until `this.camera.movement` is available.
     * Idempotent — calling it when the inputMap already matches the cached value is a no-op.
     */
    _applyUseAltToZoomToInputMap() {
      if (!this.camera?.movement) {
        return;
      }
      const input = this.camera.movement.input;
      const entry = input.getEntry("keyboard", "zoom", { modifiers: { alt: true } });
      if (!this._useAltToZoom && entry) {
        input.inputMap.splice(input.inputMap.indexOf(entry), 1);
      } else if (this._useAltToZoom && !entry) {
        input.addEntry({ source: "keyboard", modifiers: { alt: true }, interaction: "zoom" });
      }
    }
    /**
     * Attach the input controls to a specific dom element to get the input from.
     * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
     */
    attachControl(noPreventDefault) {
      noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
      if (this._onCanvasBlurObserver) {
        return;
      }
      this._scene = this.camera.getScene();
      this._engine = this._scene.getEngine();
      this._applyUseAltToZoomToInputMap();
      this._onCanvasBlurObserver = this._engine.onCanvasBlurObservable.add(() => {
        this._keys.length = 0;
      });
      this._onKeyboardObserver = this._scene.onKeyboardObservable.add((info) => {
        const evt = info.event;
        if (!evt.metaKey) {
          if (info.type === KeyboardEventTypes.KEYDOWN) {
            this._ctrlPressed = evt.ctrlKey;
            this._altPressed = evt.altKey;
            if (this.keysUp.indexOf(evt.keyCode) !== -1 || this.keysDown.indexOf(evt.keyCode) !== -1 || this.keysLeft.indexOf(evt.keyCode) !== -1 || this.keysRight.indexOf(evt.keyCode) !== -1 || this.keysReset.indexOf(evt.keyCode) !== -1 || this.keysZoomIn.indexOf(evt.keyCode) !== -1 || this.keysZoomOut.indexOf(evt.keyCode) !== -1) {
              const index = this._keys.indexOf(evt.keyCode);
              if (index === -1) {
                this._keys.push(evt.keyCode);
              }
              if (evt.preventDefault) {
                if (!noPreventDefault) {
                  evt.preventDefault();
                }
              }
            }
          } else {
            if (this.keysUp.indexOf(evt.keyCode) !== -1 || this.keysDown.indexOf(evt.keyCode) !== -1 || this.keysLeft.indexOf(evt.keyCode) !== -1 || this.keysRight.indexOf(evt.keyCode) !== -1 || this.keysReset.indexOf(evt.keyCode) !== -1 || this.keysZoomIn.indexOf(evt.keyCode) !== -1 || this.keysZoomOut.indexOf(evt.keyCode) !== -1) {
              const index = this._keys.indexOf(evt.keyCode);
              if (index >= 0) {
                this._keys.splice(index, 1);
              }
              if (evt.preventDefault) {
                if (!noPreventDefault) {
                  evt.preventDefault();
                }
              }
            }
          }
        }
      });
    }
    /**
     * Detach the current controls from the specified dom element.
     */
    detachControl() {
      if (this._scene) {
        if (this._onKeyboardObserver) {
          this._scene.onKeyboardObservable.remove(this._onKeyboardObserver);
        }
        if (this._onCanvasBlurObserver) {
          this._engine.onCanvasBlurObservable.remove(this._onCanvasBlurObserver);
        }
        this._onKeyboardObserver = null;
        this._onCanvasBlurObserver = null;
      }
      this._keys.length = 0;
    }
    /**
     * Update the current camera state depending on the inputs that have been used this frame.
     * This is a dynamically created lambda to avoid the performance penalty of looping for inputs in the render loop.
     */
    checkInputs() {
      if (this._onKeyboardObserver) {
        const camera = this.camera;
        const input = camera.movement.input;
        this._keyboardModifiers.ctrl = this._ctrlPressed;
        this._keyboardModifiers.alt = this._altPressed;
        const rotateDirection = this._rotateDirection.set(0, 0);
        const panDirection = this._panDirection.set(0, 0);
        let rotateSensitivity = 0;
        let panSensitivity = 0;
        for (let index = 0; index < this._keys.length; index++) {
          const keyCode = this._keys[index];
          this._keyboardConditions.key = keyCode;
          if (this.keysReset.indexOf(keyCode) === -1) {
            const resolved = input.resolveInteraction("keyboard", this._keyboardConditions);
            if (resolved) {
              if (resolved.interaction === "pan") {
                panSensitivity = Math.max(panSensitivity, resolved.sensitivity ?? 1 / this.panningSensibility);
                if (this.keysLeft.indexOf(keyCode) !== -1) {
                  panDirection.x -= 1;
                } else if (this.keysRight.indexOf(keyCode) !== -1) {
                  panDirection.x += 1;
                } else if (this.keysUp.indexOf(keyCode) !== -1) {
                  panDirection.y += 1;
                } else if (this.keysDown.indexOf(keyCode) !== -1) {
                  panDirection.y -= 1;
                }
              } else if (resolved.interaction === "zoom") {
                const zoomSens = resolved.sensitivity ?? 1 / this.zoomingSensibility;
                if (this.keysUp.indexOf(keyCode) !== -1 || this.keysZoomIn.indexOf(keyCode) !== -1) {
                  input.handlers.zoom(zoomSens);
                } else if (this.keysDown.indexOf(keyCode) !== -1 || this.keysZoomOut.indexOf(keyCode) !== -1) {
                  input.handlers.zoom(-zoomSens);
                }
              } else if (resolved.interaction === "rotate") {
                rotateSensitivity = Math.max(rotateSensitivity, resolved.sensitivity ?? this.angularSpeed);
                if (this.keysLeft.indexOf(keyCode) !== -1) {
                  rotateDirection.x -= 1;
                } else if (this.keysRight.indexOf(keyCode) !== -1) {
                  rotateDirection.x += 1;
                } else if (this.keysUp.indexOf(keyCode) !== -1) {
                  rotateDirection.y -= 1;
                } else if (this.keysDown.indexOf(keyCode) !== -1) {
                  rotateDirection.y += 1;
                }
              }
            }
          }
          if (this.keysReset.indexOf(keyCode) !== -1) {
            if (camera.useInputToRestoreState) {
              camera.restoreState();
            }
          }
        }
        if (rotateDirection.x !== 0 || rotateDirection.y !== 0) {
          rotateDirection.normalize().scaleInPlace(rotateSensitivity);
          input.handlers.rotate(rotateDirection.x, rotateDirection.y);
        }
        if (panDirection.x !== 0 || panDirection.y !== 0) {
          panDirection.normalize().scaleInPlace(panSensitivity);
          input.handlers.pan(panDirection.x, panDirection.y);
        }
      }
    }
    /**
     * Gets the class name of the current input.
     * @returns the class name
     */
    getClassName() {
      return "ArcRotateCameraKeyboardMoveInput";
    }
    /**
     * Get the friendly name associated with the input class.
     * @returns the input friendly name
     */
    getSimpleName() {
      return "keyboard";
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? /* @__PURE__ */ Object.create(null) : void 0;
    _keysUp_decorators = [serialize()];
    _keysDown_decorators = [serialize()];
    _keysLeft_decorators = [serialize()];
    _keysRight_decorators = [serialize()];
    _keysReset_decorators = [serialize()];
    _keysZoomIn_decorators = [serialize()];
    _keysZoomOut_decorators = [serialize()];
    _panningSensibility_decorators = [serialize()];
    _zoomingSensibility_decorators = [serialize()];
    _angularSpeed_decorators = [serialize()];
    _get_useAltToZoom_decorators = [serialize()];
    __esDecorate(_a2, null, _get_useAltToZoom_decorators, { kind: "getter", name: "useAltToZoom", static: false, private: false, access: { has: (obj) => "useAltToZoom" in obj, get: (obj) => obj.useAltToZoom }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(null, null, _keysUp_decorators, { kind: "field", name: "keysUp", static: false, private: false, access: { has: (obj) => "keysUp" in obj, get: (obj) => obj.keysUp, set: (obj, value) => {
      obj.keysUp = value;
    } }, metadata: _metadata }, _keysUp_initializers, _keysUp_extraInitializers);
    __esDecorate(null, null, _keysDown_decorators, { kind: "field", name: "keysDown", static: false, private: false, access: { has: (obj) => "keysDown" in obj, get: (obj) => obj.keysDown, set: (obj, value) => {
      obj.keysDown = value;
    } }, metadata: _metadata }, _keysDown_initializers, _keysDown_extraInitializers);
    __esDecorate(null, null, _keysLeft_decorators, { kind: "field", name: "keysLeft", static: false, private: false, access: { has: (obj) => "keysLeft" in obj, get: (obj) => obj.keysLeft, set: (obj, value) => {
      obj.keysLeft = value;
    } }, metadata: _metadata }, _keysLeft_initializers, _keysLeft_extraInitializers);
    __esDecorate(null, null, _keysRight_decorators, { kind: "field", name: "keysRight", static: false, private: false, access: { has: (obj) => "keysRight" in obj, get: (obj) => obj.keysRight, set: (obj, value) => {
      obj.keysRight = value;
    } }, metadata: _metadata }, _keysRight_initializers, _keysRight_extraInitializers);
    __esDecorate(null, null, _keysReset_decorators, { kind: "field", name: "keysReset", static: false, private: false, access: { has: (obj) => "keysReset" in obj, get: (obj) => obj.keysReset, set: (obj, value) => {
      obj.keysReset = value;
    } }, metadata: _metadata }, _keysReset_initializers, _keysReset_extraInitializers);
    __esDecorate(null, null, _keysZoomIn_decorators, { kind: "field", name: "keysZoomIn", static: false, private: false, access: { has: (obj) => "keysZoomIn" in obj, get: (obj) => obj.keysZoomIn, set: (obj, value) => {
      obj.keysZoomIn = value;
    } }, metadata: _metadata }, _keysZoomIn_initializers, _keysZoomIn_extraInitializers);
    __esDecorate(null, null, _keysZoomOut_decorators, { kind: "field", name: "keysZoomOut", static: false, private: false, access: { has: (obj) => "keysZoomOut" in obj, get: (obj) => obj.keysZoomOut, set: (obj, value) => {
      obj.keysZoomOut = value;
    } }, metadata: _metadata }, _keysZoomOut_initializers, _keysZoomOut_extraInitializers);
    __esDecorate(null, null, _panningSensibility_decorators, { kind: "field", name: "panningSensibility", static: false, private: false, access: { has: (obj) => "panningSensibility" in obj, get: (obj) => obj.panningSensibility, set: (obj, value) => {
      obj.panningSensibility = value;
    } }, metadata: _metadata }, _panningSensibility_initializers, _panningSensibility_extraInitializers);
    __esDecorate(null, null, _zoomingSensibility_decorators, { kind: "field", name: "zoomingSensibility", static: false, private: false, access: { has: (obj) => "zoomingSensibility" in obj, get: (obj) => obj.zoomingSensibility, set: (obj, value) => {
      obj.zoomingSensibility = value;
    } }, metadata: _metadata }, _zoomingSensibility_initializers, _zoomingSensibility_extraInitializers);
    __esDecorate(null, null, _angularSpeed_decorators, { kind: "field", name: "angularSpeed", static: false, private: false, access: { has: (obj) => "angularSpeed" in obj, get: (obj) => obj.angularSpeed, set: (obj, value) => {
      obj.angularSpeed = value;
    } }, metadata: _metadata }, _angularSpeed_initializers, _angularSpeed_extraInitializers);
    if (_metadata) Object.defineProperty(_a2, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a2;
})();
CameraInputTypes["ArcRotateCameraKeyboardMoveInput"] = ArcRotateCameraKeyboardMoveInput;
const FfMultiplier = 40;
let ArcRotateCameraMouseWheelInput = (() => {
  var _a2;
  let _wheelPrecision_decorators;
  let _wheelPrecision_initializers = [];
  let _wheelPrecision_extraInitializers = [];
  let _zoomToMouseLocation_decorators;
  let _zoomToMouseLocation_initializers = [];
  let _zoomToMouseLocation_extraInitializers = [];
  let _wheelDeltaPercentage_decorators;
  let _wheelDeltaPercentage_initializers = [];
  let _wheelDeltaPercentage_extraInitializers = [];
  return _a2 = class ArcRotateCameraMouseWheelInput {
    constructor() {
      this.wheelPrecision = __runInitializers(this, _wheelPrecision_initializers, 3);
      this.zoomToMouseLocation = (__runInitializers(this, _wheelPrecision_extraInitializers), __runInitializers(this, _zoomToMouseLocation_initializers, false));
      this.wheelDeltaPercentage = (__runInitializers(this, _zoomToMouseLocation_extraInitializers), __runInitializers(this, _wheelDeltaPercentage_initializers, 0));
      this.customComputeDeltaFromMouseWheel = (__runInitializers(this, _wheelDeltaPercentage_extraInitializers), null);
      this._viewOffset = new Vector3(0, 0, 0);
      this._globalOffset = new Vector3(0, 0, 0);
      this._inertialPanning = Vector3.Zero();
      this._zoomToMouseRadiusOffset = 0;
    }
    _computeDeltaFromMouseWheelLegacyEvent(mouseWheelDelta, radius) {
      let delta;
      const wheelDelta = mouseWheelDelta * 0.01 * this.wheelDeltaPercentage * radius;
      if (mouseWheelDelta > 0) {
        delta = wheelDelta / (1 + this.wheelDeltaPercentage);
      } else {
        delta = wheelDelta * (1 + this.wheelDeltaPercentage);
      }
      return delta;
    }
    /**
     * Attach the input controls to a specific dom element to get the input from.
     * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
     */
    attachControl(noPreventDefault) {
      noPreventDefault = Tools.BackCompatCameraNoPreventDefault(arguments);
      this._wheel = (p) => {
        if (p.type !== PointerEventTypes.POINTERWHEEL) {
          return;
        }
        const event = p.event;
        let delta;
        const platformScale = event.deltaMode === EventConstants.DOM_DELTA_LINE ? FfMultiplier : 1;
        const wheelDelta = -(event.deltaY * platformScale);
        if (this.customComputeDeltaFromMouseWheel) {
          delta = this.customComputeDeltaFromMouseWheel(wheelDelta, this, event);
        } else {
          if (this.wheelDeltaPercentage) {
            delta = this._computeDeltaFromMouseWheelLegacyEvent(wheelDelta, this.camera.radius);
            if (delta > 0) {
              const currentAccumulated = this.zoomToMouseLocation ? this._zoomToMouseRadiusOffset : this.camera.inertialRadiusOffset;
              let estimatedTargetRadius = this.camera.radius;
              let targetInertia = currentAccumulated + delta;
              for (let i = 0; i < 20; i++) {
                if (estimatedTargetRadius <= targetInertia) {
                  break;
                }
                if (Math.abs(targetInertia * this.camera.inertia) < 1e-3) {
                  break;
                }
                estimatedTargetRadius -= targetInertia;
                targetInertia *= this.camera.inertia;
              }
              estimatedTargetRadius = Clamp(estimatedTargetRadius, 0, Number.MAX_VALUE);
              delta = this._computeDeltaFromMouseWheelLegacyEvent(wheelDelta, estimatedTargetRadius);
            }
          } else {
            const wheelEntry = this.camera.movement.input.getEntry("wheel", "zoom");
            const wheelScale = wheelEntry?.sensitivity ?? 1 / (this.wheelPrecision * 40);
            delta = wheelDelta * wheelScale;
          }
        }
        if (delta) {
          if (this.zoomToMouseLocation) {
            if (!this._hitPlane) {
              this._updateHitPlane();
            }
            this._zoomToMouse(delta);
          } else {
            this.camera.movement.zoomAccumulatedPixels += delta;
          }
        }
        if (event.preventDefault) {
          if (!noPreventDefault) {
            event.preventDefault();
          }
        }
      };
      this._observer = this.camera.getScene()._inputManager._addCameraPointerObserver(this._wheel, PointerEventTypes.POINTERWHEEL);
      if (this.zoomToMouseLocation) {
        this._inertialPanning.setAll(0);
      }
    }
    /**
     * Detach the current controls from the specified dom element.
     */
    detachControl() {
      if (this._observer) {
        this.camera.getScene()._inputManager._removeCameraPointerObserver(this._observer);
        this._observer = null;
        this._wheel = null;
      }
    }
    /**
     * Update the current camera state depending on the inputs that have been used this frame.
     * This is a dynamically created lambda to avoid the performance penalty of looping for inputs in the render loop.
     */
    checkInputs() {
      if (!this.zoomToMouseLocation) {
        return;
      }
      const camera = this.camera;
      const motion = Math.abs(this._zoomToMouseRadiusOffset) + this._inertialPanning.lengthSquared() + Math.abs(camera.inertialAlphaOffset) + Math.abs(camera.inertialBetaOffset) + Math.abs(camera.inertialRadiusOffset);
      if (motion) {
        this._updateHitPlane();
        camera.target.addInPlace(this._inertialPanning);
        camera.radius -= this._zoomToMouseRadiusOffset;
        const decay = camera.movement.getFrameIndependentDecay(camera.inertia);
        this._inertialPanning.scaleInPlace(decay);
        this._zoomToMouseRadiusOffset *= decay;
        this._zeroIfClose(this._inertialPanning);
        if (Math.abs(this._zoomToMouseRadiusOffset) < Epsilon) {
          this._zoomToMouseRadiusOffset = 0;
        }
      }
    }
    /**
     * Gets the class name of the current input.
     * @returns the class name
     */
    getClassName() {
      return "ArcRotateCameraMouseWheelInput";
    }
    /**
     * Get the friendly name associated with the input class.
     * @returns the input friendly name
     */
    getSimpleName() {
      return "mousewheel";
    }
    _updateHitPlane() {
      const camera = this.camera;
      const direction = camera.target.subtract(camera.position);
      this._hitPlane = Plane.FromPositionAndNormal(camera.target, direction);
    }
    // Get position on the hit plane
    _getPosition() {
      const camera = this.camera;
      const scene = camera.getScene();
      const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), camera, false);
      if (camera.targetScreenOffset.x !== 0 || camera.targetScreenOffset.y !== 0) {
        this._viewOffset.set(camera.targetScreenOffset.x, camera.targetScreenOffset.y, 0);
        camera.getViewMatrix().invertToRef(camera._cameraTransformMatrix);
        this._globalOffset = Vector3.TransformNormal(this._viewOffset, camera._cameraTransformMatrix);
        ray.origin.addInPlace(this._globalOffset);
      }
      let distance = 0;
      if (this._hitPlane) {
        distance = ray.intersectsPlane(this._hitPlane) ?? 0;
      }
      return ray.origin.addInPlace(ray.direction.scaleInPlace(distance));
    }
    _zoomToMouse(delta) {
      const camera = this.camera;
      const inertiaComp = 1 - camera.inertia;
      const inputScale = camera.movement.getFrameIndependentInputScale(camera.inertia);
      if (camera.lowerRadiusLimit) {
        const lowerLimit = camera.lowerRadiusLimit ?? 0;
        if (camera.radius - (this._zoomToMouseRadiusOffset + delta * inputScale) / inertiaComp < lowerLimit) {
          delta = ((camera.radius - lowerLimit) * inertiaComp - this._zoomToMouseRadiusOffset) / inputScale;
        }
      }
      if (camera.upperRadiusLimit) {
        const upperLimit = camera.upperRadiusLimit ?? 0;
        if (camera.radius - (this._zoomToMouseRadiusOffset + delta * inputScale) / inertiaComp > upperLimit) {
          delta = ((camera.radius - upperLimit) * inertiaComp - this._zoomToMouseRadiusOffset) / inputScale;
        }
      }
      const zoomDistance = delta / inertiaComp;
      const ratio = zoomDistance / camera.radius;
      const vec = this._getPosition();
      const directionToZoomLocation = TmpVectors.Vector3[6];
      vec.subtractToRef(camera.target, directionToZoomLocation);
      directionToZoomLocation.scaleInPlace(ratio);
      directionToZoomLocation.scaleInPlace(inertiaComp);
      directionToZoomLocation.scaleInPlace(inputScale);
      this._inertialPanning.addInPlace(directionToZoomLocation);
      this._zoomToMouseRadiusOffset += delta * inputScale;
    }
    // Sets x y or z of passed in vector to zero if less than Epsilon.
    _zeroIfClose(vec) {
      if (Math.abs(vec.x) < Epsilon) {
        vec.x = 0;
      }
      if (Math.abs(vec.y) < Epsilon) {
        vec.y = 0;
      }
      if (Math.abs(vec.z) < Epsilon) {
        vec.z = 0;
      }
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? /* @__PURE__ */ Object.create(null) : void 0;
    _wheelPrecision_decorators = [serialize()];
    _zoomToMouseLocation_decorators = [serialize()];
    _wheelDeltaPercentage_decorators = [serialize()];
    __esDecorate(null, null, _wheelPrecision_decorators, { kind: "field", name: "wheelPrecision", static: false, private: false, access: { has: (obj) => "wheelPrecision" in obj, get: (obj) => obj.wheelPrecision, set: (obj, value) => {
      obj.wheelPrecision = value;
    } }, metadata: _metadata }, _wheelPrecision_initializers, _wheelPrecision_extraInitializers);
    __esDecorate(null, null, _zoomToMouseLocation_decorators, { kind: "field", name: "zoomToMouseLocation", static: false, private: false, access: { has: (obj) => "zoomToMouseLocation" in obj, get: (obj) => obj.zoomToMouseLocation, set: (obj, value) => {
      obj.zoomToMouseLocation = value;
    } }, metadata: _metadata }, _zoomToMouseLocation_initializers, _zoomToMouseLocation_extraInitializers);
    __esDecorate(null, null, _wheelDeltaPercentage_decorators, { kind: "field", name: "wheelDeltaPercentage", static: false, private: false, access: { has: (obj) => "wheelDeltaPercentage" in obj, get: (obj) => obj.wheelDeltaPercentage, set: (obj, value) => {
      obj.wheelDeltaPercentage = value;
    } }, metadata: _metadata }, _wheelDeltaPercentage_initializers, _wheelDeltaPercentage_extraInitializers);
    if (_metadata) Object.defineProperty(_a2, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a2;
})();
CameraInputTypes["ArcRotateCameraMouseWheelInput"] = ArcRotateCameraMouseWheelInput;
var _a, _b;
class ArcRotateCameraInputsManager extends CameraInputsManager {
  /**
   * Instantiates a new ArcRotateCameraInputsManager.
   * @param camera Defines the camera the inputs belong to
   */
  constructor(camera) {
    super(camera);
  }
  /**
   * Add mouse wheel input support to the input manager.
   * @returns the current input manager
   */
  addMouseWheel() {
    this.add(new ArcRotateCameraMouseWheelInput());
    return this;
  }
  /**
   * Add pointers input support to the input manager.
   * @returns the current input manager
   */
  addPointers() {
    this.add(new ArcRotateCameraPointersInput());
    return this;
  }
  /**
   * Add keyboard input support to the input manager.
   * @returns the current input manager
   */
  addKeyboard() {
    this.add(new ArcRotateCameraKeyboardMoveInput());
    return this;
  }
}
(_a = ArcRotateCameraInputsManager.prototype).addVRDeviceOrientation ?? (_a.addVRDeviceOrientation = _MissingSideEffect("ArcRotateCameraInputsManager", "addVRDeviceOrientation"));
(_b = ArcRotateCameraInputsManager.prototype).addGamepad ?? (_b.addGamepad = _MissingSideEffect("ArcRotateCameraInputsManager", "addGamepad"));
class ArcRotateCameraMovement extends CameraMovement {
  constructor(scene, cameraPosition, behavior) {
    super(scene, cameraPosition, behavior);
    this.input = new InputMapper({
      pan: (deltaX, deltaY) => {
        this.panAccumulatedPixels.x += deltaX;
        this.panAccumulatedPixels.y += deltaY;
      },
      rotate: (deltaX, deltaY) => {
        this.rotationAccumulatedPixels.x += deltaX;
        this.rotationAccumulatedPixels.y += deltaY;
      },
      zoom: (delta) => {
        this.zoomAccumulatedPixels += delta;
      }
    }, () => this._createDefaultInputMap());
  }
  _createDefaultInputMap() {
    return [
      // ctrl+left-drag → pan (more specific than the bare rotate entry below; must come first so first-match-wins picks it).
      { source: "pointer", button: 0, modifiers: { ctrl: true }, interaction: "pan" },
      { source: "pointer", button: 0, interaction: "rotate" },
      { source: "pointer", button: 2, interaction: "pan" },
      { source: "wheel", interaction: "zoom" },
      { source: "keyboard", key: [187, 107, 189, 109], interaction: "zoom" },
      // +/-/numpad+/numpad-
      { source: "keyboard", modifiers: { ctrl: true }, interaction: "pan" },
      { source: "keyboard", modifiers: { alt: true }, interaction: "zoom" },
      { source: "keyboard", interaction: "rotate" }
    ];
  }
}
function ComputeAlpha(offset) {
  let alpha = Math.PI / 2;
  if (!(offset.x === 0 && offset.z === 0)) {
    alpha = Math.acos(offset.x / Math.sqrt(Math.pow(offset.x, 2) + Math.pow(offset.z, 2)));
  }
  if (offset.z < 0) {
    alpha = 2 * Math.PI - alpha;
  }
  return alpha;
}
function ComputeBeta(verticalOffset, radius) {
  return Math.acos(verticalOffset / radius);
}
function CheckNaN(value, fallback) {
  return isNaN(value) ? fallback : value;
}
let ArcRotateCamera = (() => {
  var _a2;
  let _classSuper = TargetCamera;
  let _instanceExtraInitializers = [];
  let _alpha_decorators;
  let _alpha_initializers = [];
  let _alpha_extraInitializers = [];
  let _beta_decorators;
  let _beta_initializers = [];
  let _beta_extraInitializers = [];
  let _radius_decorators;
  let _radius_initializers = [];
  let _radius_extraInitializers = [];
  let _overrideCloneAlphaBetaRadius_decorators;
  let _overrideCloneAlphaBetaRadius_initializers = [];
  let _overrideCloneAlphaBetaRadius_extraInitializers = [];
  let __target_decorators;
  let __target_initializers = [];
  let __target_extraInitializers = [];
  let __targetHost_decorators;
  let __targetHost_initializers = [];
  let __targetHost_extraInitializers = [];
  let _get_inertialAlphaOffset_decorators;
  let _get_inertialBetaOffset_decorators;
  let _get_inertialRadiusOffset_decorators;
  let _lowerAlphaLimit_decorators;
  let _lowerAlphaLimit_initializers = [];
  let _lowerAlphaLimit_extraInitializers = [];
  let _upperAlphaLimit_decorators;
  let _upperAlphaLimit_initializers = [];
  let _upperAlphaLimit_extraInitializers = [];
  let _lowerBetaLimit_decorators;
  let _lowerBetaLimit_initializers = [];
  let _lowerBetaLimit_extraInitializers = [];
  let _upperBetaLimit_decorators;
  let _upperBetaLimit_initializers = [];
  let _upperBetaLimit_extraInitializers = [];
  let _lowerRadiusLimit_decorators;
  let _lowerRadiusLimit_initializers = [];
  let _lowerRadiusLimit_extraInitializers = [];
  let _upperRadiusLimit_decorators;
  let _upperRadiusLimit_initializers = [];
  let _upperRadiusLimit_extraInitializers = [];
  let _lowerTargetYLimit_decorators;
  let _lowerTargetYLimit_initializers = [];
  let _lowerTargetYLimit_extraInitializers = [];
  let _inertialPanningX_decorators;
  let _inertialPanningX_initializers = [];
  let _inertialPanningX_extraInitializers = [];
  let _inertialPanningY_decorators;
  let _inertialPanningY_initializers = [];
  let _inertialPanningY_extraInitializers = [];
  let _pinchToPanMaxDistance_decorators;
  let _pinchToPanMaxDistance_initializers = [];
  let _pinchToPanMaxDistance_extraInitializers = [];
  let _panningDistanceLimit_decorators;
  let _panningDistanceLimit_initializers = [];
  let _panningDistanceLimit_extraInitializers = [];
  let _panningOriginTarget_decorators;
  let _panningOriginTarget_initializers = [];
  let _panningOriginTarget_extraInitializers = [];
  let _get_panningInertia_decorators;
  let _get_zoomToMouseLocation_decorators;
  let _zoomOnFactor_decorators;
  let _zoomOnFactor_initializers = [];
  let _zoomOnFactor_extraInitializers = [];
  let _targetScreenOffset_decorators;
  let _targetScreenOffset_initializers = [];
  let _targetScreenOffset_extraInitializers = [];
  let _allowUpsideDown_decorators;
  let _allowUpsideDown_initializers = [];
  let _allowUpsideDown_extraInitializers = [];
  let _useInputToRestoreState_decorators;
  let _useInputToRestoreState_initializers = [];
  let _useInputToRestoreState_extraInitializers = [];
  let _restoreStateInterpolationFactor_decorators;
  let _restoreStateInterpolationFactor_initializers = [];
  let _restoreStateInterpolationFactor_extraInitializers = [];
  return _a2 = class ArcRotateCamera extends _classSuper {
    /**
     * Defines the target point of the camera.
     * The camera looks towards it from the radius distance.
     */
    get target() {
      return this._target;
    }
    set target(value) {
      this.setTarget(value);
    }
    /**
     * Defines the target transform node of the camera.
     * The camera looks towards it from the radius distance.
     * Please note that setting a target host will disable panning.
     */
    get targetHost() {
      return this._targetHost;
    }
    set targetHost(value) {
      if (value) {
        this.setTarget(value);
      }
    }
    /**
     * Return the current target position of the camera. This value is expressed in local space.
     * @returns the target position
     */
    getTarget() {
      return this.target;
    }
    /**
     * Define the current local position of the camera in the scene
     */
    get position() {
      return this._position;
    }
    set position(newPosition) {
      this.setPosition(newPosition);
    }
    /**
     * The vector the camera should consider as up. (default is Vector3(0, 1, 0) as returned by Vector3.Up())
     * Setting this will copy the given vector to the camera's upVector, and set rotation matrices to and from Y up.
     * DO NOT set the up vector using copyFrom or copyFromFloats, as this bypasses setting the above matrices.
     */
    set upVector(vec) {
      if (!this._upToYMatrix) {
        this._yToUpMatrix = new Matrix();
        this._upToYMatrix = new Matrix();
        this._upVector = Vector3.Zero();
      }
      vec.normalize();
      this._upVector.copyFrom(vec);
      this.setMatUp();
    }
    get upVector() {
      return this._upVector;
    }
    /**
     * Sets the Y-up to camera up-vector rotation matrix, and the up-vector to Y-up rotation matrix.
     */
    setMatUp() {
      Matrix.RotationAlignToRef(Vector3.UpReadOnly, this._upVector, this._yToUpMatrix);
      Matrix.RotationAlignToRef(this._upVector, Vector3.UpReadOnly, this._upToYMatrix);
    }
    /**
     * Current inertia value on the longitudinal axis.
     * When nonzero, represents the per-frame angular offset (in radians) applied to `alpha`.
     * Each frame, this value is multiplied by {@link inertia} (a decay coefficient where
     * 0 = instant stop, 0.9 = smooth glide, 1 = never stops).
     * Reading this value also reflects the rotation delta the movement system will apply this frame
     * (decays toward 0 over the inertia tail), preserving legacy semantics for "is the camera still animating?" checks.
     * Setting this to 0 also stops the movement system's rotation velocity for backward compatibility.
     */
    get inertialAlphaOffset() {
      if (this._inertialAlphaOffset !== 0) {
        return this._inertialAlphaOffset;
      }
      if (this.movement.rotationAccumulatedPixels.x !== 0) {
        return this.movement.rotationAccumulatedPixels.x;
      }
      const delta = this.movement.rotationDeltaCurrentFrame.x;
      return Math.abs(delta) < this._rotationEpsilon ? 0 : delta;
    }
    set inertialAlphaOffset(value) {
      this._inertialAlphaOffset = value;
      if (value === 0) {
        this.movement.resetRotationVelocity();
      }
    }
    /**
     * Current inertia value on the latitudinal axis.
     * When nonzero, represents the per-frame angular offset (in radians) applied to `beta`.
     * Each frame, this value is multiplied by {@link inertia} (a decay coefficient where
     * 0 = instant stop, 0.9 = smooth glide, 1 = never stops).
     * Reading this value also reflects the rotation delta the movement system will apply this frame
     * (decays toward 0 over the inertia tail), preserving legacy semantics for "is the camera still animating?" checks.
     * Setting this to 0 also stops the movement system's rotation velocity for backward compatibility.
     */
    get inertialBetaOffset() {
      if (this._inertialBetaOffset !== 0) {
        return this._inertialBetaOffset;
      }
      if (this.movement.rotationAccumulatedPixels.y !== 0) {
        return this.movement.rotationAccumulatedPixels.y;
      }
      const delta = this.movement.rotationDeltaCurrentFrame.y;
      return Math.abs(delta) < this._rotationEpsilon ? 0 : delta;
    }
    set inertialBetaOffset(value) {
      this._inertialBetaOffset = value;
      if (value === 0) {
        this.movement.resetRotationVelocity();
      }
    }
    /**
     * Current inertia value on the radius axis.
     * When nonzero, represents the per-frame offset (in scene units) applied to `radius`.
     * Each frame, this value is multiplied by {@link inertia} (a decay coefficient where
     * 0 = instant stop, 0.9 = smooth glide, 1 = never stops).
     * Reading this value also reflects the zoom delta the movement system will apply this frame
     * (decays toward 0 over the inertia tail), preserving legacy semantics for "is the camera still animating?" checks.
     * Setting this to 0 also stops the movement system's zoom velocity for backward compatibility.
     */
    get inertialRadiusOffset() {
      if (this._inertialRadiusOffset !== 0) {
        return this._inertialRadiusOffset;
      }
      if (this.movement.zoomAccumulatedPixels !== 0) {
        return this.movement.zoomAccumulatedPixels;
      }
      const delta = this.movement.zoomDeltaCurrentFrame;
      return Math.abs(delta) < this._rotationEpsilon ? 0 : delta;
    }
    set inertialRadiusOffset(value) {
      this._inertialRadiusOffset = value;
      if (value === 0) {
        this.movement.resetZoomVelocity();
      }
    }
    /**
     * Defines the value of the inertia used during panning.
     * A decay coefficient applied per reference frame at 60fps:
     * 0 means stop instantly, 0.9 means smooth glide, 1 means never stop.
     * Setting this also updates the movement system's pan inertia.
     */
    get panningInertia() {
      return this._panningInertia;
    }
    set panningInertia(value) {
      this._panningInertia = value;
      if (this.movement) {
        this.movement.panInertia = value;
      }
    }
    /**
     * Defines the rotation/zoom inertia (decay coefficient applied per reference frame at 60fps).
     * Override of {@link Camera.inertia} that automatically syncs to the movement system
     * (rotation and zoom). Panning inertia is controlled separately via {@link panningInertia}.
     */
    get inertia() {
      return this._inertia;
    }
    set inertia(value) {
      this._inertia = value;
      if (this.movement) {
        this.movement.rotationInertia = value;
        this.movement.zoomInertia = value;
      }
    }
    //-- begin properties for backward compatibility for inputs
    /**
     * Gets or Set the pointer angular sensibility  along the X axis or how fast is the camera rotating.
     */
    get angularSensibilityX() {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        return pointers.angularSensibilityX;
      }
      return 0;
    }
    set angularSensibilityX(value) {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        pointers.angularSensibilityX = value;
      }
    }
    /**
     * Gets or Set the pointer angular sensibility along the Y axis or how fast is the camera rotating.
     */
    get angularSensibilityY() {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        return pointers.angularSensibilityY;
      }
      return 0;
    }
    set angularSensibilityY(value) {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        pointers.angularSensibilityY = value;
      }
    }
    /**
     * Gets or Set the pointer pinch precision or how fast is the camera zooming.
     */
    get pinchPrecision() {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        return pointers.pinchPrecision;
      }
      return 0;
    }
    set pinchPrecision(value) {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        pointers.pinchPrecision = value;
      }
    }
    /**
     * Gets or Set the pointer pinch delta percentage or how fast is the camera zooming.
     * It will be used instead of pinchPrecision if different from 0.
     * It defines the percentage of current camera.radius to use as delta when pinch zoom is used.
     */
    get pinchDeltaPercentage() {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        return pointers.pinchDeltaPercentage;
      }
      return 0;
    }
    set pinchDeltaPercentage(value) {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        pointers.pinchDeltaPercentage = value;
      }
    }
    /**
     * Gets or Set the pointer use natural pinch zoom to override the pinch precision
     * and pinch delta percentage.
     * When useNaturalPinchZoom is true, multi touch zoom will zoom in such
     * that any object in the plane at the camera's target point will scale
     * perfectly with finger motion.
     */
    get useNaturalPinchZoom() {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        return pointers.useNaturalPinchZoom;
      }
      return false;
    }
    set useNaturalPinchZoom(value) {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        pointers.useNaturalPinchZoom = value;
      }
    }
    /**
     * Gets or Set the pointer panning sensibility or how fast is the camera moving.
     */
    get panningSensibility() {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        return pointers.panningSensibility;
      }
      return 0;
    }
    set panningSensibility(value) {
      const pointers = this.inputs.attached["pointers"];
      if (pointers) {
        pointers.panningSensibility = value;
      }
    }
    /**
     * Gets or Set the list of keyboard keys used to control beta angle in a positive direction.
     */
    get keysUp() {
      const keyboard = this.inputs.attached["keyboard"];
      if (keyboard) {
        return keyboard.keysUp;
      }
      return [];
    }
    set keysUp(value) {
      const keyboard = this.inputs.attached["keyboard"];
      if (keyboard) {
        keyboard.keysUp = value;
      }
    }
    /**
     * Gets or Set the list of keyboard keys used to control beta angle in a negative direction.
     */
    get keysDown() {
      const keyboard = this.inputs.attached["keyboard"];
      if (keyboard) {
        return keyboard.keysDown;
      }
      return [];
    }
    set keysDown(value) {
      const keyboard = this.inputs.attached["keyboard"];
      if (keyboard) {
        keyboard.keysDown = value;
      }
    }
    /**
     * Gets or Set the list of keyboard keys used to control alpha angle in a negative direction.
     */
    get keysLeft() {
      const keyboard = this.inputs.attached["keyboard"];
      if (keyboard) {
        return keyboard.keysLeft;
      }
      return [];
    }
    set keysLeft(value) {
      const keyboard = this.inputs.attached["keyboard"];
      if (keyboard) {
        keyboard.keysLeft = value;
      }
    }
    /**
     * Gets or Set the list of keyboard keys used to control alpha angle in a positive direction.
     */
    get keysRight() {
      const keyboard = this.inputs.attached["keyboard"];
      if (keyboard) {
        return keyboard.keysRight;
      }
      return [];
    }
    set keysRight(value) {
      const keyboard = this.inputs.attached["keyboard"];
      if (keyboard) {
        keyboard.keysRight = value;
      }
    }
    /**
     * Gets or Set the mouse wheel precision or how fast is the camera zooming.
     */
    get wheelPrecision() {
      const mousewheel = this.inputs.attached["mousewheel"];
      if (mousewheel) {
        return mousewheel.wheelPrecision;
      }
      return 0;
    }
    set wheelPrecision(value) {
      const mousewheel = this.inputs.attached["mousewheel"];
      if (mousewheel) {
        mousewheel.wheelPrecision = value;
      }
    }
    /**
     * Gets or Set the boolean value that controls whether or not the mouse wheel
     * zooms to the location of the mouse pointer or not.  The default is false.
     */
    get zoomToMouseLocation() {
      const mousewheel = this.inputs.attached["mousewheel"];
      if (mousewheel) {
        return mousewheel.zoomToMouseLocation;
      }
      return false;
    }
    set zoomToMouseLocation(value) {
      const mousewheel = this.inputs.attached["mousewheel"];
      if (mousewheel) {
        mousewheel.zoomToMouseLocation = value;
      }
    }
    /**
     * Gets or Set the mouse wheel delta percentage or how fast is the camera zooming.
     * It will be used instead of wheelPrecision if different from 0.
     * It defines the percentage of current camera.radius to use as delta when wheel zoom is used.
     */
    get wheelDeltaPercentage() {
      const mousewheel = this.inputs.attached["mousewheel"];
      if (mousewheel) {
        return mousewheel.wheelDeltaPercentage;
      }
      return 0;
    }
    set wheelDeltaPercentage(value) {
      const mousewheel = this.inputs.attached["mousewheel"];
      if (mousewheel) {
        mousewheel.wheelDeltaPercentage = value;
      }
    }
    /**
     * Gets or sets whether ctrl+keyboard triggers panning.
     * Setting this updates the keyboard→pan inputMap entry.
     * @internal kept for backward compatibility
     */
    get _useCtrlForPanning() {
      return this._useCtrlForPanningInternal;
    }
    set _useCtrlForPanning(value) {
      this._useCtrlForPanningInternal = value;
      const input = this.movement.input;
      const keyboardEntry = input.getEntry("keyboard", "pan", { modifiers: { ctrl: true } });
      if (!value && keyboardEntry) {
        input.inputMap.splice(input.inputMap.indexOf(keyboardEntry), 1);
      } else if (value && !keyboardEntry) {
        input.addEntry({ source: "keyboard", modifiers: { ctrl: true }, interaction: "pan" });
      }
      const pointerEntry = input.getEntry("pointer", "pan", { modifiers: { ctrl: true } });
      if (!value && pointerEntry) {
        input.inputMap.splice(input.inputMap.indexOf(pointerEntry), 1);
      } else if (value && !pointerEntry) {
        input.addEntry({ source: "pointer", button: 0, modifiers: { ctrl: true }, interaction: "pan" });
      }
    }
    /**
     * Gets or sets which mouse button triggers panning (0=left, 1=middle, 2=right).
     * Setting this updates the pointer→pan inputMap entry.
     * @internal kept for backward compatibility with attachControl signature
     */
    get _panningMouseButton() {
      return this._panningMouseButtonInternal;
    }
    set _panningMouseButton(value) {
      this._panningMouseButtonInternal = value;
      const entry = this.movement.input.getEntry("pointer", "pan", { modifiers: {} });
      if (entry) {
        entry.button = value;
      }
    }
    /**
     * If true, indicates the camera is currently interpolating to a new pose.
     */
    get isInterpolating() {
      return this._isInterpolating;
    }
    /**
     * Gets the bouncing behavior of the camera if it has been enabled.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/behaviors/cameraBehaviors#bouncing-behavior
     */
    get bouncingBehavior() {
      return this._bouncingBehavior;
    }
    /**
     * Defines if the bouncing behavior of the camera is enabled on the camera.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/behaviors/cameraBehaviors#bouncing-behavior
     */
    get useBouncingBehavior() {
      return this._bouncingBehavior != null;
    }
    set useBouncingBehavior(value) {
      if (value === this.useBouncingBehavior) {
        return;
      }
      if (value) {
        this._bouncingBehavior = new BouncingBehavior();
        this.addBehavior(this._bouncingBehavior);
      } else if (this._bouncingBehavior) {
        this.removeBehavior(this._bouncingBehavior);
        this._bouncingBehavior = null;
      }
    }
    /**
     * Gets the framing behavior of the camera if it has been enabled.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/behaviors/cameraBehaviors#framing-behavior
     */
    get framingBehavior() {
      return this._framingBehavior;
    }
    /**
     * Defines if the framing behavior of the camera is enabled on the camera.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/behaviors/cameraBehaviors#framing-behavior
     */
    get useFramingBehavior() {
      return this._framingBehavior != null;
    }
    set useFramingBehavior(value) {
      if (value === this.useFramingBehavior) {
        return;
      }
      if (value) {
        this._framingBehavior = new FramingBehavior();
        this.addBehavior(this._framingBehavior);
      } else if (this._framingBehavior) {
        this.removeBehavior(this._framingBehavior);
        this._framingBehavior = null;
      }
    }
    /**
     * Gets the auto rotation behavior of the camera if it has been enabled.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/behaviors/cameraBehaviors#autorotation-behavior
     */
    get autoRotationBehavior() {
      return this._autoRotationBehavior;
    }
    /**
     * Defines if the auto rotation behavior of the camera is enabled on the camera.
     * @see https://doc.babylonjs.com/features/featuresDeepDive/behaviors/cameraBehaviors#autorotation-behavior
     */
    get useAutoRotationBehavior() {
      return this._autoRotationBehavior != null;
    }
    set useAutoRotationBehavior(value) {
      if (value === this.useAutoRotationBehavior) {
        return;
      }
      if (value) {
        this._autoRotationBehavior = new AutoRotationBehavior();
        this.addBehavior(this._autoRotationBehavior);
      } else if (this._autoRotationBehavior) {
        this.removeBehavior(this._autoRotationBehavior);
        this._autoRotationBehavior = null;
      }
    }
    /**
     * Instantiates a new ArcRotateCamera in a given scene
     * @param name Defines the name of the camera
     * @param alpha Defines the camera rotation along the longitudinal axis
     * @param beta Defines the camera rotation along the latitudinal axis
     * @param radius Defines the camera distance from its target
     * @param target Defines the camera target
     * @param scene Defines the scene the camera belongs to
     * @param setActiveOnSceneIfNoneActive Defines whether the camera should be marked as active if not other active cameras have been defined
     */
    constructor(name, alpha, beta, radius, target, scene, setActiveOnSceneIfNoneActive = true) {
      super(name, Vector3.Zero(), scene, setActiveOnSceneIfNoneActive);
      this.alpha = (__runInitializers(this, _instanceExtraInitializers), __runInitializers(this, _alpha_initializers, void 0));
      this.beta = (__runInitializers(this, _alpha_extraInitializers), __runInitializers(this, _beta_initializers, void 0));
      this.radius = (__runInitializers(this, _beta_extraInitializers), __runInitializers(this, _radius_initializers, void 0));
      this.overrideCloneAlphaBetaRadius = (__runInitializers(this, _radius_extraInitializers), __runInitializers(this, _overrideCloneAlphaBetaRadius_initializers, void 0));
      this._target = (__runInitializers(this, _overrideCloneAlphaBetaRadius_extraInitializers), __runInitializers(this, __target_initializers, void 0));
      this._targetHost = (__runInitializers(this, __target_extraInitializers), __runInitializers(this, __targetHost_initializers, void 0));
      this._upToYMatrix = __runInitializers(this, __targetHost_extraInitializers);
      this._inertialAlphaOffset = 0;
      this._inertialBetaOffset = 0;
      this._inertialRadiusOffset = 0;
      this.lowerAlphaLimit = __runInitializers(this, _lowerAlphaLimit_initializers, null);
      this.upperAlphaLimit = (__runInitializers(this, _lowerAlphaLimit_extraInitializers), __runInitializers(this, _upperAlphaLimit_initializers, null));
      this.lowerBetaLimit = (__runInitializers(this, _upperAlphaLimit_extraInitializers), __runInitializers(this, _lowerBetaLimit_initializers, 0.01));
      this.upperBetaLimit = (__runInitializers(this, _lowerBetaLimit_extraInitializers), __runInitializers(this, _upperBetaLimit_initializers, Math.PI - 0.01));
      this.lowerRadiusLimit = (__runInitializers(this, _upperBetaLimit_extraInitializers), __runInitializers(this, _lowerRadiusLimit_initializers, null));
      this.upperRadiusLimit = (__runInitializers(this, _lowerRadiusLimit_extraInitializers), __runInitializers(this, _upperRadiusLimit_initializers, null));
      this.lowerTargetYLimit = (__runInitializers(this, _upperRadiusLimit_extraInitializers), __runInitializers(this, _lowerTargetYLimit_initializers, -Infinity));
      this.inertialPanningX = (__runInitializers(this, _lowerTargetYLimit_extraInitializers), __runInitializers(this, _inertialPanningX_initializers, 0));
      this.inertialPanningY = (__runInitializers(this, _inertialPanningX_extraInitializers), __runInitializers(this, _inertialPanningY_initializers, 0));
      this.pinchToPanMaxDistance = (__runInitializers(this, _inertialPanningY_extraInitializers), __runInitializers(this, _pinchToPanMaxDistance_initializers, 20));
      this.panningDistanceLimit = (__runInitializers(this, _pinchToPanMaxDistance_extraInitializers), __runInitializers(this, _panningDistanceLimit_initializers, null));
      this.panningOriginTarget = (__runInitializers(this, _panningDistanceLimit_extraInitializers), __runInitializers(this, _panningOriginTarget_initializers, Vector3.Zero()));
      this._panningInertia = (__runInitializers(this, _panningOriginTarget_extraInitializers), 0.9);
      this._inertia = 0.9;
      this.zoomOnFactor = __runInitializers(this, _zoomOnFactor_initializers, 1);
      this.targetScreenOffset = (__runInitializers(this, _zoomOnFactor_extraInitializers), __runInitializers(this, _targetScreenOffset_initializers, Vector2.Zero()));
      this.allowUpsideDown = (__runInitializers(this, _targetScreenOffset_extraInitializers), __runInitializers(this, _allowUpsideDown_initializers, true));
      this.useInputToRestoreState = (__runInitializers(this, _allowUpsideDown_extraInitializers), __runInitializers(this, _useInputToRestoreState_initializers, true));
      this.restoreStateInterpolationFactor = (__runInitializers(this, _useInputToRestoreState_extraInitializers), __runInitializers(this, _restoreStateInterpolationFactor_initializers, 0));
      this._currentInterpolationFactor = (__runInitializers(this, _restoreStateInterpolationFactor_extraInitializers), 0);
      this._viewMatrix = new Matrix();
      this._useCtrlForPanningInternal = true;
      this._panningMouseButtonInternal = 2;
      this._processMovementAsTargetCamera = false;
      this.panningAxis = new Vector3(1, 1, 0);
      this._transformedDirection = new Vector3();
      this.mapPanning = false;
      this._isInterpolating = false;
      this.onMeshTargetChangedObservable = new Observable();
      this.checkCollisions = false;
      this.collisionRadius = new Vector3(0.5, 0.5, 0.5);
      this._previousPosition = Vector3.Zero();
      this._collisionVelocity = Vector3.Zero();
      this._newPosition = Vector3.Zero();
      this._computationVector = Vector3.Zero();
      this._goalAlpha = NaN;
      this._goalBeta = NaN;
      this._goalRadius = NaN;
      this._goalTarget = new Vector3(NaN, NaN, NaN);
      this._goalTargetScreenOffset = new Vector2(NaN, NaN);
      this._onCollisionPositionChange = (collisionId, newPosition, collidedMesh = null) => {
        if (!collidedMesh) {
          this._previousPosition.copyFrom(this._position);
        } else {
          this.setPosition(newPosition);
          if (this.onCollide) {
            this.onCollide(collidedMesh);
          }
        }
        const cosa = Math.cos(this.alpha);
        const sina = Math.sin(this.alpha);
        const cosb = Math.cos(this.beta);
        let sinb = Math.sin(this.beta);
        if (sinb === 0) {
          sinb = 1e-4;
        }
        const target2 = this._getTargetPosition();
        this._computationVector.copyFromFloats(this.radius * cosa * sinb, this.radius * cosb, this.radius * sina * sinb);
        target2.addToRef(this._computationVector, this._newPosition);
        this._position.copyFrom(this._newPosition);
        let up = this.upVector;
        if (this.allowUpsideDown && this.beta < 0) {
          up = up.clone();
          up = up.negate();
        }
        this._computeViewMatrix(this._position, target2, up);
        this._viewMatrix.addAtIndex(12, this.targetScreenOffset.x);
        this._viewMatrix.addAtIndex(13, this.targetScreenOffset.y);
        this._collisionTriggered = false;
      };
      this._target = Vector3.Zero();
      if (target) {
        this.setTarget(target);
      }
      this.alpha = alpha;
      this.beta = beta;
      this.radius = radius;
      this.getViewMatrix();
      this.inputs = new ArcRotateCameraInputsManager(this);
      this.inputs.addKeyboard().addMouseWheel().addPointers();
      this.movement = new ArcRotateCameraMovement(this.getScene(), this._position);
      this.movement.rotationInertia = this._inertia;
      this.movement.zoomInertia = this._inertia;
      this.movement.panInertia = this._panningInertia;
    }
    // Cache
    /** @internal */
    _initCache() {
      super._initCache();
      this._cache._target = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
      this._cache.alpha = void 0;
      this._cache.beta = void 0;
      this._cache.radius = void 0;
      this._cache.targetScreenOffset = Vector2.Zero();
    }
    /**
     * @internal
     */
    _updateCache(ignoreParentClass) {
      if (!ignoreParentClass) {
        super._updateCache();
      }
      this._cache._target.copyFrom(this._getTargetPosition());
      this._cache.alpha = this.alpha;
      this._cache.beta = this.beta;
      this._cache.radius = this.radius;
      this._cache.targetScreenOffset.copyFrom(this.targetScreenOffset);
    }
    _getTargetPosition() {
      if (this._targetHost && this._targetHost.getAbsolutePosition) {
        const pos = this._targetHost.getAbsolutePosition();
        if (this._targetBoundingCenter) {
          pos.addToRef(this._targetBoundingCenter, this._target);
        } else {
          this._target.copyFrom(pos);
        }
      }
      const lockedTargetPosition = this._getLockedTargetPosition();
      if (lockedTargetPosition) {
        return lockedTargetPosition;
      }
      return this._target;
    }
    /**
     * Stores the current state of the camera (alpha, beta, radius and target)
     * @returns the camera itself
     */
    storeState() {
      this._storedAlpha = this.alpha;
      this._storedBeta = this.beta;
      this._storedRadius = this.radius;
      this._storedTarget = this._getTargetPosition().clone();
      this._storedTargetScreenOffset = this.targetScreenOffset.clone();
      return super.storeState();
    }
    /**
     * @internal
     * Restored camera state. You must call storeState() first
     */
    _restoreStateValues() {
      if (this.hasStateStored() && this.restoreStateInterpolationFactor > Epsilon && this.restoreStateInterpolationFactor < 1) {
        this.interpolateTo(this._storedAlpha, this._storedBeta, this._storedRadius, this._storedTarget, this._storedTargetScreenOffset, this.restoreStateInterpolationFactor);
        return true;
      }
      if (!super._restoreStateValues()) {
        return false;
      }
      this.setTarget(this._storedTarget.clone());
      this.alpha = this._storedAlpha;
      this.beta = this._storedBeta;
      this.radius = this._storedRadius;
      this.targetScreenOffset = this._storedTargetScreenOffset.clone();
      this.inertialAlphaOffset = 0;
      this.inertialBetaOffset = 0;
      this.inertialRadiusOffset = 0;
      this.inertialPanningX = 0;
      this.inertialPanningY = 0;
      return true;
    }
    /**
     * Stops any in-progress interpolation.
     */
    stopInterpolation() {
      this._goalAlpha = NaN;
      this._goalBeta = NaN;
      this._goalRadius = NaN;
      this._goalTarget.set(NaN, NaN, NaN);
      this._goalTargetScreenOffset.set(NaN, NaN);
    }
    /**
     * Interpolates the camera to a goal state.
     * @param alpha Defines the goal alpha.
     * @param beta Defines the goal beta.
     * @param radius Defines the goal radius.
     * @param target Defines the goal target.
     * @param targetScreenOffset Defines the goal target screen offset.
     * @param interpolationFactor A value  between 0 and 1 that determines the speed of the interpolation.
     * @remarks Passing undefined for any of the parameters will use the current value (effectively stopping any in-progress interpolation for that parameter).
     *          Passing NaN will not start or stop any interpolation for that parameter (effectively allowing multiple interpolations of different parameters to overlap).
     */
    interpolateTo(alpha = this.alpha, beta = this.beta, radius = this.radius, target = this.target, targetScreenOffset = this.targetScreenOffset, interpolationFactor) {
      this.inertialAlphaOffset = 0;
      this.inertialBetaOffset = 0;
      this.inertialRadiusOffset = 0;
      this.inertialPanningX = 0;
      this.inertialPanningY = 0;
      if (interpolationFactor != null) {
        this._currentInterpolationFactor = interpolationFactor;
      } else if (this.restoreStateInterpolationFactor !== 0) {
        this._currentInterpolationFactor = this.restoreStateInterpolationFactor;
      } else {
        this._currentInterpolationFactor = 0.1;
      }
      this._goalAlpha = CheckNaN(alpha, this._goalAlpha);
      this._goalBeta = CheckNaN(beta, this._goalBeta);
      this._goalRadius = CheckNaN(radius, this._goalRadius);
      this._goalTarget.set(CheckNaN(target.x, this._goalTarget.x), CheckNaN(target.y, this._goalTarget.y), CheckNaN(target.z, this._goalTarget.z));
      this._goalTargetScreenOffset.set(CheckNaN(targetScreenOffset.x, this._goalTargetScreenOffset.x), CheckNaN(targetScreenOffset.y, this._goalTargetScreenOffset.y));
      this._goalAlpha = Clamp(this._goalAlpha, this.lowerAlphaLimit ?? -Infinity, this.upperAlphaLimit ?? Infinity);
      this._goalBeta = Clamp(this._goalBeta, this.lowerBetaLimit ?? -Infinity, this.upperBetaLimit ?? Infinity);
      this._goalRadius = Clamp(this._goalRadius, this.lowerRadiusLimit ?? -Infinity, this.upperRadiusLimit ?? Infinity);
      this._goalTarget.y = Clamp(this._goalTarget.y, this.lowerTargetYLimit ?? -Infinity, Infinity);
      this._isInterpolating = true;
    }
    // Synchronized
    /** @internal */
    _isSynchronizedViewMatrix() {
      if (!super._isSynchronizedViewMatrix()) {
        return false;
      }
      return this._cache._target.equals(this._getTargetPosition()) && this._cache.alpha === this.alpha && this._cache.beta === this.beta && this._cache.radius === this.radius && this._cache.targetScreenOffset.equals(this.targetScreenOffset);
    }
    /**
     * Attached controls to the current camera.
     * @param ignored defines an ignored parameter kept for backward compatibility.
     * @param noPreventDefault Defines whether event caught by the controls should call preventdefault() (https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)
     * @param useCtrlForPanning  Defines whether ctrl is used for panning within the controls
     * @param panningMouseButton Defines whether panning is allowed through mouse click button
     */
    attachControl(ignored, noPreventDefault, useCtrlForPanning = true, panningMouseButton = 2) {
      const args = arguments;
      noPreventDefault = Tools.BackCompatCameraNoPreventDefault(args);
      this._useCtrlForPanning = useCtrlForPanning;
      this._panningMouseButton = panningMouseButton;
      if (typeof args[0] === "boolean") {
        if (args.length > 1) {
          this._useCtrlForPanning = args[1];
        }
        if (args.length > 2) {
          this._panningMouseButton = args[2];
        }
      }
      this.inputs.attachElement(noPreventDefault);
      this._reset = () => {
        this.inertialAlphaOffset = 0;
        this.inertialBetaOffset = 0;
        this.inertialRadiusOffset = 0;
        this.inertialPanningX = 0;
        this.inertialPanningY = 0;
      };
    }
    /**
     * Detach the current controls from the specified dom element.
     */
    detachControl() {
      this.inputs.detachElement();
      if (this._reset) {
        this._reset();
      }
    }
    /**
     * Applies rotation and zoom deltas to the camera, handling invertRotation, handedness, and beta-flip.
     * Shared by both the movement system and legacy inertia paths.
     * @param alphaOffset - Alpha (horizontal orbit) delta
     * @param betaOffset - Beta (vertical orbit) delta
     * @param radiusOffset - Radius (zoom) delta
     */
    _applyRotationAndZoomDelta(alphaOffset, betaOffset, radiusOffset) {
      const directionModifier = this.invertRotation ? -1 : 1;
      const handednessMultiplier = this._calculateHandednessMultiplier();
      let adjustedAlpha = alphaOffset * handednessMultiplier;
      if (this.beta < 0) {
        adjustedAlpha *= -1;
      }
      this.alpha += adjustedAlpha * directionModifier;
      this.beta += betaOffset * directionModifier;
      this.radius -= radiusOffset;
    }
    /**
     * Applies a pan delta to the camera target in screen space.
     * Shared by both the movement system and legacy inertia paths.
     * @param panX - Horizontal pan delta
     * @param panY - Vertical pan delta
     */
    _applyPanDelta(panX, panY) {
      const localDirection = TmpVectors.Vector3[0].copyFromFloats(panX, panY, panY);
      this._viewMatrix.invertToRef(this._cameraTransformMatrix);
      localDirection.multiplyInPlace(this.panningAxis);
      Vector3.TransformNormalToRef(localDirection, this._cameraTransformMatrix, this._transformedDirection);
      if (this.mapPanning) {
        const up = this.upVector;
        const right = Vector3.CrossToRef(this._transformedDirection, up, this._transformedDirection);
        Vector3.CrossToRef(up, right, this._transformedDirection);
      } else if (!this.panningAxis.y) {
        this._transformedDirection.y = 0;
      }
      if (!this._targetHost) {
        if (this.panningDistanceLimit !== null) {
          this._transformedDirection.addInPlace(this._target);
          const distanceSquared = Vector3.DistanceSquared(this._transformedDirection, this.panningOriginTarget);
          if (distanceSquared <= this.panningDistanceLimit * this.panningDistanceLimit) {
            this._target.copyFrom(this._transformedDirection);
          }
        } else {
          if (this.parent) {
            const m = TmpVectors.Matrix[0];
            this.parent.getWorldMatrix().getRotationMatrixToRef(m);
            m.transposeToRef(m);
            Vector3.TransformCoordinatesToRef(this._transformedDirection, m, this._transformedDirection);
          }
          this._target.addInPlace(this._transformedDirection);
        }
      }
    }
    /** @internal */
    _checkInputs() {
      if (this._collisionTriggered) {
        return;
      }
      this.inputs.checkInputs();
      let hasUserInteractions = false;
      this.movement.computeCurrentFrameDeltas();
      const rotDelta = this.movement.rotationDeltaCurrentFrame;
      const zoomDelta = this.movement.zoomDeltaCurrentFrame;
      const panDelta = this.movement.panDeltaCurrentFrame;
      if (rotDelta.x !== 0 || rotDelta.y !== 0 || zoomDelta !== 0 || panDelta.x !== 0 || panDelta.y !== 0) {
        hasUserInteractions = true;
        if (rotDelta.x !== 0 || rotDelta.y !== 0 || zoomDelta !== 0) {
          this._applyRotationAndZoomDelta(rotDelta.x, rotDelta.y, zoomDelta);
        }
        if (panDelta.x !== 0 || panDelta.y !== 0) {
          this._applyPanDelta(panDelta.x, panDelta.y);
        }
      }
      if (this._inertialAlphaOffset !== 0 || this._inertialBetaOffset !== 0 || this._inertialRadiusOffset !== 0) {
        this._applyRotationAndZoomDelta(this._inertialAlphaOffset, this._inertialBetaOffset, this._inertialRadiusOffset);
        this._inertialAlphaOffset *= this.inertia;
        this._inertialBetaOffset *= this.inertia;
        this._inertialRadiusOffset *= this.inertia;
        if (Math.abs(this._inertialAlphaOffset) < this._rotationEpsilon) {
          this._inertialAlphaOffset = 0;
        }
        if (Math.abs(this._inertialBetaOffset) < this._rotationEpsilon) {
          this._inertialBetaOffset = 0;
        }
        if (Math.abs(this._inertialRadiusOffset) < this._rotationEpsilon) {
          this._inertialRadiusOffset = 0;
        }
        hasUserInteractions = true;
      }
      if (this.inertialPanningX !== 0 || this.inertialPanningY !== 0) {
        this._applyPanDelta(this.inertialPanningX, this.inertialPanningY);
        this.inertialPanningX *= this.panningInertia;
        this.inertialPanningY *= this.panningInertia;
        const inertialPanningLimit = this._panningEpsilon;
        if (Math.abs(this.inertialPanningX) < inertialPanningLimit) {
          this.inertialPanningX = 0;
        }
        if (Math.abs(this.inertialPanningY) < inertialPanningLimit) {
          this.inertialPanningY = 0;
        }
        hasUserInteractions = true;
      }
      if (hasUserInteractions) {
        this.stopInterpolation();
      } else if (this._isInterpolating) {
        let isInterpolating = false;
        const dt = this._scene.getEngine().getDeltaTime() / 1e3;
        const t = 1 - Math.pow(2, -dt / this._currentInterpolationFactor);
        const goalRadius = CheckNaN(this._goalRadius, this.radius);
        if (!isNaN(this._goalTarget.x) || !isNaN(this._goalTarget.y) || !isNaN(this._goalTarget.z)) {
          const goalTarget = TmpVectors.Vector3[0].set(CheckNaN(this._goalTarget.x, this._target.x), CheckNaN(this._goalTarget.y, this._target.y), CheckNaN(this._goalTarget.z, this._target.z));
          Vector3.LerpToRef(this.target, goalTarget, t, this._target);
          if (Vector3.Distance(this.target, goalTarget) * 10 / goalRadius < Epsilon) {
            this._goalTarget.set(NaN, NaN, NaN);
            this.target.copyFrom(goalTarget);
            this.setTarget(this.target, false, true, true);
          } else {
            isInterpolating = true;
          }
        }
        if (!isNaN(this._goalAlpha) || !isNaN(this._goalBeta)) {
          const goalRotation = Quaternion.RotationAlphaBetaGammaToRef(CheckNaN(this._goalAlpha, this.alpha), CheckNaN(this._goalBeta, this.beta), 0, TmpVectors.Quaternion[0]);
          const currentRotation = Quaternion.RotationAlphaBetaGammaToRef(this.alpha, this.beta, 0, TmpVectors.Quaternion[1]);
          const newRotation = Quaternion.SlerpToRef(currentRotation, goalRotation, t, TmpVectors.Quaternion[2]);
          newRotation.normalize();
          const newAlphaBetaGamma = newRotation.toAlphaBetaGammaToRef(TmpVectors.Vector3[0]);
          this.alpha = newAlphaBetaGamma.x;
          this.beta = newAlphaBetaGamma.y;
          if (newRotation.isApprox(goalRotation, Epsilon / 5)) {
            this._goalAlpha = NaN;
            this._goalBeta = NaN;
            const goalAlphaBetaGamma = goalRotation.toAlphaBetaGammaToRef(TmpVectors.Vector3[0]);
            this.alpha = goalAlphaBetaGamma.x;
            this.beta = goalAlphaBetaGamma.y;
          } else {
            isInterpolating = true;
          }
        }
        if (!isNaN(this._goalRadius)) {
          this.radius += (goalRadius - this.radius) * t;
          if (Math.abs(goalRadius / this.radius - 1) < Epsilon) {
            this._goalRadius = NaN;
            this.radius = goalRadius;
          } else {
            isInterpolating = true;
          }
        }
        if (!isNaN(this._goalTargetScreenOffset.x) || !isNaN(this._goalTargetScreenOffset.y)) {
          const goalTargetScreenOffset = TmpVectors.Vector2[0].set(CheckNaN(this._goalTargetScreenOffset.x, this.targetScreenOffset.x), CheckNaN(this._goalTargetScreenOffset.y, this.targetScreenOffset.y));
          Vector2.LerpToRef(this.targetScreenOffset, goalTargetScreenOffset, t, this.targetScreenOffset);
          if (Vector2.Distance(this.targetScreenOffset, goalTargetScreenOffset) < Epsilon) {
            this._goalTargetScreenOffset.set(NaN, NaN);
            this.targetScreenOffset.copyFrom(goalTargetScreenOffset);
          } else {
            isInterpolating = true;
          }
        }
        this._isInterpolating = isInterpolating;
      }
      this._checkLimits();
      super._checkInputs();
    }
    _checkLimits() {
      if (this.lowerBetaLimit === null || this.lowerBetaLimit === void 0) {
        if (this.allowUpsideDown && this.beta > Math.PI) {
          this.beta = this.beta - 2 * Math.PI;
        }
      } else {
        if (this.beta < this.lowerBetaLimit) {
          this.beta = this.lowerBetaLimit;
        }
      }
      if (this.upperBetaLimit === null || this.upperBetaLimit === void 0) {
        if (this.allowUpsideDown && this.beta < -Math.PI) {
          this.beta = this.beta + 2 * Math.PI;
        }
      } else {
        if (this.beta > this.upperBetaLimit) {
          this.beta = this.upperBetaLimit;
        }
      }
      if (this.lowerAlphaLimit !== null && this.alpha < this.lowerAlphaLimit) {
        this.alpha = this.lowerAlphaLimit;
      }
      if (this.upperAlphaLimit !== null && this.alpha > this.upperAlphaLimit) {
        this.alpha = this.upperAlphaLimit;
      }
      if (this.lowerRadiusLimit !== null && this.radius < this.lowerRadiusLimit) {
        this.radius = this.lowerRadiusLimit;
        this.inertialRadiusOffset = 0;
      }
      if (this.upperRadiusLimit !== null && this.radius > this.upperRadiusLimit) {
        this.radius = this.upperRadiusLimit;
        this.inertialRadiusOffset = 0;
      }
      this.target.y = Math.max(this.target.y, this.lowerTargetYLimit);
    }
    /**
     * Rebuilds angles (alpha, beta) and radius from the give position and target
     */
    rebuildAnglesAndRadius() {
      this._position.subtractToRef(this._getTargetPosition(), this._computationVector);
      if (this._upVector.x !== 0 || this._upVector.y !== 1 || this._upVector.z !== 0) {
        Vector3.TransformCoordinatesToRef(this._computationVector, this._upToYMatrix, this._computationVector);
      }
      this.radius = this._computationVector.length();
      if (this.radius === 0) {
        this.radius = 1e-4;
      }
      const previousAlpha = this.alpha;
      this.alpha = ComputeAlpha(this._computationVector);
      this.beta = ComputeBeta(this._computationVector.y, this.radius);
      const alphaCorrectionTurns = Math.round((previousAlpha - this.alpha) / (2 * Math.PI));
      this.alpha += alphaCorrectionTurns * 2 * Math.PI;
      this._checkLimits();
    }
    /**
     * Use a position to define the current camera related information like alpha, beta and radius
     * @param position Defines the position to set the camera at
     */
    setPosition(position) {
      if (this._position.equals(position)) {
        return;
      }
      this._position.copyFrom(position);
      this.rebuildAnglesAndRadius();
    }
    /**
     * Defines the target the camera should look at.
     * This will automatically adapt alpha beta and radius to fit within the new target.
     * Please note that setting a target as a mesh will disable panning.
     * @param target Defines the new target as a Vector or a transform node
     * @param toBoundingCenter In case of a mesh target, defines whether to target the mesh position or its bounding information center
     * @param allowSamePosition If false, prevents reapplying the new computed position if it is identical to the current one (optim)
     * @param cloneAlphaBetaRadius If true, replicate the current setup (alpha, beta, radius) on the new target
     */
    setTarget(target, toBoundingCenter = false, allowSamePosition = false, cloneAlphaBetaRadius = false) {
      cloneAlphaBetaRadius = this.overrideCloneAlphaBetaRadius ?? cloneAlphaBetaRadius;
      if (target.computeWorldMatrix) {
        if (toBoundingCenter && target.getBoundingInfo) {
          this._targetBoundingCenter = target.getBoundingInfo().boundingBox.centerWorld.clone();
        } else {
          this._targetBoundingCenter = null;
        }
        target.computeWorldMatrix();
        this._targetHost = target;
        this._target = this._getTargetPosition();
        this.onMeshTargetChangedObservable.notifyObservers(this._targetHost);
      } else {
        const newTarget = target;
        const currentTarget = this._getTargetPosition();
        if (currentTarget && !allowSamePosition && currentTarget.equals(newTarget)) {
          return;
        }
        this._targetHost = null;
        this._target = newTarget;
        this._targetBoundingCenter = null;
        this.onMeshTargetChangedObservable.notifyObservers(null);
      }
      if (!cloneAlphaBetaRadius) {
        this.rebuildAnglesAndRadius();
      }
    }
    /** @internal */
    _getViewMatrix() {
      const cosa = Math.cos(this.alpha);
      const sina = Math.sin(this.alpha);
      const cosb = Math.cos(this.beta);
      let sinb = Math.sin(this.beta);
      if (sinb === 0) {
        sinb = 1e-4;
      }
      if (this.radius === 0) {
        this.radius = 1e-4;
      }
      const target = this._getTargetPosition();
      this._computationVector.copyFromFloats(this.radius * cosa * sinb, this.radius * cosb, this.radius * sina * sinb);
      if (this._upVector.x !== 0 || this._upVector.y !== 1 || this._upVector.z !== 0) {
        Vector3.TransformCoordinatesToRef(this._computationVector, this._yToUpMatrix, this._computationVector);
      }
      target.addToRef(this._computationVector, this._newPosition);
      if (this.getScene().collisionsEnabled && this.checkCollisions) {
        const coordinator = this.getScene().collisionCoordinator;
        if (!this._collider) {
          this._collider = coordinator.createCollider();
        }
        this._collider._radius = this.collisionRadius;
        this._newPosition.subtractToRef(this._position, this._collisionVelocity);
        this._collisionTriggered = true;
        coordinator.getNewPosition(this._position, this._collisionVelocity, this._collider, 3, null, this._onCollisionPositionChange, this.uniqueId);
      } else {
        this._position.copyFrom(this._newPosition);
        let up = this.upVector;
        if (this.allowUpsideDown && sinb < 0) {
          up = up.negate();
        }
        this._computeViewMatrix(this._position, target, up);
        this._viewMatrix.addAtIndex(12, this.targetScreenOffset.x);
        this._viewMatrix.addAtIndex(13, this.targetScreenOffset.y);
      }
      this._currentTarget.copyFrom(target);
      return this._viewMatrix;
    }
    /**
     * Zooms on a mesh to be at the min distance where we could see it fully in the current viewport.
     * @param meshes Defines the mesh to zoom on
     * @param doNotUpdateMaxZ Defines whether or not maxZ should be updated whilst zooming on the mesh (this can happen if the mesh is big and the maxradius pretty small for instance)
     */
    zoomOn(meshes, doNotUpdateMaxZ = false) {
      meshes = meshes || this.getScene().meshes;
      const minMaxVector = Mesh.MinMax(meshes);
      let distance = this._calculateLowerRadiusFromModelBoundingSphere(minMaxVector.min, minMaxVector.max);
      distance = Math.max(Math.min(distance, this.upperRadiusLimit || Number.MAX_VALUE), this.lowerRadiusLimit || 0);
      this.radius = distance * this.zoomOnFactor;
      if (this.mode === Camera.ORTHOGRAPHIC_CAMERA) {
        const aspectRatio = this.getScene().getEngine().getAspectRatio(this);
        const orthoExtent = distance * this.zoomOnFactor / 2;
        this.orthoLeft = -orthoExtent * aspectRatio;
        this.orthoRight = orthoExtent * aspectRatio;
        this.orthoBottom = -orthoExtent;
        this.orthoTop = orthoExtent;
      }
      this.focusOn({ min: minMaxVector.min, max: minMaxVector.max, distance }, doNotUpdateMaxZ);
    }
    /**
     * Focus on a mesh or a bounding box. This adapts the target and maxRadius if necessary but does not update the current radius.
     * The target will be changed but the radius
     * @param meshesOrMinMaxVectorAndDistance Defines the mesh or bounding info to focus on
     * @param doNotUpdateMaxZ Defines whether or not maxZ should be updated whilst zooming on the mesh (this can happen if the mesh is big and the maxradius pretty small for instance)
     */
    focusOn(meshesOrMinMaxVectorAndDistance, doNotUpdateMaxZ = false) {
      let meshesOrMinMaxVector;
      let distance;
      if (meshesOrMinMaxVectorAndDistance.min === void 0) {
        const meshes = meshesOrMinMaxVectorAndDistance || this.getScene().meshes;
        meshesOrMinMaxVector = Mesh.MinMax(meshes);
        distance = Vector3.Distance(meshesOrMinMaxVector.min, meshesOrMinMaxVector.max);
      } else {
        const minMaxVectorAndDistance = meshesOrMinMaxVectorAndDistance;
        meshesOrMinMaxVector = minMaxVectorAndDistance;
        distance = minMaxVectorAndDistance.distance;
      }
      this._target = Mesh.Center(meshesOrMinMaxVector);
      if (!doNotUpdateMaxZ) {
        this.maxZ = distance * 2;
      }
    }
    /**
     * @override
     * Override Camera.createRigCamera
     * @param name the name of the camera
     * @param cameraIndex the index of the camera in the rig cameras array
     */
    createRigCamera(name, cameraIndex) {
      let alphaShift = 0;
      switch (this.cameraRigMode) {
        case Camera.RIG_MODE_STEREOSCOPIC_ANAGLYPH:
        case Camera.RIG_MODE_STEREOSCOPIC_SIDEBYSIDE_PARALLEL:
        case Camera.RIG_MODE_STEREOSCOPIC_OVERUNDER:
        case Camera.RIG_MODE_STEREOSCOPIC_INTERLACED:
        case Camera.RIG_MODE_VR:
          alphaShift = this._cameraRigParams.stereoHalfAngle * (cameraIndex === 0 ? 1 : -1);
          break;
        case Camera.RIG_MODE_STEREOSCOPIC_SIDEBYSIDE_CROSSEYED:
          alphaShift = this._cameraRigParams.stereoHalfAngle * (cameraIndex === 0 ? -1 : 1);
          break;
      }
      const rigCam = new _a2(name, this.alpha + alphaShift, this.beta, this.radius, this._target, this.getScene());
      rigCam._cameraRigParams = {};
      rigCam.isRigCamera = true;
      rigCam.rigParent = this;
      rigCam.upVector = this.upVector;
      rigCam.mode = this.mode;
      rigCam.orthoLeft = this.orthoLeft;
      rigCam.orthoRight = this.orthoRight;
      rigCam.orthoBottom = this.orthoBottom;
      rigCam.orthoTop = this.orthoTop;
      return rigCam;
    }
    /**
     * @internal
     * @override
     * Override Camera._updateRigCameras
     */
    _updateRigCameras() {
      const camLeft = this._rigCameras[0];
      const camRight = this._rigCameras[1];
      camLeft.beta = camRight.beta = this.beta;
      switch (this.cameraRigMode) {
        case Camera.RIG_MODE_STEREOSCOPIC_ANAGLYPH:
        case Camera.RIG_MODE_STEREOSCOPIC_SIDEBYSIDE_PARALLEL:
        case Camera.RIG_MODE_STEREOSCOPIC_OVERUNDER:
        case Camera.RIG_MODE_STEREOSCOPIC_INTERLACED:
        case Camera.RIG_MODE_VR:
          camLeft.alpha = this.alpha - this._cameraRigParams.stereoHalfAngle;
          camRight.alpha = this.alpha + this._cameraRigParams.stereoHalfAngle;
          break;
        case Camera.RIG_MODE_STEREOSCOPIC_SIDEBYSIDE_CROSSEYED:
          camLeft.alpha = this.alpha + this._cameraRigParams.stereoHalfAngle;
          camRight.alpha = this.alpha - this._cameraRigParams.stereoHalfAngle;
          break;
      }
      super._updateRigCameras();
    }
    /**
     * @internal
     */
    _calculateLowerRadiusFromModelBoundingSphere(minimumWorld, maximumWorld, radiusScale = 1) {
      const boxVectorGlobalDiagonal = Vector3.Distance(minimumWorld, maximumWorld);
      const engine = this.getScene().getEngine();
      const aspectRatio = engine.getAspectRatio(this);
      const frustumSlopeY = Math.tan(this.fov / 2);
      const frustumSlopeX = frustumSlopeY * aspectRatio;
      const radiusWithoutFraming = boxVectorGlobalDiagonal * 0.5;
      const radius = radiusWithoutFraming * radiusScale;
      const distanceForHorizontalFrustum = radius * Math.sqrt(1 + 1 / (frustumSlopeX * frustumSlopeX));
      const distanceForVerticalFrustum = radius * Math.sqrt(1 + 1 / (frustumSlopeY * frustumSlopeY));
      return Math.max(distanceForHorizontalFrustum, distanceForVerticalFrustum);
    }
    /**
     * Destroy the camera and release the current resources hold by it.
     */
    dispose() {
      this.inputs.clear();
      super.dispose();
    }
    /**
     * Gets the current object class name.
     * @returns the class name
     */
    getClassName() {
      return "ArcRotateCamera";
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
    _alpha_decorators = [serialize()];
    _beta_decorators = [serialize()];
    _radius_decorators = [serialize()];
    _overrideCloneAlphaBetaRadius_decorators = [serialize()];
    __target_decorators = [serializeAsVector3("target")];
    __targetHost_decorators = [serializeAsMeshReference("targetHost")];
    _get_inertialAlphaOffset_decorators = [serialize()];
    _get_inertialBetaOffset_decorators = [serialize()];
    _get_inertialRadiusOffset_decorators = [serialize()];
    _lowerAlphaLimit_decorators = [serialize()];
    _upperAlphaLimit_decorators = [serialize()];
    _lowerBetaLimit_decorators = [serialize()];
    _upperBetaLimit_decorators = [serialize()];
    _lowerRadiusLimit_decorators = [serialize()];
    _upperRadiusLimit_decorators = [serialize()];
    _lowerTargetYLimit_decorators = [serialize()];
    _inertialPanningX_decorators = [serialize()];
    _inertialPanningY_decorators = [serialize()];
    _pinchToPanMaxDistance_decorators = [serialize()];
    _panningDistanceLimit_decorators = [serialize()];
    _panningOriginTarget_decorators = [serializeAsVector3()];
    _get_panningInertia_decorators = [serialize()];
    _get_zoomToMouseLocation_decorators = [serialize()];
    _zoomOnFactor_decorators = [serialize()];
    _targetScreenOffset_decorators = [serializeAsVector2()];
    _allowUpsideDown_decorators = [serialize()];
    _useInputToRestoreState_decorators = [serialize()];
    _restoreStateInterpolationFactor_decorators = [serialize()];
    __esDecorate(_a2, null, _get_inertialAlphaOffset_decorators, { kind: "getter", name: "inertialAlphaOffset", static: false, private: false, access: { has: (obj) => "inertialAlphaOffset" in obj, get: (obj) => obj.inertialAlphaOffset }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a2, null, _get_inertialBetaOffset_decorators, { kind: "getter", name: "inertialBetaOffset", static: false, private: false, access: { has: (obj) => "inertialBetaOffset" in obj, get: (obj) => obj.inertialBetaOffset }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a2, null, _get_inertialRadiusOffset_decorators, { kind: "getter", name: "inertialRadiusOffset", static: false, private: false, access: { has: (obj) => "inertialRadiusOffset" in obj, get: (obj) => obj.inertialRadiusOffset }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a2, null, _get_panningInertia_decorators, { kind: "getter", name: "panningInertia", static: false, private: false, access: { has: (obj) => "panningInertia" in obj, get: (obj) => obj.panningInertia }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(_a2, null, _get_zoomToMouseLocation_decorators, { kind: "getter", name: "zoomToMouseLocation", static: false, private: false, access: { has: (obj) => "zoomToMouseLocation" in obj, get: (obj) => obj.zoomToMouseLocation }, metadata: _metadata }, null, _instanceExtraInitializers);
    __esDecorate(null, null, _alpha_decorators, { kind: "field", name: "alpha", static: false, private: false, access: { has: (obj) => "alpha" in obj, get: (obj) => obj.alpha, set: (obj, value) => {
      obj.alpha = value;
    } }, metadata: _metadata }, _alpha_initializers, _alpha_extraInitializers);
    __esDecorate(null, null, _beta_decorators, { kind: "field", name: "beta", static: false, private: false, access: { has: (obj) => "beta" in obj, get: (obj) => obj.beta, set: (obj, value) => {
      obj.beta = value;
    } }, metadata: _metadata }, _beta_initializers, _beta_extraInitializers);
    __esDecorate(null, null, _radius_decorators, { kind: "field", name: "radius", static: false, private: false, access: { has: (obj) => "radius" in obj, get: (obj) => obj.radius, set: (obj, value) => {
      obj.radius = value;
    } }, metadata: _metadata }, _radius_initializers, _radius_extraInitializers);
    __esDecorate(null, null, _overrideCloneAlphaBetaRadius_decorators, { kind: "field", name: "overrideCloneAlphaBetaRadius", static: false, private: false, access: { has: (obj) => "overrideCloneAlphaBetaRadius" in obj, get: (obj) => obj.overrideCloneAlphaBetaRadius, set: (obj, value) => {
      obj.overrideCloneAlphaBetaRadius = value;
    } }, metadata: _metadata }, _overrideCloneAlphaBetaRadius_initializers, _overrideCloneAlphaBetaRadius_extraInitializers);
    __esDecorate(null, null, __target_decorators, { kind: "field", name: "_target", static: false, private: false, access: { has: (obj) => "_target" in obj, get: (obj) => obj._target, set: (obj, value) => {
      obj._target = value;
    } }, metadata: _metadata }, __target_initializers, __target_extraInitializers);
    __esDecorate(null, null, __targetHost_decorators, { kind: "field", name: "_targetHost", static: false, private: false, access: { has: (obj) => "_targetHost" in obj, get: (obj) => obj._targetHost, set: (obj, value) => {
      obj._targetHost = value;
    } }, metadata: _metadata }, __targetHost_initializers, __targetHost_extraInitializers);
    __esDecorate(null, null, _lowerAlphaLimit_decorators, { kind: "field", name: "lowerAlphaLimit", static: false, private: false, access: { has: (obj) => "lowerAlphaLimit" in obj, get: (obj) => obj.lowerAlphaLimit, set: (obj, value) => {
      obj.lowerAlphaLimit = value;
    } }, metadata: _metadata }, _lowerAlphaLimit_initializers, _lowerAlphaLimit_extraInitializers);
    __esDecorate(null, null, _upperAlphaLimit_decorators, { kind: "field", name: "upperAlphaLimit", static: false, private: false, access: { has: (obj) => "upperAlphaLimit" in obj, get: (obj) => obj.upperAlphaLimit, set: (obj, value) => {
      obj.upperAlphaLimit = value;
    } }, metadata: _metadata }, _upperAlphaLimit_initializers, _upperAlphaLimit_extraInitializers);
    __esDecorate(null, null, _lowerBetaLimit_decorators, { kind: "field", name: "lowerBetaLimit", static: false, private: false, access: { has: (obj) => "lowerBetaLimit" in obj, get: (obj) => obj.lowerBetaLimit, set: (obj, value) => {
      obj.lowerBetaLimit = value;
    } }, metadata: _metadata }, _lowerBetaLimit_initializers, _lowerBetaLimit_extraInitializers);
    __esDecorate(null, null, _upperBetaLimit_decorators, { kind: "field", name: "upperBetaLimit", static: false, private: false, access: { has: (obj) => "upperBetaLimit" in obj, get: (obj) => obj.upperBetaLimit, set: (obj, value) => {
      obj.upperBetaLimit = value;
    } }, metadata: _metadata }, _upperBetaLimit_initializers, _upperBetaLimit_extraInitializers);
    __esDecorate(null, null, _lowerRadiusLimit_decorators, { kind: "field", name: "lowerRadiusLimit", static: false, private: false, access: { has: (obj) => "lowerRadiusLimit" in obj, get: (obj) => obj.lowerRadiusLimit, set: (obj, value) => {
      obj.lowerRadiusLimit = value;
    } }, metadata: _metadata }, _lowerRadiusLimit_initializers, _lowerRadiusLimit_extraInitializers);
    __esDecorate(null, null, _upperRadiusLimit_decorators, { kind: "field", name: "upperRadiusLimit", static: false, private: false, access: { has: (obj) => "upperRadiusLimit" in obj, get: (obj) => obj.upperRadiusLimit, set: (obj, value) => {
      obj.upperRadiusLimit = value;
    } }, metadata: _metadata }, _upperRadiusLimit_initializers, _upperRadiusLimit_extraInitializers);
    __esDecorate(null, null, _lowerTargetYLimit_decorators, { kind: "field", name: "lowerTargetYLimit", static: false, private: false, access: { has: (obj) => "lowerTargetYLimit" in obj, get: (obj) => obj.lowerTargetYLimit, set: (obj, value) => {
      obj.lowerTargetYLimit = value;
    } }, metadata: _metadata }, _lowerTargetYLimit_initializers, _lowerTargetYLimit_extraInitializers);
    __esDecorate(null, null, _inertialPanningX_decorators, { kind: "field", name: "inertialPanningX", static: false, private: false, access: { has: (obj) => "inertialPanningX" in obj, get: (obj) => obj.inertialPanningX, set: (obj, value) => {
      obj.inertialPanningX = value;
    } }, metadata: _metadata }, _inertialPanningX_initializers, _inertialPanningX_extraInitializers);
    __esDecorate(null, null, _inertialPanningY_decorators, { kind: "field", name: "inertialPanningY", static: false, private: false, access: { has: (obj) => "inertialPanningY" in obj, get: (obj) => obj.inertialPanningY, set: (obj, value) => {
      obj.inertialPanningY = value;
    } }, metadata: _metadata }, _inertialPanningY_initializers, _inertialPanningY_extraInitializers);
    __esDecorate(null, null, _pinchToPanMaxDistance_decorators, { kind: "field", name: "pinchToPanMaxDistance", static: false, private: false, access: { has: (obj) => "pinchToPanMaxDistance" in obj, get: (obj) => obj.pinchToPanMaxDistance, set: (obj, value) => {
      obj.pinchToPanMaxDistance = value;
    } }, metadata: _metadata }, _pinchToPanMaxDistance_initializers, _pinchToPanMaxDistance_extraInitializers);
    __esDecorate(null, null, _panningDistanceLimit_decorators, { kind: "field", name: "panningDistanceLimit", static: false, private: false, access: { has: (obj) => "panningDistanceLimit" in obj, get: (obj) => obj.panningDistanceLimit, set: (obj, value) => {
      obj.panningDistanceLimit = value;
    } }, metadata: _metadata }, _panningDistanceLimit_initializers, _panningDistanceLimit_extraInitializers);
    __esDecorate(null, null, _panningOriginTarget_decorators, { kind: "field", name: "panningOriginTarget", static: false, private: false, access: { has: (obj) => "panningOriginTarget" in obj, get: (obj) => obj.panningOriginTarget, set: (obj, value) => {
      obj.panningOriginTarget = value;
    } }, metadata: _metadata }, _panningOriginTarget_initializers, _panningOriginTarget_extraInitializers);
    __esDecorate(null, null, _zoomOnFactor_decorators, { kind: "field", name: "zoomOnFactor", static: false, private: false, access: { has: (obj) => "zoomOnFactor" in obj, get: (obj) => obj.zoomOnFactor, set: (obj, value) => {
      obj.zoomOnFactor = value;
    } }, metadata: _metadata }, _zoomOnFactor_initializers, _zoomOnFactor_extraInitializers);
    __esDecorate(null, null, _targetScreenOffset_decorators, { kind: "field", name: "targetScreenOffset", static: false, private: false, access: { has: (obj) => "targetScreenOffset" in obj, get: (obj) => obj.targetScreenOffset, set: (obj, value) => {
      obj.targetScreenOffset = value;
    } }, metadata: _metadata }, _targetScreenOffset_initializers, _targetScreenOffset_extraInitializers);
    __esDecorate(null, null, _allowUpsideDown_decorators, { kind: "field", name: "allowUpsideDown", static: false, private: false, access: { has: (obj) => "allowUpsideDown" in obj, get: (obj) => obj.allowUpsideDown, set: (obj, value) => {
      obj.allowUpsideDown = value;
    } }, metadata: _metadata }, _allowUpsideDown_initializers, _allowUpsideDown_extraInitializers);
    __esDecorate(null, null, _useInputToRestoreState_decorators, { kind: "field", name: "useInputToRestoreState", static: false, private: false, access: { has: (obj) => "useInputToRestoreState" in obj, get: (obj) => obj.useInputToRestoreState, set: (obj, value) => {
      obj.useInputToRestoreState = value;
    } }, metadata: _metadata }, _useInputToRestoreState_initializers, _useInputToRestoreState_extraInitializers);
    __esDecorate(null, null, _restoreStateInterpolationFactor_decorators, { kind: "field", name: "restoreStateInterpolationFactor", static: false, private: false, access: { has: (obj) => "restoreStateInterpolationFactor" in obj, get: (obj) => obj.restoreStateInterpolationFactor, set: (obj, value) => {
      obj.restoreStateInterpolationFactor = value;
    } }, metadata: _metadata }, _restoreStateInterpolationFactor_initializers, _restoreStateInterpolationFactor_extraInitializers);
    if (_metadata) Object.defineProperty(_a2, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a2;
})();
let _Registered = false;
function RegisterArcRotateCamera() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  Node.AddNodeConstructor("ArcRotateCamera", (name, scene) => {
    return () => new ArcRotateCamera(name, 0, 0, 1, Vector3.Zero(), scene);
  });
  RegisterClass("BABYLON.ArcRotateCamera", ArcRotateCamera);
}
RegisterArcRotateCamera();
export {
  ArcRotateCamera as A,
  BaseCameraPointersInput as B,
  OrbitCameraPointersInput as O,
  ArcRotateCameraInputsManager as a
};
