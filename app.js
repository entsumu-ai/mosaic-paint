// DOM Elements
const canvas = document.getElementById('paint-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvas-container');
const welcomeScreen = document.getElementById('welcome-screen');
const fileInput = document.getElementById('file-input');
const selectionBox = document.getElementById('selection-box');
const workspaceArea = document.getElementById('workspace-area');
const importOverlay = document.getElementById('import-overlay');

// Tool Buttons
const btnOpenFile = document.getElementById('btn-open-file');
const btnUndo = document.getElementById('btn-undo');
const btnRedo = document.getElementById('btn-redo');
const btnClear = document.getElementById('btn-clear');
const btnSave = document.getElementById('btn-save');
const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');

// Zoom Elements
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomReset = document.getElementById('btn-zoom-reset');
const zoomVal = document.getElementById('zoom-val');

// Welcome Screen Buttons
const welcomeBtnOpen = document.getElementById('welcome-btn-open');
const welcomeBtnNew = document.getElementById('welcome-btn-new');

// Property Panel Elements
const brushSizeInput = document.getElementById('brush-size');
const brushSizeVal = document.getElementById('brush-size-val');
const mosaicSizeInput = document.getElementById('mosaic-size');
const mosaicSizeVal = document.getElementById('mosaic-size-val');
const mosaicTypeSelect = document.getElementById('mosaic-type');
const colorPicker = document.getElementById('color-picker');
const presetColorButtons = document.querySelectorAll('.preset-color-btn');
const cropSection = document.getElementById('crop-section');
const btnCrop = document.getElementById('btn-crop');
const btnCropOutside = document.getElementById('btn-crop-outside');

// Status Bar Elements
const statusSize = document.getElementById('status-size');
const statusTool = document.getElementById('status-tool');
const statusCoords = document.getElementById('status-coords');

// State Variables
let currentTool = 'brush'; // brush, eraser, mosaic-brush, mosaic-rect, rect, ellipse, select, text
let brushColor = '#3b82f6';
let brushSize = 10;
let mosaicSize = 6;
let mosaicType = 'pixel';
let zoomLevel = 1.0;
let initialTouchDistance = 0;
let initialZoomLevel = 1.0;
let isPinching = false;
let originalCanvas = null;
let originalCtx = null;
let touchAnchorCanvasX = 0;
let touchAnchorCanvasY = 0;

let isDrawing = false;
let canvasStartX = 0;
let canvasStartY = 0;
let containerStartX = 0;
let containerStartY = 0;
let containerCurrX = 0;
let containerCurrY = 0;
let activeTextInput = null;
let selectedArea = null;

// History Stack
let history = [];
let historyIndex = -1;
const MAX_HISTORY = 30;
let previewImageData = null; // For shapes drawing preview

// Initialize Lucide Icons
lucide.createIcons();

// --- Event Listeners Initialization ---
function initEvents() {
  // File Open Trigger
  btnOpenFile.addEventListener('click', () => fileInput.click());
  welcomeBtnOpen.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);
  
  // New Canvas Trigger
  welcomeBtnNew.addEventListener('click', () => createNewCanvas(800, 600));

  // Tool Selection
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-tool');
      setTool(tool);
    });
  });

  // Properties Controls
  brushSizeInput.addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
    brushSizeVal.textContent = `${brushSize}px`;
    updateCursor();
  });

  mosaicSizeInput.addEventListener('input', (e) => {
    mosaicSize = parseInt(e.target.value);
    mosaicSizeVal.textContent = `${mosaicSize}px`;
  });

  mosaicTypeSelect.addEventListener('change', (e) => {
    mosaicType = e.target.value;
  });

  colorPicker.addEventListener('input', (e) => {
    updateColor(e.target.value);
  });

  presetColorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetColorButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const color = btn.getAttribute('data-color');
      updateColor(color);
    });
  });

  // History & Action Buttons
  btnUndo.addEventListener('click', undo);
  btnRedo.addEventListener('click', redo);
  btnClear.addEventListener('click', confirmClearCanvas);
  btnSave.addEventListener('click', saveImage);
  const onCropClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleCropClick();
  };
  const onCropOutsideClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleCropOutsideClick();
  };
  btnCrop.addEventListener('click', onCropClick);
  btnCrop.addEventListener('touchstart', onCropClick, { passive: false });
  btnCropOutside.addEventListener('click', onCropOutsideClick);
  btnCropOutside.addEventListener('touchstart', onCropOutsideClick, { passive: false });

  // Drag and Drop Events
  workspaceArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    importOverlay.classList.add('drag-over');
  });

  workspaceArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    importOverlay.classList.remove('drag-over');
  });

  workspaceArea.addEventListener('drop', (e) => {
    e.preventDefault();
    importOverlay.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      loadFile(files[0]);
    }
  });

  // Clipboard Paste (Ctrl+V)
  window.addEventListener('paste', handleClipboardPaste);

  // Keyboard Shortcuts
  window.addEventListener('keydown', handleKeyboardShortcuts);

  // Canvas Mouse Events
  canvas.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  // Zoom Controls Events
  btnZoomIn.addEventListener('click', () => {
    zoomLevel = Math.min(4.0, zoomLevel + 0.1);
    applyZoom();
  });

  btnZoomOut.addEventListener('click', () => {
    zoomLevel = Math.max(0.2, zoomLevel - 0.1);
    applyZoom();
  });

  btnZoomReset.addEventListener('click', () => {
    zoomLevel = 1.0;
    applyZoom();
  });

  // Mouse Wheel Zoom (works even during drawing/drag-selecting, without Ctrl key)
  window.addEventListener('wheel', (e) => {
    if (welcomeScreen.classList.contains('hidden') === false) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      zoomLevel = Math.min(4.0, zoomLevel + 0.1);
    } else {
      zoomLevel = Math.max(0.2, zoomLevel - 0.1);
    }
    applyZoom();
  }, { passive: false });

  // Canvas Touch Events (for Mobile Devices)
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: false });
  window.addEventListener('touchcancel', handleTouchCancel, { passive: false });

  // Mobile Panel Toggle
  const mobilePanelToggle = document.getElementById('mobile-panel-toggle');
  const propertiesPanel = document.querySelector('.properties-panel');
  if (mobilePanelToggle && propertiesPanel) {
    const togglePanel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      propertiesPanel.classList.toggle('open');
    };
    mobilePanelToggle.addEventListener('click', togglePanel);
    mobilePanelToggle.addEventListener('touchstart', togglePanel, { passive: false });
  }

  updateCursor();
}

