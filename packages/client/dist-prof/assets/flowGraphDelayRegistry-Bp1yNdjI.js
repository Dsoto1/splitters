import { L as Logger, M as Matrix, Y as FlowGraphInteger, a0 as Vector2, V as Vector3, a1 as Vector4, Q as Quaternion, a as Color3, C as Color4, a8 as __runInitializers, bu as RandomGUID, O as Observable, a7 as __esDecorate, bm as serialize, z as RegisterClass, cd as IsNavigatorAvailable, a2 as PointerEventTypes, c5 as KeyboardEventTypes, a5 as Tools, U as AbstractEngine } from "./babylon-PnzH6wcM.js";
import { F as FlowGraphMatrix2D, n as FlowGraphMatrix3D } from "./flowGraphRichTypes-B7BqVpav.js";
const _DefaultEventDataParseCounts = /* @__PURE__ */ new WeakMap();
function _GetDefaultEventDataParseCount(value) {
  return value !== null && typeof value === "object" ? _DefaultEventDataParseCounts.get(value) ?? 0 : 0;
}
function IsVectorClassName(className) {
  return className === "Vector2" || className === "Vector3" || className === "Vector4" || className === "Quaternion" || className === "Color3" || className === "Color4";
}
function IsMatrixClassName(className) {
  return className === "Matrix" || className === "Matrix2D" || className === "Matrix3D";
}
function IsAnimationGroupClassName(className) {
  return className === "AnimationGroup";
}
function GetSceneNodeFromSerializedReference(serializedReference, scene) {
  if (!serializedReference || !serializedReference.id && !serializedReference.name) {
    return void 0;
  }
  const nodes = scene.getNodes().filter((node) => serializedReference.id ? node.id === serializedReference.id : node.name === serializedReference.name);
  if (nodes.length === 0) {
    return void 0;
  }
  const className = serializedReference.type ?? serializedReference.className;
  const classMatches = className ? nodes.filter((node) => node.getClassName() === className) : [];
  const candidates = classMatches.length > 0 ? classMatches : nodes;
  return (serializedReference.uniqueId ? candidates.find((node) => node.uniqueId === serializedReference.uniqueId) : void 0) ?? candidates[0];
}
function ParseVector(className, value, flipHandedness = false) {
  if (className === "Vector2") {
    return Vector2.FromArray(value);
  } else if (className === "Vector3") {
    if (flipHandedness) {
      value[2] *= -1;
    }
    return Vector3.FromArray(value);
  } else if (className === "Vector4") {
    return Vector4.FromArray(value);
  } else if (className === "Quaternion") {
    if (flipHandedness) {
      value[2] *= -1;
      value[3] *= -1;
    }
    return Quaternion.FromArray(value);
  } else if (className === "Color3") {
    return new Color3(value[0], value[1], value[2]);
  } else if (className === "Color4") {
    return new Color4(value[0], value[1], value[2], value[3]);
  } else {
    throw new Error(`Unknown vector class name ${className}`);
  }
}
function defaultValueSerializationFunction(key, value, serializationObject) {
  const className = value?.getClassName?.() ?? "";
  if (IsVectorClassName(className) || IsMatrixClassName(className)) {
    serializationObject[key] = {
      value: value.asArray(),
      className
    };
  } else if (className === "FlowGraphInteger") {
    serializationObject[key] = {
      value: value.value,
      className
    };
  } else {
    if (className && (value.id || value.name)) {
      serializationObject[key] = {
        id: value.id,
        name: value.name,
        className,
        uniqueId: value.uniqueId
      };
    } else {
      if (typeof value !== "object" || value === null) {
        serializationObject[key] = value;
      } else {
        if (key === "pathConverter") {
          return;
        }
        const hasFunction = Object.values(value).some((v) => typeof v === "function");
        if (hasFunction) {
          return;
        }
        try {
          serializationObject[key] = JSON.parse(JSON.stringify(value));
        } catch {
          Logger.Warn(`FlowGraph serialization: value for key "${key}" is not JSON-serializable and was skipped.`);
        }
      }
    }
  }
}
function defaultValueParseFunction(key, serializationObject, assetsContainer, scene) {
  const intermediateValue = serializationObject[key];
  let finalValue;
  const className = intermediateValue?.type ?? intermediateValue?.className;
  const sceneNode = GetSceneNodeFromSerializedReference(intermediateValue, scene);
  if (sceneNode) {
    finalValue = sceneNode;
  } else if (IsVectorClassName(className)) {
    finalValue = ParseVector(className, intermediateValue.value);
  } else if (IsAnimationGroupClassName(className)) {
    const ags = scene.animationGroups.filter((ag) => ag.name === intermediateValue.name);
    finalValue = ags.length === 1 ? ags[0] : ags.find((ag) => ag.uniqueId === intermediateValue.uniqueId);
  } else if (className === "Matrix") {
    finalValue = Matrix.FromArray(intermediateValue.value);
  } else if (className === "Matrix2D") {
    finalValue = new FlowGraphMatrix2D(intermediateValue.value);
  } else if (className === "Matrix3D") {
    finalValue = new FlowGraphMatrix3D(intermediateValue.value);
  } else if (className === "FlowGraphInteger") {
    finalValue = FlowGraphInteger.FromValue(intermediateValue.value);
  } else if (className === "number" || className === "string" || className === "boolean") {
    finalValue = intermediateValue.value[0];
  } else if (key === "eventData" && intermediateValue !== null && typeof intermediateValue === "object") {
    _DefaultEventDataParseCounts.set(intermediateValue, _GetDefaultEventDataParseCount(intermediateValue) + 1);
    finalValue = intermediateValue;
  } else if (intermediateValue && intermediateValue.value !== void 0) {
    finalValue = intermediateValue.value;
  } else {
    if (Array.isArray(intermediateValue)) {
      finalValue = intermediateValue;
    } else {
      finalValue = intermediateValue;
    }
  }
  return finalValue;
}
function needsPathConverter(className) {
  return className === "FlowGraphJsonPointerParserBlock";
}
var FlowGraphAssetType;
(function(FlowGraphAssetType2) {
  FlowGraphAssetType2["Animation"] = "Animation";
  FlowGraphAssetType2["AnimationGroup"] = "AnimationGroup";
  FlowGraphAssetType2["Mesh"] = "Mesh";
  FlowGraphAssetType2["Material"] = "Material";
  FlowGraphAssetType2["Camera"] = "Camera";
  FlowGraphAssetType2["Light"] = "Light";
})(FlowGraphAssetType || (FlowGraphAssetType = {}));
function GetFlowGraphAssetWithType(assetsContext, type, index, useIndexAsUniqueId) {
  switch (type) {
    case "Animation":
      return useIndexAsUniqueId ? assetsContext.animations.find((a) => a.uniqueId === index) ?? null : assetsContext.animations[index] ?? null;
    case "AnimationGroup":
      return useIndexAsUniqueId ? assetsContext.animationGroups.find((a) => a.uniqueId === index) ?? null : assetsContext.animationGroups[index] ?? null;
    case "Mesh":
      return useIndexAsUniqueId ? assetsContext.meshes.find((a) => a.uniqueId === index) ?? null : assetsContext.meshes[index] ?? null;
    case "Material":
      return useIndexAsUniqueId ? assetsContext.materials.find((a) => a.uniqueId === index) ?? null : assetsContext.materials[index] ?? null;
    case "Camera":
      return useIndexAsUniqueId ? assetsContext.cameras.find((a) => a.uniqueId === index) ?? null : assetsContext.cameras[index] ?? null;
    case "Light":
      return useIndexAsUniqueId ? assetsContext.lights.find((a) => a.uniqueId === index) ?? null : assetsContext.lights[index] ?? null;
    default:
      return null;
  }
}
var FlowGraphAction;
(function(FlowGraphAction2) {
  FlowGraphAction2["ExecuteBlock"] = "ExecuteBlock";
  FlowGraphAction2["ExecuteEvent"] = "ExecuteEvent";
  FlowGraphAction2["TriggerConnection"] = "TriggerConnection";
  FlowGraphAction2["ContextVariableSet"] = "ContextVariableSet";
  FlowGraphAction2["GlobalVariableSet"] = "GlobalVariableSet";
  FlowGraphAction2["GlobalVariableDelete"] = "GlobalVariableDelete";
  FlowGraphAction2["GlobalVariableGet"] = "GlobalVariableGet";
  FlowGraphAction2["AddConnection"] = "AddConnection";
  FlowGraphAction2["GetConnectionValue"] = "GetConnectionValue";
  FlowGraphAction2["SetConnectionValue"] = "SetConnectionValue";
  FlowGraphAction2["ActivateSignal"] = "ActivateSignal";
  FlowGraphAction2["ContextVariableGet"] = "ContextVariableGet";
})(FlowGraphAction || (FlowGraphAction = {}));
class FlowGraphLogger {
  constructor() {
    this.logToConsole = false;
    this.log = [];
  }
  addLogItem(item) {
    if (!item.time) {
      item.time = Date.now();
    }
    this.log.push(item);
    if (this.logToConsole) {
      const value = item.payload?.value;
      if (typeof value === "object" && value.getClassName) {
        Logger.Log(`[FGLog] ${item.className}:${item.uniqueId.split("-")[0]} ${item.action} - ${JSON.stringify(value.getClassName())}: ${value.toString()}`);
      } else {
        Logger.Log(`[FGLog] ${item.className}:${item.uniqueId.split("-")[0]} ${item.action} - ${JSON.stringify(item.payload)}`);
      }
    }
  }
  getItemsOfType(action) {
    return this.log.filter((i) => i.action === action);
  }
}
let FlowGraphContext = (() => {
  var _a;
  let _uniqueId_decorators;
  let _uniqueId_initializers = [];
  let _uniqueId_extraInitializers = [];
  let _name_decorators;
  let _name_initializers = [];
  let _name_extraInitializers = [];
  return _a = class FlowGraphContext {
    /**
     * Enable logging on this context
     */
    get enableLogging() {
      return this._enableLogging;
    }
    set enableLogging(value) {
      if (this._enableLogging === value) {
        return;
      }
      this._enableLogging = value;
      if (this._enableLogging) {
        this.logger = new FlowGraphLogger();
        this.logger.logToConsole = true;
      } else {
        this.logger = null;
      }
    }
    constructor(params) {
      this.uniqueId = __runInitializers(this, _uniqueId_initializers, RandomGUID());
      this.name = (__runInitializers(this, _uniqueId_extraInitializers), __runInitializers(this, _name_initializers, ""));
      this._userVariables = (__runInitializers(this, _name_extraInitializers), {});
      this._variableTypes = {};
      this._executionVariables = {};
      this._globalContextVariables = {};
      this._connectionValues = {};
      this._pendingBlocks = [];
      this._executionId = 0;
      this.onNodeExecutedObservable = new Observable();
      this.onBreakpointHitObservable = new Observable();
      this.breakpointPredicate = null;
      this._pendingActivation = null;
      this._stepMode = false;
      this._skipBreakpointForBlockId = null;
      this.treatDataAsRightHanded = false;
      this._enableLogging = false;
      this._configuration = params;
      this.assetsContext = params.assetsContext ?? params.scene;
    }
    /**
     * Check if a user-defined variable is defined.
     * @param name the name of the variable
     * @returns true if the variable is defined
     */
    hasVariable(name) {
      return name in this._userVariables;
    }
    /**
     * Set a user-defined variable.
     * @param name the name of the variable
     * @param value the value of the variable
     */
    setVariable(name, value) {
      this._userVariables[name] = value;
      this.logger?.addLogItem({
        time: Date.now(),
        className: this.getClassName(),
        uniqueId: this.uniqueId,
        action: "ContextVariableSet",
        payload: {
          name,
          value
        }
      });
    }
    /**
     * Get an assets from the assets context based on its type and index in the array
     * @param type The type of the asset
     * @param index The index of the asset
     * @returns The asset or null if not found
     */
    getAsset(type, index) {
      return GetFlowGraphAssetWithType(this.assetsContext, type, index);
    }
    /**
     * Get a user-defined variable.
     * @param name the name of the variable
     * @returns the value of the variable
     */
    getVariable(name) {
      this.logger?.addLogItem({
        time: Date.now(),
        className: this.getClassName(),
        uniqueId: this.uniqueId,
        action: "ContextVariableGet",
        payload: {
          name,
          value: this._userVariables[name]
        }
      });
      return this._userVariables[name];
    }
    /**
     * Gets all user variables map
     */
    get userVariables() {
      return this._userVariables;
    }
    /**
     * Set the declared type annotation for a user variable.
     * @param name - the variable name
     * @param typeName - the type name string (e.g. "number", "Vector3", "Mesh")
     */
    setVariableType(name, typeName) {
      this._variableTypes[name] = typeName;
    }
    /**
     * Get the declared type annotation for a user variable.
     * @param name - the variable name
     * @returns the type name string, or undefined if no type was declared
     */
    getVariableType(name) {
      return this._variableTypes[name];
    }
    /**
     * Gets all variable type annotations.
     */
    get variableTypes() {
      return this._variableTypes;
    }
    /**
     * Get the scene that the context belongs to.
     * @returns the scene
     */
    getScene() {
      return this._configuration.scene;
    }
    /**
     * Encodes an event source key as the opaque reference exposed by event blocks on their `event`
     * output. Delegates to the {@link IFlowGraphHostResolver} configured on the coordinator, so the
     * reference format is owned by the environment hosting the graph.
     * @param key the event source key (e.g. `"sceneReady"`, `"sceneTick"`, or a custom event id)
     * @returns the event reference
     */
    getEventReference(key) {
      return this._configuration.coordinator._getEventReference(key);
    }
    /**
     * Decodes the array index denoted by a reference. Returns `undefined` when no host resolver is
     * configured or the host does not recognise the value as an indexed reference.
     * @param reference the reference to decode
     * @param collection optional host collection the reference must address
     * @returns the index the reference denotes, or `undefined` when it does not denote one
     */
    decodeIndexReference(reference, collection) {
      return this._configuration.coordinator.config.hostResolver?.decodeIndexReference?.(reference, collection);
    }
    /**
     * Maps a runtime object to the reference the host addresses it by. Returns `undefined` when no
     * host resolver is configured or the host cannot address the object.
     * @param object the runtime object to address
     * @param hint optional disambiguation hint telling the host which kind of reference is wanted
     * @returns the reference for the object, or `undefined` when it cannot be addressed
     */
    getObjectReference(object, hint) {
      return this._configuration.coordinator.config.hostResolver?.getObjectReference?.(object, hint);
    }
    _getUniqueIdPrefixedName(obj, name) {
      return `${obj.uniqueId}_${name}`;
    }
    /**
     * @internal
     * @param name name of the variable
     * @param defaultValue default value to return if the variable is not defined
     * @returns the variable value or the default value if the variable is not defined
     */
    _getGlobalContextVariable(name, defaultValue) {
      this.logger?.addLogItem({
        time: Date.now(),
        className: this.getClassName(),
        uniqueId: this.uniqueId,
        action: "GlobalVariableGet",
        payload: {
          name,
          defaultValue,
          possibleValue: this._globalContextVariables[name]
        }
      });
      if (this._hasGlobalContextVariable(name)) {
        return this._globalContextVariables[name];
      } else {
        return defaultValue;
      }
    }
    /**
     * Set a global context variable
     * @internal
     * @param name the name of the variable
     * @param value the value of the variable
     */
    _setGlobalContextVariable(name, value) {
      this.logger?.addLogItem({
        time: Date.now(),
        className: this.getClassName(),
        uniqueId: this.uniqueId,
        action: "GlobalVariableSet",
        payload: { name, value }
      });
      this._globalContextVariables[name] = value;
    }
    /**
     * Delete a global context variable
     * @internal
     * @param name the name of the variable
     */
    _deleteGlobalContextVariable(name) {
      this.logger?.addLogItem({
        time: Date.now(),
        className: this.getClassName(),
        uniqueId: this.uniqueId,
        action: "GlobalVariableDelete",
        payload: { name }
      });
      delete this._globalContextVariables[name];
    }
    /**
     * Check if a global context variable is defined
     * @internal
     * @param name the name of the variable
     * @returns true if the variable is defined
     */
    _hasGlobalContextVariable(name) {
      return name in this._globalContextVariables;
    }
    /**
     * Set an internal execution variable
     * @internal
     * @param name
     * @param value
     */
    _setExecutionVariable(block, name, value) {
      this._executionVariables[this._getUniqueIdPrefixedName(block, name)] = value;
    }
    /**
     * Get an internal execution variable
     * @internal
     * @param name
     * @returns
     */
    _getExecutionVariable(block, name, defaultValue) {
      if (this._hasExecutionVariable(block, name)) {
        return this._executionVariables[this._getUniqueIdPrefixedName(block, name)];
      } else {
        return defaultValue;
      }
    }
    /**
     * Delete an internal execution variable
     * @internal
     * @param block
     * @param name
     */
    _deleteExecutionVariable(block, name) {
      delete this._executionVariables[this._getUniqueIdPrefixedName(block, name)];
    }
    /**
     * Check if an internal execution variable is defined
     * @internal
     * @param block
     * @param name
     * @returns
     */
    _hasExecutionVariable(block, name) {
      return this._getUniqueIdPrefixedName(block, name) in this._executionVariables;
    }
    /**
     * Check if a connection value is defined
     * @internal
     * @param connectionPoint
     * @returns
     */
    _hasConnectionValue(connectionPoint) {
      return connectionPoint.uniqueId in this._connectionValues;
    }
    /**
     * Set a connection value
     * @internal
     * @param connectionPoint
     * @param value
     */
    _setConnectionValue(connectionPoint, value) {
      this._connectionValues[connectionPoint.uniqueId] = value;
      this.logger?.addLogItem({
        time: Date.now(),
        className: this.getClassName(),
        uniqueId: this.uniqueId,
        action: "SetConnectionValue",
        payload: {
          connectionPointId: connectionPoint.uniqueId,
          value
        }
      });
    }
    /**
     * Set a connection value by key
     * @internal
     * @param key the key of the connection value
     * @param value the value of the connection
     */
    _setConnectionValueByKey(key, value) {
      this._connectionValues[key] = value;
    }
    /**
     * Get a connection value
     * @internal
     * @param connectionPoint
     * @returns
     */
    _getConnectionValue(connectionPoint) {
      this.logger?.addLogItem({
        time: Date.now(),
        className: this.getClassName(),
        uniqueId: this.uniqueId,
        action: "GetConnectionValue",
        payload: {
          connectionPointId: connectionPoint.uniqueId,
          value: this._connectionValues[connectionPoint.uniqueId]
        }
      });
      return this._connectionValues[connectionPoint.uniqueId];
    }
    /**
     * Get the configuration
     * @internal
     * @param name
     * @param value
     */
    get configuration() {
      return this._configuration;
    }
    /**
     * Check if there are any pending blocks in this context
     * @returns true if there are pending blocks
     */
    get hasPendingBlocks() {
      return this._pendingBlocks.length > 0;
    }
    /**
     * Add a block to the list of blocks that have pending tasks.
     * @internal
     * @param block
     */
    _addPendingBlock(block) {
      if (this._pendingBlocks.includes(block)) {
        return;
      }
      this._pendingBlocks.push(block);
      this._pendingBlocks.sort((a, b) => a.priority - b.priority);
    }
    /**
     * Remove a block from the list of blocks that have pending tasks.
     * @internal
     * @param block
     */
    _removePendingBlock(block) {
      const index = this._pendingBlocks.indexOf(block);
      if (index !== -1) {
        this._pendingBlocks.splice(index, 1);
      }
    }
    /**
     * Clear all pending blocks.
     * @internal
     */
    _clearPendingBlocks() {
      for (const block of this._pendingBlocks.slice()) {
        block._cancelPendingTasks(this);
      }
      this._pendingBlocks.length = 0;
    }
    /**
     * @internal
     * Function that notifies the node executed observable
     * @param node
     */
    _notifyExecuteNode(node) {
      this.onNodeExecutedObservable.notifyObservers(node);
      this.logger?.addLogItem({
        time: Date.now(),
        className: node.getClassName(),
        uniqueId: node.uniqueId,
        action: "ExecuteBlock"
      });
    }
    _notifyOnTick(framePayload) {
      this._setGlobalContextVariable("firstTickPayload", this._getGlobalContextVariable("firstTickPayload", framePayload));
      this._setGlobalContextVariable("timeSinceStart", framePayload.timeSinceStart);
      this._setGlobalContextVariable("deltaTime", framePayload.deltaTime);
      for (const block of this._pendingBlocks) {
        block._executeOnTick?.(this);
      }
    }
    /**
     * @internal
     */
    _increaseExecutionId() {
      this._executionId++;
    }
    /**
     * A monotonically increasing ID for each execution.
     * Incremented for every block executed.
     */
    get executionId() {
      return this._executionId;
    }
    // ── Breakpoint API ─────────────────────────────────────────────────
    /**
     * Check whether the given block should break before executing.
     * Called by the signal connection infrastructure.
     * @internal
     * @param block the block about to execute
     * @param signal the signal that is triggering the execution
     * @returns true if execution should be paused (breakpoint hit)
     */
    _shouldBreak(block, signal) {
      if (this._skipBreakpointForBlockId === block.uniqueId) {
        this._skipBreakpointForBlockId = null;
        return false;
      }
      if (this._pendingActivation) {
        return true;
      }
      if (this._stepMode) {
        this._stepMode = false;
        this._pendingActivation = { block, context: this, signal };
        this.onBreakpointHitObservable.notifyObservers(this._pendingActivation);
        return true;
      }
      if (this.breakpointPredicate && this.breakpointPredicate(block)) {
        this._pendingActivation = { block, context: this, signal };
        this.onBreakpointHitObservable.notifyObservers(this._pendingActivation);
        return true;
      }
      return false;
    }
    /**
     * Returns the currently paused activation, or null if not paused.
     */
    get pendingActivation() {
      return this._pendingActivation;
    }
    /**
     * Resume execution from a breakpoint hit.
     * The paused block and all downstream blocks will execute normally until
     * the next breakpoint (if any) is hit.
     */
    continueExecution() {
      const pending = this._pendingActivation;
      if (!pending) {
        return;
      }
      this._pendingActivation = null;
      this._skipBreakpointForBlockId = pending.block.uniqueId;
      pending.signal._activateSignal(this);
      this._skipBreakpointForBlockId = null;
    }
    /**
     * Execute exactly the paused block and then pause again before the next
     * execution block fires. If no activation is pending, this is a no-op.
     */
    stepExecution() {
      const pending = this._pendingActivation;
      if (!pending) {
        return;
      }
      this._pendingActivation = null;
      this._stepMode = true;
      this._skipBreakpointForBlockId = pending.block.uniqueId;
      pending.signal._activateSignal(this);
      this._stepMode = false;
      this._skipBreakpointForBlockId = null;
    }
    /**
     * Discard any pending breakpoint activation without resuming.
     * Used when stopping or resetting the graph.
     * @internal
     */
    _clearPendingActivation() {
      this._pendingActivation = null;
      this._stepMode = false;
      this._skipBreakpointForBlockId = null;
    }
    /**
     * Serializes a context
     * @param serializationObject the object to write the values in
     * @param valueSerializationFunction a function to serialize complex values
     */
    serialize(serializationObject = {}, valueSerializationFunction = defaultValueSerializationFunction) {
      serializationObject.uniqueId = this.uniqueId;
      serializationObject.name = this.name;
      serializationObject._userVariables = {};
      for (const key in this._userVariables) {
        valueSerializationFunction(key, this._userVariables[key], serializationObject._userVariables);
      }
      if (Object.keys(this._variableTypes).length > 0) {
        serializationObject._variableTypes = { ...this._variableTypes };
      }
      serializationObject._connectionValues = {};
      for (const key in this._connectionValues) {
        valueSerializationFunction(key, this._connectionValues[key], serializationObject._connectionValues);
      }
      if (this.assetsContext !== this.getScene()) {
        serializationObject._assetsContext = {
          meshes: this.assetsContext.meshes.map((m) => m.id),
          materials: this.assetsContext.materials.map((m) => m.id),
          textures: this.assetsContext.textures.map((m) => m.name),
          animations: this.assetsContext.animations.map((m) => m.name),
          lights: this.assetsContext.lights.map((m) => m.id),
          cameras: this.assetsContext.cameras.map((m) => m.id),
          sounds: this.assetsContext.sounds?.map((m) => m.name),
          skeletons: this.assetsContext.skeletons.map((m) => m.id),
          particleSystems: this.assetsContext.particleSystems.map((m) => m.name),
          geometries: this.assetsContext.geometries.map((m) => m.id),
          multiMaterials: this.assetsContext.multiMaterials.map((m) => m.id),
          transformNodes: this.assetsContext.transformNodes.map((m) => m.id)
        };
      }
    }
    /**
     * @returns the class name of the object.
     */
    getClassName() {
      return "FlowGraphContext";
    }
  }, (() => {
    const _metadata = typeof Symbol === "function" && Symbol.metadata ? /* @__PURE__ */ Object.create(null) : void 0;
    _uniqueId_decorators = [serialize()];
    _name_decorators = [serialize()];
    __esDecorate(null, null, _uniqueId_decorators, { kind: "field", name: "uniqueId", static: false, private: false, access: { has: (obj) => "uniqueId" in obj, get: (obj) => obj.uniqueId, set: (obj, value) => {
      obj.uniqueId = value;
    } }, metadata: _metadata }, _uniqueId_initializers, _uniqueId_extraInitializers);
    __esDecorate(null, null, _name_decorators, { kind: "field", name: "name", static: false, private: false, access: { has: (obj) => "name" in obj, get: (obj) => obj.name, set: (obj, value) => {
      obj.name = value;
    } }, metadata: _metadata }, _name_initializers, _name_extraInitializers);
    if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
  })(), _a;
})();
var FlowGraphConnectionType;
(function(FlowGraphConnectionType2) {
  FlowGraphConnectionType2[FlowGraphConnectionType2["Input"] = 0] = "Input";
  FlowGraphConnectionType2[FlowGraphConnectionType2["Output"] = 1] = "Output";
})(FlowGraphConnectionType || (FlowGraphConnectionType = {}));
class FlowGraphConnection {
  constructor(name, _connectionType, _ownerBlock) {
    this._ownerBlock = _ownerBlock;
    this._connectedPoint = [];
    this.uniqueId = RandomGUID();
    this.connectedPointIds = [];
    this.name = name;
    this._connectionType = _connectionType;
  }
  /**
   * The type of the connection
   */
  get connectionType() {
    return this._connectionType;
  }
  /**
   * @internal
   * Override this to indicate if a point can connect to more than one point.
   */
  _isSingularConnection() {
    return true;
  }
  /**
   * Returns if a point is connected to any other point.
   * @returns boolean indicating if the point is connected.
   */
  isConnected() {
    return this._connectedPoint.length > 0;
  }
  /**
   * Connects two connections together.
   * @param point the connection to connect to.
   */
  connectTo(point) {
    if (this._connectionType === point._connectionType) {
      throw new Error(`Cannot connect two points of type ${this.connectionType}`);
    }
    if (this._isSingularConnection() && this._connectedPoint.length > 0 || point._isSingularConnection() && point._connectedPoint.length > 0) {
      throw new Error("Max number of connections for point reached");
    }
    this._connectedPoint.push(point);
    point._connectedPoint.push(this);
  }
  /**
   * Disconnects two connections.
   * @param point the connection to disconnect from.
   * @param removeFromLocal if true, the connection will be removed from the local connection list.
   */
  disconnectFrom(point, removeFromLocal = true) {
    const indexLocal = this._connectedPoint.indexOf(point);
    const indexConnected = point._connectedPoint.indexOf(this);
    if (indexLocal === -1 || indexConnected === -1) {
      return;
    }
    if (removeFromLocal) {
      this._connectedPoint.splice(indexLocal, 1);
    }
    point._connectedPoint.splice(indexConnected, 1);
  }
  /**
   * Disconnects all connected points.
   */
  disconnectFromAll() {
    for (const point of this._connectedPoint) {
      this.disconnectFrom(point, false);
    }
    this._connectedPoint.length = 0;
  }
  /**
   * Disconnects this point from every connected point.
   */
  dispose() {
    for (const point of this._connectedPoint) {
      this.disconnectFrom(point);
    }
  }
  /**
   * Saves the connection to a JSON object.
   * @param serializationObject the object to serialize to.
   */
  serialize(serializationObject = {}) {
    serializationObject.uniqueId = this.uniqueId;
    serializationObject.name = this.name;
    serializationObject._connectionType = this._connectionType;
    serializationObject.connectedPointIds = [];
    serializationObject.className = this.getClassName();
    if (this.metadata !== void 0) {
      serializationObject.metadata = this.metadata;
    }
    for (const point of this._connectedPoint) {
      serializationObject.connectedPointIds.push(point.uniqueId);
    }
  }
  /**
   * @returns class name of the connection.
   */
  getClassName() {
    return "FGConnection";
  }
  /**
   * Deserialize from a object into this
   * @param serializationObject the object to deserialize from.
   */
  deserialize(serializationObject) {
    this.uniqueId = serializationObject.uniqueId;
    this.name = serializationObject.name;
    this._connectionType = serializationObject._connectionType;
    this.connectedPointIds = serializationObject.connectedPointIds;
    this.metadata = serializationObject.metadata;
  }
}
class FlowGraphDataConnection extends FlowGraphConnection {
  /**
   * Create a new data connection point.
   * @param name the name of the connection
   * @param connectionType the type of the connection
   * @param ownerBlock the block that owns this connection
   * @param richType the type of the data in this block
   * @param _defaultValue the default value of the connection
   * @param _optional if the connection is optional
   */
  constructor(name, connectionType, ownerBlock, richType, _defaultValue = richType.defaultValue, _optional = false) {
    super(name, connectionType, ownerBlock);
    this.richType = richType;
    this._defaultValue = _defaultValue;
    this._optional = _optional;
    this._isDisabled = false;
    this._lastValue = null;
    this.dataTransformer = null;
    this.onValueChangedObservable = new Observable();
  }
  /**
   * Whether or not the connection is optional.
   * Currently only used for UI control.
   */
  get optional() {
    return this._optional;
  }
  /**
   * is this connection disabled
   * If the connection is disabled you will not be able to connect anything to it.
   */
  get isDisabled() {
    return this._isDisabled;
  }
  set isDisabled(value) {
    if (this._isDisabled === value) {
      return;
    }
    this._isDisabled = value;
    if (this._isDisabled) {
      this.disconnectFromAll();
    }
  }
  /**
   * An output data block can connect to multiple input data blocks,
   * but an input data block can only connect to one output data block.
   * @returns true if the connection is singular
   */
  _isSingularConnection() {
    return this.connectionType === 0;
  }
  /**
   * Set the value of the connection in a specific context.
   * @param value the value to set
   * @param context the context to which the value is set
   */
  setValue(value, context) {
    if (context._getConnectionValue(this) === value) {
      return;
    }
    context._setConnectionValue(this, value);
    this.onValueChangedObservable.notifyObservers(value);
  }
  /**
   * Reset the value of the connection to the default value.
   * @param context the context in which the value is reset
   */
  resetToDefaultValue(context) {
    context._setConnectionValue(this, this._defaultValue);
  }
  /**
   * Re-resolves this input's default value against a (new) scene when the value is a node reference.
   * This handles two cases that occur when a graph is moved to a different scene (see
   * {@link FlowGraph.setScene}):
   * - the value is still an unresolved serialized reference (`{ id, name, className, uniqueId }`)
   *   because the node did not yet exist in the scene at parse time, or
   * - the value is a node that belongs to a different (e.g. disposed) scene.
   * Values that are not node references (numbers, vectors, matrices, etc.) are left untouched, and
   * the default value is only replaced when a matching node is found in the new scene.
   * @param scene the scene to resolve the reference against
   * @internal
   */
  _reresolveDefaultValueForScene(scene) {
    const value = this._defaultValue;
    if (!value || typeof value !== "object") {
      return;
    }
    let reference;
    if (typeof value.getClassName === "function" && typeof value.getScene === "function") {
      if (value.getScene() === scene) {
        return;
      }
      reference = { id: value.id, name: value.name, className: value.getClassName(), uniqueId: value.uniqueId };
    } else if (typeof value.className === "string" && (value.id || value.name) && value.value === void 0) {
      reference = value;
    } else {
      return;
    }
    const node = GetSceneNodeFromSerializedReference(reference, scene);
    if (node) {
      this._defaultValue = node;
    }
  }
  /**
   * Connect this point to another point.
   * @param point the point to connect to.
   */
  connectTo(point) {
    if (this._isDisabled) {
      return;
    }
    super.connectTo(point);
  }
  _getValueOrDefault(context) {
    const val = context._getConnectionValue(this) ?? this._defaultValue;
    return this.dataTransformer ? this.dataTransformer(val) : val;
  }
  /**
   * Gets the value of the connection in a specific context.
   * @param context the context from which the value is retrieved
   * @returns the value of the connection
   */
  getValue(context) {
    if (this.connectionType === 1) {
      context._notifyExecuteNode(this._ownerBlock);
      this._ownerBlock._updateOutputs(context);
      const value2 = this._getValueOrDefault(context);
      this._lastValue = value2;
      return this.richType.typeTransformer ? this.richType.typeTransformer(value2) : value2;
    }
    const value = !this.isConnected() ? this._getValueOrDefault(context) : this._connectedPoint[0].getValue(context);
    this._lastValue = value;
    return this.richType.typeTransformer ? this.richType.typeTransformer(value) : value;
  }
  /**
   * @internal
   */
  _getLastValue() {
    return this._lastValue;
  }
  /**
   * @returns class name of the object.
   */
  getClassName() {
    return "FlowGraphDataConnection";
  }
  /**
   * Serializes this object.
   * @param serializationObject the object to serialize to
   */
  serialize(serializationObject = {}) {
    super.serialize(serializationObject);
    serializationObject.richType = {};
    this.richType.serialize(serializationObject.richType);
    serializationObject.optional = this._optional;
    defaultValueSerializationFunction("defaultValue", this._defaultValue, serializationObject);
  }
}
let _Registered$1 = false;
function RegisterFlowGraphDataConnection() {
  if (_Registered$1) {
    return;
  }
  _Registered$1 = true;
  RegisterClass("FlowGraphDataConnection", FlowGraphDataConnection);
}
class FlowGraphBlock {
  /** Constructor is protected so only subclasses can be instantiated
   * @param config optional configuration for this block
   * @internal - do not use directly. Extend this class instead.
   */
  constructor(config) {
    this.config = config;
    this.uniqueId = RandomGUID();
    this.name = this.config?.name ?? this.getClassName();
    this.dataInputs = [];
    this.dataOutputs = [];
  }
  /**
   * @internal
   * This function is called when the block needs to update its output flows.
   * @param _context the context in which it is running
   */
  _updateOutputs(_context) {
  }
  /**
   * Registers a data input on the block.
   * @param name the name of the input
   * @param richType the type of the input
   * @param defaultValue optional default value of the input. If not set, the rich type's default value will be used.
   * @returns the created connection
   */
  registerDataInput(name, richType, defaultValue) {
    const input = new FlowGraphDataConnection(name, 0, this, richType, defaultValue);
    this.dataInputs.push(input);
    return input;
  }
  /**
   * Registers a data output on the block.
   * @param name the name of the input
   * @param richType the type of the input
   * @param defaultValue optional default value of the input. If not set, the rich type's default value will be used.
   * @returns the created connection
   */
  registerDataOutput(name, richType, defaultValue) {
    const output = new FlowGraphDataConnection(name, 1, this, richType, defaultValue);
    this.dataOutputs.push(output);
    return output;
  }
  /**
   * Given the name of a data input, returns the connection if it exists
   * @param name the name of the input
   * @returns the connection if it exists, undefined otherwise
   */
  getDataInput(name) {
    return this.dataInputs.find((i) => i.name === name);
  }
  /**
   * Given the name of a data output, returns the connection if it exists
   * @param name the name of the output
   * @returns the connection if it exists, undefined otherwise
   */
  getDataOutput(name) {
    return this.dataOutputs.find((i) => i.name === name);
  }
  /**
   * Serializes this block
   * @param serializationObject the object to serialize to
   * @param _valueSerializeFunction a function that serializes a specific value
   */
  serialize(serializationObject = {}, _valueSerializeFunction = defaultValueSerializationFunction) {
    serializationObject.uniqueId = this.uniqueId;
    if (this.metadata !== void 0) {
      serializationObject.metadata = this.metadata;
    }
    serializationObject.config = {};
    if (this.config) {
      const config = this.config;
      const keys = Object.keys(config);
      for (const key of keys) {
        _valueSerializeFunction(key, config[key], serializationObject.config);
      }
    }
    serializationObject.dataInputs = [];
    serializationObject.dataOutputs = [];
    serializationObject.className = this.getClassName();
    for (const input of this.dataInputs) {
      const serializedInput = {};
      input.serialize(serializedInput);
      serializationObject.dataInputs.push(serializedInput);
    }
    for (const output of this.dataOutputs) {
      const serializedOutput = {};
      output.serialize(serializedOutput);
      serializationObject.dataOutputs.push(serializedOutput);
    }
  }
  /**
   * Deserializes this block
   * @param _serializationObject the object to deserialize from
   */
  deserialize(_serializationObject) {
  }
  _log(context, action, payload) {
    context.logger?.addLogItem({
      action,
      payload,
      className: this.getClassName(),
      uniqueId: this.uniqueId
    });
  }
  /**
   * Gets the class name of this block
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphBlock";
  }
}
class FlowGraphSignalConnection extends FlowGraphConnection {
  constructor() {
    super(...arguments);
    this.priority = 0;
    this._lastActivationTime = -1;
  }
  _isSingularConnection() {
    return false;
  }
  connectTo(point) {
    super.connectTo(point);
    this._connectedPoint.sort((a, b) => b.priority - a.priority);
  }
  /**
   * @internal
   */
  _activateSignal(context) {
    this._lastActivationTime = performance.now();
    context.logger?.addLogItem({
      action: "ActivateSignal",
      className: this._ownerBlock.getClassName(),
      uniqueId: this._ownerBlock.uniqueId,
      payload: {
        connectionType: this.connectionType,
        name: this.name
      }
    });
    if (this.connectionType === 0) {
      if (context._shouldBreak(this._ownerBlock, this)) {
        return;
      }
      context._increaseExecutionId();
      context._notifyExecuteNode(this._ownerBlock);
      const startTime = performance.now();
      this._ownerBlock._execute(context, this);
      this._ownerBlock._lastExecutionTime = performance.now() - startTime;
    } else {
      for (const connectedPoint of this._connectedPoint) {
        connectedPoint._activateSignal(context);
      }
    }
  }
}
let _Registered = false;
function RegisterFlowGraphSignalConnection() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphSignalConnection", FlowGraphSignalConnection);
}
class FlowGraphExecutionBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.priority = 0;
    this._lastExecutionTime = -1;
    this.signalInputs = [];
    this.signalOutputs = [];
    this.in = this._registerSignalInput("in");
    this.error = this._registerSignalOutput("error");
  }
  _registerSignalInput(name) {
    const input = new FlowGraphSignalConnection(name, 0, this);
    this.signalInputs.push(input);
    return input;
  }
  _registerSignalOutput(name) {
    const output = new FlowGraphSignalConnection(name, 1, this);
    this.signalOutputs.push(output);
    return output;
  }
  _unregisterSignalInput(name) {
    const index = this.signalInputs.findIndex((input) => input.name === name);
    if (index !== -1) {
      this.signalInputs[index].dispose();
      this.signalInputs.splice(index, 1);
    }
  }
  _unregisterSignalOutput(name) {
    const index = this.signalOutputs.findIndex((output) => output.name === name);
    if (index !== -1) {
      this.signalOutputs[index].dispose();
      this.signalOutputs.splice(index, 1);
    }
  }
  _reportError(context, error) {
    this.error.payload = typeof error === "string" ? new Error(error) : error;
    this.error._activateSignal(context);
  }
  /**
   * Given a name of a signal input, return that input if it exists
   * @param name the name of the input
   * @returns if the input exists, the input. Otherwise, undefined.
   */
  getSignalInput(name) {
    return this.signalInputs.find((input) => input.name === name);
  }
  /**
   * Given a name of a signal output, return that input if it exists
   * @param name the name of the input
   * @returns if the input exists, the input. Otherwise, undefined.
   */
  getSignalOutput(name) {
    return this.signalOutputs.find((output) => output.name === name);
  }
  /**
   * Serializes this block
   * @param serializationObject the object to serialize in
   */
  serialize(serializationObject = {}) {
    super.serialize(serializationObject);
    serializationObject.signalInputs = [];
    serializationObject.signalOutputs = [];
    for (const input of this.signalInputs) {
      const serializedInput = {};
      input.serialize(serializedInput);
      serializationObject.signalInputs.push(serializedInput);
    }
    for (const output of this.signalOutputs) {
      const serializedOutput = {};
      output.serialize(serializedOutput);
      serializationObject.signalOutputs.push(serializedOutput);
    }
  }
  /**
   * Deserializes from an object
   * @param serializationObject the object to deserialize from
   */
  deserialize(serializationObject) {
    for (let i = 0; i < serializationObject.signalInputs.length; i++) {
      const signalInput = this.getSignalInput(serializationObject.signalInputs[i].name);
      if (signalInput) {
        signalInput.deserialize(serializationObject.signalInputs[i]);
      } else {
        throw new Error("Could not find signal input with name " + serializationObject.signalInputs[i].name + " in block " + serializationObject.className);
      }
    }
    for (let i = 0; i < serializationObject.signalOutputs.length; i++) {
      const signalOutput = this.getSignalOutput(serializationObject.signalOutputs[i].name);
      if (signalOutput) {
        signalOutput.deserialize(serializationObject.signalOutputs[i]);
      } else {
        throw new Error("Could not find signal output with name " + serializationObject.signalOutputs[i].name + " in block " + serializationObject.className);
      }
    }
  }
  /**
   * @returns the class name
   */
  getClassName() {
    return "FlowGraphExecutionBlock";
  }
}
class FlowGraphExecutionBlockWithOutSignal extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.out = this._registerSignalOutput("out");
  }
}
class FlowGraphAsyncExecutionBlock extends FlowGraphExecutionBlockWithOutSignal {
  constructor(config, events) {
    super(config);
    this._eventsSignalOutputs = {};
    this.done = this._registerSignalOutput("done");
    if (events) {
      for (const eventName of events) {
        this._eventsSignalOutputs[eventName] = this._registerSignalOutput(eventName + "Event");
      }
    }
  }
  /**
   * @internal
   * This function can be overridden to execute any
   * logic that should be executed on every frame
   * while the async task is pending.
   * @param context the context in which it is running
   */
  _executeOnTick(_context) {
  }
  /**
   * @internal
   * @param context
   */
  _startPendingTasks(context) {
    if (context._getExecutionVariable(this, "_initialized", false)) {
      this._cancelPendingTasks(context);
      this._resetAfterCanceled(context);
    }
    this._preparePendingTasks(context);
    context._addPendingBlock(this);
    this.out._activateSignal(context);
    context._setExecutionVariable(this, "_initialized", true);
  }
  _resetAfterCanceled(context) {
    context._deleteExecutionVariable(this, "_initialized");
    context._removePendingBlock(this);
  }
}
const _IsMacPlatform = IsNavigatorAvailable() && /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
function _IsDescendantOf(mesh1, mesh2) {
  return !!(mesh1.parent && (mesh1.parent === mesh2 || _IsDescendantOf(mesh1.parent, mesh2)));
}
function _GetClassNameOf(v) {
  if (v.getClassName) {
    return v.getClassName();
  }
  return;
}
function _AreSameVectorOrQuaternionClass(className, className2) {
  return className === className2 && (className === "Vector2" || className === "Vector3" || className === "Vector4" || className === "Quaternion");
}
function _AreSameMatrixClass(className, className2) {
  return className === className2 && (className === "Matrix" || className === "Matrix2D" || className === "Matrix3D");
}
function _AreSameIntegerClass(className, className2) {
  return className === "FlowGraphInteger" && className2 === "FlowGraphInteger";
}
function isNumeric(a, validIfNaN) {
  const isNumeric2 = typeof a === "number" || typeof a?.value === "number";
  if (isNumeric2 && !validIfNaN) {
    return !isNaN(getNumericValue(a));
  }
  return isNumeric2;
}
function getNumericValue(a) {
  return typeof a === "number" ? a : a.value;
}
class FlowGraphSceneEventCoordinator {
  constructor(scene) {
    this.onEventTriggeredObservable = new Observable();
    this.sceneReadyTriggered = false;
    this._pointerUnderMeshState = {};
    this._onBlurHandler = null;
    this.pressedKeys = /* @__PURE__ */ new Set();
    this._startingTime = 0;
    this._scene = scene;
    this._initialize();
  }
  _initialize() {
    this._sceneReadyObserver = this._scene.onReadyObservable.addOnce(() => {
      if (!this.sceneReadyTriggered) {
        this.onEventTriggeredObservable.notifyObservers({
          type: "SceneReady"
          /* FlowGraphEventType.SceneReady */
        });
        this.sceneReadyTriggered = true;
      }
    });
    this._sceneDisposeObserver = this._scene.onDisposeObservable.add(() => {
      this.onEventTriggeredObservable.notifyObservers({
        type: "SceneDispose"
        /* FlowGraphEventType.SceneDispose */
      });
    });
    this._sceneOnBeforeRenderObserver = this._scene.onBeforeRenderObservable.add(() => {
      const deltaTime = this._scene.getEngine().getDeltaTime() / 1e3;
      this.onEventTriggeredObservable.notifyObservers({
        type: "SceneBeforeRender",
        payload: {
          timeSinceStart: this._startingTime,
          deltaTime
        }
      });
      this._startingTime += deltaTime;
    });
    this._meshPickedObserver = this._scene.onPointerObservable.add((pointerInfo) => {
      this.onEventTriggeredObservable.notifyObservers({ type: "MeshPick", payload: pointerInfo });
    }, PointerEventTypes.POINTERPICK);
    this._pointerDownObserver = this._scene.onPointerObservable.add((pointerInfo) => {
      this.onEventTriggeredObservable.notifyObservers({ type: "PointerDown", payload: pointerInfo });
    }, PointerEventTypes.POINTERDOWN);
    this._pointerUpObserver = this._scene.onPointerObservable.add((pointerInfo) => {
      this.onEventTriggeredObservable.notifyObservers({ type: "PointerUp", payload: pointerInfo });
    }, PointerEventTypes.POINTERUP);
    this._pointerMoveObserver = this._scene.onPointerObservable.add((pointerInfo) => {
      this.onEventTriggeredObservable.notifyObservers({ type: "PointerMove", payload: pointerInfo });
    }, PointerEventTypes.POINTERMOVE);
    this._meshUnderPointerObserver = this._scene.onMeshUnderPointerUpdatedObservable.add((data) => {
      const pointerId = data.pointerId;
      const mesh = data.mesh;
      const previousState = this._pointerUnderMeshState[pointerId];
      if (!previousState && mesh) {
        this.onEventTriggeredObservable.notifyObservers({ type: "PointerOver", payload: { pointerId, mesh } });
      } else if (previousState && !mesh) {
        this.onEventTriggeredObservable.notifyObservers({ type: "PointerOut", payload: { pointerId, mesh: previousState } });
      } else if (previousState && mesh && previousState !== mesh) {
        this.onEventTriggeredObservable.notifyObservers({ type: "PointerOut", payload: { pointerId, mesh: previousState, over: mesh } });
        this.onEventTriggeredObservable.notifyObservers({ type: "PointerOver", payload: { pointerId, mesh, out: previousState } });
      }
      this._pointerUnderMeshState[pointerId] = mesh;
    }, PointerEventTypes.POINTERMOVE);
    this._keyDownObserver = this._scene.onKeyboardObservable.add((keyboardInfo) => {
      const code = keyboardInfo.event.code;
      this.pressedKeys.add(code);
      if (FlowGraphSceneEventCoordinator._COMMAND_OR_CTRL_CODES.has(code)) {
        this.pressedKeys.add("CommandOrControl");
      }
      this.onEventTriggeredObservable.notifyObservers({ type: "KeyDown", payload: keyboardInfo });
    }, KeyboardEventTypes.KEYDOWN);
    this._keyUpObserver = this._scene.onKeyboardObservable.add((keyboardInfo) => {
      const code = keyboardInfo.event.code;
      this.pressedKeys.delete(code);
      if (FlowGraphSceneEventCoordinator._COMMAND_OR_CTRL_CODES.has(code)) {
        let stillHeld = false;
        for (const c of Array.from(FlowGraphSceneEventCoordinator._COMMAND_OR_CTRL_CODES)) {
          if (c !== code && this.pressedKeys.has(c)) {
            stillHeld = true;
            break;
          }
        }
        if (!stillHeld) {
          this.pressedKeys.delete("CommandOrControl");
        }
      }
      this.onEventTriggeredObservable.notifyObservers({ type: "KeyUp", payload: keyboardInfo });
    }, KeyboardEventTypes.KEYUP);
    const canvas = this._scene.getEngine().getRenderingCanvas();
    if (canvas) {
      this._onBlurHandler = () => this.pressedKeys.clear();
      canvas.addEventListener("blur", this._onBlurHandler);
    }
  }
  dispose() {
    this._sceneDisposeObserver?.remove();
    this._sceneReadyObserver?.remove();
    this._sceneOnBeforeRenderObserver?.remove();
    this._meshPickedObserver?.remove();
    this._meshUnderPointerObserver?.remove();
    this._pointerDownObserver?.remove();
    this._pointerUpObserver?.remove();
    this._pointerMoveObserver?.remove();
    this._keyDownObserver?.remove();
    this._keyUpObserver?.remove();
    if (this._onBlurHandler) {
      const canvas = this._scene.getEngine().getRenderingCanvas();
      canvas?.removeEventListener("blur", this._onBlurHandler);
      this._onBlurHandler = null;
    }
    this.pressedKeys.clear();
    this.onEventTriggeredObservable.clear();
  }
}
FlowGraphSceneEventCoordinator._COMMAND_OR_CTRL_CODES = _IsMacPlatform ? /* @__PURE__ */ new Set(["MetaLeft", "MetaRight"]) : /* @__PURE__ */ new Set(["ControlLeft", "ControlRight"]);
class FlowGraphEventBlock extends FlowGraphAsyncExecutionBlock {
  /**
   * Creates a new event block.
   * @param config optional configuration
   */
  constructor(config) {
    super(config);
    this.initPriority = 0;
    this.type = "NoTrigger";
    this._unregisterSignalInput("in");
  }
  /**
   * Deserializes from an object.
   * Filters out the legacy "in" signal input that existed before event blocks
   * stopped exposing it, so old serialized graphs load without error.
   * @param serializationObject the object to deserialize from
   */
  deserialize(serializationObject) {
    const filtered = { ...serializationObject };
    filtered.signalInputs = (serializationObject.signalInputs ?? []).filter((s) => s.name !== "in");
    super.deserialize(filtered);
  }
  /**
   * Stable key used to represent this event during propagation.
   * Event blocks with equivalent event sources should return the same key.
   */
  get eventKey() {
    return this.config?.eventKey ?? this.type;
  }
  /**
   * @internal
   */
  _execute(context) {
    context._notifyExecuteNode(this);
    this.done._activateSignal(context);
    this.out._activateSignal(context);
  }
  /**
   * @internal
   * Override _startPendingTasks so that event blocks do NOT fire the
   * `out` signal at graph-start time.  The base FlowGraphAsyncExecutionBlock
   * fires `out` immediately in _startPendingTasks (useful for async blocks
   * like PlayAnimation that start a task and let sync flow continue).
   * Event blocks should only fire their output signals when the actual
   * event occurs, which is handled by _execute.
   */
  _startPendingTasks(context) {
    if (context._getExecutionVariable(this, "_initialized", false)) {
      this._cancelPendingTasks(context);
      this._resetAfterCanceled(context);
    }
    this._preparePendingTasks(context);
    context._addPendingBlock(this);
    context._setExecutionVariable(this, "_initialized", true);
  }
}
var FlowGraphValidationSeverity;
(function(FlowGraphValidationSeverity2) {
  FlowGraphValidationSeverity2[FlowGraphValidationSeverity2["Error"] = 0] = "Error";
  FlowGraphValidationSeverity2[FlowGraphValidationSeverity2["Warning"] = 1] = "Warning";
})(FlowGraphValidationSeverity || (FlowGraphValidationSeverity = {}));
const NumericLikeTypes = /* @__PURE__ */ new Set([
  "number",
  "FlowGraphInteger",
  "boolean"
  /* FlowGraphTypes.Boolean */
]);
const VectorLikeTypes = /* @__PURE__ */ new Set([
  "Vector4",
  "Quaternion"
  /* FlowGraphTypes.Quaternion */
]);
const ColorLikeTypes = /* @__PURE__ */ new Set([
  "Color3",
  "Color4"
  /* FlowGraphTypes.Color4 */
]);
function _AreTypesCompatible(sourceType, targetType) {
  if (sourceType === targetType) {
    return true;
  }
  if (sourceType === "any" || targetType === "any") {
    return true;
  }
  if (NumericLikeTypes.has(sourceType) && NumericLikeTypes.has(targetType)) {
    return true;
  }
  if (VectorLikeTypes.has(sourceType) && VectorLikeTypes.has(targetType)) {
    return true;
  }
  if (ColorLikeTypes.has(sourceType) && ColorLikeTypes.has(targetType)) {
    return true;
  }
  return false;
}
function ValidateFlowGraph(flowGraph) {
  const issues = [];
  const issuesByBlock = /* @__PURE__ */ new Map();
  const addIssue = (issue) => {
    issues.push(issue);
    if (issue.block) {
      let arr = issuesByBlock.get(issue.block.uniqueId);
      if (!arr) {
        arr = [];
        issuesByBlock.set(issue.block.uniqueId, arr);
      }
      arr.push(issue);
    }
  };
  const allBlocks = [];
  flowGraph.visitAllBlocks((block) => {
    allBlocks.push(block);
  });
  const eventBlocks = _GetEventBlocks(flowGraph);
  if (eventBlocks.length === 0) {
    addIssue({
      severity: 0,
      message: "Graph has no event blocks — nothing will trigger execution."
    });
  }
  for (const block of allBlocks) {
    for (const input of block.dataInputs) {
      if (!input.optional && !input.isDisabled && !input.isConnected()) {
        addIssue({
          severity: 1,
          message: `"${input.name}" is not connected and will use its default value.`,
          block,
          connectionName: input.name
        });
      }
    }
  }
  for (const block of allBlocks) {
    if (block instanceof FlowGraphExecutionBlock) {
      if (_IsEventBlock(block)) {
        continue;
      }
      const inSignal = block.signalInputs.find((s) => s.name === "in");
      if (inSignal && !inSignal.isConnected()) {
        addIssue({
          severity: 0,
          message: `Execution block has no incoming signal — it will never execute.`,
          block,
          connectionName: "in"
        });
      }
    }
  }
  for (const block of allBlocks) {
    for (const input of block.dataInputs) {
      if (!input.isConnected()) {
        continue;
      }
      const source = input._connectedPoint[0];
      const srcType = source.richType?.typeName;
      const tgtType = input.richType?.typeName;
      if (srcType && tgtType && !_AreTypesCompatible(srcType, tgtType)) {
        if (source.richType.typeTransformer !== void 0 || input.richType.typeTransformer !== void 0) {
          continue;
        }
        addIssue({
          severity: 1,
          message: `Type mismatch: "${source._ownerBlock.name}.${source.name}" (${srcType}) → "${block.name}.${input.name}" (${tgtType}).`,
          block,
          connectionName: input.name
        });
      }
    }
  }
  const reachableIds = /* @__PURE__ */ new Set();
  flowGraph.visitAllBlocks((block) => {
    reachableIds.add(block.uniqueId);
  });
  _DetectDataCycles(allBlocks, addIssue);
  issues.sort((a, b) => a.severity - b.severity);
  return {
    isValid: issues.every(
      (i) => i.severity !== 0
      /* FlowGraphValidationSeverity.Error */
    ),
    issues,
    errorCount: issues.filter(
      (i) => i.severity === 0
      /* FlowGraphValidationSeverity.Error */
    ).length,
    warningCount: issues.filter(
      (i) => i.severity === 1
      /* FlowGraphValidationSeverity.Warning */
    ).length,
    issuesByBlock
  };
}
function ValidateFlowGraphWithBlockList(flowGraph, allKnownBlocks) {
  const result = ValidateFlowGraph(flowGraph);
  const reachableIds = /* @__PURE__ */ new Set();
  flowGraph.visitAllBlocks((block) => {
    reachableIds.add(block.uniqueId);
  });
  for (const block of allKnownBlocks) {
    if (!reachableIds.has(block.uniqueId)) {
      const issue = {
        severity: 1,
        message: `Block is unreachable from any event block.`,
        block
      };
      result.issues.push(issue);
      result.warningCount++;
      let arr = result.issuesByBlock.get(block.uniqueId);
      if (!arr) {
        arr = [];
        result.issuesByBlock.set(block.uniqueId, arr);
      }
      arr.push(issue);
      for (const input of block.dataInputs) {
        if (!input.optional && !input.isDisabled && !input.isConnected()) {
          const dataIssue = {
            severity: 1,
            message: `"${input.name}" is not connected and will use its default value.`,
            block,
            connectionName: input.name
          };
          result.issues.push(dataIssue);
          result.warningCount++;
          arr.push(dataIssue);
        }
      }
      if (block instanceof FlowGraphExecutionBlock && !_IsEventBlock(block)) {
        const inSignal = block.signalInputs.find((s) => s.name === "in");
        if (inSignal && !inSignal.isConnected()) {
          const signalIssue = {
            severity: 0,
            message: `Execution block has no incoming signal — it will never execute.`,
            block,
            connectionName: "in"
          };
          result.issues.push(signalIssue);
          result.errorCount++;
          arr.push(signalIssue);
        }
      }
    }
  }
  result.isValid = result.issues.every(
    (i) => i.severity !== 0
    /* FlowGraphValidationSeverity.Error */
  );
  result.issues.sort((a, b) => a.severity - b.severity);
  return result;
}
function _GetEventBlocks(flowGraph) {
  const eventBlocks = [];
  for (const type in flowGraph._eventBlocks) {
    for (const block of flowGraph._eventBlocks[type]) {
      eventBlocks.push(block);
    }
  }
  return eventBlocks;
}
function _IsEventBlock(block) {
  return block instanceof FlowGraphEventBlock;
}
function _DetectDataCycles(allBlocks, addIssue) {
  const white = 0;
  const gray = 1;
  const black = 2;
  const color = /* @__PURE__ */ new Map();
  for (const block of allBlocks) {
    color.set(block.uniqueId, white);
  }
  const reportedCycleBlocks = /* @__PURE__ */ new Set();
  function dfs(block) {
    color.set(block.uniqueId, gray);
    for (const input of block.dataInputs) {
      if (!input.isConnected()) {
        continue;
      }
      for (const connected of input._connectedPoint) {
        const dep = connected._ownerBlock;
        if (dep instanceof FlowGraphExecutionBlock) {
          continue;
        }
        const depColor = color.get(dep.uniqueId);
        if (depColor === gray) {
          if (!reportedCycleBlocks.has(block.uniqueId)) {
            reportedCycleBlocks.add(block.uniqueId);
            addIssue({
              severity: 0,
              message: `Data dependency cycle detected — getValue() will recurse infinitely.`,
              block
            });
          }
          if (!reportedCycleBlocks.has(dep.uniqueId)) {
            reportedCycleBlocks.add(dep.uniqueId);
            addIssue({
              severity: 0,
              message: `Data dependency cycle detected — getValue() will recurse infinitely.`,
              block: dep
            });
          }
          return true;
        }
        if (depColor === white) {
          dfs(dep);
        }
      }
    }
    color.set(block.uniqueId, black);
    return false;
  }
  for (const block of allBlocks) {
    if (color.get(block.uniqueId) === white) {
      dfs(block);
    }
  }
}
var FlowGraphState;
(function(FlowGraphState2) {
  FlowGraphState2[FlowGraphState2["Stopped"] = 0] = "Stopped";
  FlowGraphState2[FlowGraphState2["Started"] = 1] = "Started";
  FlowGraphState2[FlowGraphState2["Paused"] = 2] = "Paused";
})(FlowGraphState || (FlowGraphState = {}));
class FlowGraph {
  /** @returns the flow graph editor from a UMD bundle or the BABYLON global, or undefined if not loaded */
  _getGlobalFlowGraphEditor() {
    if (typeof FLOWGRAPHEDITOR !== "undefined") {
      if (FLOWGRAPHEDITOR.FlowGraphEditor) {
        return FLOWGRAPHEDITOR;
      }
      if (FLOWGRAPHEDITOR.default?.FlowGraphEditor) {
        return FLOWGRAPHEDITOR.default;
      }
    }
    if (typeof BABYLON !== "undefined" && typeof BABYLON.FlowGraphEditor !== "undefined") {
      return BABYLON;
    }
    return void 0;
  }
  /**
   * The scene associated with this flow graph.
   */
  get scene() {
    return this._scene;
  }
  /**
   * The coordinator that owns this flow graph.
   */
  get coordinator() {
    return this._coordinator;
  }
  /**
   * The scene event coordinator for this graph.
   * Provides access to runtime event state such as currently pressed keys.
   */
  get sceneEventCoordinator() {
    return this._sceneEventCoordinator;
  }
  /**
   * The state of the graph
   */
  get state() {
    return this._state;
  }
  /**
   * The state of the graph
   */
  set state(value) {
    this._state = value;
    this.onStateChangedObservable.notifyObservers(value);
  }
  /**
   * Construct a Flow Graph
   * @param params construction parameters. currently only the scene
   */
  constructor(params) {
    this._BJSFLOWGRAPHEDITOR = this._getGlobalFlowGraphEditor();
    this.onStateChangedObservable = new Observable();
    this._eventBlocks = {
      [
        "SceneReady"
        /* FlowGraphEventType.SceneReady */
      ]: [],
      [
        "SceneDispose"
        /* FlowGraphEventType.SceneDispose */
      ]: [],
      [
        "SceneBeforeRender"
        /* FlowGraphEventType.SceneBeforeRender */
      ]: [],
      [
        "MeshPick"
        /* FlowGraphEventType.MeshPick */
      ]: [],
      [
        "PointerDown"
        /* FlowGraphEventType.PointerDown */
      ]: [],
      [
        "PointerUp"
        /* FlowGraphEventType.PointerUp */
      ]: [],
      [
        "PointerMove"
        /* FlowGraphEventType.PointerMove */
      ]: [],
      [
        "PointerOver"
        /* FlowGraphEventType.PointerOver */
      ]: [],
      [
        "PointerOut"
        /* FlowGraphEventType.PointerOut */
      ]: [],
      [
        "KeyDown"
        /* FlowGraphEventType.KeyDown */
      ]: [],
      [
        "KeyUp"
        /* FlowGraphEventType.KeyUp */
      ]: [],
      [
        "SceneAfterRender"
        /* FlowGraphEventType.SceneAfterRender */
      ]: [],
      [
        "NoTrigger"
        /* FlowGraphEventType.NoTrigger */
      ]: []
    };
    this._allBlocks = [];
    this._executionContexts = [];
    this._state = 0;
    this._scene = params.scene;
    this._sceneEventCoordinator = new FlowGraphSceneEventCoordinator(this._scene);
    this._coordinator = params.coordinator;
    this.name = params.name ?? "Graph";
    this.uniqueId = params.uniqueId ?? RandomGUID();
  }
  _attachEventObserver() {
    if (this._eventObserver) {
      return;
    }
    this._eventObserver = this._sceneEventCoordinator.onEventTriggeredObservable.add((event, eventState) => {
      if (event.type === "SceneDispose") {
        this.dispose();
        return;
      }
      if (this.state !== 1) {
        return;
      }
      const propagationStops = event.type === "MeshPick" || event.type === "PointerOver" || event.type === "PointerOut" ? [] : void 0;
      const payload = event.payload;
      const source = payload?.pickInfo?.pickedMesh ?? payload?.mesh;
      for (const context of this._executionContexts) {
        const order = this._getContextualOrder(event.type, context);
        for (const block of order) {
          const eventBlock = block;
          const target = eventBlock._getReferencedMesh?.(context);
          if (source && target && propagationStops?.some((stoppedTarget) => stoppedTarget !== target && _IsDescendantOf(source, target))) {
            continue;
          }
          const eventKey = eventBlock.eventKey;
          this._coordinator._beginEventDispatch(eventKey, eventState);
          let shouldContinue;
          let dispatch;
          try {
            shouldContinue = block._executeEvent(context, event.payload);
          } finally {
            dispatch = this._coordinator._endEventDispatch();
          }
          if (dispatch?.propagationStopped && target) {
            propagationStops?.push(target);
          }
          if (eventState.skipNextObservers || !shouldContinue) {
            break;
          }
        }
        if (eventState.skipNextObservers) {
          break;
        }
      }
      switch (event.type) {
        case "SceneReady":
          this._sceneEventCoordinator.sceneReadyTriggered = true;
          break;
        case "SceneBeforeRender":
          for (const context of this._executionContexts) {
            context._notifyOnTick(event.payload);
          }
          break;
      }
    });
  }
  _detachEventObserver() {
    this._eventObserver?.remove();
    this._eventObserver = null;
  }
  /**
   * Sets a new scene for this flow graph, re-wiring all event listeners.
   * This is useful when the scene the flow graph should listen to changes
   * (e.g. when a new scene is loaded in an editor preview).
   * If the graph is currently running, it will be stopped first and must be
   * restarted manually after calling this method.
   * @param scene the new scene to attach to
   */
  setScene(scene) {
    if (scene === this._scene) {
      return;
    }
    if (this.state === 1) {
      this.stop();
    }
    this._detachEventObserver();
    this._sceneEventCoordinator.dispose();
    this._executionContexts.length = 0;
    this._scene = scene;
    this._scene.constantlyUpdateMeshUnderPointer = true;
    for (const block of this._allBlocks) {
      for (const input of block.dataInputs) {
        input._reresolveDefaultValueForScene(scene);
      }
    }
    this._sceneEventCoordinator = new FlowGraphSceneEventCoordinator(this._scene);
    this._attachEventObserver();
  }
  /**
   * Create a context. A context represents one self contained execution for the graph, with its own variables.
   * @returns the context, where you can get and set variables
   */
  createContext() {
    const context = new FlowGraphContext({ scene: this._scene, coordinator: this._coordinator, sceneEventCoordinator: this._sceneEventCoordinator });
    this._executionContexts.push(context);
    return context;
  }
  /**
   * Returns the execution context at a given index
   * @param index the index of the context
   * @returns the execution context at that index
   */
  getContext(index) {
    return this._executionContexts[index];
  }
  /**
   * Returns the number of execution contexts currently attached to this graph.
   */
  get contextCount() {
    return this._executionContexts.length;
  }
  /**
   * Remove an execution context by index. Any pending async blocks on
   * the context are cleared before removal.
   * @param index the index of the context to remove
   * @returns the removed context, or undefined if the index was out of range
   */
  removeContext(index) {
    if (index < 0 || index >= this._executionContexts.length) {
      return void 0;
    }
    const [removed] = this._executionContexts.splice(index, 1);
    removed._clearPendingBlocks();
    return removed;
  }
  /**
   * Returns all blocks registered in this graph, including disconnected ones.
   * @returns a read-only array of all blocks
   */
  getAllBlocks() {
    return this._allBlocks;
  }
  /**
   * Register a block with the graph. This does not wire any connections;
   * it simply ensures the block is tracked so that serialization, editor
   * display, and validation see it even when it is not reachable from an
   * event block.
   * @param block the block to register
   */
  addBlock(block) {
    if (this._allBlocks.indexOf(block) === -1) {
      this._allBlocks.push(block);
    }
  }
  /**
   * Remove a block from the graph. Disconnects all of its ports and, if it
   * is an event block, unregisters it from the event-block lists.
   * @param block the block to remove
   */
  removeBlock(block) {
    const idx = this._allBlocks.indexOf(block);
    if (idx !== -1) {
      this._allBlocks.splice(idx, 1);
    }
    if (block instanceof FlowGraphExecutionBlock && "type" in block) {
      const eventBlock = block;
      const list = this._eventBlocks[eventBlock.type];
      if (list) {
        const eIdx = list.indexOf(eventBlock);
        if (eIdx !== -1) {
          list.splice(eIdx, 1);
        }
      }
    }
    if (block instanceof FlowGraphAsyncExecutionBlock) {
      for (const context of this._executionContexts) {
        block._cancelPendingTasks(context);
        block._resetAfterCanceled(context);
      }
    }
    for (const input of block.dataInputs) {
      input.disconnectFromAll();
    }
    for (const output of block.dataOutputs) {
      output.disconnectFromAll();
    }
    if (block instanceof FlowGraphExecutionBlock) {
      for (const signalIn of block.signalInputs) {
        signalIn.disconnectFromAll();
      }
      for (const signalOut of block.signalOutputs) {
        signalOut.disconnectFromAll();
      }
    }
  }
  /**
   * Add an event block. When the graph is started, it will start listening to events
   * from the block and execute the graph when they are triggered.
   * @param block the event block to be added
   */
  addEventBlock(block) {
    this.addBlock(block);
    if (block.type === "PointerOver" || block.type === "PointerOut") {
      this._scene.constantlyUpdateMeshUnderPointer = true;
    }
    this._eventBlocks[block.type].push(block);
    if (this.state === 1) {
      for (const context of this._executionContexts) {
        block._startPendingTasks(context);
      }
    } else {
      this.onStateChangedObservable.addOnce((state) => {
        if (state === 1) {
          for (const context of this._executionContexts) {
            block._startPendingTasks(context);
          }
        }
      });
    }
  }
  /**
   * Stops the flow graph. Cancels all pending tasks and clears execution contexts,
   * but keeps event blocks so the graph can be restarted.
   */
  stop() {
    if (this.state === 0) {
      return;
    }
    this._detachEventObserver();
    this.state = 0;
    for (const context of this._executionContexts) {
      context._clearPendingBlocks();
      context._clearPendingActivation();
    }
    this._executionContexts.length = 0;
  }
  /**
   * Pauses the flow graph. Cancels pending tasks but keeps execution contexts and event blocks.
   * Call start() to resume.
   */
  pause() {
    if (this.state !== 1) {
      return;
    }
    this._detachEventObserver();
    this.state = 2;
    for (const context of this._executionContexts) {
      context._clearPendingBlocks();
    }
  }
  /**
   * Starts the flow graph. Initializes the event blocks and starts listening to events.
   * Can also be called to resume from a paused state.
   * @param skipSceneReadyCheck whether to activate the startup event immediately even when the scene is not yet ready
   */
  start(skipSceneReadyCheck = false) {
    if (this.state === 1) {
      return;
    }
    const resumingFromPause = this.state === 2;
    if (this._executionContexts.length === 0) {
      this.createContext();
    }
    this._attachEventObserver();
    this.state = 1;
    this._startPendingEvents();
    if (!resumingFromPause) {
      this._sceneEventCoordinator.sceneReadyTriggered = false;
      if (skipSceneReadyCheck || this._scene.isReady(true)) {
        this._sceneEventCoordinator.sceneReadyTriggered = true;
        this._sceneEventCoordinator.onEventTriggeredObservable.notifyObservers({
          type: "SceneReady"
          /* FlowGraphEventType.SceneReady */
        });
      } else {
        this._scene.executeWhenReady(() => {
          if (this.state === 1 && !this._sceneEventCoordinator.sceneReadyTriggered) {
            this._sceneEventCoordinator.sceneReadyTriggered = true;
            this._sceneEventCoordinator.onEventTriggeredObservable.notifyObservers({
              type: "SceneReady"
              /* FlowGraphEventType.SceneReady */
            });
          }
        }, true);
      }
    }
  }
  _startPendingEvents() {
    for (const context of this._executionContexts) {
      for (const type in this._eventBlocks) {
        const order = this._getContextualOrder(type, context);
        for (const block of order) {
          block._startPendingTasks(context);
        }
      }
    }
  }
  _getContextualOrder(type, context) {
    const order = this._eventBlocks[type].sort((a, b) => b.initPriority - a.initPriority);
    if (type === "MeshPick" || type === "PointerOver" || type === "PointerOut") {
      const meshPickOrder = [];
      for (const block1 of order) {
        const mesh1 = type === "MeshPick" ? block1.asset.getValue(context) : block1._getReferencedMesh(context);
        let i = 0;
        for (; i < order.length; i++) {
          const block2 = order[i];
          const mesh2 = type === "MeshPick" ? block2.asset.getValue(context) : block2._getReferencedMesh(context);
          if (mesh1 && mesh2 && _IsDescendantOf(mesh1, mesh2)) {
            break;
          }
        }
        meshPickOrder.splice(i, 0, block1);
      }
      return meshPickOrder;
    }
    return order;
  }
  /**
   * Disposes of the flow graph. Cancels any pending tasks and removes all event listeners.
   */
  dispose() {
    this._detachEventObserver();
    this._sceneEventCoordinator.dispose();
    if (this.state === 0) {
      return;
    }
    this.state = 0;
    for (const context of this._executionContexts) {
      context._clearPendingBlocks();
      context._clearPendingActivation();
    }
    this._executionContexts.length = 0;
    for (const type in this._eventBlocks) {
      this._eventBlocks[type].length = 0;
    }
    this._allBlocks.length = 0;
  }
  /**
   * Executes a function in all blocks of a flow graph, starting with the event blocks.
   * @param visitor the function to execute.
   */
  visitAllBlocks(visitor) {
    const visitList = [];
    const idsAddedToVisitList = /* @__PURE__ */ new Set();
    for (const type in this._eventBlocks) {
      for (const block of this._eventBlocks[type]) {
        visitList.push(block);
        idsAddedToVisitList.add(block.uniqueId);
      }
    }
    while (visitList.length > 0) {
      const block = visitList.pop();
      visitor(block);
      for (const dataIn of block.dataInputs) {
        for (const connection of dataIn._connectedPoint) {
          if (!idsAddedToVisitList.has(connection._ownerBlock.uniqueId)) {
            visitList.push(connection._ownerBlock);
            idsAddedToVisitList.add(connection._ownerBlock.uniqueId);
          }
        }
      }
      if (block instanceof FlowGraphExecutionBlock) {
        for (const signalOut of block.signalOutputs) {
          for (const connection of signalOut._connectedPoint) {
            if (!idsAddedToVisitList.has(connection._ownerBlock.uniqueId)) {
              visitList.push(connection._ownerBlock);
              idsAddedToVisitList.add(connection._ownerBlock.uniqueId);
            }
          }
        }
      }
    }
  }
  /**
   * Validates the flow graph and returns all issues found.
   * Uses the tracked block list for complete validation including unreachable block detection.
   * @returns The validation result containing errors and warnings.
   */
  validate() {
    return ValidateFlowGraphWithBlockList(this, this._allBlocks);
  }
  /**
   * Serializes a graph
   * @param serializationObject the object to write the values in
   * @param valueSerializeFunction a function to serialize complex values
   */
  serialize(serializationObject = {}, valueSerializeFunction) {
    serializationObject.name = this.name;
    serializationObject.uniqueId = this.uniqueId;
    if (this.metadata !== void 0) {
      serializationObject.metadata = this.metadata;
    }
    serializationObject.allBlocks = [];
    const seen = /* @__PURE__ */ new Set();
    const serializeBlock = (block) => {
      if (seen.has(block.uniqueId)) {
        return;
      }
      seen.add(block.uniqueId);
      const serializedBlock = {};
      block.serialize(serializedBlock);
      serializationObject.allBlocks.push(serializedBlock);
    };
    this.visitAllBlocks(serializeBlock);
    for (const block of this._allBlocks) {
      serializeBlock(block);
    }
    serializationObject.executionContexts = [];
    for (const context of this._executionContexts) {
      const serializedContext = {};
      context.serialize(serializedContext, valueSerializeFunction);
      serializationObject.executionContexts.push(serializedContext);
    }
  }
  /**
   * Launches the flow graph editor for this graph.
   * The editor is lazy-loaded from {@link FlowGraph.EditorURL} the first time it is used.
   * @param config defines the configuration of the editor
   * @returns a promise fulfilled when the editor is visible
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  async edit(config) {
    return await new Promise((resolve) => {
      this._BJSFLOWGRAPHEDITOR = this._BJSFLOWGRAPHEDITOR || this._getGlobalFlowGraphEditor();
      if (typeof this._BJSFLOWGRAPHEDITOR === "undefined") {
        const editorUrl = config && config.editorURL ? config.editorURL : FlowGraph.EditorURL;
        Tools.LoadBabylonScript(editorUrl, () => {
          this._BJSFLOWGRAPHEDITOR = this._BJSFLOWGRAPHEDITOR || this._getGlobalFlowGraphEditor();
          this._createFlowGraphEditor(config?.flowGraphEditorConfig);
          resolve();
        });
      } else {
        this._createFlowGraphEditor(config?.flowGraphEditorConfig);
        resolve();
      }
    });
  }
  /**
   * Creates the flow graph editor window.
   * @param additionalConfig additional configuration forwarded to `FlowGraphEditor.Show()`
   */
  _createFlowGraphEditor(additionalConfig) {
    const editorConfig = {
      flowGraph: this,
      hostScene: this._scene,
      // edit() always targets the developer's own live graph and scene, so the editor should
      // attach to that scene instead of spinning up a throwaway preview scene. A caller can
      // still override this via additionalConfig.
      attachToLiveScene: true,
      ...additionalConfig
    };
    this._BJSFLOWGRAPHEDITOR.FlowGraphEditor.Show(editorConfig);
  }
}
FlowGraph.EditorURL = `${Tools._DefaultCdnUrl}/v${AbstractEngine.Version}/flowGraphEditor/babylon.flowGraphEditor.js`;
const FlowGraphDefaultEventReferencePrefix = "flowgraph://events/";
function GetDefaultEventReference(key) {
  return FlowGraphDefaultEventReferencePrefix + key;
}
function GetDefaultEventReferenceKey(reference) {
  return reference.startsWith(FlowGraphDefaultEventReferencePrefix) ? reference.substring(FlowGraphDefaultEventReferencePrefix.length) : void 0;
}
class FlowGraphCoordinator {
  /**
   * Observable raised when a flow graph is added to any coordinator. Used by the inspector to keep
   * the flow graph list in sync. The payload is the newly added flow graph.
   */
  static get OnFlowGraphAddedObservable() {
    return this._OnFlowGraphAddedObservable;
  }
  /**
   * Observable raised when a flow graph is removed from any coordinator. Used by the inspector to keep
   * the flow graph list in sync. The payload is the removed flow graph.
   */
  static get OnFlowGraphRemovedObservable() {
    return this._OnFlowGraphRemovedObservable;
  }
  constructor(config) {
    this.config = config;
    this.dispatchEventsSynchronously = true;
    this._flowGraphs = [];
    this._customEventsMap = /* @__PURE__ */ new Map();
    this._eventExecutionCounter = /* @__PURE__ */ new Map();
    this._executeOnNextFrame = [];
    this._eventUniqueId = 0;
    this._eventDispatchStack = [];
    this._attachToScene(this.config.scene);
  }
  _attachToScene(scene) {
    this._disposeObserver = scene.onDisposeObservable.add(() => {
      this.dispose();
    });
    this._onBeforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
      this._eventExecutionCounter.clear();
      const executeOnNextFrame = this._executeOnNextFrame.slice(0);
      if (executeOnNextFrame.length) {
        for (const event of executeOnNextFrame) {
          this.notifyCustomEvent(event.id, event.data, false);
          const index = this._executeOnNextFrame.findIndex((e) => e.uniqueId === event.uniqueId);
          if (index !== -1) {
            this._executeOnNextFrame.splice(index, 1);
          }
        }
      }
    });
    let coordinators = FlowGraphCoordinator.SceneCoordinators.get(scene);
    if (!coordinators) {
      coordinators = [];
      FlowGraphCoordinator.SceneCoordinators.set(scene, coordinators);
    }
    coordinators.push(this);
  }
  _detachFromScene(scene) {
    this._disposeObserver.remove();
    this._onBeforeRenderObserver.remove();
    const coordinators = FlowGraphCoordinator.SceneCoordinators.get(scene);
    if (!coordinators) {
      return;
    }
    const index = coordinators.indexOf(this);
    if (index !== -1) {
      coordinators.splice(index, 1);
    }
  }
  /**
   * Reattaches this coordinator's lifecycle observers to another scene.
   * @param scene new scene owned by the coordinator
   * @param updateGraphs whether existing graphs should also be reattached
   * @internal
   */
  _setScene(scene, updateGraphs = true) {
    const previousScene = this.config.scene;
    if (scene === previousScene) {
      return;
    }
    this._detachFromScene(previousScene);
    this.config.scene = scene;
    if (updateGraphs) {
      for (const graph of this._flowGraphs) {
        graph.setScene(scene);
      }
    }
    this._attachToScene(scene);
  }
  /**
   * Creates a new flow graph and adds it to the list of existing flow graphs
   * @param name - optional name for the new graph. If not provided, an auto-generated name is used.
   * @returns a new flow graph
   */
  createGraph(name) {
    const graphName = name ?? `Graph ${this._flowGraphs.length + 1}`;
    const graph = new FlowGraph({ scene: this.config.scene, coordinator: this, name: graphName });
    this._flowGraphs.push(graph);
    FlowGraphCoordinator._OnFlowGraphAddedObservable.notifyObservers(graph);
    return graph;
  }
  /**
   * Removes a flow graph from the list of existing flow graphs and disposes it
   * @param graph the graph to remove
   */
  removeGraph(graph) {
    const index = this._flowGraphs.indexOf(graph);
    if (index !== -1) {
      graph.dispose();
      this._flowGraphs.splice(index, 1);
      FlowGraphCoordinator._OnFlowGraphRemovedObservable.notifyObservers(graph);
    }
  }
  /**
   * Starts all graphs
   */
  start() {
    for (const graph of this._flowGraphs) {
      graph.start();
    }
  }
  /**
   * Disposes all graphs
   */
  dispose() {
    for (const graph of this._flowGraphs) {
      graph.dispose();
      FlowGraphCoordinator._OnFlowGraphRemovedObservable.notifyObservers(graph);
    }
    this._flowGraphs.length = 0;
    this._detachFromScene(this.config.scene);
  }
  /**
   * Serializes this coordinator to a JSON object.
   * @param serializationObject the object to serialize to
   * @param valueSerializeFunction the function to use to serialize the value
   */
  serialize(serializationObject, valueSerializeFunction) {
    serializationObject._flowGraphs = [];
    for (const graph of this._flowGraphs) {
      const serializedGraph = {};
      graph.serialize(serializedGraph, valueSerializeFunction);
      serializationObject._flowGraphs.push(serializedGraph);
    }
    serializationObject.dispatchEventsSynchronously = this.dispatchEventsSynchronously;
  }
  /**
   * Gets the list of flow graphs
   */
  get flowGraphs() {
    return this._flowGraphs;
  }
  /**
   * Get an observable that will be notified when the event with the given id is fired.
   * @param id the id of the event
   * @returns the observable for the event
   */
  getCustomEventObservable(id) {
    let observable = this._customEventsMap.get(id);
    if (!observable) {
      observable = new Observable(
        /*undefined, true*/
      );
      this._customEventsMap.set(id, observable);
    }
    return observable;
  }
  /**
   * Notifies the observable for the given event id with the given data.
   * @param id the id of the event
   * @param data the data to send with the event
   * @param async if true, the event will be dispatched asynchronously
   */
  notifyCustomEvent(id, data, async = !this.dispatchEventsSynchronously) {
    if (async) {
      this._executeOnNextFrame.push({ id, data, uniqueId: this._eventUniqueId++ });
      return;
    }
    if (this._eventExecutionCounter.has(id)) {
      const count = this._eventExecutionCounter.get(id);
      this._eventExecutionCounter.set(id, count + 1);
      if (count >= FlowGraphCoordinator.MaxEventTypeExecutionPerFrame) {
        if (count === FlowGraphCoordinator.MaxEventTypeExecutionPerFrame) {
          Logger.Warn(`FlowGraphCoordinator: Too many executions of event "${id}".`);
        }
        return;
      }
    } else {
      this._eventExecutionCounter.set(id, 1);
    }
    const observable = this._customEventsMap.get(id);
    if (observable) {
      observable.notifyObservers(data);
    }
  }
  /**
   * @internal
   * Marks the beginning of a custom-event dispatch. Called by event receiver
   * blocks from within their Observable callback so that the dispatch's
   * EventState becomes reachable by `event/stopPropagation` while the receiver
   * flow executes synchronously.
   * @param eventId the id of the event being dispatched
   * @param state the Observable EventState for this dispatch
   */
  _beginEventDispatch(eventId, state) {
    this._eventDispatchStack.push({ eventId, state, propagationStopped: false });
  }
  /**
   * @internal
   * Marks the end of the most recent custom-event dispatch started with
   * {@link _beginEventDispatch}.
   */
  _endEventDispatch() {
    return this._eventDispatchStack.pop();
  }
  /**
   * Stops the propagation of an in-flight custom event, preventing any event
   * handler nodes that have not been activated yet from running for the current
   * dispatch.
   *
   * The `event` argument is the opaque event reference produced by an event block on its `event`
   * output. If it does not reference an event that is currently being dispatched, this is a no-op.
   *
   * Babylon custom events have no scene-graph propagation layer, so there are
   * no transitive activations to cancel when `stopImmediate` is false. When it
   * is true, the remaining handlers in the Observable dispatch are skipped.
   * @param event the event reference to stop propagation for
   * @param stopImmediate whether to also stop remaining immediate handlers
   */
  stopEventPropagation(event, stopImmediate) {
    if (typeof event !== "string") {
      return;
    }
    const decode = this.config.hostResolver?.decodeEventReference ?? GetDefaultEventReferenceKey;
    const eventId = decode(event);
    if (eventId === void 0) {
      return;
    }
    for (let i = this._eventDispatchStack.length - 1; i >= 0; i--) {
      if (this._eventDispatchStack[i].eventId === eventId) {
        this._eventDispatchStack[i].propagationStopped = true;
        if (stopImmediate) {
          this._eventDispatchStack[i].state.skipNextObservers = true;
        }
        return;
      }
    }
  }
  /**
   * @internal
   * Encodes an event source key as the opaque reference exposed on an event block's `event`
   * output, delegating to the host resolver when one is configured.
   * @param key the event source key
   * @returns the event reference
   */
  _getEventReference(key) {
    const encode = this.config.hostResolver?.encodeEventReference;
    return encode ? encode(key) : GetDefaultEventReference(key);
  }
}
FlowGraphCoordinator.MaxEventsPerType = 30;
FlowGraphCoordinator.MaxEventTypeExecutionPerFrame = 30;
FlowGraphCoordinator.SceneCoordinators = /* @__PURE__ */ new Map();
FlowGraphCoordinator._OnFlowGraphAddedObservable = new Observable();
FlowGraphCoordinator._OnFlowGraphRemovedObservable = new Observable();
const ActiveDelayIndicesKey = "activeDelayIndices";
function GetActiveDelaySet(context) {
  let set = context._getGlobalContextVariable(ActiveDelayIndicesKey, null);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    context._setGlobalContextVariable(ActiveDelayIndicesKey, set);
  }
  return set;
}
function MarkDelayActive(context, index) {
  GetActiveDelaySet(context).add(index);
}
function MarkDelayInactive(context, index) {
  context._getGlobalContextVariable(ActiveDelayIndicesKey, null)?.delete(index);
}
function IsDelayActive(context, index) {
  return context._getGlobalContextVariable(ActiveDelayIndicesKey, null)?.has(index) ?? false;
}
export {
  FlowGraphExecutionBlockWithOutSignal as F,
  GetFlowGraphAssetWithType as G,
  IsDelayActive as I,
  MarkDelayInactive as M,
  RegisterFlowGraphSignalConnection as R,
  _IsDescendantOf as _,
  FlowGraphExecutionBlock as a,
  FlowGraphAsyncExecutionBlock as b,
  FlowGraphBlock as c,
  defaultValueSerializationFunction as d,
  FlowGraphEventBlock as e,
  FlowGraphCoordinator as f,
  getNumericValue as g,
  _IsMacPlatform as h,
  isNumeric as i,
  MarkDelayActive as j,
  _GetClassNameOf as k,
  _AreSameVectorOrQuaternionClass as l,
  _AreSameMatrixClass as m,
  _AreSameIntegerClass as n,
  _GetDefaultEventDataParseCount as o,
  needsPathConverter as p,
  defaultValueParseFunction as q,
  RegisterFlowGraphDataConnection as r
};
