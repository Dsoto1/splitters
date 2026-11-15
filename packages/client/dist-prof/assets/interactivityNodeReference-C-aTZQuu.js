const _NodeSets = /* @__PURE__ */ new WeakMap();
const _Hoverable = /* @__PURE__ */ new WeakMap();
const _Selectable = /* @__PURE__ */ new WeakMap();
function _GetStateMap(state) {
  return state === "selectable" ? _Selectable : _Hoverable;
}
function _GetLocalState(node, state) {
  return _GetStateMap(state).get(node) ?? true;
}
function _GetEffectiveState(node, state) {
  let current = node;
  while (current) {
    if (!_GetLocalState(current, state)) {
      return false;
    }
    current = current.parent;
  }
  return true;
}
function _ApplyMeshState(mesh, state, value) {
  if (state === "selectable") {
    mesh.isPickable = value;
  } else {
    mesh._isPointerMovePickable = value;
  }
}
function _ApplyNodeState(node, state) {
  const effective = _GetEffectiveState(node, state);
  const meshes = node._primitiveBabylonMeshes ?? [];
  for (const mesh of meshes) {
    _ApplyMeshState(mesh, state, effective);
  }
  const transformNode = node._babylonTransformNode;
  if (transformNode && "isPickable" in transformNode) {
    _ApplyMeshState(transformNode, state, effective);
  }
}
function _IsDescendantNode(node, ancestor) {
  let current = node;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = current.parent;
  }
  return false;
}
function InitializeInteractivityNodeState(nodes, state, getAuthoredState) {
  const stateMap = _GetStateMap(state);
  for (const node of nodes) {
    _NodeSets.set(node, nodes);
    stateMap.set(node, getAuthoredState(node) ?? true);
  }
  for (const node of nodes) {
    _ApplyNodeState(node, state);
  }
}
function GetInteractivityNodeState(node, state) {
  return _GetLocalState(node, state);
}
function SetInteractivityNodeState(node, state, value) {
  _GetStateMap(state).set(node, value);
  const nodes = _NodeSets.get(node) ?? [node];
  for (const candidate of nodes) {
    if (_IsDescendantNode(candidate, node)) {
      _ApplyNodeState(candidate, state);
    }
  }
}
function GetInteractivityNodeRuntimeReference(node) {
  const runtimeNode = node?._babylonTransformNode;
  return {
    className: runtimeNode?.getClassName(),
    id: runtimeNode?.id,
    uniqueId: runtimeNode?.uniqueId
  };
}
export {
  GetInteractivityNodeRuntimeReference as G,
  InitializeInteractivityNodeState as I,
  SetInteractivityNodeState as S,
  GetInteractivityNodeState as a
};
