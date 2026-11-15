import { F as FlowGraphUnaryOperationBlock } from "./flowGraphUnaryOperationBlock-DRlLg4AU.js";
import { b as RichTypeBoolean, d as RichTypeNumber, c as RichTypeFlowGraphInteger } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass, Y as FlowGraphInteger } from "./babylon-PnzH6wcM.js";
import "./flowGraphCachedOperationBlock-DbqCuriJ.js";
import "./flowGraphDelayRegistry-Bp1yNdjI.js";
class FlowGraphBooleanToFloat extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeBoolean, RichTypeNumber, (a) => +a, "FlowGraphBooleanToFloat", config);
  }
}
class FlowGraphBooleanToInt extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeBoolean, RichTypeFlowGraphInteger, (a) => FlowGraphInteger.FromValue(+a), "FlowGraphBooleanToInt", config);
  }
}
class FlowGraphFloatToBoolean extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeBoolean, (a) => !!a, "FlowGraphFloatToBoolean", config);
  }
}
class FlowGraphIntToBoolean extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeFlowGraphInteger, RichTypeBoolean, (a) => !!a.value, "FlowGraphIntToBoolean", config);
  }
}
class FlowGraphIntToFloat extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeFlowGraphInteger, RichTypeNumber, (a) => a.value, "FlowGraphIntToFloat", config);
  }
}
class FlowGraphFloatToInt extends FlowGraphUnaryOperationBlock {
  constructor(config) {
    super(RichTypeNumber, RichTypeFlowGraphInteger, (a) => {
      const roundingMode = config?.roundingMode;
      switch (roundingMode) {
        case "floor":
          return FlowGraphInteger.FromValue(Math.floor(a));
        case "ceil":
          return FlowGraphInteger.FromValue(Math.ceil(a));
        case "round":
          return FlowGraphInteger.FromValue(Math.round(a));
        default:
          return FlowGraphInteger.FromValue(a);
      }
    }, "FlowGraphFloatToInt", config);
  }
}
let _Registered = false;
function RegisterFlowGraphTypeToTypeBlocks() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphBooleanToFloat", FlowGraphBooleanToFloat);
  RegisterClass("FlowGraphBooleanToInt", FlowGraphBooleanToInt);
  RegisterClass("FlowGraphFloatToBoolean", FlowGraphFloatToBoolean);
  RegisterClass("FlowGraphIntToBoolean", FlowGraphIntToBoolean);
  RegisterClass("FlowGraphIntToFloat", FlowGraphIntToFloat);
  RegisterClass("FlowGraphFloatToInt", FlowGraphFloatToInt);
}
export {
  FlowGraphBooleanToFloat,
  FlowGraphBooleanToInt,
  FlowGraphFloatToBoolean,
  FlowGraphFloatToInt,
  FlowGraphIntToBoolean,
  FlowGraphIntToFloat,
  RegisterFlowGraphTypeToTypeBlocks
};