// --- Tool Controller ---
function setTool(tool) {
  // Commit text if we are leaving text tool
  if (activeTextInput) {
    commitTextInput();
  }
  
  currentTool = tool;
  
  // Update UI active state
  toolButtons.forEach(btn => {
    if (btn.getAttribute('data-tool') === tool) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Manage selection box and crop button display
  if (tool !== 'select') {
    selectionBox.style.display = 'none';
    cropSection.style.display = 'none';
    selectedArea = null;
  } else {
    cropSection.style.display = 'block';
    btnCrop.disabled = true;
    btnCropOutside.disabled = true;
  }

  // Translate tool names for status bar
  const toolNames = {
    'brush': 'ブラシ',
    'eraser': '消しゴム',
    'mosaic-brush': 'モザイクブラシ',
    'mosaic-rect': '範囲モザイク',
    'rect': '長方形',
    'ellipse': '楕円',
    'select': '範囲選択 (キリトリ)',
    'text': 'テキスト挿入'
  };
  statusTool.textContent = `ツール: ${toolNames[tool] || tool}`;

  // Update properties panels based on tool
  const sizeSetting = document.getElementById('size-setting-group');
  const mosaicSetting = document.getElementById('mosaic-setting-group');
  const colorSection = document.getElementById('color-section');

  // Basic UI highlight logic
  if (tool === 'eraser') {
    colorSection.style.opacity = '0.3';
    colorSection.style.pointerEvents = 'none';
    sizeSetting.style.opacity = '1';
    mosaicSetting.style.opacity = '0.3';
  } else if (tool === 'mosaic-brush') {
    colorSection.style.opacity = '0.3';
    colorSection.style.pointerEvents = 'none';
    sizeSetting.style.opacity = '1';
    mosaicSetting.style.opacity = '1';
  } else if (tool === 'mosaic-rect') {
    colorSection.style.opacity = '0.3';
    colorSection.style.pointerEvents = 'none';
    sizeSetting.style.opacity = '0.3';
    mosaicSetting.style.opacity = '1';
  } else if (tool === 'select') {
    colorSection.style.opacity = '0.3';
    colorSection.style.pointerEvents = 'none';
    sizeSetting.style.opacity = '0.3';
    mosaicSetting.style.opacity = '0.3';
  } else if (tool === 'text') {
    colorSection.style.opacity = '1';
    colorSection.style.pointerEvents = 'auto';
    sizeSetting.style.opacity = '1';
    mosaicSetting.style.opacity = '0.3';
  } else {
    colorSection.style.opacity = '1';
    colorSection.style.pointerEvents = 'auto';
    sizeSetting.style.opacity = '1';
    mosaicSetting.style.opacity = '0.3';
  }

  updateCursor();
}

// --- Color Controller ---
function updateColor(color) {
  brushColor = color;
  colorPicker.value = color;
  
  // Active state for preset button
  presetColorButtons.forEach(btn => {
    if (btn.getAttribute('data-color').toLowerCase() === color.toLowerCase()) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// --- File Handling Functions ---
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    loadFile(file);
  }
}

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    loadImage(e.target.result);
  };
  reader.readAsDataURL(file);
  showToast('画像を読み込みました');
}

function loadImage(src) {
  const img = new Image();
  img.onload = () => {
    // Reset canvas dimensions to match image
    canvas.width = img.width;
    canvas.height = img.height;
    
    // Create original canvas for eraser restore feature
    originalCanvas = document.createElement('canvas');
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    originalCtx = originalCanvas.getContext('2d');
    originalCtx.drawImage(img, 0, 0);
    
    // Draw image onto canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    
    // Toggle UI views
    welcomeScreen.classList.add('hidden');
    container.style.display = 'flex';
    
    // Enable Actions
    btnSave.disabled = false;
    btnClear.disabled = false;
    
    // Status info update
    statusSize.textContent = `サイズ: ${img.width} x ${img.height}`;

    // Reset zoom state to fit screen width/height
    zoomLevel = getFitZoomLevel(img.width, img.height);
    applyZoom();
    btnZoomIn.disabled = false;
    btnZoomOut.disabled = false;
    btnZoomReset.disabled = false;
    
    // Reset history stack
    history = [];
    historyIndex = -1;
    saveHistory();
    
    setTool(currentTool); // Refresh panel state
  };
  img.src = src;
}

function createNewCanvas(width, height) {
  canvas.width = width;
  canvas.height = height;
  
  // Create original canvas for eraser restore feature
  originalCanvas = document.createElement('canvas');
  originalCanvas.width = width;
  originalCanvas.height = height;
  originalCtx = originalCanvas.getContext('2d');
  originalCtx.fillStyle = '#ffffff';
  originalCtx.fillRect(0, 0, width, height);
  
  // Fill background with white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  
  welcomeScreen.classList.add('hidden');
  container.style.display = 'flex';
  
  // Enable Actions
  btnSave.disabled = false;
  btnClear.disabled = false;
  
  statusSize.textContent = `サイズ: ${width} x ${height}`;

  // Reset zoom state to fit screen width/height
  zoomLevel = getFitZoomLevel(width, height);
  applyZoom();
  btnZoomIn.disabled = false;
  btnZoomOut.disabled = false;
  btnZoomReset.disabled = false;
  
  history = [];
  historyIndex = -1;
  saveHistory();
  
  setTool(currentTool);
}

function handleClipboardPaste(e) {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const blob = items[i].getAsFile();
      loadFile(blob);
      showToast('クリップボードから画像を貼り付けました');
      break;
    }
  }
}

