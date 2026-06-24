import { IfcAPI } from 'web-ifc';
import { join } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

export async function initIfcAPI() {
  const projectRoot = join(__dirname, '../..');
  const wasmPath = join(projectRoot, 'node_modules', 'web-ifc', 'web-ifc-node.wasm');
  const wasmUrl = 'file://' + wasmPath;

  if (!existsSync(wasmPath)) {
    throw new Error(`WASM файл не найден: ${wasmPath}`);
  }

  const ifcAPI = new IfcAPI();
  await ifcAPI.Init(() => wasmUrl);

  return ifcAPI;
}

export function buildPropertiesMap(ifcAPI, modelId) {
  const propertiesMap = new Map();

  try {
    const allLines = [...ifcAPI.GetAllLines(modelId)];

    for (const expressId of allLines) {
      const line = ifcAPI.GetLine(modelId, expressId);

      if (!line || !line.RelatedObjects || !line.RelatingPropertyDefinition) {
        continue;
      }

      if (!line.RelatingPropertyDefinition) {
        continue;
      }

      const propSetHandle = line.RelatingPropertyDefinition;
      const propSetLine = ifcAPI.GetLine(modelId, propSetHandle.value);

      if (!propSetLine || !propSetLine.HasProperties) {
        continue;
      }

      const setName = propSetLine.Name?.value || 'Unnamed';

      for (let j = 0; j < line.RelatedObjects.length; j++) {
        const relatedObject = line.RelatedObjects[j];
        const relatedExpressId = relatedObject.value;

        if (!relatedExpressId) continue;

        let elementProps = propertiesMap.get(relatedExpressId);
        if (!elementProps) {
          elementProps = {};
          propertiesMap.set(relatedExpressId, elementProps);
        }

        for (let k = 0; k < propSetLine.HasProperties.length; k++) {
          const propHandle = propSetLine.HasProperties[k];
          const propLine = ifcAPI.GetLine(modelId, propHandle.value);

          const propName = propLine.Name?.value || 'Unnamed';
          const propNameFull = `${setName}.${propName}`;

          if (propLine.NominalValue && propLine.NominalValue.value !== undefined) {
            elementProps[propNameFull] = propLine.NominalValue.value;
          }
        }
      }
    }
  } catch (e) {
    // Silent fail
  }

  return propertiesMap;
}

export function extractPosition(ifcAPI, modelId, expressId) {
  try {
    const element = ifcAPI.GetLine(modelId, expressId);
    if (!element || !element.ObjectPlacement) {
      return { x: 0, y: 0, z: 0 };
    }

    const placementId = element.ObjectPlacement.value;
    if (!placementId) {
      return { x: 0, y: 0, z: 0 };
    }

    let totalX = 0;
    let totalY = 0;
    let totalZ = 0;

    let currentPlacementId = placementId;
    const MAX_DEPTH = 10;
    let depth = 0;

    while (currentPlacementId && depth < MAX_DEPTH) {
      const placement = ifcAPI.GetLine(modelId, currentPlacementId);
      if (!placement) {
        break;
      }

      let coords = null;

      if (placement.RelativePlacement) {
        const relPlacement = ifcAPI.GetLine(modelId, placement.RelativePlacement.value);

        if (relPlacement?.Location) {
          const location = ifcAPI.GetLine(modelId, relPlacement.Location.value);
          if (location?.Coordinates) {
            coords = location.Coordinates;
          }
        }
      } else if (placement.Location?.Coordinates) {
        coords = placement.Location.Coordinates;
      }

      if (coords) {
        totalX += Number(coords[0].value) || 0;
        totalY += Number(coords[1].value) || 0;
        totalZ += Number(coords[2].value) || 0;
      }

      if (placement.PlacementRelTo) {
        currentPlacementId = placement.PlacementRelTo.value;
      } else {
        break;
      }

      depth++;
    }

    return { x: totalX, y: totalY, z: totalZ };
  } catch (e) {
    return { x: 0, y: 0, z: 0 };
  }
}
