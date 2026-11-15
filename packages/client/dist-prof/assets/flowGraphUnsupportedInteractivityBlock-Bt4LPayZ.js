import { a as FlowGraphExecutionBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { g as getRichTypeByFlowGraphType, n as FlowGraphMatrix3D, F as FlowGraphMatrix2D } from "./flowGraphRichTypes-B7BqVpav.js";
import { M as Matrix, a1 as Vector4, V as Vector3, a0 as Vector2, Y as FlowGraphInteger } from "./babylon-PnzH6wcM.js";
function _GetDefaultValue(signature) {
  switch (signature) {
    case "bool":
      return false;
    case "int":
      return new FlowGraphInteger(0);
    case "float":
      return NaN;
    case "float2":
      return new Vector2(NaN, NaN);
    case "float3":
      return new Vector3(NaN, NaN, NaN);
    case "float4":
      return new Vector4(NaN, NaN, NaN, NaN);
    case "float2x2":
      return new FlowGraphMatrix2D([NaN, NaN, NaN, NaN]);
    case "float3x3":
      return new FlowGraphMatrix3D([NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN]);
    case "float4x4":
      return Matrix.FromArray([NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN]);
    case "ref":
      return "";
    default:
      return void 0;
  }
}
class FlowGraphUnsupportedInteractivityBlock extends FlowGraphExecutionBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this._unregisterSignalInput("in");
    this._unregisterSignalOutput("error");
    for (const socket of config.inputValueSockets ?? []) {
      this.registerDataInput(socket.name, getRichTypeByFlowGraphType(socket.type));
    }
    for (const socket of config.outputValueSockets ?? []) {
      this.registerDataOutput(socket.name, getRichTypeByFlowGraphType(socket.type), _GetDefaultValue(socket.signature));
    }
    for (const socket of config.inputFlowSockets ?? []) {
      this._registerSignalInput(socket);
    }
    for (const socket of config.outputFlowSockets ?? []) {
      this._registerSignalOutput(socket);
    }
  }
  /** @internal */
  _execute(_context, _callingSignal) {
  }
  /** @returns the serialized class name */
  getClassName() {
    return "FlowGraphUnsupportedInteractivityBlock";
  }
}
export {
  FlowGraphUnsupportedInteractivityBlock
};