// --- Canvas Coordinate Conversion ---
function getCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

// --- Mosaic Algorithm (Pixelation / Blur / Dot) ---
function createMosaicPatternCanvas(sourceCanvas, blockSize, type = 'pixel') {
  const mCanvas = document.createElement('canvas');
  mCanvas.width = sourceCanvas.width;
  mCanvas.height = sourceCanvas.height;
  const mCtx = mCanvas.getContext('2d');
  
  if (type === 'blur') {
    // 摺りガラス（ぼかし）モザイク
    mCtx.filter = `blur(${blockSize * 1.5}px)`;
    mCtx.drawImage(sourceCanvas, 0, 0);
    mCtx.filter = 'none';
  } else if (type === 'dot') {
    // ドット（丸型）モザイク
    const sCtx = sourceCanvas.getContext('2d');
    const imgData = sCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = imgData.data;
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    
    for (let x = 0; x < w; x += blockSize) {
      for (let y = 0; y < h; y += blockSize) {
        // ブロックの中心のピクセルカラーを抽出
        const cx = Math.min(w - 1, x + Math.floor(blockSize / 2));
        const cy = Math.min(h - 1, y + Math.floor(blockSize / 2));
        const idx = (cy * w + cx) * 4;
        
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3] / 255;
        
        // 隙間の背景を、そのブロックの元の色を70%暗くした色で塗りつぶす（チカチカ防止）
        const darkR = Math.floor(r * 0.3);
        const darkG = Math.floor(g * 0.3);
        const darkB = Math.floor(b * 0.3);
        mCtx.fillStyle = `rgba(${darkR}, ${darkG}, ${darkB}, ${a})`;
        mCtx.fillRect(x, y, blockSize, blockSize);
        
        // 円を描画 (少しだけ隙間を作るために 0.9 倍する)
        mCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        mCtx.beginPath();
        mCtx.arc(x + blockSize / 2, y + blockSize / 2, (blockSize / 2) * 0.9, 0, Math.PI * 2);
        mCtx.fill();
      }
    }
  } else {
    // 従来のピクセルモザイク
    const tempCanvas = document.createElement('canvas');
    const tempW = Math.max(1, Math.floor(sourceCanvas.width / blockSize));
    const tempH = Math.max(1, Math.floor(sourceCanvas.height / blockSize));
    tempCanvas.width = tempW;
    tempCanvas.height = tempH;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(sourceCanvas, 0, 0, tempW, tempH);
    mCtx.imageSmoothingEnabled = false;
    mCtx.drawImage(tempCanvas, 0, 0, tempW, tempH, 0, 0, sourceCanvas.width, sourceCanvas.height);
  }
  
  return mCanvas;
}

