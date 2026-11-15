import { c as FlowGraphBlock } from "./flowGraphDelayRegistry-Bp1yNdjI.js";
import { R as RichTypeAny } from "./flowGraphRichTypes-B7BqVpav.js";
import "./babylon-PnzH6wcM.js";
class FlowGraphGLTFDataProvider extends FlowGraphBlock {
  constructor(config = {}) {
    super(config);
    const glTF = config.glTF;
    const animationGroups = glTF?.animations?.map((a) => a._babylonAnimationGroup) || [];
    this.animationGroups = this.registerDataOutput("animationGroups", RichTypeAny, animationGroups);
    const nodes = glTF?.nodes?.map((n) => n._babylonTransformNode) || [];
    this.nodes = this.registerDataOutput("nodes", RichTypeAny, nodes);
  }
  getClassName() {
    return "FlowGraphGLTFDataProvider";
  }
}
export {
  FlowGraphGLTFDataProvider
};
