import { d as BezierCurveEase } from "./easing-CT5FBt-r.js";
import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { d as RichTypeNumber, f as RichTypeVector2, R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { z as RegisterClass } from "./babylon-PnzH6wcM.js";
function _SolveCssCubicBezier(t, x1, y1, x2, y2) {
  if (t <= 0) {
    return 0;
  }
  if (t >= 1) {
    return 1;
  }
  const fx0 = 1 - 3 * x2 + 3 * x1;
  const fx1 = 3 * x2 - 6 * x1;
  const fx2 = 3 * x1;
  let lowerBound = 0;
  let upperBound = 1;
  let u = t;
  for (let i = 0; i < 8; i++) {
    const u2 = u * u;
    const u3 = u2 * u;
    const x = fx0 * u3 + fx1 * u2 + fx2 * u;
    const error = x - t;
    if (Math.abs(error) < 1e-7) {
      break;
    }
    if (error > 0) {
      upperBound = u;
    } else {
      lowerBound = u;
    }
    const derivative = 3 * fx0 * u2 + 2 * fx1 * u + fx2;
    const newtonU = Math.abs(derivative) > 1e-7 ? u - error / derivative : NaN;
    u = Number.isFinite(newtonU) && newtonU > lowerBound && newtonU < upperBound ? newtonU : (lowerBound + upperBound) * 0.5;
  }
  const fy0 = 1 - 3 * y2 + 3 * y1;
  const fy1 = 3 * y2 - 6 * y1;
  const fy2 = 3 * y1;
  return fy0 * u * u * u + fy1 * u * u + fy2 * u;
}
class InteractivityBezierCurveEase extends BezierCurveEase {
  easeInCore(gradient) {
    return _SolveCssCubicBezier(gradient, this.x1, this.y1, this.x2, this.y2);
  }
}
class FlowGraphBezierCurveEasingBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this._easingFunctions = {};
    this.mode = this.registerDataInput("mode", RichTypeNumber, 0);
    this.controlPoint1 = this.registerDataInput("controlPoint1", RichTypeVector2);
    this.controlPoint2 = this.registerDataInput("controlPoint2", RichTypeVector2);
    this.easingFunction = this.registerDataOutput("easingFunction", RichTypeAny);
  }
  _updateOutputs(context) {
    const mode = this.mode.getValue(context);
    const controlPoint1 = this.controlPoint1.getValue(context);
    const controlPoint2 = this.controlPoint2.getValue(context);
    if (mode === void 0) {
      return;
    }
    const key = `${mode}-${controlPoint1.x}-${controlPoint1.y}-${controlPoint2.x}-${controlPoint2.y}`;
    if (!this._easingFunctions[key]) {
      const easing = new InteractivityBezierCurveEase(controlPoint1.x, controlPoint1.y, controlPoint2.x, controlPoint2.y);
      easing.setEasingMode(mode);
      this._easingFunctions[key] = easing;
    }
    this.easingFunction.setValue(this._easingFunctions[key], context);
  }
  getClassName() {
    return "FlowGraphBezierCurveEasing";
  }
}
let _Registered = false;
function RegisterFlowGraphBezierCurveEasingBlock() {
  if (_Registered) {
    return;
  }
  _Registered = true;
  RegisterClass("FlowGraphBezierCurveEasing", FlowGraphBezierCurveEasingBlock);
}
export {
  FlowGraphBezierCurveEasingBlock,
  RegisterFlowGraphBezierCurveEasingBlock
};
