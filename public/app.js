import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let currentModelGroup = null;
let resizeObserver = null;

let isRendering = true;

let meshIndex = new Map();
let highlightedMesh = null;
let originalMaterial = null;

function showPreloader(message = 'Загрузка модулей...') {
  const preloader = document.getElementById('preloader');
  const text = document.getElementById('preloader-text');
  if (preloader && text) {
    text.textContent = message;
    preloader.classList.remove('hidden');
  }
}

function updatePreloaderProgress(text, progress = '') {
  const textEl = document.getElementById('preloader-text');
  const progressEl = document.getElementById('preloader-progress');
  if (textEl) textEl.textContent = text;
  if (progressEl) progressEl.textContent = progress;
}

function hidePreloader() {
  const preloader = document.getElementById('preloader');
  if (preloader) preloader.classList.add('hidden');
}

const viewerContainer = document.getElementById('viewer-container');
const gridContainer = document.getElementById('grid-container');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');

let dataRows = [];
let gridApi = null;
let gridOptions = null;
let currentModelId = null;
let isPaginationLoading = false;
let isChangingPageSize = false;
let resetCameraBtn = null;
let toggleAllBtn = null;

let isUploading = false;
let statusMessageEl = null;
let progressBarEl = null;

function createStatusElement() {
  const existing = document.getElementById('upload-status');
  if (existing) return existing;
  
  const statusEl = document.createElement('div');
  statusEl.id = 'upload-status';
  statusEl.className = 'px-4 py-2 bg-blue-50 border-b border-blue-200';
  statusEl.innerHTML = `
    <div class="flex items-center gap-3 text-sm text-slate-700">
      <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span id="status-text">Готов к загрузке</span>
    </div>
    <div id="progress-bar" class="w-full h-1 bg-slate-200 mt-2 rounded overflow-hidden hidden">
      <div id="progress-fill" class="h-full bg-blue-500 transition-all duration-300" style="width: 0%"></div>
    </div>
  `;
  
  const header = document.querySelector('.bg-slate-50:first-child');
  if (header) {
    header.parentNode.insertBefore(statusEl, header.nextSibling);
  }
  
  return statusEl;
}

function updateStatus(message, progress = null, isError = false) {
  const textEl = document.getElementById('status-text');
  const progressEl = document.getElementById('progress-bar');
  const fillEl = document.getElementById('progress-fill');
  
  if (textEl) {
    textEl.textContent = message;
    textEl.className = isError 
      ? 'text-red-600 font-medium' 
      : 'text-slate-700';
  }
  
  if (progressEl && fillEl) {
    if (progress !== null) {
      progressEl.classList.remove('hidden');
      fillEl.style.width = `${progress}%`;
    } else {
      progressEl.classList.add('hidden');
    }
  }
}

function clearStatus() {
  const statusEl = document.getElementById('upload-status');
  if (statusEl) {
    statusEl.remove();
  }
}

