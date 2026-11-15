import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import { Y as FlowGraphInteger } from "./babylon-PnzH6wcM.js";
import { D as DelayReferencePrefix } from "./KHR_interactivity.pure-C16ycFL3.js";
import "./declarationMapper-Hl5Q9jGZ.js";
class FlowGraphDelayReferenceBlock extends FlowGraphBlock {
  constructor(config) {
    super(config);
    this.config = config;
    this.input = this.registerDataInput("input", RichTypeAny);
    this.value = this.registerDataOutput("value", RichTypeAny, config.decode ? new FlowGraphInteger(-1) : "");
  }
  /** @internal */
  _updateOutputs(context) {
    const input = this.input.getValue(context);
    if (this.config.decode) {
      let index = -1;
      if (input instanceof FlowGraphInteger) {
        index = input.value;
      } else if (typeof input === "string" && input.startsWith(DelayReferencePrefix)) {
        const tail = input.substring(DelayReferencePrefix.length);
        if (/^(0|[1-9]\d*)$/.test(tail)) {
          const parsed = Number(tail);
          if (Number.isSafeInteger(parsed) && parsed <= 2147483647) {
            index = parsed;
          }
        }
      }
      this.value.setValue(new FlowGraphInteger(index), context);
    } else {
      const index = input instanceof FlowGraphInteger ? input.value : -1;
      this.value.setValue(index < 0 ? "" : DelayReferencePrefix + index, context);
    }
  }
  /** @returns the serialized class name */
  getClassName() {
    return "FlowGraphDelayReferenceBlock";
  }
}
export {
  FlowGraphDelayReferenceBlock
};
