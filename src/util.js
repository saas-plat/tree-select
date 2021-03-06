import warning from 'warning';
import {
  SHOW_CHILD,
  SHOW_PARENT
} from './strategies';

// When treeNode not provide key, and we will use value as key.
// Some time value is empty, we should pass it instead.
const KEY_OF_VALUE_EMPTY = 'RC_TREE_SELECT_KEY_OF_VALUE_EMPTY';

let warnDeprecatedLabel = false;

// =================== MISC ====================
export function toTitle(title) {
  if (typeof title === 'string') {
    return title;
  }
  return null;
}

export function toArray(data) {
  if (!data) return [];

  return Array.isArray(data) ? data : [data];
}

// Shallow copy of React 16.3 createRef api
export function createRef() {
  const func = function setRef(node) {
    func.current = node;
  };
  return func;
}

// =============== Legacy ===============
export const UNSELECTABLE_STYLE = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
};

export const UNSELECTABLE_ATTRIBUTE = {
  unselectable: 'unselectable',
};

/**
 * Convert position list to hierarchy structure.
 * This is little hack since use '-' to split the position.
 */
export function flatToHierarchy(positionList) {
  if (!positionList.length) {
    return [];
  }

  const entrances = {};

  // Prepare the position map
  const posMap = {};
  const parsedList = positionList.slice().map(entity => {
    const clone = {
      ...entity,
      fields: entity.pos.split('-'),
    };
    return clone;
  });

  parsedList.forEach((entity) => {
    posMap[entity.pos] = entity;
  });

  parsedList.sort((a, b) => {
    return a.fields.length - b.fields.length;
  });

  // Create the hierarchy
  parsedList.forEach((entity) => {
    const parentPos = entity.fields.slice(0, -1).join('-');
    const parentEntity = posMap[parentPos];

    if (!parentEntity) {
      entrances[entity.pos] = entity;
    } else {
      parentEntity.children = parentEntity.children || [];
      parentEntity.children.push(entity);
    }

    // Some time position list provide `key`, we don't need it
    delete entity.key;
    delete entity.fields;
  });

  return Object.keys(entrances).map(key => entrances[key]);
}

// =============== Accessibility ===============
let ariaId = 0;

export function resetAriaId() {
  ariaId = 0;
}

export function generateAriaId(prefix) {
  ariaId += 1;
  return `${prefix}_${ariaId}`;
}

export function isLabelInValue(props) {
  const {
    rowCheckable,
    rowCheckStrictly,
    labelInValue
  } = props;
  if (rowCheckable && rowCheckStrictly) {
    return true;
  }
  return labelInValue || false;
}

// =================== Tree ====================
export function parseSimpleTreeData(tableData, {
  id,
  pId,
  rootPId
}) {
  const keyNodes = {};
  const rootRowList = [];

  // Fill in the map
  const dataList = tableData.map((data) => {
    const clone = { ...data
    };
    const key = clone[id];
    keyNodes[key] = clone;
    return clone;
  });

  // Connect tree
  dataList.forEach((data) => {
    const parentKey = data[pId];
    const parent = keyNodes[parentKey];

    // Fill parent
    if (parent) {
      parent.children = parent.children || [];
      parent.children.push(data);
    }

    // Fill root tree data
    if (parentKey === rootPId || (!parent && rootPId === null)) {
      rootRowList.push(data);
    }
  });

  return rootRowList;
}

/**
 * Convert `tableData` to TreeNode List contains the mapping data.
 */
