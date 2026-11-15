import { A as AbstractAudioOutNode } from "./webAudioBaseSubGraph-BCodVyiC.js";
class AbstractAudioBus extends AbstractAudioOutNode {
  constructor(name, engine) {
    super(
      name,
      engine,
      3
      /* AudioNodeType.HAS_INPUTS_AND_OUTPUTS */
    );
  }
}
export {
  AbstractAudioBus as A
};