function applyMosaicToRect(x, y, w, h, blockSize, type = 'pixel') {
  const x1 = Math.max(0, Math.min(canvas.width, x));
  const y1 = Math.max(0, Math.min(canvas.height, y));
  const x2 = Math.max(0, Math.min(canvas.width, x + w));
  const y2 = Math.max(0, Math.min(canvas.height, y + h));
  
  const targetX = x1;
  const targetY = y1;
  const targetW = x2 - x1;
  const targetH = y2 - y1;
  
  if (targetW <= 0 || targetH <= 0) return;
  
  if (type === 'blur') {
    // ぼかし（摺りガラス）の境界が縮む問題の対策：のりしろ（余白）を取る
    const margin = Math.ceil(blockSize * 2);
    const srcX = Math.max(0, targetX - margin);
    const srcY = Math.max(0, targetY - margin);
    const srcW = Math.min(canvas.width, targetX + targetW + margin) - srcX;
    const srcH = Math.min(canvas.height, targetY + targetH + margin) - srcY;
    
    // 余白を含めて一時コピー
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = srcW;
    tempCanvas.height = srcH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    
    // コピーにぼかしモザイクを適用
    const patternCanvas = createMosaicPatternCanvas(tempCanvas, blockSize, type);
    
    // のりしろ（マージン）部分を切り落として、本来の選択範囲にピタリと上書き
    const cropX = targetX - srcX;
    const cropY = targetY - srcY;
    ctx.drawImage(patternCanvas, cropX, cropY, targetW, targetH, targetX, targetY, targetW, targetH);
  } else {
    // ピクセル・ドットモザイクは従来通り（のりしろ不要）
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetW;
    tempCanvas.height = targetH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, targetX, targetY, targetW, targetH, 0, 0, targetW, targetH);
    
    const patternCanvas = createMosaicPatternCanvas(tempCanvas, blockSize, type);
    ctx.drawImage(patternCanvas, targetX, targetY);
  }
}

// --- Drawing Event Handlers ---
function handleMouseDown(e) {
  if (welcomeScreen.classList.contains('hidden') === false) return; // Prevent drawing if welcome screen is visible
  if (e.button !== 0) return; // Only left mouse button
  
  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;
  
  canvasStartX = (e.clientX - canvasRect.left) * scaleX;
  canvasStartY = (e.clientY - canvasRect.top) * scaleY;
  
  containerStartX = e.clientX - containerRect.left;
  containerStartY = e.clientY - containerRect.top;
  containerCurrX = containerStartX;
  containerCurrY = containerStartY;
  
  if (currentTool === 'text') {
    isDrawing = false;
    if (activeTextInput) {
      commitTextInput();
    }
    createTextInput(e.clientX, e.clientY, canvasStartX, canvasStartY);
    return;
  }
  
  isDrawing = true;
  
  // Backup image state for shape previewing
  previewImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  if (currentTool === 'brush') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(canvasStartX, canvasStartY);
  } else if (currentTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(canvasStartX, canvasStartY);
  } else if (currentTool === 'mosaic-brush') {
    ctx.globalCompositeOperation = 'source-over';
    const mosaicPatternCanvas = createMosaicPatternCanvas(canvas, mosaicSize, mosaicType);
    const pattern = ctx.createPattern(mosaicPatternCanvas, 'no-repeat');
    ctx.strokeStyle = pattern;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(canvasStartX, canvasStartY);
  } else if (currentTool === 'mosaic-rect') {
    // MouseDown/TouchStart ではリセットしない（MouseMoveによる5px以上のドラッグ開始時にリセット・描画を行う）
  } else if (currentTool === 'select') {
    // 同上（誤タップで既に存在する選択枠が消えるのを完全に防止する）
  }
}

