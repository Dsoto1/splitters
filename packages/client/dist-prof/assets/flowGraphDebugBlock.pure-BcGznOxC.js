import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
const MAX_LOG_ENTRIES = 100;
class FlowGraphDebugBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.log = [];
    this._isDebug = true;
    this.input = this.registerDataInput("input", RichTypeAny);
    this.output = this.registerDataOutput("output", RichTypeAny);
  }
  /**
   * @internal
   */
  _updateOutputs(context) {
    const value = this.input.getValue(context);
    this.output.setValue(value, context);
    this._logValue(value);
  }
  /**
   * Format and store a value in the log.
   * @param value
   */
  _logValue(value) {
    if (value === null || value === void 0) {
      this.log.push(["null", "null"]);
    } else {
      const formatted = FlowGraphDebugBlock._FormatValue(value);
      this.log.push([formatted, String(value)]);
    }
    if (this.log.length > MAX_LOG_ENTRIES) {
      this.log.shift();
    }
  }
  /**
   * Type-aware value formatting.
   * @param value the value to format
   * @returns a human-readable string
   */
  static _FormatValue(value) {
    if (typeof value === "number") {
      return Number.isInteger(value) ? value.toString() : value.toFixed(4);
    }
    if (typeof value === "boolean" || typeof value === "string") {
      return String(value);
    }
    if (value && typeof value === "object") {
      if ("w" in value && "x" in value && "y" in value && "z" in value) {
        return `(${value.x.toFixed(3)}, ${value.y.toFixed(3)}, ${value.z.toFixed(3)}, ${value.w.toFixed(3)})`;
      }
      if ("z" in value && "x" in value && "y" in value) {
        return `(${value.x.toFixed(3)}, ${value.y.toFixed(3)}, ${value.z.toFixed(3)})`;
      }
      if ("x" in value && "y" in value) {
        return `(${value.x.toFixed(3)}, ${value.y.toFixed(3)})`;
      }
      if ("r" in value && "g" in value && "b" in value) {
        const a = "a" in value ? `, ${value.a.toFixed(3)}` : "";
        return `(${value.r.toFixed(3)}, ${value.g.toFixed(3)}, ${value.b.toFixed(3)}${a})`;
      }
      if (typeof value.toString === "function" && value.toString !== Object.prototype.toString) {
        return value.toString();
      }
    }
    try {
      const str = JSON.stringify(value);
      return str.length > 64 ? str.substring(0, 61) + "..." : str;
    } catch {
      return String(value);
    }
  }
  getClassName() {
    return "FlowGraphDebugBlock";
  }
}
let _Registered = false;
function RegisterFlowGraphDebugBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphDebugBlock", FlowGraphDebugBlock);
}
export {
  FlowGraphDebugBlock,
  RegisterFlowGraphDebugBlock
};
