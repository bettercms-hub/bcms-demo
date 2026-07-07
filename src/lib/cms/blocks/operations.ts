/**
 * Pure helpers for navigating and mutating a Block tree.
 * Blocks are addressed by `path` — a numeric index array starting at the
 * section's root children (e.g. [0, 2, 1] = section.blocks[0].children[2].children[1]).
 */
import { BLOCK_REGISTRY, type Block, type BlockKind, isContainer, newBlockId } from "./registry";

export type BlockPath = number[];

export function pathKey(path: BlockPath): string {
  return path.join(".");
}

export function findBlock(blocks: Block[], path: BlockPath): Block | undefined {
  if (path.length === 0) return undefined;
  let cur: Block | undefined = blocks[path[0]];
  for (let i = 1; i < path.length && cur; i++) {
    cur = cur.children?.[path[i]];
  }
  return cur;
}

export function findParent(
  blocks: Block[],
  path: BlockPath,
): { parent: Block[] | null; index: number } {
  if (path.length === 0) return { parent: null, index: -1 };
  if (path.length === 1) return { parent: blocks, index: path[0] };
  let cur: Block = blocks[path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    cur = cur.children![path[i]];
  }
  return { parent: cur.children ?? [], index: path[path.length - 1] };
}

/** Make a fresh block (and its initial children, if any) from a kind. */
export function createBlock(kind: BlockKind): Block {
  const def = BLOCK_REGISTRY[kind];
  if (!def) throw new Error(`Unknown block kind: ${kind}`);
  const block: Block = {
    id: newBlockId(),
    kind,
    props: def.defaults(),
  };
  if (isContainer(kind)) {
    block.children = def.initialChildren ? def.initialChildren() : [];
  }
  return block;
}

/** Immutable transform helpers — they return a new tree. */

function clone(blocks: Block[]): Block[] {
  return blocks.map((b) => ({
    ...b,
    props: { ...b.props },
    children: b.children ? clone(b.children) : undefined,
  }));
}

export function addBlock(
  blocks: Block[],
  parentPath: BlockPath, // [] = root
  kind: BlockKind,
  atIndex?: number,
): { blocks: Block[]; newPath: BlockPath } {
  const next = clone(blocks);
  const block = createBlock(kind);
  if (parentPath.length === 0) {
    const idx = atIndex ?? next.length;
    next.splice(idx, 0, block);
    return { blocks: next, newPath: [idx] };
  }
  const target = findBlock(next, parentPath);
  if (!target) return { blocks: next, newPath: parentPath };
  if (!target.children) target.children = [];
  const idx = atIndex ?? target.children.length;
  target.children.splice(idx, 0, block);
  return { blocks: next, newPath: [...parentPath, idx] };
}

export function removeBlock(blocks: Block[], path: BlockPath): Block[] {
  if (path.length === 0) return blocks;
  const next = clone(blocks);
  const { parent, index } = findParent(next, path);
  if (!parent) return blocks;
  parent.splice(index, 1);
  return next;
}

export function updateBlockProps(
  blocks: Block[],
  path: BlockPath,
  patch: Record<string, unknown>,
): Block[] {
  const next = clone(blocks);
  const target = findBlock(next, path);
  if (!target) return blocks;
  target.props = { ...target.props, ...patch };
  return next;
}

export function duplicateBlock(
  blocks: Block[],
  path: BlockPath,
): { blocks: Block[]; newPath: BlockPath } {
  if (path.length === 0) return { blocks, newPath: path };
  const next = clone(blocks);
  const { parent, index } = findParent(next, path);
  if (!parent) return { blocks, newPath: path };
  const original = parent[index];
  const copy = reIdDeep(original);
  parent.splice(index + 1, 0, copy);
  return {
    blocks: next,
    newPath: [...path.slice(0, -1), index + 1],
  };
}

function reIdDeep(b: Block): Block {
  return {
    ...b,
    id: newBlockId(),
    props: { ...b.props },
    children: b.children ? b.children.map(reIdDeep) : undefined,
  };
}

/** Move a block up/down within its current parent. Returns the new path. */
export function moveBlock(
  blocks: Block[],
  path: BlockPath,
  delta: -1 | 1,
): { blocks: Block[]; newPath: BlockPath } {
  if (path.length === 0) return { blocks, newPath: path };
  const next = clone(blocks);
  const { parent, index } = findParent(next, path);
  if (!parent) return { blocks, newPath: path };
  const j = index + delta;
  if (j < 0 || j >= parent.length) return { blocks, newPath: path };
  [parent[index], parent[j]] = [parent[j], parent[index]];
  return { blocks: next, newPath: [...path.slice(0, -1), j] };
}