function handleMouseMove(e) {
  if (welcomeScreen.classList.contains('hidden') === false) return;
  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;
  
  let canvasCurrX, canvasCurrY;
  
  if (currentTool === 'select' || currentTool === 'mosaic-rect') {
    // For selection tools, clamp coordinates to the canvas bounds to allow easy edge selection
    const clampedClientX = Math.max(canvasRect.left, Math.min(canvasRect.right, e.clientX));
    const clampedClientY = Math.max(canvasRect.top, Math.min(canvasRect.bottom, e.clientY));
    
    canvasCurrX = (clampedClientX - canvasRect.left) * scaleX;
    canvasCurrY = (clampedClientY - canvasRect.top) * scaleY;
    containerCurrX = clampedClientX - containerRect.left;
    containerCurrY = clampedClientY - containerRect.top;
  } else {
    // For drawing tools (brush, shapes, etc.), do not clamp so drawing behaves naturally when cursor goes off-canvas
    canvasCurrX = (e.clientX - canvasRect.left) * scaleX;
    canvasCurrY = (e.clientY - canvasRect.top) * scaleY;
    containerCurrX = e.clientX - containerRect.left;
    containerCurrY = e.clientY - containerRect.top;
  }
  
  // Update status coordinate details
  const clampedX = Math.round(Math.max(0, Math.min(canvas.width, canvasCurrX)));
  const clampedY = Math.round(Math.max(0, Math.min(canvas.height, canvasCurrY)));
  statusCoords.textContent = `X: ${clampedX}, Y: ${clampedY}`;
  
  if (!isDrawing) return;
  
  if (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'mosaic-brush') {
    ctx.lineTo(canvasCurrX, canvasCurrY);
    ctx.stroke();
  } else if (currentTool === 'mosaic-rect' || currentTool === 'select') {
    const left = Math.min(containerStartX, containerCurrX);
    const top = Math.min(containerStartY, containerCurrY);
    const width = Math.abs(containerCurrX - containerStartX);
    const height = Math.abs(containerCurrY - containerStartY);
    
    // 5px以上の移動があって初めて古い選択枠を解除し、新規の枠描画を画面に表示する
    if (width > 5 || height > 5) {
      if (currentTool === 'select' && selectedArea) {
        selectedArea = null;
        btnCrop.disabled = true;
        btnCropOutside.disabled = true;
      }
      selectionBox.style.display = 'block';
      selectionBox.style.left = `${left}px`;
      selectionBox.style.top = `${top}px`;
      selectionBox.style.width = `${width}px`;
      selectionBox.style.height = `${height}px`;
    }
  } else if (currentTool === 'rect' || currentTool === 'ellipse') {
    // Redraw snapshot image before painting active drag shape
    ctx.putImageData(previewImageData, 0, 0);
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    const w = canvasCurrX - canvasStartX;
    const h = canvasCurrY - canvasStartY;
    
    if (currentTool === 'rect') {
      ctx.strokeRect(canvasStartX, canvasStartY, w, h);
    } else if (currentTool === 'ellipse') {
      const rx = Math.abs(w / 2);
      const ry = Math.abs(h / 2);
      const cx = canvasStartX + w / 2;
      const cy = canvasStartY + h / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
}

function handleMouseUp(e) {
  if (!isDrawing) return;
  isDrawing = false;
  
  if (currentTool === 'mosaic-rect') {
    selectionBox.style.display = 'none';
    
    const left = Math.min(containerStartX, containerCurrX);
    const top = Math.min(containerStartY, containerCurrY);
    const width = Math.abs(containerCurrX - containerStartX);
    const height = Math.abs(containerCurrY - containerStartY);
    
    if (width > 5 && height > 5) {
      const canvasRect = canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      
      const cX = ((left + containerRect.left) - canvasRect.left) * scaleX;
      const cY = ((top + containerRect.top) - canvasRect.top) * scaleY;
      const cW = width * scaleX;
      const cH = height * scaleY;
      
      applyMosaicToRect(cX, cY, cW, cH, mosaicSize, mosaicType);
      saveHistory();
    }
  } else if (currentTool === 'select') {
    const left = Math.min(containerStartX, containerCurrX);
    const top = Math.min(containerStartY, containerCurrY);
    const width = Math.abs(containerCurrX - containerStartX);
    const height = Math.abs(containerCurrY - containerStartY);
    
    if (width > 5 && height > 5) {
      const canvasRect = canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      
      const cX = ((left + containerRect.left) - canvasRect.left) * scaleX;
      const cY = ((top + containerRect.top) - canvasRect.top) * scaleY;
      const cW = width * scaleX;
      const cH = height * scaleY;
      
      selectedArea = { x: cX, y: cY, w: cW, h: cH };
      btnCrop.disabled = false;
      btnCropOutside.disabled = false;

      // スマホ表示時、選択が完了したら自動的に設定パネル（キリトリボタンがある場所）を開く
      // スマホ表示時、選択が完了したら自動的に設定パネル（キリトリボタンがある場所）を開く
      const propertiesPanel = document.querySelector('.properties-panel');
      if (propertiesPanel) {
        propertiesPanel.classList.add('open');
      }
    } else {
      selectionBox.style.display = 'none';
      btnCrop.disabled = true;
      btnCropOutside.disabled = true;
      selectedArea = null;
    }
  } else if (currentTool === 'eraser') {
    // 復元消しゴム処理を走り込ませてからヒストリー保存
    restoreOriginalPixels();
    saveHistory();
  } else {
    // Save history for normal drawing tools on mouse up
    saveHistory();
  }
}

// --- History Stack Management ---
function saveHistory() {
  console.log("saveHistory called. Current index before push:", historyIndex);
  // Clear redo actions if we drew a new path
  if (historyIndex < history.length - 1) {
    history = history.slice(0, historyIndex + 1);
  }
  
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const origImgData = originalCtx ? originalCtx.getImageData(0, 0, canvas.width, canvas.height) : null;
  
  history.push({
    width: canvas.width,
    height: canvas.height,
    imgData: imgData,
    origImgData: origImgData
  });
  
  if (history.length > MAX_HISTORY) {
    history.shift();
  } else {
    historyIndex++;
  }
  
  console.log("History saved. Stack length:", history.length, "Index:", historyIndex);
  updateHistoryControls();
}

function undo() {
  console.log("undo requested. Index:", historyIndex);
  if (welcomeScreen.classList.contains('hidden') === false) {
    console.log("undo blocked: welcome screen visible");
    return;
  }
  if (historyIndex > 0) {
    historyIndex--;
    const state = history[historyIndex];
    canvas.width = state.width;
    canvas.height = state.height;
    ctx.putImageData(state.imgData, 0, 0);
    
    // originalCanvas も同期
    if (state.origImgData) {
      originalCanvas = document.createElement('canvas');
      originalCanvas.width = state.width;
      originalCanvas.height = state.height;
      originalCtx = originalCanvas.getContext('2d');
      originalCtx.putImageData(state.origImgData, 0, 0);
    }
    
    statusSize.textContent = `サイズ: ${state.width} x ${state.height}`;
    updateHistoryControls();
    showToast('元に戻しました');
    console.log("undo success. New index:", historyIndex);
  } else {
    console.log("undo ignored: historyIndex is 0 or less");
  }
}

function redo() {
  console.log("redo requested. Index:", historyIndex);
  if (welcomeScreen.classList.contains('hidden') === false) {
    console.log("redo blocked: welcome screen visible");
    return;
  }
  if (historyIndex < history.length - 1) {
    historyIndex++;
    const state = history[historyIndex];
    canvas.width = state.width;
    canvas.height = state.height;
    ctx.putImageData(state.imgData, 0, 0);
    
    // originalCanvas も同期
    if (state.origImgData) {
      originalCanvas = document.createElement('canvas');
      originalCanvas.width = state.width;
      originalCanvas.height = state.height;
      originalCtx = originalCanvas.getContext('2d');
      originalCtx.putImageData(state.origImgData, 0, 0);
    }
    
    statusSize.textContent = `サイズ: ${state.width} x ${state.height}`;
    updateHistoryControls();
    showToast('やり直しました');
    console.log("redo success. New index:", historyIndex);
  } else {
    console.log("redo ignored: historyIndex at peak");
  }
}

function updateHistoryControls() {
  btnUndo.disabled = (historyIndex <= 0);
  btnRedo.disabled = (historyIndex >= history.length - 1);
  console.log("History controls updated. Undo disabled:", btnUndo.disabled, "Redo disabled:", btnRedo.disabled);
}

function confirmClearCanvas() {
  if (welcomeScreen.classList.contains('hidden') === false) return;
  if (confirm('キャンバスの描画内容をクリアしますか？')) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
    showToast('クリアしました');
  }
}

// --- Export Function ---
function saveImage() {
  if (welcomeScreen.classList.contains('hidden') === false) return;
  const link = document.createElement('a');
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  
  link.download = `mosaic-paint-${yyyy}${mm}${dd}-${hh}${min}${sec}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('画像を保存しました');
}

// --- Keyboard & Shortcuts Handler ---
function handleKeyboardShortcuts(e) {
  if (welcomeScreen.classList.contains('hidden')) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        saveImage();
      }
    } else if (e.key === 'Escape') {
      // Escape キーによる選択解除・キャンセル
      if (selectedArea) {
        selectionBox.style.display = 'none';
        btnCrop.disabled = true;
        btnCropOutside.disabled = true;
        selectedArea = null;
        showToast('選択を解除しました');
      }
      if (activeTextInput) {
        cancelTextInput();
      }
    }
  }
}

// --- Toast Toast Notification System ---
function showToast(message) {
  const toast = document.getElementById('toast-notification');
  const toastMsg = document.getElementById('toast-message');
  
  toastMsg.textContent = message;
  toast.classList.add('show');
  
  if (window.toastTimeout) {
    clearTimeout(window.toastTimeout);
  }
  
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// --- Selection & Crop Handling ---
// Crop inside: erase the selected area, keep the surroundings (canvas size kept)
function handleCropClick() {
  if (!selectedArea) return;

  const { x, y, w, h } = selectedArea;

  const rx = Math.max(0, Math.floor(x));
  const ry = Math.max(0, Math.floor(y));
  const rw = Math.min(canvas.width - rx, Math.floor(w));
  const rh = Math.min(canvas.height - ry, Math.floor(h));

  if (rw <= 5 || rh <= 5) {
    showToast('選択範囲が小さすぎます');
    return;
  }

  // Erase only the selected area (transparent); everything around it stays
  ctx.clearRect(rx, ry, rw, rh);

  // Clear selection Box (keep crop panel visible so repeated crops work)
  selectionBox.style.display = 'none';
  btnCrop.disabled = true;
  btnCropOutside.disabled = true;
  selectedArea = null;

  // originalCanvas も新しいサイズに更新
  originalCanvas = document.createElement('canvas');
  originalCanvas.width = canvas.width;
  originalCanvas.height = canvas.height;
  originalCtx = originalCanvas.getContext('2d');
  originalCtx.drawImage(canvas, 0, 0);

  saveHistory();
  showToast('範囲内をキリトリしました');
}

// Crop outside: keep only the selected area, clear everything around it (canvas size kept)
function handleCropOutsideClick() {
  if (!selectedArea) return;

  const { x, y, w, h } = selectedArea;

  const rx = Math.max(0, Math.floor(x));
  const ry = Math.max(0, Math.floor(y));
  const rw = Math.min(canvas.width - rx, Math.floor(w));
  const rh = Math.min(canvas.height - ry, Math.floor(h));

  if (rw <= 5 || rh <= 5) {
    showToast('選択範囲が小さすぎます');
    return;
  }

  // Save the selected pixels, wipe the whole canvas, then restore them in place
  const keep = ctx.getImageData(rx, ry, rw, rh);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(keep, rx, ry);

  // Clear selection Box (keep crop panel visible so repeated crops work)
  selectionBox.style.display = 'none';
  btnCrop.disabled = true;
  btnCropOutside.disabled = true;
  selectedArea = null;

  // originalCanvas も新しいサイズに更新
  originalCanvas = document.createElement('canvas');
  originalCanvas.width = canvas.width;
  originalCanvas.height = canvas.height;
  originalCtx = originalCanvas.getContext('2d');
  originalCtx.drawImage(canvas, 0, 0);

  saveHistory();
  showToast('範囲外をキリトリしました');
}

// Change the canvas cursor to match the active tool.
// Brush / eraser / mosaic-brush use a circle sized to the brush.
function updateCursor() {
  if (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'mosaic-brush') {
    const s = Math.max(6, Math.min(brushSize, 120));
    const c = (s + 4) / 2;
    const r = s / 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${s + 4}" height="${s + 4}">` +
      `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="black" stroke-width="2"/>` +
      `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="white" stroke-width="1"/>` +
      `</svg>`;
    const url = `data:image/svg+xml;base64,${btoa(svg)}`;
    canvas.style.cursor = `url('${url}') ${c} ${c}, crosshair`;
  } else if (currentTool === 'text') {
    canvas.style.cursor = 'text';
  } else {
    canvas.style.cursor = 'crosshair';
  }
}