export function convertDataToEntities(tableData) {
  const list = toArray(tableData);

  const valueEntities = {};
  const keyEntities = {};
  const posEntities = {};

  function traverse(subTreeData, parentPos) {
    const subList = toArray(subTreeData);

    return subList.forEach(({
      key,
      title,
      label,
      value
    }, index) => {
      const pos = `${parentPos}-${index}`;

      const entity = {
        key,
        value,
        pos
      };

      // This may cause some side effect, need additional check
      entity.key = entity.key || value;
      if (!entity.key && entity.key !== 0) {
        entity.key = KEY_OF_VALUE_EMPTY;
      }

      // Fill children
      entity.parent = posEntities[parentPos];
      if (entity.parent) {
        entity.parent.children = entity.parent.children || [];
        entity.parent.children.push(entity);
      }

      // Fill entities
      valueEntities[value] = entity;
      keyEntities[entity.key] = entity;
      posEntities[pos] = entity;

      // Warning user not to use deprecated label prop.
      if ((!title && label) && !warnDeprecatedLabel) {
        warning(
          false,
          '\'label\' in tableData is deprecated. Please use \'title\' instead.'
        );
        warnDeprecatedLabel = true;
      }

    });
  }

  traverse(list, '0');

  return {
    data: tableData,
    valueEntities,
    keyEntities,
    posEntities,
  };
}

/**
 * Detect if position has relation.
 * e.g. 1-2 related with 1-2-3
 * e.g. 1-3-2 related with 1
 * e.g. 1-2 not related with 1-21
 */