/** Insert an existing (pre-built) block at parentPath + atIndex. */
export function insertBlockAt(
  blocks: Block[],
  parentPath: BlockPath,
  atIndex: number,
  block: Block,
): { blocks: Block[]; newPath: BlockPath } {
  const next = clone(blocks);
  if (parentPath.length === 0) {
    const idx = Math.max(0, Math.min(atIndex, next.length));
    next.splice(idx, 0, block);
    return { blocks: next, newPath: [idx] };
  }
  const target = findBlock(next, parentPath);
  if (!target) return { blocks, newPath: parentPath };
  if (!target.children) target.children = [];
  const idx = Math.max(0, Math.min(atIndex, target.children.length));
  target.children.splice(idx, 0, block);
  return { blocks: next, newPath: [...parentPath, idx] };
}

/** True when `to` path lies inside (or equals) `from`'s subtree — would create a cycle. */
function isDescendantOrSelf(from: BlockPath, to: BlockPath): boolean {
  if (to.length < from.length) return false;
  for (let i = 0; i < from.length; i++) if (to[i] !== from[i]) return false;
  return true;
}

/**
 * Move a block to an arbitrary destination (cross-parent supported).
 * `to` is the *insertion path*: to.slice(0,-1) = target parent, to.at(-1) = index.
 */
export function moveBlockTo(
  blocks: Block[],
  from: BlockPath,
  to: BlockPath,
): { blocks: Block[]; newPath: BlockPath } {
  if (from.length === 0 || to.length === 0) return { blocks, newPath: from };
  const targetParentPath = to.slice(0, -1);
  // Cycle guard: cannot drop a node into itself or its own subtree.
  if (isDescendantOrSelf(from, targetParentPath) || isDescendantOrSelf(from, to)) {
    return { blocks, newPath: from };
  }

  const source = findBlock(blocks, from);
  if (!source) return { blocks, newPath: from };
  // Deep-clone the source so we don't share references.
  const sourceCopy: Block = JSON.parse(JSON.stringify(source));

  // Step 1: remove source.
  let next = removeBlock(blocks, from);

  // Step 2: adjust target index when the removal affected it.
  const sourceParentPath = from.slice(0, -1);
  const sourceIndex = from[from.length - 1];
  let targetIndex = to[to.length - 1];
  const sameParent =
    sourceParentPath.length === targetParentPath.length &&
    sourceParentPath.every((v, i) => v === targetParentPath[i]);
  if (sameParent && sourceIndex < targetIndex) targetIndex -= 1;

  // Step 3: insert at adjusted position.
  const result = insertBlockAt(next, targetParentPath, targetIndex, sourceCopy);
  return result;
}


/** Wrap an existing block in a new container (e.g. wrap selection in Container). */
export function wrapBlock(
  blocks: Block[],
  path: BlockPath,
  wrapperKind: BlockKind,
): { blocks: Block[]; newPath: BlockPath } {
  if (path.length === 0 || !isContainer(wrapperKind)) {
    return { blocks, newPath: path };
  }
  const next = clone(blocks);
  const { parent, index } = findParent(next, path);
  if (!parent) return { blocks, newPath: path };
  const original = parent[index];
  const wrapper: Block = {
    id: newBlockId(),
    kind: wrapperKind,
    props: BLOCK_REGISTRY[wrapperKind].defaults(),
    children: [original],
  };
  parent[index] = wrapper;
  return { blocks: next, newPath: [...path.slice(0, -1), index, 0] };
}

/**
 * Swap a block's `kind` in place, preserving its id (so selection stays
 * stable). Props are reset to the new kind's defaults, then `patch` is
 * applied on top. Children are kept iff both old and new kinds are
 * containers; otherwise dropped.
 */
export function transformBlock(
  blocks: Block[],
  path: BlockPath,
  nextKind: BlockKind,
  patch: Record<string, unknown> = {},
): Block[] {
  if (path.length === 0) return blocks;
  const def = BLOCK_REGISTRY[nextKind];
  if (!def) return blocks;
  const next = clone(blocks);
  const target = findBlock(next, path);
  if (!target) return blocks;
  const keepChildren = isContainer(target.kind) && isContainer(nextKind);
  target.kind = nextKind;
  target.props = { ...def.defaults(), ...patch };
  if (keepChildren) {
    // children already cloned
  } else {
    delete target.children;
    if (isContainer(nextKind)) {
      target.children = def.initialChildren ? def.initialChildren() : [];
    }
  }
  return next;
}