// --- Text Drawing Tool Handling ---
function createTextInput(clientX, clientY, canvasX, canvasY) {
  const containerRect = container.getBoundingClientRect();
  const left = clientX - containerRect.left;
  const top = clientY - containerRect.top;
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'canvas-text-input';
  input.style.left = `${left}px`;
  input.style.top = `${top}px`;
  input.style.fontSize = `${brushSize}px`;
  input.style.color = brushColor;
  input.placeholder = '文字を入力してEnterで確定...';
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      commitTextInput();
    } else if (e.key === 'Escape') {
      cancelTextInput();
    }
  });
  
  // Stop mouse click inside input field from bubbling to canvas
  input.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });
  
  container.appendChild(input);
  activeTextInput = {
    element: input,
    x: canvasX,
    y: canvasY
  };
  
  // Focus the input
  setTimeout(() => input.focus(), 50);
}

function commitTextInput() {
  if (!activeTextInput) return;
  
  const input = activeTextInput.element;
  const text = input.value.trim();
  const x = activeTextInput.x;
  const y = activeTextInput.y;
  
  if (text.length > 0) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = brushColor;
    ctx.font = `${brushSize}px sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
    saveHistory();
    showToast('テキストを挿入しました');
  }
  
  input.remove();
  activeTextInput = null;
}

function cancelTextInput() {
  if (!activeTextInput) return;
  activeTextInput.element.remove();
  activeTextInput = null;
}

function applyZoom() {
  if (!canvas.width || !canvas.height) return;
  const w = canvas.width * zoomLevel;
  const h = canvas.height * zoomLevel;
  container.style.width = `${w}px`;
  container.style.height = `${h}px`;
  zoomVal.textContent = `${Math.round(zoomLevel * 100)}%`;
}

// --- Touch Event Handlers for Mobile Devices ---
function handleTouchStart(e) {
  if (e.touches.length === 2) {
    // 2本指タッチの場合：ピンチズーム開始
    isPinching = true;
    isDrawing = false; // 描画をキャンセル
    if (selectionBox) selectionBox.style.display = 'none'; // 範囲選択中の場合はクリア
    hideTouchCursor();
    
    // 2つのタッチ点の間隔を計算（ズーム用）
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    initialTouchDistance = Math.hypot(dx, dy);
    initialZoomLevel = zoomLevel;

    // 2つのタッチ点の中心座標（重心）に対応する画像上のピクセル座標（アンカー）を計算
    const workspace = document.querySelector('.workspace');
    if (workspace) {
      const rect = workspace.getBoundingClientRect();
      const startCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const startCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      
      // 指でつまみ始めた箇所の、キャンバス上のピクセル座標をアンカーとして記録
      touchAnchorCanvasX = (startCenterX + workspace.scrollLeft) / zoomLevel;
      touchAnchorCanvasY = (startCenterY + workspace.scrollTop) / zoomLevel;
    }
    
    e.preventDefault();
  } else if (e.touches.length === 1 && !isPinching) {
    // 1本指タッチの場合：通常の描画・選択
    const touch = e.touches[0];
    const pseudoEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      button: 0,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation()
    };
    if (currentTool !== 'text') {
      e.preventDefault();
    }
    updateTouchCursor(touch.clientX, touch.clientY);
    handleMouseDown(pseudoEvent);
  }
}

function handleTouchMove(e) {
  if (e.touches.length === 2 && isPinching) {
    const workspace = document.querySelector('.workspace');
    if (!workspace) return;
    
    // --- 1. ピンチズーム計算（倍率決定） ---
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const currentDistance = Math.hypot(dx, dy);
    
    if (initialTouchDistance > 0) {
      const scale = currentDistance / initialTouchDistance;
      // 0.2倍〜4.0倍の範囲で拡大縮小
      zoomLevel = Math.max(0.2, Math.min(4.0, initialZoomLevel * scale));
      applyZoom();
    }

    // --- 2. アンカー座標を指の中央位置に固定（ズーム＆パン同期） ---
    // 現在の2本の指の重心（ワークスペース相対）
    const rect = workspace.getBoundingClientRect();
    const currCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    const currCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    
    // 最初につまんだ箇所の画像ピクセルが、現在の指の中心に一致するようにスクロール位置を補正
    workspace.scrollLeft = touchAnchorCanvasX * zoomLevel - currCenterX;
    workspace.scrollTop = touchAnchorCanvasY * zoomLevel - currCenterY;
    
    e.preventDefault();
  } else if (e.touches.length === 1 && isDrawing && !isPinching) {
    // 通常のなぞり描き・スワイプ
    const touch = e.touches[0];
    const pseudoEvent = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation()
    };
    if (currentTool !== 'text') {
      e.preventDefault();
    }
    updateTouchCursor(touch.clientX, touch.clientY);
    handleMouseMove(pseudoEvent);
  }
}

function handleTouchEnd(e) {
  hideTouchCursor();
  if (isPinching) {
    // 指が離れたとき、ピンチを終了
    if (e.touches.length < 2) {
      isPinching = false;
      initialTouchDistance = 0;
    }
  } else if (isDrawing) {
    // 通常の描画終了
    const touch = e.changedTouches.length > 0 ? e.changedTouches[0] : null;
    const pseudoEvent = {
      clientX: touch ? touch.clientX : containerCurrX,
      clientY: touch ? touch.clientY : containerCurrY,
      preventDefault: () => e.preventDefault(),
      stopPropagation: () => e.stopPropagation()
    };
    handleMouseUp(pseudoEvent);
  }
  
  // 安全装置：画面に触れている指が0本になったら全ての状態フラグを強制リセット
  if (e.touches.length === 0) {
    isPinching = false;
    isDrawing = false;
    initialTouchDistance = 0;
  }
}

function handleTouchCancel(e) {
  hideTouchCursor();
  // システム介入や画面外への指離脱などでタッチがキャンセルされた場合は、全て強制リセット
  isPinching = false;
  isDrawing = false;
  initialTouchDistance = 0;
  if (selectionBox) {
    selectionBox.style.display = 'none';
  }
}

// --- Touch Cursor (Pointer) Helper Functions ---
const touchCursor = document.getElementById('touch-brush-cursor');

function updateTouchCursor(clientX, clientY) {
  if (!touchCursor) return;
  if (currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'mosaic-brush') {
    const canvasRect = canvas.getBoundingClientRect();
    const baseSize = brushSize * (canvasRect.width / canvas.width);
    // 指の腹で円が完全に隠れてしまわないように、表示サイズにゲイン（+30px）を足し、最小でも40pxを確保
    const displaySize = Math.max(40, baseSize + 30);
    
    touchCursor.style.width = `${displaySize}px`;
    touchCursor.style.height = `${displaySize}px`;
    
    // 指の真下に表示
    touchCursor.style.left = `${clientX}px`;
    touchCursor.style.top = `${clientY}px`;
    touchCursor.style.display = 'block';
  } else {
    touchCursor.style.display = 'none';
  }
}

function hideTouchCursor() {
  if (touchCursor) {
    touchCursor.style.display = 'none';
  }
}

function restoreOriginalPixels() {
  if (!originalCanvas || !canvas.width || !canvas.height) return;
  
  const currImgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const origImgData = originalCtx.getImageData(0, 0, canvas.width, canvas.height);
  
  const currData = currImgData.data;
  const origData = origImgData.data;
  const len = currData.length;
  
  let modified = false;
  
  // アルファ値が255未満（消しゴムで消された箇所）を元画像のピクセルで復元
  for (let i = 3; i < len; i += 4) {
    if (currData[i] < 255) {
      currData[i - 3] = origData[i - 3]; // R
      currData[i - 2] = origData[i - 2]; // G
      currData[i - 1] = origData[i - 1]; // B
      currData[i] = origData[i];         // A
      modified = true;
    }
  }
  
  if (modified) {
    ctx.putImageData(currImgData, 0, 0);
  }
}

function getFitZoomLevel(w, h) {
  const workspace = document.querySelector('.workspace');
  if (!workspace) return 1.0;
  
  // マージン（上下左右40px）を引いた実表示エリア
  const maxW = Math.max(200, workspace.clientWidth - 40);
  const maxH = Math.max(200, workspace.clientHeight - 40);
  
  // はみ出さないスケールを算出
  const scaleX = maxW / w;
  const scaleY = maxH / h;
  const fitScale = Math.min(scaleX, scaleY);
  
  // 100% (1.0) を上限とし、0.2未満にならないように
  return Math.max(0.2, Math.min(1.0, fitScale));
}

// Initialize Application
initEvents();
setTool('brush');
updateColor('#3b82f6');
