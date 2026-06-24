import { IfcAPI } from 'web-ifc';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initIfcAPI, buildPropertiesMap, extractPosition } from './ifcUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_ELEMENTS = 0;

function getAllElements(ifcAPI, modelId, maxElements = 0) {
  const elementsMap = new Map();

  const limit = maxElements > 0 ? maxElements : MAX_ELEMENTS;
  const hasLimit = limit > 0; // Проверяем, есть ли вообще лимит

  try {
    const allLines = [...ifcAPI.GetAllLines(modelId)];

    let count = 0;
    for (const expressId of allLines) {
      const elementData = ifcAPI.GetLine(modelId, expressId);

      if (elementData && elementData.type !== -1) {
        elementsMap.set(expressId, {
          id: expressId,
          type: elementData.type,
          data: elementData
        });

        count++;

        if (hasLimit && count >= limit) {
          break;
        }
      }
    }
  } catch (e) {
    // Silent fail
  }

  return elementsMap;
}

function extractElementData(ifcAPI, element, modelId, propertiesMap) {
  try {
    const properties = propertiesMap.get(element.id) || {};
    const position = extractPosition(ifcAPI, modelId, element.id);

    return {
      id: element.id,
      type: element.type,
      name: element.data.Name?.value || '',
      position: position,
      properties: properties,
      typeCode: element.typeId
    };
  } catch (e) {
    return null;
  }
}

function getProperties(ifcAPI, expressId, modelId) {
  const properties = {};

  try {
    const allLines = [...ifcAPI.GetAllLines(modelId)];

    for (const lineId of allLines) {
      const line = ifcAPI.GetLine(modelId, lineId);

      if (!line || line.type !== 23) continue;

      if (!line.RelatedObjects || !line.RelatingPropertyDefinition) continue;

      let isRelated = false;
      for (let j = 0; j < line.RelatedObjects.length; j++) {
        if (line.RelatedObjects[j].oid === expressId) {
          isRelated = true;
          break;
        }
      }

      if (!isRelated) continue;

      const propertySet = line.RelatingPropertyDefinition;
      if (!propertySet || !propertySet.HasProperties) continue;

      const setName = propertySet.Name?.value || 'Unnamed';

      for (let j = 0; j < propertySet.HasProperties.length; j++) {
        const prop = propertySet.HasProperties[j];
        const propName = prop.Name?.value || 'Unnamed';
        const propNameFull = `${setName}.${propName}`;

        if (prop.NominalValue) {
          properties[propNameFull] = prop.NominalValue.value;
        }
      }
    }
  } catch (e) {
    // Silent fail
  }

  return properties;
}

async function extractIfc(filePath) {
  const ifcAPI = await initIfcAPI();

  const fileBuffer = fs.readFileSync(filePath);
  const ifcByteArray = new Uint8Array(fileBuffer);

  const modelId = ifcAPI.OpenModel(ifcByteArray);

  const structuralElements = [];
  const underlays = [];

  const elementsMap = getAllElements(ifcAPI, modelId, MAX_ELEMENTS);

  const propertiesMap = buildPropertiesMap(ifcAPI, modelId);

  let count = 0;
  for (const [expressId, element] of elementsMap) {
    const elementData = extractElementData(ifcAPI, element, modelId, propertiesMap);

    if (!elementData) {
      continue;
    }

    structuralElements.push(elementData);

    count++;
  }

  ifcAPI.CloseModel(modelId);


  return {
    structuralElements,
    underlays
  };
}

export { extractIfc, getAllElements, extractElementData, getProperties };