function showUIError(message) {
  const container = document.createElement('div');
  container.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded shadow-lg z-50 flex items-center gap-3 animate-fade-in';
  container.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
    </svg>
    <span>${message}</span>
  `;
  
  document.body.appendChild(container);
  setTimeout(() => {
    container.style.opacity = '0';
    setTimeout(() => container.remove(), 300);
  }, 4000);
}

const columnDefs = [
  {
    field: 'visible',
    headerName: '👁️',
    width: 50,
    cellRenderer: (params) => {
      const checked = params.value ? 'checked' : '';
      return `<input type="checkbox" ${checked} data-id="${params.data.id}" class="element-checkbox">`;
    },
    cellStyle: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
    sortable: false,
    filter: false
  },
  {
    field: 'id',
    headerName: 'ID',
    width: 100,
    sortable: true,
    filter: true,
    chartDataType: 'category'
  },
  {
    field: 'type',
    headerName: 'Тип',
    width: 150,
    sortable: true,
    filter: true,
    cellStyle: { 'font-weight': '600', 'color': '#2563eb' }
  },
  {
    field: 'name',
    headerName: 'Название',
    flex: 1,
    sortable: true,
    filter: true
  }
];

function onCellClicked(event) {
  if (event.event && event.event.target && event.event.target.classList.contains('element-checkbox')) {
    const elementId = event.data.id;
    const isChecked = event.event.target.checked;
    
    event.api.updateRowData({
      update: [{ id: elementId, visible: isChecked }],
      updateMulti: false
    });
    
    const mesh = meshIndex.get(elementId);
    if (mesh) {
      mesh.visible = isChecked;
    }
  }
}

function initGrid() {
  gridOptions = {
    columnDefs: columnDefs,
    defaultColDef: {
      editable: false,
      sortable: true,
      filter: true,
      resizable: true,
      minWidth: 100
    },
    rowSelection: 'single',
    pagination: true,
    paginationPageSize: 50,
    paginationPageSizeSelector: [10, 20, 50, 100, 200, 500, 1000],
    onCellClicked: onCellClicked,
    onRowClicked: (event) => {
      const rowData = event.data;
      if (rowData) {
        highlightElement(rowData.id);
      }
    },
    onPaginationChanged: (event) => {
      if (gridApi && !isPaginationLoading && !isChangingPageSize) {
        isChangingPageSize = true;
        const pageSize = gridApi.paginationGetPageSize();
        if (pageSize) {
          gridApi.updateGridOptions({ paginationPageSize: pageSize });
        }
        setTimeout(() => {
          isChangingPageSize = false;
        }, 0);
      }
    }
  };

  gridApi = agGrid.createGrid(gridContainer, gridOptions);
  
  if (!gridApi) {
    return;
  }
  
  loadGridData();
}

async function loadGridData() {
  if (!gridApi || !gridContainer) {
    return;
  }
  
  try {
    isPaginationLoading = true;
    const currentPage = 1;
    const fetchPageSize = 50;
    
    const response = await fetch(`/api/model/data?page=${currentPage}&pageSize=${fetchPageSize}`);
    const data = await response.json();
    
    if (data.allElements && data.allElements.length > 0) {
      const rows = data.allElements.map(el => ({
        id: el.id,
        type: el.type,
        name: el.name || 'Без имени',
        visible: el.visible !== undefined ? el.visible : true
      }));
      
      dataRows = rows;
      gridApi.updateGridOptions({ rowData: rows, paginationPageSize: fetchPageSize });
    } else {
      if (gridContainer) {
        gridContainer.innerHTML = '<div class="flex items-center justify-center h-full text-slate-500"><p>Нет данных для отображения</p></div>';
      }
    }
  } catch (err) {
    if (gridContainer) {
      gridContainer.innerHTML = '<div class="flex items-center justify-center h-full text-red-500"><p>Ошибка загрузки данных</p></div>';
    }
  } finally {
    setTimeout(() => {
      isPaginationLoading = false;
    }, 0);
  }
}

function highlightElement(elementId) {
  if (highlightedMesh && originalMaterial) {
    highlightedMesh.material = originalMaterial;
    highlightedMesh = null;
    originalMaterial = null;
  }
  
  const mesh = meshIndex.get(elementId);
  if (!mesh) {
    return;
  }
  
  highlightedMesh = mesh;
  originalMaterial = mesh.material;
  
  const highlightMaterial = originalMaterial.clone();
  highlightMaterial.color.setHex(0xffff00);
  highlightMaterial.transparent = true;
  highlightMaterial.opacity = 0.5;
  highlightMaterial.emissive = new THREE.Color(0xffff00);
  highlightMaterial.emissiveIntensity = 0.3;
  
  mesh.material = highlightMaterial;
}

function showWebGLInstructions() {
  const container = document.getElementById('viewer-container');
  if (container) {
    container.innerHTML = '<div class="flex items-center justify-center h-full text-red-500"><p>WebGL не поддерживается. Пожалуйста, используйте современный браузер.</p></div>';
  }
}

function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

function initViewer() {
  const container = document.getElementById('viewer-container');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf3f4f6);

  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
  camera.position.set(15, 15, 15);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);

  const gridHelper = new THREE.GridHelper(50, 50, 0x888888, 0xcccccc);
  scene.add(gridHelper);
  
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  
  let resizeTimeout = null;
  resizeObserver = new ResizeObserver((entries) => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    
    resizeTimeout = setTimeout(() => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    }, 100);
  });
  
  resizeObserver.observe(container);

  setRenderMode(true);
  animate();
}

function setRenderMode(mode) {
  isRendering = mode;
}

function animate() {
  requestAnimationFrame(animate);
  
  if (isRendering) {
    if (controls) controls.update();
    if (scene && renderer) renderer.render(scene, camera);
  }
}

function clearOldModel() {
  if (currentModelGroup) {
    scene.remove(currentModelGroup);
    
    currentModelGroup.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });
    
    currentModelGroup = null;
  }
  
  meshIndex.clear();
  highlightedMesh = null;
  originalMaterial = null;
  
  setRenderMode(false);
}

async function loadIFCModel() {
  showPreloader('Загрузка 3D-модели...');
  
  try {
    clearOldModel();
    
    const response = await fetch('/api/model/fragments');
    
    if (!response.ok) {
      if (response.status === 404) {
        hidePreloader();
        return;
      }
      throw new Error(`Ошибка загрузки модели: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    const dataView = new DataView(arrayBuffer);
    let offset = 0;
    
    const geometryCount = dataView.getUint32(offset, true);
    offset += 4;
    
    currentModelGroup = new THREE.Group();
    
    for (let i = 0; i < geometryCount; i++) {
      if (offset + 8 > dataView.byteLength) {
        break;
      }
      
      const id = dataView.getUint32(offset, true);
      offset += 4;
      
      const vertexCountFloats = dataView.getUint32(offset, true);
      offset += 4;
      
       if (vertexCountFloats === 0 || vertexCountFloats % 3 !== 0) {
         if (offset + 4 > dataView.byteLength) {
           break;
         }
         const faceCountSkip = dataView.getUint32(offset, true);
         offset += 4;
         if (offset + faceCountSkip * 4 > dataView.byteLength) {
           break;
         }
         offset += faceCountSkip * 4;
         continue;
       }
       
       if (offset + vertexCountFloats * 4 > dataView.byteLength) {
         break;
       }
       
       const numVertices = vertexCountFloats / 3;
       const vertices = new Float32Array(vertexCountFloats);
       for (let v = 0; v < vertexCountFloats; v++) {
         vertices[v] = dataView.getFloat32(offset, true);
         offset += 4;
       }
       
       if (offset + 4 > dataView.byteLength) {
         break;
       }
       
       const faceCount = dataView.getUint32(offset, true);
       offset += 4;
       
       if (offset + faceCount * 4 > dataView.byteLength) {
         break;
       }
      
       const indices = new Uint32Array(faceCount);
       for (let f = 0; f < faceCount; f++) {
         indices[f] = dataView.getUint32(offset, true);
         offset += 4;
       }
       
       const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      
      geometry.computeVertexNormals();
      
      const material = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.expressId = id;
      
      meshIndex.set(id, mesh);
      
      currentModelGroup.add(mesh);
      
      if (i % 10 === 0) {
        updatePreloaderProgress('Загрузка геометрии...', `${Math.round((i / geometryCount) * 100)}%`);
      }
    }
    
    scene.add(currentModelGroup);
    
    const box = new THREE.Box3().setFromObject(currentModelGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (!box.isEmpty()) {
      controls.target.copy(center);
      controls.update();
      
      const distance = maxDim * 1.5;
      const newPos = new THREE.Vector3(
        center.x + distance * 0.5,
        center.y + distance * 0.8,
        center.z + distance * 0.5
      );
      camera.position.copy(newPos);
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      
      controls.target.copy(center);
      controls.update();
    }
    
    updatePreloaderProgress('Загрузка завершена...', '100%');
    
  } catch (error) {
    showUIError(`Ошибка загрузки модели: ${error.message}`);
  } finally {
    setTimeout(() => {
      hidePreloader();
      setRenderMode(true);
    }, 300);
  }
}

