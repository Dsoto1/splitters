import { L as Logger } from "./babylon-PnzH6wcM.js";
import { p as getAnimationTypeByFlowGraphType } from "./flowGraphRichTypes-B7BqVpav.js";
const InteractivityForLoopMaxIterations = 2e4;
function HasDefaultInteractivityFlowInput(operation) {
  if (operation === "flow/waitAll") {
    return false;
  }
  return operation.startsWith("flow/") || operation.startsWith("animation/") || operation === "pointer/set" || operation === "pointer/interpolate" || operation === "variable/set" || operation === "variable/interpolate" || operation === "event/send" || operation === "event/stopPropagation" || operation === "flow/log:BABYLON";
}
function NormalizeInteractivityEventDataConfiguration(value) {
  const normalizeValue = (entry) => {
    if (Array.isArray(entry)) {
      return entry.slice();
    }
    if (entry !== null && typeof entry === "object") {
      if (typeof entry.asArray === "function") {
        return Array.from(entry.asArray());
      }
      if (Object.prototype.hasOwnProperty.call(entry, "value")) {
        const nested = entry.value;
        return Array.isArray(nested) ? nested.slice() : [nested];
      }
    }
    return [entry];
  };
  if (Array.isArray(value)) {
    return value.filter((entry) => entry !== null && typeof entry === "object" && typeof entry.id === "string").map((entry) => ({
      id: entry.id,
      type: entry.type,
      ...entry.value === void 0 ? {} : { value: normalizeValue(entry.value) }
    })).sort((left, right) => left.id.localeCompare(right.id));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).map(([id, entry]) => {
      if (entry === null || typeof entry !== "object") {
        return { id, malformed: true };
      }
      const definition = entry;
      return {
        id,
        type: typeof definition.type === "string" ? definition.type : definition.type?.typeName,
        ...definition.value === void 0 ? {} : { value: normalizeValue(definition.value) }
      };
    }).sort((left, right) => left.id.localeCompare(right.id));
  }
  return value;
}
function getMappingForDeclaration(declaration, returnNoOpIfNotAvailable = true) {
  const extensionMappings = declaration.extension ? _GetOwnRegistryValue(gltfExtensionsToFlowGraphMapping, declaration.extension) : void 0;
  const mapping = declaration.extension ? _GetOwnRegistryValue(extensionMappings, declaration.op) : _GetOwnRegistryValue(gltfToFlowGraphMapping, declaration.op);
  if (!mapping) {
    if (returnNoOpIfNotAvailable) {
      Logger.Warn(`No mapping found for operation ${declaration.op} and extension ${declaration.extension || "KHR_interactivity"}`);
      return getNoOpMappingForDeclaration(declaration);
    }
  }
  return mapping;
}
function getNoOpMappingForDeclaration(declaration) {
  const inputs = {};
  const outputs = {
    flows: {}
  };
  if (declaration.inputValueSockets) {
    inputs.values = /* @__PURE__ */ Object.create(null);
    for (const key in declaration.inputValueSockets) {
      if (Object.prototype.hasOwnProperty.call(declaration.inputValueSockets, key)) {
        Object.defineProperty(inputs.values, key, {
          configurable: true,
          enumerable: true,
          value: { name: key },
          writable: true
        });
      }
    }
  }
  if (declaration.outputValueSockets) {
    outputs.values = /* @__PURE__ */ Object.create(null);
    Object.keys(declaration.outputValueSockets).forEach((key) => {
      Object.defineProperty(outputs.values, key, {
        configurable: true,
        enumerable: true,
        value: { name: key },
        writable: true
      });
    });
  }
  return {
    blocks: [],
    inputs,
    outputs
  };
}
function addNewInteractivityFlowGraphMapping(key, extension, mapping) {
  let extensionMappings = _GetOwnRegistryValue(gltfExtensionsToFlowGraphMapping, extension);
  if (!extensionMappings) {
    extensionMappings = /* @__PURE__ */ Object.create(null);
    Object.defineProperty(gltfExtensionsToFlowGraphMapping, extension, {
      configurable: true,
      enumerable: true,
      value: extensionMappings,
      writable: true
    });
  }
  Object.defineProperty(extensionMappings, key, {
    configurable: true,
    enumerable: true,
    value: mapping,
    writable: true
  });
}
function _GetOwnRegistryValue(registry, key) {
  return registry && Object.prototype.hasOwnProperty.call(registry, key) ? registry[key] : void 0;
}
const gltfExtensionsToFlowGraphMapping = {
  /**
   * This is the BABYLON extension for glTF interactivity.
   * It defines babylon-specific blocks and operations.
   */
  BABYLON: {
    /**
     * flow/log is a flow node that logs input to the console.
     * It has "in" and "out" flows, and takes a message as input.
     * The message can be any type of value.
     * The message is logged to the console when the "in" flow is triggered.
     * The "out" flow is triggered when the message is logged.
     */
    "flow/log": {
      blocks: [
        "FlowGraphConsoleLogBlock"
        /* FlowGraphBlockNames.ConsoleLog */
      ],
      inputs: {
        values: {
          message: { name: "message" },
          "[segment]": { name: "$1", compatibilityOnly: true }
        }
      },
      outputs: {
        flows: {
          out: { name: "out", compatibilityOnly: true }
        }
      }
    }
  }
};
const gltfToFlowGraphMapping = {
  "event/onStart": {
    blocks: [
      "FlowGraphSceneReadyEventBlock"
      /* FlowGraphBlockNames.SceneReadyEvent */
    ],
    outputs: {
      values: {
        // KHR_interactivity `ref event` output (the event reference).
        event: { name: "event" }
      },
      flows: {
        out: { name: "done" }
      }
    }
  },
  "event/onTick": {
    blocks: [
      "FlowGraphSceneTickEventBlock"
      /* FlowGraphBlockNames.SceneTickEvent */
    ],
    inputs: {},
    outputs: {
      values: {
        timeSinceStart: { name: "timeSinceStart", gltfType: "number" },
        timeSinceLastTick: {
          name: "deltaTime",
          gltfType: "number"
          /*, dataTransformer: (time: number) => time / 1000*/
        },
        // KHR_interactivity `ref event` output (the event reference).
        event: { name: "event" }
      },
      flows: {
        out: { name: "done" }
      }
    },
    extraProcessor(_node, _declaration, _mapping, _parser, blocks) {
      blocks[0].config.useFirstTickAsStart = true;
      return blocks;
    }
  },
  "event/send": {
    blocks: [
      "FlowGraphSendCustomEventBlock"
      /* FlowGraphBlockNames.SendCustomEvent */
    ],
    configuration: {
      event: {
        name: "eventId",
        configurationType: "int",
        required: true,
        indexSource: "events",
        validationOnly: true
      }
    },
    inputs: {
      values: {
        "[segment]": { name: "$1" }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" }
      }
    },
    extraProcessor(gltfBlock, declaration, _mapping, parser, serializedObjects) {
      if (declaration.op !== "event/send" || !gltfBlock.configuration?.event) {
        throw new Error("Send event should have a single configuration object, the event itself");
      }
      const eventConfiguration = gltfBlock.configuration["event"];
      const eventId = eventConfiguration.value?.[0];
      if (typeof eventId !== "number") {
        throw new Error("Event id should be a number");
      }
      const event = parser.arrays.events[eventId];
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.eventId = event.eventId;
      serializedObject.config.eventData = event.eventData;
      return serializedObjects;
    }
  },
  "event/receive": {
    blocks: [
      "FlowGraphReceiveCustomEventBlock"
      /* FlowGraphBlockNames.ReceiveCustomEvent */
    ],
    configuration: {
      event: {
        name: "eventId",
        configurationType: "int",
        required: true,
        indexSource: "events",
        validationOnly: true
      }
    },
    outputs: {
      values: {
        // KHR_interactivity `ref event` output (the event reference).
        event: { name: "event" },
        "[segment]": { name: "$1" }
      },
      flows: {
        out: { name: "done" }
      }
    },
    validation(gltfBlock, interactivityGraph) {
      if (!gltfBlock.configuration) {
        Logger.Error("Receive event should have a configuration object");
        return { valid: false, error: "Receive event should have a configuration object" };
      }
      const eventConfiguration = gltfBlock.configuration["event"];
      if (!eventConfiguration) {
        Logger.Error("Receive event should have a single configuration object, the event itself");
        return { valid: false, error: "Receive event should have a single configuration object, the event itself" };
      }
      const eventId = eventConfiguration.value?.[0];
      if (typeof eventId !== "number") {
        Logger.Error("Event id should be a number");
        return { valid: false, error: "Event id should be a number" };
      }
      const event = interactivityGraph.events?.[eventId];
      if (!event) {
        Logger.Error(`Event with id ${eventId} not found`);
        return { valid: false, error: `Event with id ${eventId} not found` };
      }
      return { valid: true };
    },
    extraProcessor(gltfBlock, declaration, _mapping, parser, serializedObjects) {
      if (declaration.op !== "event/receive" || !gltfBlock.configuration?.event) {
        throw new Error("Receive event should have a single configuration object, the event itself");
      }
      const eventConfiguration = gltfBlock.configuration["event"];
      const eventId = eventConfiguration.value?.[0];
      if (typeof eventId !== "number") {
        throw new Error("Event id should be a number");
      }
      const event = parser.arrays.events[eventId];
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.eventId = event.eventId;
      serializedObject.config.eventData = event.eventData;
      return serializedObjects;
    }
  },
  "event/stopPropagation": {
    blocks: [
      "FlowGraphStopEventPropagationBlock"
      /* FlowGraphBlockNames.StopEventPropagation */
    ],
    inputs: {
      values: {
        event: { name: "event" },
        stopImmediate: { name: "stopImmediate" }
      },
      flows: {
        in: { name: "in" }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" }
      }
    }
  },
  "math/E": getSimpleInputMapping("FlowGraphEBlock", []),
  "math/Pi": getSimpleInputMapping("FlowGraphPIBlock", []),
  "math/Tau": getSimpleInputMapping("FlowGraphTauBlock", []),
  "math/Inf": getSimpleInputMapping("FlowGraphInfBlock", []),
  "math/NaN": getSimpleInputMapping("FlowGraphNaNBlock", []),
  "math/abs": getSimpleInputMapping(
    "FlowGraphAbsBlock"
    /* FlowGraphBlockNames.Abs */
  ),
  "math/sign": getSimpleInputMapping(
    "FlowGraphSignBlock"
    /* FlowGraphBlockNames.Sign */
  ),
  "math/trunc": getSimpleInputMapping(
    "FlowGraphTruncBlock"
    /* FlowGraphBlockNames.Trunc */
  ),
  "math/floor": getSimpleInputMapping(
    "FlowGraphFloorBlock"
    /* FlowGraphBlockNames.Floor */
  ),
  "math/ceil": getSimpleInputMapping(
    "FlowGraphCeilBlock"
    /* FlowGraphBlockNames.Ceil */
  ),
  "math/round": {
    blocks: [
      "FlowGraphRoundBlock"
      /* FlowGraphBlockNames.Round */
    ],
    configuration: {},
    inputs: {
      values: {
        a: { name: "a" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" }
      }
    },
    extraProcessor(gltfBlock, declaration, _mapping, parser, serializedObjects) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      serializedObjects[0].config.roundHalfAwayFromZero = true;
      return serializedObjects;
    }
  },
  "math/fract": getSimpleInputMapping(
    "FlowGraphFractBlock"
    /* FlowGraphBlockNames.Fraction */
  ),
  "math/neg": getSimpleInputMapping(
    "FlowGraphNegationBlock"
    /* FlowGraphBlockNames.Negation */
  ),
  "math/add": getSimpleInputMapping("FlowGraphAddBlock", ["a", "b"], true),
  "math/sub": getSimpleInputMapping("FlowGraphSubtractBlock", ["a", "b"], true),
  "math/mul": {
    blocks: [
      "FlowGraphMultiplyBlock"
      /* FlowGraphBlockNames.Multiply */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        b: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      serializedObjects[0].config.useMatrixPerComponent = true;
      serializedObjects[0].config.preventIntegerFloatArithmetic = true;
      let type = -1;
      Object.keys(_gltfBlock.values || {}).find((value) => {
        if (_gltfBlock.values?.[value].type !== void 0) {
          type = _gltfBlock.values[value].type;
          return true;
        }
        return false;
      });
      if (type !== -1) {
        serializedObjects[0].config.type = _parser.arrays.types[type].flowGraphType;
      }
      return serializedObjects;
    },
    validation(gltfBlock) {
      if (gltfBlock.values) {
        return ValidateTypes(gltfBlock);
      }
      return { valid: true };
    }
  },
  "math/div": getSimpleInputMapping("FlowGraphDivideBlock", ["a", "b"], true),
  "math/rem": getSimpleInputMapping("FlowGraphModuloBlock", ["a", "b"]),
  "math/min": getSimpleInputMapping("FlowGraphMinBlock", ["a", "b"]),
  "math/max": getSimpleInputMapping("FlowGraphMaxBlock", ["a", "b"]),
  "math/clamp": getSimpleInputMapping("FlowGraphClampBlock", ["a", "b", "c"]),
  "math/saturate": getSimpleInputMapping(
    "FlowGraphSaturateBlock"
    /* FlowGraphBlockNames.Saturate */
  ),
  "math/mix": getSimpleInputMapping("FlowGraphMathInterpolationBlock", ["a", "b", "c"]),
  // Smooth-step (Hermite interpolation): edges a/b and value c.
  "math/smoothStep": getSimpleInputMapping("FlowGraphSmoothStepBlock", ["a", "b", "c"]),
  // Linear sRGB <-> OkLCh (Oklab polar form). Scalar r/g/b inputs map to l/c/h
  // outputs (hue in radians) and vice-versa.
  "math/rgbToOkLCh": {
    blocks: [
      "FlowGraphRGBToOkLChBlock"
      /* FlowGraphBlockNames.RGBToOkLCh */
    ],
    inputs: {
      values: {
        r: { name: "r", gltfType: "number" },
        g: { name: "g", gltfType: "number" },
        b: { name: "b", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        l: { name: "l" },
        c: { name: "c" },
        h: { name: "h" }
      }
    }
  },
  "math/rgbFromOkLCh": {
    blocks: [
      "FlowGraphRGBFromOkLChBlock"
      /* FlowGraphBlockNames.RGBFromOkLCh */
    ],
    inputs: {
      values: {
        l: { name: "l", gltfType: "number" },
        c: { name: "c", gltfType: "number" },
        h: { name: "h", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        r: { name: "r" },
        g: { name: "g" },
        b: { name: "b" }
      }
    }
  },
  // Quaternion spherical-linear interpolation. Inputs are two unit
  // quaternions and an unclamped float coefficient.
  "math/quatSlerp": getSimpleInputMapping("FlowGraphMathSlerpBlock", ["a", "b", "c"]),
  // Vector spherical-linear interpolation (float2/float3). Inputs are two
  // vectors and an unclamped float coefficient.
  "math/slerp": getSimpleInputMapping("FlowGraphVectorSlerpBlock", ["a", "b", "c"]),
  "math/eq": getSimpleInputMapping("FlowGraphEqualityBlock", ["a", "b"]),
  // Reference equality. The spec defines `ref/eq` as: true if both refs are
  // null, true if both refer to the same object (regardless of whether it
  // exists), false otherwise. FlowGraphEqualityBlock falls through to a
  // strict `===` comparison for non-vector/matrix/numeric types, which
  // already produces the spec-defined behaviour for Babylon object refs.
  "ref/eq": getSimpleInputMapping("FlowGraphEqualityBlock", ["a", "b"]),
  "math/lt": getSimpleInputMapping("FlowGraphLessThanBlock", ["a", "b"]),
  "math/le": getSimpleInputMapping("FlowGraphLessThanOrEqualBlock", ["a", "b"]),
  "math/gt": getSimpleInputMapping("FlowGraphGreaterThanBlock", ["a", "b"]),
  "math/ge": getSimpleInputMapping("FlowGraphGreaterThanOrEqualBlock", ["a", "b"]),
  "math/isNaN": getSimpleInputMapping(
    "FlowGraphIsNaNBlock"
    /* FlowGraphBlockNames.IsNaN */
  ),
  "math/isInf": getSimpleInputMapping(
    "FlowGraphIsInfBlock"
    /* FlowGraphBlockNames.IsInfinity */
  ),
  "math/select": {
    blocks: [
      "FlowGraphConditionalBlock"
      /* FlowGraphBlockNames.Conditional */
    ],
    inputs: {
      values: {
        condition: { name: "condition" },
        // Should we validate those have the same type here, or assume it is already validated?
        a: { name: "onTrue" },
        b: { name: "onFalse" }
      }
    },
    outputs: {
      values: {
        value: { name: "output", typeSourceInput: "a" }
      }
    }
  },
  "math/random": {
    blocks: [
      "FlowGraphRandomBlock"
      /* FlowGraphBlockNames.Random */
    ],
    outputs: {
      values: {
        value: { name: "value", gltfType: "float" }
      }
    }
  },
  "math/sin": getSimpleInputMapping("FlowGraphSinBlock", ["a"], false, ["float", "float2", "float3", "float4"]),
  "math/cos": getSimpleInputMapping(
    "FlowGraphCosBlock"
    /* FlowGraphBlockNames.Cos */
  ),
  "math/tan": getSimpleInputMapping(
    "FlowGraphTanBlock"
    /* FlowGraphBlockNames.Tan */
  ),
  "math/asin": getSimpleInputMapping(
    "FlowGraphASinBlock"
    /* FlowGraphBlockNames.Asin */
  ),
  "math/acos": getSimpleInputMapping(
    "FlowGraphACosBlock"
    /* FlowGraphBlockNames.Acos */
  ),
  "math/atan": getSimpleInputMapping(
    "FlowGraphATanBlock"
    /* FlowGraphBlockNames.Atan */
  ),
  "math/atan2": getSimpleInputMapping("FlowGraphATan2Block", ["a", "b"]),
  "math/sinh": getSimpleInputMapping(
    "FlowGraphSinhBlock"
    /* FlowGraphBlockNames.Sinh */
  ),
  "math/cosh": getSimpleInputMapping(
    "FlowGraphCoshBlock"
    /* FlowGraphBlockNames.Cosh */
  ),
  "math/tanh": getSimpleInputMapping(
    "FlowGraphTanhBlock"
    /* FlowGraphBlockNames.Tanh */
  ),
  "math/asinh": getSimpleInputMapping(
    "FlowGraphASinhBlock"
    /* FlowGraphBlockNames.Asinh */
  ),
  "math/acosh": getSimpleInputMapping(
    "FlowGraphACoshBlock"
    /* FlowGraphBlockNames.Acosh */
  ),
  "math/atanh": getSimpleInputMapping(
    "FlowGraphATanhBlock"
    /* FlowGraphBlockNames.Atanh */
  ),
  "math/exp": getSimpleInputMapping(
    "FlowGraphExponentialBlock"
    /* FlowGraphBlockNames.Exponential */
  ),
  "math/log": getSimpleInputMapping(
    "FlowGraphLogBlock"
    /* FlowGraphBlockNames.Log */
  ),
  "math/log2": getSimpleInputMapping(
    "FlowGraphLog2Block"
    /* FlowGraphBlockNames.Log2 */
  ),
  "math/log10": getSimpleInputMapping(
    "FlowGraphLog10Block"
    /* FlowGraphBlockNames.Log10 */
  ),
  "math/sqrt": getSimpleInputMapping(
    "FlowGraphSquareRootBlock"
    /* FlowGraphBlockNames.SquareRoot */
  ),
  "math/cbrt": getSimpleInputMapping(
    "FlowGraphCubeRootBlock"
    /* FlowGraphBlockNames.CubeRoot */
  ),
  "math/pow": getSimpleInputMapping("FlowGraphPowerBlock", ["a", "b"]),
  "math/length": getSimpleInputMapping(
    "FlowGraphLengthBlock"
    /* FlowGraphBlockNames.Length */
  ),
  "math/normalize": {
    ...getSimpleInputMapping(
      "FlowGraphNormalizeBlock"
      /* FlowGraphBlockNames.Normalize */
    ),
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" },
        isValid: { name: "isValid", gltfType: "bool" }
      }
    }
  },
  "math/dot": getSimpleInputMapping("FlowGraphDotBlock", ["a", "b"]),
  "math/cross": getSimpleInputMapping("FlowGraphCrossBlock", ["a", "b"]),
  "math/rotate2D": {
    blocks: [
      "FlowGraphRotate2DBlock"
      /* FlowGraphBlockNames.Rotate2D */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        angle: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" }
      }
    }
  },
  "math/rotate3D": {
    blocks: [
      "FlowGraphRotate3DBlock"
      /* FlowGraphBlockNames.Rotate3D */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        rotation: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" }
      }
    }
  },
  "math/transform": {
    // glTF transform is vectorN with matrixN
    blocks: [
      "FlowGraphTransformVectorBlock"
      /* FlowGraphBlockNames.TransformVector */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        b: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" }
      }
    }
  },
  "math/combine2": {
    blocks: [
      "FlowGraphCombineVector2Block"
      /* FlowGraphBlockNames.CombineVector2 */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float2" }
      }
    }
  },
  "math/combine3": {
    blocks: [
      "FlowGraphCombineVector3Block"
      /* FlowGraphBlockNames.CombineVector3 */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float3" }
      }
    }
  },
  "math/combine4": {
    blocks: [
      "FlowGraphCombineVector4Block"
      /* FlowGraphBlockNames.CombineVector4 */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" },
        d: { name: "input_3", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float4" }
      }
    }
  },
  // one input, N outputs! outputs named using numbers.
  "math/extract2": {
    blocks: [
      "FlowGraphExtractVector2Block"
      /* FlowGraphBlockNames.ExtractVector2 */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "float2" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" }
      }
    }
  },
  "math/extract3": {
    blocks: [
      "FlowGraphExtractVector3Block"
      /* FlowGraphBlockNames.ExtractVector3 */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "float3" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" }
      }
    }
  },
  "math/extract4": {
    blocks: [
      "FlowGraphExtractVector4Block"
      /* FlowGraphBlockNames.ExtractVector4 */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "float4" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" },
        "3": { name: "output_3" }
      }
    }
  },
  "math/transpose": getSimpleInputMapping("FlowGraphTransposeBlock", ["a"], false, ["float2x2", "float3x3", "float4x4"]),
  "math/determinant": getSimpleInputMapping("FlowGraphDeterminantBlock", ["a"], false, ["float2x2", "float3x3", "float4x4"]),
  "math/inverse": {
    ...getSimpleInputMapping("FlowGraphInvertMatrixBlock", ["a"], false, ["float2x2", "float3x3", "float4x4"]),
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" },
        isValid: { name: "isValid", gltfType: "bool" }
      }
    }
  },
  "math/matMul": getSimpleInputMapping("FlowGraphMatrixMultiplicationBlock", ["a", "b"], true, ["float2x2", "float3x3", "float4x4"]),
  "math/matCompose": {
    blocks: [
      "FlowGraphMatrixCompose"
      /* FlowGraphBlockNames.MatrixCompose */
    ],
    inputs: {
      values: {
        translation: { name: "position", gltfType: "float3" },
        rotation: { name: "rotationQuaternion", gltfType: "float4" },
        scale: { name: "scaling", gltfType: "float3" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float4x4" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      const d = serializedObjects[0].dataInputs.find((input) => input.name === "rotationQuaternion");
      if (!d) {
        throw new Error("Rotation quaternion input not found");
      }
      if (context._connectionValues[d.uniqueId]) {
        context._connectionValues[d.uniqueId].type = "Quaternion";
      }
      return serializedObjects;
    }
  },
  "math/matDecompose": {
    blocks: [
      "FlowGraphMatrixDecompose"
      /* FlowGraphBlockNames.MatrixDecompose */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "float4x4" }
      }
    },
    outputs: {
      values: {
        translation: { name: "position" },
        rotation: { name: "rotationQuaternion" },
        scale: { name: "scaling" },
        scaling: { name: "scaling", compatibilityOnly: true },
        isValid: { name: "isValid", compatibilityOnly: true }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      serializedObjects[0].config.keepDegenerateComponents = true;
      return serializedObjects;
    }
  },
  "math/quatConjugate": getSimpleInputMapping("FlowGraphConjugateBlock", ["a"]),
  "math/quatMul": {
    blocks: [
      "FlowGraphMultiplyBlock"
      /* FlowGraphBlockNames.Multiply */
    ],
    inputs: {
      values: {
        a: { name: "a", gltfType: "float4" },
        b: { name: "b", gltfType: "float4" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float4" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      serializedObjects[0].config.type = "Quaternion";
      return serializedObjects;
    }
  },
  "math/quatAngleBetween": getSimpleInputMapping("FlowGraphAngleBetweenBlock", ["a", "b"]),
  "math/quatFromAxisAngle": {
    blocks: [
      "FlowGraphQuaternionFromAxisAngleBlock"
      /* FlowGraphBlockNames.QuaternionFromAxisAngle */
    ],
    inputs: {
      values: {
        axis: { name: "a", gltfType: "float3" },
        angle: { name: "b", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float4" }
      }
    }
  },
  "math/quatToAxisAngle": {
    blocks: [
      "FlowGraphAxisAngleFromQuaternionBlock"
      /* FlowGraphBlockNames.AxisAngleFromQuaternion */
    ],
    inputs: {
      values: {
        a: { name: "a", gltfType: "float4" }
      }
    },
    outputs: {
      values: {
        axis: { name: "axis", gltfType: "float3" },
        angle: { name: "angle", gltfType: "float" }
      }
    }
  },
  "math/quatFromDirections": {
    ...getSimpleInputMapping("FlowGraphQuaternionFromDirectionsBlock", ["a", "b"]),
    outputs: {
      values: {
        value: { name: "value", gltfType: "float4" }
      }
    }
  },
  "math/quatFromUpForward": {
    blocks: [
      "FlowGraphQuaternionFromUpForwardBlock"
      /* FlowGraphBlockNames.QuaternionFromUpForward */
    ],
    inputs: {
      values: {
        up: { name: "a", gltfType: "float3" },
        forward: { name: "b", gltfType: "float3" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float4" }
      }
    }
  },
  // Tait–Bryan intrinsic Euler angles (x/y/z, in radians) to a rotation quaternion. The rotation
  // order is selected by the `order` configuration string (default `yxz`).
  "math/quatFromAngles": {
    blocks: [
      "FlowGraphQuaternionFromAnglesBlock"
      /* FlowGraphBlockNames.QuaternionFromAngles */
    ],
    configuration: {
      order: {
        name: "order",
        defaultValue: ["yxz"],
        configurationType: "string",
        invalidUsesDefault: true,
        allowedValues: ["xyz", "xzy", "yxz", "yzx", "zxy", "zyx"]
      }
    },
    inputs: {
      values: {
        x: { name: "a", gltfType: "number" },
        y: { name: "b", gltfType: "number" },
        z: { name: "c", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float4" }
      }
    }
  },
  "math/combine2x2": {
    blocks: [
      "FlowGraphCombineMatrix2DBlock"
      /* FlowGraphBlockNames.CombineMatrix2D */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" },
        d: { name: "input_3", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float2x2" }
      }
    }
  },
  "math/extract2x2": {
    blocks: [
      "FlowGraphExtractMatrix2DBlock"
      /* FlowGraphBlockNames.ExtractMatrix2D */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "float2x2" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" },
        "3": { name: "output_3" }
      }
    }
  },
  "math/combine3x3": {
    blocks: [
      "FlowGraphCombineMatrix3DBlock"
      /* FlowGraphBlockNames.CombineMatrix3D */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" },
        d: { name: "input_3", gltfType: "number" },
        e: { name: "input_4", gltfType: "number" },
        f: { name: "input_5", gltfType: "number" },
        g: { name: "input_6", gltfType: "number" },
        h: { name: "input_7", gltfType: "number" },
        i: { name: "input_8", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float3x3" }
      }
    }
  },
  "math/extract3x3": {
    blocks: [
      "FlowGraphExtractMatrix3DBlock"
      /* FlowGraphBlockNames.ExtractMatrix3D */
    ],
    inputs: {
      values: {
        a: { name: "input", gltfType: "float3x3" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" },
        "3": { name: "output_3" },
        "4": { name: "output_4" },
        "5": { name: "output_5" },
        "6": { name: "output_6" },
        "7": { name: "output_7" },
        "8": { name: "output_8" }
      }
    }
  },
  "math/combine4x4": {
    blocks: [
      "FlowGraphCombineMatrixBlock"
      /* FlowGraphBlockNames.CombineMatrix */
    ],
    inputs: {
      values: {
        a: { name: "input_0", gltfType: "number" },
        b: { name: "input_1", gltfType: "number" },
        c: { name: "input_2", gltfType: "number" },
        d: { name: "input_3", gltfType: "number" },
        e: { name: "input_4", gltfType: "number" },
        f: { name: "input_5", gltfType: "number" },
        g: { name: "input_6", gltfType: "number" },
        h: { name: "input_7", gltfType: "number" },
        i: { name: "input_8", gltfType: "number" },
        j: { name: "input_9", gltfType: "number" },
        k: { name: "input_10", gltfType: "number" },
        l: { name: "input_11", gltfType: "number" },
        m: { name: "input_12", gltfType: "number" },
        n: { name: "input_13", gltfType: "number" },
        o: { name: "input_14", gltfType: "number" },
        p: { name: "input_15", gltfType: "number" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", gltfType: "float4x4" }
      }
    }
  },
  "math/extract4x4": {
    blocks: [
      "FlowGraphExtractMatrixBlock"
      /* FlowGraphBlockNames.ExtractMatrix */
    ],
    configuration: {},
    inputs: {
      values: {
        a: { name: "input", gltfType: "float4x4" }
      }
    },
    outputs: {
      values: {
        "0": { name: "output_0" },
        "1": { name: "output_1" },
        "2": { name: "output_2" },
        "3": { name: "output_3" },
        "4": { name: "output_4" },
        "5": { name: "output_5" },
        "6": { name: "output_6" },
        "7": { name: "output_7" },
        "8": { name: "output_8" },
        "9": { name: "output_9" },
        "10": { name: "output_10" },
        "11": { name: "output_11" },
        "12": { name: "output_12" },
        "13": { name: "output_13" },
        "14": { name: "output_14" },
        "15": { name: "output_15" }
      }
    }
  },
  "math/not": {
    blocks: [
      "FlowGraphBitwiseNotBlock"
      /* FlowGraphBlockNames.BitwiseNot */
    ],
    inputs: {
      values: {
        a: { name: "a" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      const socketIn = serializedObjects[0].dataInputs[0];
      serializedObjects[0].config.valueType = context._connectionValues[socketIn.uniqueId]?.type ?? "FlowGraphInteger";
      return serializedObjects;
    }
  },
  "math/and": {
    blocks: [
      "FlowGraphBitwiseAndBlock"
      /* FlowGraphBlockNames.BitwiseAnd */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        b: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      const socketInA = serializedObjects[0].dataInputs[0];
      const socketInB = serializedObjects[0].dataInputs[1];
      serializedObjects[0].config.valueType = context._connectionValues[socketInA.uniqueId]?.type ?? context._connectionValues[socketInB.uniqueId]?.type ?? "FlowGraphInteger";
      return serializedObjects;
    }
  },
  "math/or": {
    blocks: [
      "FlowGraphBitwiseOrBlock"
      /* FlowGraphBlockNames.BitwiseOr */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        b: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      const socketInA = serializedObjects[0].dataInputs[0];
      const socketInB = serializedObjects[0].dataInputs[1];
      serializedObjects[0].config.valueType = context._connectionValues[socketInA.uniqueId]?.type ?? context._connectionValues[socketInB.uniqueId]?.type ?? "FlowGraphInteger";
      return serializedObjects;
    }
  },
  "math/xor": {
    blocks: [
      "FlowGraphBitwiseXorBlock"
      /* FlowGraphBlockNames.BitwiseXor */
    ],
    inputs: {
      values: {
        a: { name: "a" },
        b: { name: "b" }
      }
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: "a" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _parser, serializedObjects, context) {
      var _a;
      (_a = serializedObjects[0]).config || (_a.config = {});
      const socketInA = serializedObjects[0].dataInputs[0];
      const socketInB = serializedObjects[0].dataInputs[1];
      serializedObjects[0].config.valueType = context._connectionValues[socketInA.uniqueId]?.type ?? context._connectionValues[socketInB.uniqueId]?.type ?? "FlowGraphInteger";
      return serializedObjects;
    }
  },
  "math/asr": getSimpleInputMapping("FlowGraphBitwiseRightShiftBlock", ["a", "b"]),
  "math/lsl": getSimpleInputMapping("FlowGraphBitwiseLeftShiftBlock", ["a", "b"]),
  "math/clz": getSimpleInputMapping(
    "FlowGraphLeadingZerosBlock"
    /* FlowGraphBlockNames.LeadingZeros */
  ),
  "math/ctz": getSimpleInputMapping(
    "FlowGraphTrailingZerosBlock"
    /* FlowGraphBlockNames.TrailingZeros */
  ),
  "math/popcnt": getSimpleInputMapping(
    "FlowGraphOneBitsCounterBlock"
    /* FlowGraphBlockNames.OneBitsCounter */
  ),
  "math/rad": getSimpleInputMapping(
    "FlowGraphDegToRadBlock"
    /* FlowGraphBlockNames.DegToRad */
  ),
  "math/deg": getSimpleInputMapping(
    "FlowGraphRadToDegBlock"
    /* FlowGraphBlockNames.RadToDeg */
  ),
  "type/boolToInt": getSimpleInputMapping(
    "FlowGraphBooleanToInt"
    /* FlowGraphBlockNames.BooleanToInt */
  ),
  "type/boolToFloat": getSimpleInputMapping(
    "FlowGraphBooleanToFloat"
    /* FlowGraphBlockNames.BooleanToFloat */
  ),
  "type/intToBool": getSimpleInputMapping(
    "FlowGraphIntToBoolean"
    /* FlowGraphBlockNames.IntToBoolean */
  ),
  "type/intToFloat": getSimpleInputMapping(
    "FlowGraphIntToFloat"
    /* FlowGraphBlockNames.IntToFloat */
  ),
  "type/floatToInt": getSimpleInputMapping(
    "FlowGraphFloatToInt"
    /* FlowGraphBlockNames.FloatToInt */
  ),
  "type/floatToBool": getSimpleInputMapping(
    "FlowGraphFloatToBoolean"
    /* FlowGraphBlockNames.FloatToBoolean */
  ),
  // flows
  "flow/sequence": {
    blocks: [
      "FlowGraphSequenceBlock"
      /* FlowGraphBlockNames.Sequence */
    ],
    outputs: {
      flows: {
        "[segment]": { name: "$1" }
      }
    },
    extraProcessor(gltfBlock, _declaration, _mapping, _arrays, serializedObjects) {
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.outputSignalCount = Object.keys(gltfBlock.flows || []).length;
      serializedObject.signalOutputs.forEach((output, index) => {
        output.name = "out_" + index;
      });
      return serializedObjects;
    }
  },
  "flow/branch": {
    blocks: [
      "FlowGraphBranchBlock"
      /* FlowGraphBlockNames.Branch */
    ],
    inputs: {
      values: {
        condition: { name: "condition", gltfType: "boolean" }
      }
    },
    outputs: {
      flows: {
        true: { name: "onTrue" },
        false: { name: "onFalse" }
      }
    }
  },
  "flow/switch": {
    blocks: [
      "FlowGraphSwitchBlock"
      /* FlowGraphBlockNames.Switch */
    ],
    configuration: {
      cases: {
        name: "cases",
        isArray: true,
        inOptions: true,
        defaultValue: [],
        configurationType: "int[]",
        invalidUsesDefault: true,
        generatesOutputFlowSockets: true,
        uniqueValues: true
      }
    },
    inputs: {
      values: {
        selection: { name: "case", gltfType: "int" }
      }
    },
    outputs: {
      flows: {
        default: { name: "default" },
        "[segment]": { name: "$1" }
      }
    },
    validation(gltfBlock) {
      const cases = gltfBlock.configuration?.cases;
      if (cases && cases.value) {
        const onlyIntegers = cases.value.every((caseValue) => typeof caseValue === "number" && Number.isInteger(caseValue) && caseValue >= -2147483648 && caseValue <= 2147483647);
        if (!onlyIntegers) {
          Logger.Warn("Switch cases should be integers. Using empty array instead.");
          cases.value = [];
          return { valid: true };
        }
        const uniqueCases = new Set(cases.value);
        cases.value = Array.from(uniqueCases);
      }
      return { valid: true };
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects) {
      const serializedObject = serializedObjects[0];
      serializedObject.signalOutputs.forEach((output) => {
        if (output.name !== "default") {
          output.name = "out_" + output.name;
        }
      });
      return serializedObjects;
    }
  },
  "flow/while": {
    blocks: [
      "FlowGraphWhileLoopBlock"
      /* FlowGraphBlockNames.WhileLoop */
    ],
    inputs: {
      values: {
        condition: { name: "condition", gltfType: "boolean" }
      }
    },
    outputs: {
      flows: {
        loopBody: { name: "executionFlow" },
        completed: { name: "completed" }
      }
    }
  },
  "flow/for": {
    blocks: [
      "FlowGraphForLoopBlock"
      /* FlowGraphBlockNames.ForLoop */
    ],
    configuration: {
      initialIndex: {
        name: "initialIndex",
        gltfType: "int",
        inOptions: true,
        defaultValue: 0,
        configurationType: "int",
        invalidUsesDefault: true
      }
    },
    inputs: {
      values: {
        startIndex: { name: "startIndex", gltfType: "int" },
        endIndex: { name: "endIndex", gltfType: "int" }
      }
    },
    outputs: {
      values: {
        index: { name: "index" }
      },
      flows: {
        loopBody: { name: "executionFlow" },
        completed: { name: "completed" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects) {
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.incrementIndexWhenLoopDone = true;
      serializedObject.config.maxLoopIterations = InteractivityForLoopMaxIterations;
      return serializedObjects;
    }
  },
  "flow/doN": {
    blocks: [
      "FlowGraphDoNBlock"
      /* FlowGraphBlockNames.DoN */
    ],
    configuration: {},
    inputs: {
      values: {
        n: { name: "maxExecutions", gltfType: "int" }
      },
      flows: {
        reset: { name: "reset" }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" }
      },
      values: {
        currentCount: { name: "executionCount" }
      }
    }
  },
  "flow/multiGate": {
    blocks: [
      "FlowGraphMultiGateBlock"
      /* FlowGraphBlockNames.MultiGate */
    ],
    inputs: {
      flows: {
        reset: { name: "reset" }
      }
    },
    configuration: {
      isRandom: {
        name: "isRandom",
        gltfType: "boolean",
        inOptions: true,
        defaultValue: false,
        configurationType: "bool",
        invalidUsesDefault: true,
        configurationGroup: "multiGate"
      },
      isLoop: {
        name: "isLoop",
        gltfType: "boolean",
        inOptions: true,
        defaultValue: false,
        configurationType: "bool",
        invalidUsesDefault: true,
        configurationGroup: "multiGate"
      }
    },
    outputs: {
      flows: {
        "[segment]": { name: "$1" }
      },
      values: {
        lastIndex: { name: "lastIndex", gltfType: "int" }
      }
    },
    extraProcessor(gltfBlock, declaration, _mapping, _arrays, serializedObjects) {
      if (declaration.op !== "flow/multiGate") {
        throw new Error("Invalid operation for MultiGate mapping");
      }
      const serializedObject = serializedObjects[0];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.outputSignalCount = Object.keys(gltfBlock.flows ?? {}).length;
      serializedObject.signalOutputs.forEach((output, index) => {
        output.name = "out_" + index;
      });
      return serializedObjects;
    }
  },
  "flow/waitAll": {
    blocks: [
      "FlowGraphWaitAllBlock"
      /* FlowGraphBlockNames.WaitAll */
    ],
    configuration: {
      inputFlows: {
        name: "inputSignalCount",
        gltfType: "number",
        inOptions: true,
        defaultValue: [0],
        configurationType: "int",
        invalidUsesDefault: true,
        minimum: 0,
        maximum: 64,
        generatesInputFlowSockets: true
      }
    },
    inputs: {
      flows: {
        reset: { name: "reset" },
        "[segment]": { name: "in_$1" }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" },
        completed: { name: "completed" }
      },
      values: {
        remainingInputs: { name: "remainingInputs", gltfType: "int" }
      }
    },
    validation(gltfBlock) {
      const inputFlowsConfiguration = gltfBlock.configuration?.inputFlows?.value;
      const inputFlows = inputFlowsConfiguration?.[0];
      if (inputFlowsConfiguration?.length !== 1 || typeof inputFlows !== "number" || !Number.isInteger(inputFlows) || inputFlows < 0 || inputFlows > 64) {
        gltfBlock.configuration = gltfBlock.configuration || {
          inputFlows: { value: [0] }
        };
        gltfBlock.configuration.inputFlows.value = [0];
      }
      return { valid: true };
    }
  },
  "flow/throttle": {
    blocks: [
      "FlowGraphThrottleBlock"
      /* FlowGraphBlockNames.Throttle */
    ],
    inputs: {
      values: {
        duration: { name: "duration", gltfType: "number" }
      },
      flows: {
        reset: { name: "reset" }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" },
        err: { name: "error" }
      },
      values: {
        lastRemainingTime: { name: "lastRemainingTime", gltfType: "number" }
      }
    },
    extraProcessor(_node, _declaration, _mapping, _parser, blocks) {
      blocks[0].config.allowZeroDuration = true;
      return blocks;
    }
  },
  "flow/setDelay": {
    blocks: ["FlowGraphSetDelayBlock", "KHR_interactivity/FlowGraphDelayReferenceBlock"],
    inputs: {
      values: {
        duration: { name: "duration", gltfType: "number" }
      },
      flows: {
        cancel: { name: "cancel" }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" },
        err: { name: "error" },
        done: { name: "done" }
      },
      values: {
        lastDelay: { name: "value", toBlock: "KHR_interactivity/FlowGraphDelayReferenceBlock" },
        lastDelayIndex: { name: "lastDelayIndex", compatibilityOnly: true }
      }
    },
    interBlockConnectors: [{ input: "input", output: "lastDelayIndex", inputBlockIndex: 1, outputBlockIndex: 0, isVariable: true }]
  },
  "flow/cancelDelay": {
    blocks: ["FlowGraphCancelDelayBlock", "KHR_interactivity/FlowGraphDelayReferenceBlock"],
    inputs: {
      values: {
        delay: { name: "input", gltfType: "ref", toBlock: "KHR_interactivity/FlowGraphDelayReferenceBlock" },
        delayIndex: { name: "input", compatibilityOnly: true, toBlock: "KHR_interactivity/FlowGraphDelayReferenceBlock" }
      }
    },
    interBlockConnectors: [{ input: "delayIndex", output: "value", inputBlockIndex: 0, outputBlockIndex: 1, isVariable: true }],
    extraProcessor(_node, _declaration, _mapping, _parser, blocks) {
      blocks[0].config.ignoreInvalidDelay = true;
      blocks[1].config.decode = true;
      return blocks;
    },
    outputs: {
      flows: {
        out: { name: "out" }
      }
    }
  },
  "variable/get": {
    blocks: [
      "FlowGraphGetVariableBlock"
      /* FlowGraphBlockNames.GetVariable */
    ],
    validation(gltfBlock) {
      if (!gltfBlock.configuration?.variable?.value) {
        Logger.Error("Variable get block should have a variable configuration");
        return { valid: false, error: "Variable get block should have a variable configuration" };
      }
      return { valid: true };
    },
    configuration: {
      variable: {
        name: "variable",
        gltfType: "number",
        configurationType: "int",
        required: true,
        indexSource: "variables",
        flowGraphType: "string",
        inOptions: true,
        isVariable: true,
        dataTransformer(index, parser) {
          return parser.getVariableName(index);
        }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    }
  },
  "variable/set": {
    blocks: [
      "FlowGraphSetVariableBlock"
      /* FlowGraphBlockNames.SetVariable */
    ],
    inputs: {
      values: {
        "[segment]": { name: "$1" }
      }
    },
    configuration: {
      variables: {
        name: "variables",
        gltfType: "number",
        configurationType: "int[]",
        required: true,
        indexSource: "variables",
        minItems: 1,
        generatesInputValueSockets: true,
        flowGraphType: "string",
        inOptions: true,
        isArray: true,
        dataTransformer(index, parser) {
          return index.map((i) => parser.getVariableName(i));
        }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" }
      }
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      const serializedSetVariable = serializedObjects[0];
      serializedSetVariable.config.cancelVariableAnimations = true;
      serializedSetVariable.config.evaluateInputsBeforeWrite = true;
      serializedSetVariable.dataInputs.forEach((input) => {
        input.name = parser.getVariableName(+input.name);
      });
      return serializedObjects;
    }
  },
  "variable/interpolate": {
    blocks: [
      "FlowGraphInterpolationBlock",
      "FlowGraphContextBlock",
      "FlowGraphPlayAnimationBlock",
      "FlowGraphBezierCurveEasing",
      "FlowGraphGetVariableBlock"
    ],
    configuration: {
      variable: {
        name: "propertyName",
        configurationType: "int",
        required: true,
        indexSource: "variables",
        inOptions: true,
        isVariable: true,
        dataTransformer(index, parser) {
          return parser.getVariableName(index);
        }
      },
      useSlerp: {
        name: "animationType",
        configurationType: "bool",
        required: true,
        inOptions: true,
        dataTransformer(value) {
          return value === true ? "Quaternion" : void 0;
        }
      }
    },
    inputs: {
      values: {
        value: { name: "value_1" },
        duration: { name: "duration_1", gltfType: "number" },
        p1: {
          name: "controlPoint1",
          gltfType: "float2",
          toBlock: "FlowGraphBezierCurveEasing"
          /* FlowGraphBlockNames.BezierCurveEasing */
        },
        p2: {
          name: "controlPoint2",
          gltfType: "float2",
          toBlock: "FlowGraphBezierCurveEasing"
          /* FlowGraphBlockNames.BezierCurveEasing */
        }
      },
      flows: {
        in: {
          name: "in",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        }
      }
    },
    outputs: {
      flows: {
        err: {
          name: "error",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        },
        out: {
          name: "out",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        },
        done: {
          name: "done",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        }
      }
    },
    interBlockConnectors: [
      {
        input: "object",
        output: "userVariables",
        inputBlockIndex: 2,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "animation",
        output: "animation",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "easingFunction",
        output: "easingFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 3,
        isVariable: true
      },
      {
        input: "value_0",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 4,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      var _a, _b;
      const serializedValueInterpolation = serializedObjects[0];
      const propertyIndex = gltfBlock.configuration?.variable.value?.[0];
      if (typeof propertyIndex !== "number") {
        Logger.Error("Variable index is not defined for variable interpolation block");
        throw new Error("Variable index is not defined for variable interpolation block");
      }
      const variable = parser.arrays.staticVariables[propertyIndex];
      if (typeof serializedValueInterpolation.config?.animationType?.value === "undefined") {
        serializedValueInterpolation.config || (serializedValueInterpolation.config = {});
        (_a = serializedValueInterpolation.config).animationType || (_a.animationType = {});
        serializedValueInterpolation.config.animationType.value = getAnimationTypeByFlowGraphType(variable.type);
      }
      const serializedGetVariable = serializedObjects[4];
      serializedGetVariable.config || (serializedGetVariable.config = {});
      (_b = serializedGetVariable.config).variable || (_b.variable = {});
      serializedGetVariable.config.variable.value = parser.getVariableName(propertyIndex);
      return serializedObjects;
    }
  },
  "pointer/get": {
    blocks: [
      "FlowGraphGetPropertyBlock",
      "FlowGraphJsonPointerParserBlock"
      /* FlowGraphBlockNames.JsonPointerParser */
    ],
    validation: (node) => ValidateJsonPointerTemplate(node),
    configuration: {
      pointer: { name: "jsonPointer", toBlock: "FlowGraphJsonPointerParserBlock", configurationType: "string", required: true, pointerTemplate: true },
      type: {
        name: "type",
        configurationType: "int",
        required: true,
        validationOnly: true,
        indexSource: "types"
      }
    },
    inputs: {
      values: {
        "[segment]": {
          name: "$1",
          toBlock: "FlowGraphJsonPointerParserBlock"
          /* FlowGraphBlockNames.JsonPointerParser */
        }
      }
    },
    outputs: {
      values: {
        value: { name: "value" },
        isValid: { name: "isValid", gltfType: "bool" }
      }
    },
    interBlockConnectors: [
      {
        input: "object",
        output: "object",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "propertyName",
        output: "propertyName",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "customGetFunction",
        output: "getFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      const configuredType = gltfBlock.configuration?.type?.value?.[0];
      if (typeof configuredType === "number" && parser.arrays.types[configuredType]) {
        serializedObjects[0].config.invalidValue = parser.getTypeDefault(configuredType);
      }
      serializedObjects.forEach((serializedObject) => {
        if (serializedObject.className === "FlowGraphJsonPointerParserBlock") {
          serializedObject.config || (serializedObject.config = {});
          serializedObject.config.outputValue = true;
        }
      });
      return serializedObjects;
    }
  },
  "pointer/set": {
    blocks: [
      "FlowGraphSetPropertyBlock",
      "FlowGraphJsonPointerParserBlock"
      /* FlowGraphBlockNames.JsonPointerParser */
    ],
    validation: (node) => ValidateJsonPointerTemplate(node, /* @__PURE__ */ new Set(["value"])),
    configuration: {
      pointer: { name: "jsonPointer", toBlock: "FlowGraphJsonPointerParserBlock", configurationType: "string", required: true, pointerTemplate: true },
      type: {
        name: "type",
        configurationType: "int",
        required: true,
        validationOnly: true,
        indexSource: "types"
      }
    },
    inputs: {
      values: {
        // must be defined due to the array taking over
        value: { name: "value" },
        "[segment]": {
          name: "$1",
          toBlock: "FlowGraphJsonPointerParserBlock"
          /* FlowGraphBlockNames.JsonPointerParser */
        }
      }
    },
    outputs: {
      flows: {
        err: { name: "error" },
        out: { name: "out" }
      }
    },
    interBlockConnectors: [
      {
        input: "object",
        output: "object",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "propertyName",
        output: "propertyName",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "customSetFunction",
        output: "setFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      const typeIndex = gltfBlock.configuration?.type?.value?.[0];
      serializedObjects.forEach((serializedObject) => {
        if (serializedObject.className === "FlowGraphJsonPointerParserBlock") {
          serializedObject.config || (serializedObject.config = {});
          serializedObject.config.outputValue = true;
          if (typeof typeIndex === "number") {
            serializedObject.config.valueType = parser.arrays.types[typeIndex].flowGraphType;
          }
        } else if (serializedObject.className === "FlowGraphSetPropertyBlock") {
          serializedObject.config.stopOnError = true;
        }
      });
      return serializedObjects;
    }
  },
  "pointer/interpolate": {
    // interpolate, parse the pointer and play the animation generated. 3 blocks!
    blocks: [
      "FlowGraphInterpolationBlock",
      "FlowGraphJsonPointerParserBlock",
      "FlowGraphPlayAnimationBlock",
      "FlowGraphBezierCurveEasing"
      /* FlowGraphBlockNames.BezierCurveEasing */
    ],
    validation: (node) => ValidateJsonPointerTemplate(node, /* @__PURE__ */ new Set(["value", "duration", "p1", "p2"])),
    configuration: {
      pointer: { name: "jsonPointer", toBlock: "FlowGraphJsonPointerParserBlock", configurationType: "string", required: true, pointerTemplate: true },
      type: {
        name: "type",
        configurationType: "int",
        required: true,
        validationOnly: true,
        indexSource: "types",
        allowedSignatures: ["float", "float2", "float3", "float4", "float2x2", "float3x3", "float4x4"]
      }
    },
    inputs: {
      values: {
        value: { name: "value_1" },
        "[segment]": {
          name: "$1",
          toBlock: "FlowGraphJsonPointerParserBlock"
          /* FlowGraphBlockNames.JsonPointerParser */
        },
        duration: {
          name: "duration_1",
          gltfType: "number"
          /*, inOptions: true */
        },
        p1: {
          name: "controlPoint1",
          gltfType: "float2",
          toBlock: "FlowGraphBezierCurveEasing"
          /* FlowGraphBlockNames.BezierCurveEasing */
        },
        p2: {
          name: "controlPoint2",
          gltfType: "float2",
          toBlock: "FlowGraphBezierCurveEasing"
          /* FlowGraphBlockNames.BezierCurveEasing */
        }
      },
      flows: {
        in: {
          name: "in",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        }
      }
    },
    outputs: {
      flows: {
        err: {
          name: "error",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        },
        out: {
          name: "out",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        },
        done: {
          name: "done",
          toBlock: "FlowGraphPlayAnimationBlock"
          /* FlowGraphBlockNames.PlayAnimation */
        }
      }
    },
    interBlockConnectors: [
      {
        input: "object",
        output: "object",
        inputBlockIndex: 2,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "propertyName",
        output: "propertyName",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "customBuildAnimation",
        output: "generateAnimationsFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "animation",
        output: "animation",
        inputBlockIndex: 2,
        outputBlockIndex: 0,
        isVariable: true
      },
      {
        input: "animationTargets",
        output: "animationTargets",
        inputBlockIndex: 2,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "easingFunction",
        output: "easingFunction",
        inputBlockIndex: 0,
        outputBlockIndex: 3,
        isVariable: true
      },
      {
        input: "value_0",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      }
    ],
    extraProcessor(gltfBlock, _declaration, _mapping, parser, serializedObjects) {
      const typeIndex = gltfBlock.configuration?.type?.value?.[0];
      serializedObjects.forEach((serializedObject) => {
        if (serializedObject.className === "FlowGraphJsonPointerParserBlock") {
          serializedObject.config || (serializedObject.config = {});
          serializedObject.config.outputValue = true;
          if (typeof typeIndex === "number") {
            serializedObject.config.valueType = parser.arrays.types[typeIndex].flowGraphType;
          }
        } else if (serializedObject.className === "FlowGraphInterpolationBlock") {
          serializedObject.config || (serializedObject.config = {});
          if (typeof typeIndex === "number") {
            serializedObject.config.animationType = parser.arrays.types[typeIndex].flowGraphType;
          }
        }
      });
      return serializedObjects;
    }
  },
  "animation/start": {
    blocks: ["FlowGraphPlayAnimationBlock", "FlowGraphArrayIndexBlock", "KHR_interactivity/FlowGraphGLTFDataProvider"],
    inputs: {
      values: {
        animation: {
          name: "index",
          gltfType: "ref",
          toBlock: "FlowGraphArrayIndexBlock"
          /* FlowGraphBlockNames.ArrayIndex */
        },
        speed: { name: "speed", gltfType: "number" },
        startTime: {
          name: "from",
          gltfType: "number",
          convertConnectedTimeToFrames: true,
          dataTransformer: (time, parser) => [time[0] * parser._animationTargetFps]
        },
        endTime: {
          name: "to",
          gltfType: "number",
          convertConnectedTimeToFrames: true,
          dataTransformer: (time, parser) => [time[0] * parser._animationTargetFps]
        }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" },
        err: { name: "error" },
        done: { name: "done" }
      }
    },
    interBlockConnectors: [
      {
        input: "animationGroup",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "animationGroups",
        inputBlockIndex: 1,
        outputBlockIndex: 2,
        isVariable: true
      }
    ],
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects, _context, globalGLTF) {
      const playAnimationBlock = serializedObjects.find(
        (block) => block.className === "FlowGraphPlayAnimationBlock"
        /* FlowGraphBlockNames.PlayAnimation */
      );
      if (playAnimationBlock) {
        playAnimationBlock.config.useVirtualTimeline = true;
      }
      const arrayIndexBlock = serializedObjects.find(
        (block) => block.className === "FlowGraphArrayIndexBlock"
        /* FlowGraphBlockNames.ArrayIndex */
      );
      if (arrayIndexBlock) {
        arrayIndexBlock.config.referenceCollection = "animations";
      }
      const serializedObject = serializedObjects[serializedObjects.length - 1];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.glTF = globalGLTF;
      return serializedObjects;
    }
  },
  "animation/stop": {
    blocks: ["FlowGraphStopAnimationBlock", "FlowGraphArrayIndexBlock", "KHR_interactivity/FlowGraphGLTFDataProvider"],
    inputs: {
      values: {
        animation: {
          name: "index",
          gltfType: "ref",
          toBlock: "FlowGraphArrayIndexBlock"
          /* FlowGraphBlockNames.ArrayIndex */
        }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" },
        err: { name: "error" }
      }
    },
    interBlockConnectors: [
      {
        input: "animationGroup",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "animationGroups",
        inputBlockIndex: 1,
        outputBlockIndex: 2,
        isVariable: true
      }
    ],
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects, _context, globalGLTF) {
      const stopAnimationBlock = serializedObjects.find(
        (block) => block.className === "FlowGraphStopAnimationBlock"
        /* FlowGraphBlockNames.StopAnimation */
      );
      if (stopAnimationBlock) {
        stopAnimationBlock.config.skipOnAnimationEnd = true;
      }
      const arrayIndexBlock = serializedObjects.find(
        (block) => block.className === "FlowGraphArrayIndexBlock"
        /* FlowGraphBlockNames.ArrayIndex */
      );
      if (arrayIndexBlock) {
        arrayIndexBlock.config.referenceCollection = "animations";
      }
      const serializedObject = serializedObjects[serializedObjects.length - 1];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.glTF = globalGLTF;
      return serializedObjects;
    }
  },
  "animation/stopAt": {
    blocks: ["FlowGraphStopAnimationBlock", "FlowGraphArrayIndexBlock", "KHR_interactivity/FlowGraphGLTFDataProvider"],
    configuration: {},
    inputs: {
      values: {
        animation: {
          name: "index",
          gltfType: "ref",
          toBlock: "FlowGraphArrayIndexBlock"
          /* FlowGraphBlockNames.ArrayIndex */
        },
        stopTime: {
          name: "stopAtFrame",
          gltfType: "number",
          convertConnectedTimeToFrames: true,
          dataTransformer: (time, parser) => [time[0] * parser._animationTargetFps]
        }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" },
        err: { name: "error" },
        done: { name: "done" }
      }
    },
    interBlockConnectors: [
      {
        input: "animationGroup",
        output: "value",
        inputBlockIndex: 0,
        outputBlockIndex: 1,
        isVariable: true
      },
      {
        input: "array",
        output: "animationGroups",
        inputBlockIndex: 1,
        outputBlockIndex: 2,
        isVariable: true
      }
    ],
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects, _context, globalGLTF) {
      const stopAnimationBlock = serializedObjects.find(
        (block) => block.className === "FlowGraphStopAnimationBlock"
        /* FlowGraphBlockNames.StopAnimation */
      );
      if (stopAnimationBlock) {
        stopAnimationBlock.config.useVirtualStopAt = true;
        stopAnimationBlock.config.skipOnAnimationEnd = true;
      }
      const arrayIndexBlock = serializedObjects.find(
        (block) => block.className === "FlowGraphArrayIndexBlock"
        /* FlowGraphBlockNames.ArrayIndex */
      );
      if (arrayIndexBlock) {
        arrayIndexBlock.config.referenceCollection = "animations";
      }
      const serializedObject = serializedObjects[serializedObjects.length - 1];
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.glTF = globalGLTF;
      return serializedObjects;
    }
  },
  "math/switch": {
    blocks: [
      "FlowGraphDataSwitchBlock"
      /* FlowGraphBlockNames.DataSwitch */
    ],
    configuration: {
      cases: {
        name: "cases",
        isArray: true,
        inOptions: true,
        defaultValue: [],
        configurationType: "int[]",
        invalidUsesDefault: true,
        generatesCaseInputValueSockets: true,
        uniqueValues: true
      }
    },
    inputs: {
      values: {
        selection: { name: "case", gltfType: "int" },
        default: { name: "default" },
        "[case]": { name: "$1" }
      }
    },
    outputs: {
      values: {
        value: { name: "value" }
      }
    },
    validation(gltfBlock) {
      const cases = gltfBlock.configuration?.cases;
      if (cases && cases.value) {
        const onlyIntegers = cases.value.every((caseValue) => {
          return typeof caseValue === "number" && /^-?\d+$/.test(caseValue.toString());
        });
        if (!onlyIntegers) {
          Logger.Warn("Switch cases should be integers. Using empty array instead.");
          cases.value = [];
          return { valid: true };
        }
        const uniqueCases = new Set(cases.value);
        cases.value = Array.from(uniqueCases);
      }
      return { valid: true };
    },
    extraProcessor(_gltfBlock, _declaration, _mapping, _arrays, serializedObjects) {
      const serializedObject = serializedObjects[0];
      serializedObject.dataInputs.forEach((input) => {
        if (input.name !== "default" && input.name !== "case") {
          input.name = "in_" + input.name;
        }
      });
      serializedObject.config || (serializedObject.config = {});
      serializedObject.config.treatCasesAsIntegers = true;
      return serializedObjects;
    }
  },
  "debug/log": {
    blocks: [
      "FlowGraphConsoleLogBlock"
      /* FlowGraphBlockNames.ConsoleLog */
    ],
    inputs: {
      flows: {
        in: { name: "in" }
      },
      values: {
        "[parameter]": { name: "$1" }
      }
    },
    outputs: {
      flows: {
        out: { name: "out" }
      }
    },
    configuration: {
      severity: {
        name: "severity",
        configurationType: "int",
        defaultValue: 0,
        invalidUsesDefault: true,
        validationOnly: true,
        configurationGroup: "debugLog"
      },
      message: {
        name: "messageTemplate",
        configurationType: "string",
        defaultValue: "",
        invalidUsesDefault: true,
        inOptions: true,
        configurationGroup: "debugLog",
        debugLogTemplate: true
      }
    }
  }
};
function getSimpleInputMapping(type, inputs = ["a"], inferType, allowedSignatures) {
  return {
    blocks: [type],
    inputs: {
      values: inputs.reduce((acc, input) => {
        acc[input] = { name: input, allowedSignatures };
        return acc;
      }, {})
    },
    outputs: {
      values: {
        value: { name: "value", typeSourceInput: inputs[0] }
      }
    },
    extraProcessor(gltfBlock, _declaration, _mapping, _parser, serializedObjects) {
      var _a;
      if (inferType) {
        (_a = serializedObjects[0]).config || (_a.config = {});
        serializedObjects[0].config.preventIntegerFloatArithmetic = true;
        let type2 = -1;
        Object.keys(gltfBlock.values || {}).find((value) => {
          if (gltfBlock.values?.[value].type !== void 0) {
            type2 = gltfBlock.values[value].type;
            return true;
          }
          return false;
        });
        if (type2 !== -1) {
          serializedObjects[0].config.type = _parser.arrays.types[type2].flowGraphType;
        }
      }
      return serializedObjects;
    },
    validation(gltfBlock) {
      if (inferType) {
        return ValidateTypes(gltfBlock);
      }
      return { valid: true };
    }
  };
}
function ValidateTypes(gltfBlock) {
  if (gltfBlock.values) {
    const types = Object.keys(gltfBlock.values).map((key) => gltfBlock.values[key].type).filter((type) => type !== void 0);
    const allSameType = types.every((type) => type === types[0]);
    if (!allSameType) {
      return { valid: false, error: "All inputs must be of the same type" };
    }
  }
  return { valid: true };
}
function HasOddBracketRun(segment) {
  for (let index = 0; index < segment.length; index++) {
    const character = segment[index];
    if ("[]{}".indexOf(character) === -1) {
      continue;
    }
    let runLength = 1;
    while (segment[index + runLength] === character) {
      runLength++;
    }
    if (runLength % 2 !== 0) {
      return true;
    }
    index += runLength - 1;
  }
  return false;
}
function ParseDebugLogTemplate(message) {
  let state = 0;
  let parameterStart = -1;
  const sockets = [];
  const seen = /* @__PURE__ */ new Set();
  for (let index = 0; index < message.length; index++) {
    const character = message[index];
    if (character === "{") {
      if (state === 0) {
        state = 1;
      } else if (state === 1) {
        state = 0;
      } else {
        return { valid: false, sockets: [] };
      }
    } else if (character === "}") {
      if (state === 0) {
        state = 3;
      } else if (state === 3) {
        state = 0;
      } else if (state === 2) {
        const socket = message.substring(parameterStart + 1, index);
        if (!seen.has(socket)) {
          seen.add(socket);
          sockets.push(socket);
        }
        state = 0;
      } else {
        return { valid: false, sockets: [] };
      }
    } else if (state === 1) {
      parameterStart = index - 1;
      state = 2;
    } else if (state === 3) {
      return { valid: false, sockets: [] };
    }
  }
  return { valid: state === 0, sockets: state === 0 ? sockets : [] };
}
function ValidateJsonPointerTemplate(gltfBlock, reservedSocketIds = /* @__PURE__ */ new Set()) {
  const pointer = gltfBlock.configuration?.pointer?.value?.[0];
  if (typeof pointer !== "string") {
    return { valid: false, error: "A pointer operation requires a string `pointer` configuration value" };
  }
  if (pointer.length !== 0 && pointer[0] !== "/") {
    return { valid: false, error: `The JSON Pointer Template "${pointer}" is not a syntactically valid JSON Pointer` };
  }
  const invalid = (reason) => ({ valid: false, error: `The JSON Pointer Template "${pointer}" is invalid: ${reason}` });
  const socketIds = /* @__PURE__ */ new Set();
  for (const segment of pointer.split("/")) {
    if (/~(?:[^01]|$)/.test(segment)) {
      return invalid(`the path segment "${segment}" contains an invalid RFC 6901 escape`);
    }
    const isIntegerParameter = segment[0] === "[" && segment[1] !== "[";
    const isReferenceParameter = segment[0] === "{" && segment[1] !== "{";
    if (!isIntegerParameter && !isReferenceParameter) {
      if (HasOddBracketRun(segment)) {
        return invalid(`the path segment "${segment}" contains an odd number of consecutive brackets`);
      }
      continue;
    }
    const closingBracket = isIntegerParameter ? "]" : "}";
    const body = segment.substring(1, segment.length - 1);
    if (segment.length < 3 || segment[segment.length - 1] !== closingBracket || /[[{]/.test(body) || /[\]}]/.test(body)) {
      return invalid(`the template parameter path segment "${segment}" is malformed`);
    }
    const socketId = body.replace(/~1/g, "/").replace(/~0/g, "~");
    if (reservedSocketIds.has(socketId)) {
      return invalid(`the template parameter "${socketId}" uses a reserved input socket id`);
    }
    if (socketIds.has(socketId)) {
      return invalid(`the template parameter "${socketId}" is used more than once`);
    }
    socketIds.add(socketId);
  }
  return { valid: true };
}
export {
  HasDefaultInteractivityFlowInput as H,
  NormalizeInteractivityEventDataConfiguration as N,
  ParseDebugLogTemplate as P,
  addNewInteractivityFlowGraphMapping as a,
  getNoOpMappingForDeclaration as b,
  getMappingForDeclaration as g
};