export function isPosRelated(pos1, pos2) {
  const fields1 = pos1.split('-');
  const fields2 = pos2.split('-');

  const minLen = Math.min(fields1.length, fields2.length);
  for (let i = 0; i < minLen; i += 1) {
    if (fields1[i] !== fields2[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Get a filtered TreeNode list by provided dataSource.
 * [Legacy] Since `Tree` use `key` as map but `key` will changed by React,
 * we have to convert `dataSource > data > dataSource` to keep the key.
 * Such performance hungry!
 */
export function getFilterTable(data, searchValue, filterFunc) {
  if (!searchValue) {
    return null;
  }

  function mapFilteredData(row) {
    if (!row) return null;

    let match = false;
    if (filterFunc(searchValue, row)) {
      match = true;
    }

    const children = (row.children || []).map(mapFilteredData).filter(n => n);

    if (children.length || match) {
      return {
        ...row,
        key: row.key,
        children,
      };
    }

    return null;
  }

  return convertDataToEntities(
    data.map(mapFilteredData).filter(row => row)
  ).data;
}

// =================== Value ===================
/**
 * Convert value to array format to make logic simplify.
 */
export function formatInternalValue(value, props) {
  const valueList = toArray(value);

  // Parse label in value
  if (isLabelInValue(props)) {
    return valueList.map((val) => {
      if (typeof val !== 'object' || !val) {
        return {
          value: null,
          label: '',
        };
      }

      return val;
    });
  }

  return valueList.map(val => ({
    value: val,
  }));
}

export function getLabel(wrappedValue, entity, rowLabelProp) {
  if (wrappedValue.label) {
    return wrappedValue.label;
  }

  if (entity && entity.value) {
    return entity.value[rowLabelProp];
  }

  // Since value without entity will be in missValueList.
  // This code will never reached, but we still need this in case.
  return wrappedValue.value;
}

/**
 * Convert internal state `valueList` to user needed value list.
 * This will return an array list. You need check if is not multiple when return.
 *
 * `allCheckedNodes` is used for `rowCheckStrictly`
 */
export function formatSelectorValue(valueList, props, valueEntities) {
  const {
    rowLabelProp,
    rowCheckable,
    rowCheckStrictly,
    showCheckedStrategy,
  } = props;

  // Will hide some value if `showCheckedStrategy` is set
  if (rowCheckable && !rowCheckStrictly) {
    const values = {};
    valueList.forEach((wrappedValue) => {
      values[wrappedValue.value] = wrappedValue;
    });
    const hierarchyList = flatToHierarchy(valueList.map(({
      value
    }) => valueEntities[value]));

    if (showCheckedStrategy === SHOW_PARENT) {
      // Only get the parent checked value
      return hierarchyList.map(({
        value
      }) => ({
        label: getLabel(values[value], valueEntities[value], rowLabelProp),
        value,
      }));

    } else if (showCheckedStrategy === SHOW_CHILD) {
      // Only get the children checked value
      const targetValueList = [];

      // Find the leaf children
      const traverse = ({
        value,
        children
      }) => {
        if (!children || children.length === 0) {
          targetValueList.push({
            label: getLabel(values[value], valueEntities[value], rowLabelProp),
            value,
          });
          return;
        }

        children.forEach((entity) => {
          traverse(entity);
        });
      };

      hierarchyList.forEach((entity) => {
        traverse(entity);
      });

      return targetValueList;
    }
  }

  return valueList.map(wrappedValue => ({
    label: getLabel(wrappedValue, valueEntities[wrappedValue.value], rowLabelProp),
    value: wrappedValue.value,
  }));
}

/**
 * When user search the tree, will not get correct tree checked status.
 * For checked key, use the `rc-tree` `calcCheckStateConduct` function.
 * For unchecked key, we need the calculate ourselves.
 */
export function calcUncheckConduct(keyList, uncheckedKey, keyEntities) {
  let myKeyList = keyList.slice();

  function conductUp(conductKey) {
    myKeyList = myKeyList.filter(key => key !== conductKey);

    // Check if need conduct
    const parentEntity = keyEntities[conductKey].parent;
    if (parentEntity && myKeyList.some(key => key === parentEntity.key)) {
      conductUp(parentEntity.key);
    }
  }

  function conductDown(conductKey) {
    myKeyList = myKeyList.filter(key => key !== conductKey);

    (keyEntities[conductKey].children || []).forEach((childEntity) => {
      conductDown(childEntity.key);
    });
  }

  conductUp(uncheckedKey);
  conductDown(uncheckedKey);

  return myKeyList;
}

export function calcCheckStateConduct(keyEntities, posEntities, checkedKeys) {
  const tgtCheckedKeys = {};
  const tgtHalfCheckedKeys = {};

  // Conduct up
  function conductUp(key, halfChecked) {
    if (tgtCheckedKeys[key]) return;

    const _keyNodes$key = keyEntities[key];
    const _keyNodes$key$subNode = _keyNodes$key.children;
    const subNodes = _keyNodes$key$subNode === undefined ? [] : _keyNodes$key$subNode;
    const parentPos = _keyNodes$key.parent.pos;

    const allSubChecked = !halfChecked && subNodes.every((sub) => {
      return tgtCheckedKeys[sub.key];
    });

    if (allSubChecked) {
      tgtCheckedKeys[key] = true;
    } else {
      tgtHalfCheckedKeys[key] = true;
    }

    if (parentPos !== null) {
      conductUp(posEntities[parentPos].key, !allSubChecked);
    }
  }

  // Conduct down
  function conductDown(key) {
    if (tgtCheckedKeys[key]) return;
    const _keyNodes$key2 = keyEntities[key];
    const _keyNodes$key2$subNod = _keyNodes$key2.children;
    const subNodes = _keyNodes$key2$subNod === undefined ? [] : _keyNodes$key2$subNod;

    tgtCheckedKeys[key] = true;

    subNodes.forEach((sub) => {
      conductDown(sub.key);
    });
  }

  function conduct(key) {
    if (!keyEntities[key]) {
      warning(false, `${key} does not exist in the table tree.`);
      return;
    }

    const _keyNodes$key3 = keyEntities[key];
    const _keyNodes$key3$subNod = _keyNodes$key3.children;
    const subNodes = _keyNodes$key3$subNod === undefined ? [] : _keyNodes$key3$subNod;
    const parentPos = _keyNodes$key3.parent.pos;

    tgtCheckedKeys[key] = true;

    // Conduct down
    subNodes.forEach((sub) => {
      conductDown(sub.key);
    });

    // Conduct up
    if (parentPos !== null) {
      conductUp(posEntities[parentPos].key);
    }
  }

  checkedKeys.forEach((key) => {
    conduct(key);
  });

  return Object.keys(tgtCheckedKeys);
}