async function uploadFile(file) {
  if (isUploading) {
    return;
  }
  
  isUploading = true;
  
  if (!statusMessageEl) {
    statusMessageEl = createStatusElement();
  }
  
  try {
    updateStatus('Загрузка файла на сервер...', null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Ошибка загрузки файла');
    }
    
    if (!result.success) {
      throw new Error(result.error || 'Неизвестная ошибка загрузки');
    }
    
    updateStatus('Конвертация IFC в 3D-геометрию...', null);
    
    const convertResponse = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ifcFilePath: `uploads/${result.fileName}` })
    });
    
    const convertResult = await convertResponse.json();
    
    if (!convertResponse.ok) {
      const errorMsg = convertResult.error || 'Ошибка конвертации';
      const details = convertResult.details || convertResult.stdout || convertResult.stderr || '';
      throw new Error(`${errorMsg}${details ? ': ' + details : ''}`);
    }
    
    updateStatus('Обновление модели и таблицы...', null);
    
    clearOldModel();
    await loadIFCModel();
    await loadGridData();
    
    updateStatus('Готово!', 100);
    setTimeout(() => {
      clearStatus();
      isUploading = false;
    }, 2000);
    
  } catch (error) {
    updateStatus(`Ошибка: ${error.message}`, null, true);
    showUIError(`Ошибка: ${error.message}`);
    isUploading = false;
    
    setTimeout(() => {
      clearStatus();
    }, 3000);
  }
}

uploadBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    uploadFile(file);
    fileInput.value = '';
  }
});

resetCameraBtn = document.getElementById('reset-camera-btn');
if (resetCameraBtn) {
  resetCameraBtn.addEventListener('click', () => {
    resetCamera();
  });
}

toggleAllBtn = document.getElementById('toggle-all-btn');
if (toggleAllBtn) {
  let allVisible = true;
  toggleAllBtn.addEventListener('click', () => {
    allVisible = !allVisible;
    toggleAllBtn.textContent = allVisible ? '👁️ Показать все' : '❌ Скрыть все';
    toggleAllBtn.className = allVisible 
      ? 'px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition' 
      : 'px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition';
    
    updateElementVisibility(allVisible);
  });
}

function updateElementVisibility(show) {
  if (!gridApi) return;
  
  const rows = gridApi.getModel().getRows();
  for (const rowNode of rows) {
    const elementId = rowNode.data.id;
    rowNode.setDataValue('visible', show);
    
    const mesh = meshIndex.get(elementId);
    if (mesh) {
      mesh.visible = show;
    }
  }
}

function resetCamera() {
  if (!controls || !camera) {
    return;
  }
  
  controls.target.set(0, 0, 0);
  controls.update();
  
  camera.position.set(15, 15, 15);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

window.addEventListener('load', async () => {
  showPreloader('Загрузка модулей...');
  updatePreloaderProgress('Загрузка модулей...', '0%');
  
  try {
    updatePreloaderProgress('Загрузка таблицы данных...', '30%');
    initGrid();
    
    updatePreloaderProgress('Проверка WebGL...', '50%');
    if (!checkWebGLSupport()) {
      showWebGLInstructions();
    }
    
    updatePreloaderProgress('Инициализация 3D-вьювера...', '70%');
    initViewer();
    
    updatePreloaderProgress('Загрузка модели...', '80%');
    loadIFCModel();
    
    updatePreloaderProgress('Готово!', '100%');
    setTimeout(hidePreloader, 500);
    
  } catch (error) {
    hidePreloader();
    alert(`Ошибка инициализации: ${error.message}`);
  }
});