document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const layersList = document.getElementById('layers-list');
    const addLayerBtn = document.getElementById('add-layer-btn');
    const deleteLayerBtn = document.getElementById('delete-layer-btn');
    const blendingModeSelect = document.getElementById('blending-mode-select');
    const brushStyleSelect = document.getElementById('brush-style-select');
    const brushToolBtn = document.getElementById('brush-tool');
    const eraserToolBtn = document.getElementById('eraser-tool');
    const colorPicker = document.getElementById('color-picker');
    const sizeSlider = document.getElementById('size-slider');
    const canvasWrapper = document.getElementById('canvas-wrapper');
    const toggleOrientationBtn = document.getElementById('toggle-orientation-btn');
    const canvasWidthInput = document.getElementById('canvas-width');
    const canvasHeightInput = document.getElementById('canvas-height');
    const resizeCanvasBtn = document.getElementById('resize-canvas-btn');
    const canvasContainer = document.getElementById('canvas-container');
    const saveBtn = document.getElementById('saveBtn');
    const eyedropperBtn = document.getElementById("eyedropperBtn1");




  
    document.getElementById('bgColorPicker').addEventListener('input', (e) => {
    setBackgroundColor(e.target.value);
});


    // Variabel utama
   
canvas.width = 1200; // Gunakan nilai default
canvas.height = 700;
     let isDrawing = false;
    let currentTool = 'brush';
    let currentColor = '#000000';
    let currentSize = 5;
    let brushStyle = 'normal';
    let lastX, lastY;
    let mouseX = 0, mouseY = 0;
    let selection = null;
    let isSelecting = false;
    let currentOpacity = 1.0;
    let isEmberActive = true;
    let selectionImageData = null;
    let isMovingSelection = false;
    let isResizingSelection = false;
    let moveStart = null;
    let previewOffset = {dx:0, dy:0};
    let lastTapTime = 0;
    let perspectiveCorners = [];  
    let draggingCorner = null;
    let selectionBuffer = null;  
    // Layer dan Blending
    let layers = [];
    let activeLayerIndex = 0;
    let backgroundCanvas;
    // Riwayat untuk undo/redo
    let history = [];
    let historyIndex = -1;
    let drawTimeout = null;
    // Kontrol zoom & pan
    let scale = 1.0;
    let panX = 0;
    let panY = 0;
    const MAX_SCALE = 4;
    const MIN_SCALE = 0.5;




  
    // Variabel untuk pan mouse
    let isPanning = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Variabel untuk pan dan zoom sentuhan
    let initialTouches = null;
    lastX = null;
    lastY = null;


    // Drag and drop variables
    let draggedItem = null;
    let dragStartIndex = -1;

    // --- Fungsi Utama ---
    function getTransformedCoordinates(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left - panX) / scale;
        const y = (clientY - rect.top - panY) / scale;
        return { x, y };
    }



canvas.addEventListener("mousedown", handleCanvasEvent);
canvas.addEventListener("touchstart", handleCanvasEvent, { passive: false });

function handleCanvasEvent(e) {
  if (currentTool === "brush") {
    startDrawing(e);
  } else if (currentTool === "eyedropper") {
    pickColor(e);
  }
  // bisa ditambah tool lain: eraser, move, resize, dll
}








// listener global

function pickColor(e) {
  const rect = canvas.getBoundingClientRect();
  const { x, y } = getEventXY(e);
  const px = Math.floor(x - rect.left);
  const py = Math.floor(y - rect.top);

  const radius = currentSize * 2; // area sampling
  const imgData = ctx.getImageData(px - radius/2, py - radius/2, radius, radius);
  const data = imgData.data;

  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i+3];
    if (alpha > 0) { // hanya pixel yang ada warnanya
      r += data[i];
      g += data[i+1];
      b += data[i+2];
      count++;
    }
  }

  if (count > 0) {
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    const hex = rgbToHex(r, g, b);

    // update state
    currentColor = hex;
    colorPicker.value = hex;

    // keluar dari mode eyedropper → balik ke brush
    currentTool = "brush";
    eyedropperActive = false;
    previewBubble.style.display = "none";
  } else {
    console.warn("Area transparan, tidak ada warna terambil");
  }
}




eyedropperBtn.addEventListener("click", () => {
  currentTool = "eyedropper";
  eyedropperActive = true;
  previewBubble.style.display = "block";
  canvas.classList.add("eyedropper-active"); // ubah cursor
});






document.getElementById("pov").addEventListener("click", () => {
  if (!selection) {
    alert("Nothing is selected!");
    return;
  }

  currentTool = "perspective";

  const layerCtx = layers[activeLayerIndex].canvas.getContext("2d");

  // getSelectionBounds must return { x, y, w, h }
  const { x, y, w, h } = getSelectionBounds();
  if (w <= 0 || h <= 0) {
    console.warn("Selection bounds invalid:", { x, y, w, h });
    return;
  }

  // copy selection into buffer
  selectionBuffer = document.createElement("canvas");
  selectionBuffer.width = w;
  selectionBuffer.height = h;
  const bufCtx = selectionBuffer.getContext("2d");
  bufCtx.drawImage(layerCtx.canvas, x, y, w, h, 0, 0, w, h);

  // clear selected area from layer
  layerCtx.clearRect(x, y, w, h);

  // initialize corners (clockwise from top-left)
  perspectiveCorners = [
    { x: x,     y: y     }, // top-left
    { x: x + w, y: y     }, // top-right
    { x: x + w, y: y + h }, // bottom-right
    { x: x,     y: y + h }  // bottom-left
  ];

  isTransformingSelection = true;
});



canvas.addEventListener("mousedown", e => {
  if (currentTool !== "perspective") return;
  const { x, y } = getTransformedCoordinates(...Object.values(getEventXY(e)));

  // cek jarak ke tiap corner
  perspectiveCorners.forEach((corner, i) => {
    const dx = x - corner.x;
    const dy = y - corner.y;
    if (Math.hypot(dx, dy) < 20) { // radius 10px
      draggingCorner = i;
    }
  });
});

canvas.addEventListener("mousemove", e => {
  if (currentTool !== "perspective" || draggingCorner === null) return;
  const { x, y } = getTransformedCoordinates(...Object.values(getEventXY(e)));

  // update corner yang sedang di-drag
  perspectiveCorners[draggingCorner] = { x, y };
  renderPerspectivePreview();
});

canvas.addEventListener("mouseup", () => {
  draggingCorner = null;
  commitPerspective()
  
});





 

// helper bilinear interpolation





//btn pindahkan
document.getElementById("pindahkan").addEventListener("click", () => {
  if (!selection) {
     alert("Nothing is selected!");
    return;
  }
  currentTool = "move";

  const ctx = layers[activeLayerIndex].canvas.getContext("2d");
  const {x,y,w,h} = getSelectionBounds();

  // copy isi seleksi ke buffer
  selectionBuffer = document.createElement("canvas");
  selectionBuffer.width = w;
  selectionBuffer.height = h;
  selectionBuffer.getContext("2d").drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);

  // hapus isi dari layar
  ctx.clearRect(x, y, w, h);

  previewOffset = {dx:0, dy:0};
  isMovingSelection = true;
});

canvas.addEventListener("mousemove", e => {
  const {x,y} = getTransformedCoordinates(...Object.values(getEventXY(e)));

  if (isSelecting) {
    selection.endX = x;
    selection.endY = y;
    render(); 
  }

  if (isMovingSelection) {
    previewOffset.dx = x - moveStart.x;
    previewOffset.dy = y - moveStart.y;
    render(); 
  }

  if (isResizingSelection) {
    const dx = x - moveStart.x;
    const dy = y - moveStart.y;

    previewOffset.dx = dx;
    previewOffset.dy = dy;
    render(); 
  }
});


canvas.addEventListener("mouseup", e => {
  if (currentTool !== "move") return;

  if (isMovingSelection) {
    commitMove();
  } else if (isResizingSelection) {
    commitResize();
  }
});


canvas.addEventListener("pointermove", e => {
  const { x, y } = getTransformedCoordinates(...Object.values(getEventXY(e)));

  if (isSelecting) {
    selection.endX = x;
    selection.endY = y;
    render();
  }

  if (isMovingSelection) {
    previewOffset.dx = x - moveStart.x;
    previewOffset.dy = y - moveStart.y;
    render();
  }

  if (isResizingSelection) {
    const dx = x - moveStart.x;
    const dy = y - moveStart.y;

    previewOffset.dx = dx;
    previewOffset.dy = dy;
    render();
  }
});

// Handler untuk lepas pointer
canvas.addEventListener("pointerup", e => {
  if (currentTool !== "move") return;

  if (isMovingSelection) {
    commitMove();
  } else if (isResizingSelection) {
    commitResize();
  }
});










// aktifkan tool seleksi saat tombol diklik
document.getElementById("select-area").addEventListener("click", () => {
  currentTool = "select";
  console.log("Tool aktif: Seleksi Area");
});

canvas.addEventListener("mousedown", e => {
  if (currentTool !== "select") return;
 if (e.button !== undefined && e.button !== 0) return; // hanya klik kiri

  const {x,y} = getTransformedCoordinates(...Object.values(getEventXY(e)));

  // bikin seleksi baru
  isSelecting = true;
  selection = {startX:x, startY:y, endX:x, endY:y};
  document.getElementById("selection-toolbar").style.display = "block";
});

canvas.addEventListener("mousemove", e => {
  if (currentTool !== "select" || !isSelecting) return;
  const {x,y} = getTransformedCoordinates(...Object.values(getEventXY(e)));

  selection.endX = x;
  selection.endY = y;
  render(); // marching ants
});

canvas.addEventListener("mouseup", e => {
  if (currentTool !== "select") return;
   if (e.button !== undefined && e.button !== 0) return;

  if (isSelecting) {
    isSelecting = false;
    const ctx = layers[activeLayerIndex].canvas.getContext("2d");
    const {w,h} = getSelectionBounds();
    selectionBuffer = document.createElement("canvas");
    selectionBuffer.width = w;
    selectionBuffer.height = h;
    selectionBuffer.getContext("2d")
      .drawImage(ctx.canvas, selection.startX, selection.startY, w,h, 0,0,w,h);
  }
});







canvas.addEventListener("touchstart", e => {
  if (currentTool !== "select") return;
  e.preventDefault();
  const {x,y} = getTransformedCoordinates(...Object.values(getEventXY(e)));

  if (e.touches.length === 1) {
    // satu jari → bikin seleksi baru
    isSelecting = true;
    selection = {startX:x, startY:y, endX:x, endY:y};
  } else if (e.touches.length === 2 && selection) {
   
    const handle = getHandleAt(x,y);
    if(handle){
      isResizingSelection = true;
      resizeHandle = handle;
      moveStart = {x,y};
    } else {
      isMovingSelection = true;
      moveStart = {x,y};
    }
  }
   document.getElementById("selection-toolbar").style.display = "block";
}, {passive:false});

canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  const touch = e.touches[0];
  const {x,y} = getTransformedCoordinates(touch.clientX, touch.clientY);

  if (isSelecting) {
    selection.endX = x;
    selection.endY = y;
    render();
  }

  if (isMovingSelection) {
    previewOffset.dx = x - moveStart.x;
    previewOffset.dy = y - moveStart.y;
    render();
  }

  if (isResizingSelection) {
    previewOffset.dx = x - moveStart.x;
    previewOffset.dy = y - moveStart.y;
    render();
  }
}, {passive:false});

canvas.addEventListener("touchend", e => {
  e.preventDefault();
  const {x,y} =getTransformedCoordinates(...Object.values(getEventXY(e)));

  if (isSelecting) {
    isSelecting = false;
    const ctx = layers[activeLayerIndex].canvas.getContext("2d");
    const {w,h} = getSelectionBounds();
    selectionBuffer = document.createElement("canvas");
    selectionBuffer.width = w;
    selectionBuffer.height = h;
    selectionBuffer.getContext("2d")
      .drawImage(ctx.canvas, selection.startX, selection.startY, w,h, 0,0,w,h);
  }

  if (isMovingSelection) {
    const ctx = layers[activeLayerIndex].canvas.getContext("2d");
    const {w,h} = getSelectionBounds();
    ctx.clearRect(selection.startX, selection.startY, w, h);
    ctx.drawImage(selectionBuffer, selection.startX+previewOffset.dx, selection.startY+previewOffset.dy);

    selection.startX += previewOffset.dx;
    selection.endX += previewOffset.dx;
    selection.startY += previewOffset.dy;
    selection.endY += previewOffset.dy;

    previewOffset = {dx:0,dy:0};
    isMovingSelection=false;
  }

  if (isResizingSelection) {
    const ctx = layers[activeLayerIndex].canvas.getContext("2d");
    const {w,h} = getSelectionBounds();
    const newW = w + previewOffset.dx;
    const newH = h + previewOffset.dy;

    ctx.clearRect(selection.startX, selection.startY, w, h);
    ctx.drawImage(selectionBuffer, selection.startX, selection.startY, newW, newH);

    selection.endX = selection.startX + newW;
    selection.endY = selection.startY + newH;

    const newBuffer = document.createElement("canvas");
    newBuffer.width = newW;
    newBuffer.height = newH;
    newBuffer.getContext("2d")
      .drawImage(ctx.canvas, selection.startX, selection.startY, newW,newH, 0,0,newW,newH);
    selectionBuffer = newBuffer;

    previewOffset = {dx:0,dy:0};
    isResizingSelection=false;
  }
}, {passive:false});












// pop up
document.getElementById("flip-h").onclick = () => applyTransform("flipH");
document.getElementById("flip-v").onclick = () => applyTransform("flipV");
document.getElementById("rotate").onclick = () => applyTransform("rotate");
document.getElementById("skew").onclick = () => applyTransform("skew");

function applyTransform(type) {
  if (!selectionBuffer) return;
  const {x,y,w,h} = getSelectionBounds();

  const ctx = layers[activeLayerIndex].canvas.getContext("2d");
  ctx.save();
  ctx.clearRect(x, y, w, h);
  ctx.translate(x + w/2, y + h/2);

  if (type === "flipH") ctx.scale(-1,1);
  if (type === "flipV") ctx.scale(1,-1);
  if (type === "rotate") ctx.rotate(Math.PI/2);
  if (type === "skew") ctx.transform(1,0.3,0.3,1,0,0);

  ctx.drawImage(selectionBuffer, -w/2, -h/2, w, h);
  ctx.restore();

  // update buffer baru dari hasil transformasi
  const newBuffer = document.createElement("canvas");
  newBuffer.width = w;
  newBuffer.height = h;
  newBuffer.getContext("2d").drawImage(ctx.canvas, x, y, w, h, 0, 0, w, h);
  selectionBuffer = newBuffer;

  hideSelectionToolbar();
  render();
}

function hideSelectionToolbar() {
  const toolbar = document.getElementById("selection-toolbar");
  if (toolbar) {
    toolbar.style.display = "block";
  }
}



document.getElementById("cancel-selection").onclick = () => {
  selection = null;
  selectionBuffer = null;
  isSelecting = false;
  document.getElementById("selection-toolbar").style.display = "none";
  render();
};

function getSelectionBounds() {
  const x = Math.min(selection.startX, selection.endX);
  const y = Math.min(selection.startY, selection.endY);
  const w = Math.abs(selection.endX - selection.startX);
  const h = Math.abs(selection.endY - selection.startY);
  return { x, y, w, h };
}



function getHandleAt(x,y){
  const size = 10;
  const handles = {
    tl:[selection.startX, selection.startY],
    tr:[selection.endX, selection.startY],
    bl:[selection.startX, selection.endY],
    br:[selection.endX, selection.endY]
  };
  for(const [key,[hx,hy]] of Object.entries(handles)){
    if(x>=hx-size && x<=hx+size && y>=hy-size && y<=hy+size){
      return key;
    }
  }
  return null;
}











function showTransformHandles(sel) {

  octx.strokeStyle = "blue";
  octx.setLineDash([6,2]);
  octx.strokeRect(sel.startX, sel.startY, sel.endX - sel.startX, sel.endY - sel.startY);
  octx.setLineDash([]);

  // gambar handle di tiap sudut
  const size = 8;
  const corners = [
    [sel.startX, sel.startY],
    [sel.endX, sel.startY],
    [sel.endX, sel.endY],
    [sel.startX, sel.endY]
  ];
  octx.fillStyle = "white";
  octx.strokeStyle = "black";
  corners.forEach(([cx,cy]) => {
    octx.fillRect(cx-size/2, cy-size/2, size, size);
    octx.strokeRect(cx-size/2, cy-size/2, size, size);
  });
}




function renderPerspectivePreview() {
  if (!selectionBuffer || !perspectiveCorners) return;
  const ctx = layers[activeLayerIndex].canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const [p0, p1, p2, p3] = perspectiveCorners;
  const bw = selectionBuffer.width;
  const bh = selectionBuffer.height;

  const steps = 20; // semakin besar semakin halus
  const bufCtx = selectionBuffer.getContext("2d");

  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const u0 = i / steps, v0 = j / steps;
      const u1 = (i+1) / steps, v1 = (j+1) / steps;

      // hitung posisi 4 titik kecil di polygon target
      const dst0 = bilerp(p0,p1,p2,p3,u0,v0);
      const dst1 = bilerp(p0,p1,p2,p3,u1,v0);
      const dst2 = bilerp(p0,p1,p2,p3,u1,v1);
      const dst3 = bilerp(p0,p1,p2,p3,u0,v1);

      // ambil potongan kecil dari buffer
      const sx = u0 * bw;
      const sy = v0 * bh;
      const sw = (u1-u0) * bw;
      const sh = (v1-v0) * bh;
      const piece = bufCtx.getImageData(sx, sy, sw, sh);

      
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(dst0.x, dst0.y);
      ctx.lineTo(dst1.x, dst1.y);
      ctx.lineTo(dst2.x, dst2.y);
      ctx.lineTo(dst3.x, dst3.y);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(selectionBuffer, sx, sy, sw, sh,
        dst0.x, dst0.y, dst2.x-dst0.x, dst2.y-dst0.y);
      ctx.restore();
      
    }
  }
 render()
}

// bilinear interpolation helper
function bilerp(p0,p1,p2,p3,u,v) {
  const x = (1-v)*((1-u)*p0.x + u*p1.x) + v*((1-u)*p3.x + u*p2.x);
  const y = (1-v)*((1-u)*p0.y + u*p1.y) + v*((1-u)*p3.y + u*p2.y);
  return {x,y};
}






function commitMove() {
  const ctx = layers[activeLayerIndex].canvas.getContext("2d");
  const {x,y,w,h} = getSelectionBounds();

  // hapus isi lama
  ctx.clearRect(x, y, w, h);

  // gambar buffer di posisi baru
  ctx.drawImage(selectionBuffer, x + previewOffset.dx, y + previewOffset.dy, w, h);

  // update koordinat seleksi
  selection.startX += previewOffset.dx;
  selection.endX += previewOffset.dx;
  selection.startY += previewOffset.dy;
  selection.endY += previewOffset.dy;

  previewOffset = {dx:0, dy:0};
  isMovingSelection = false;
  render();
}




function commitResize() {
  const ctx = layers[activeLayerIndex].canvas.getContext("2d");
  const {x,y,w,h} = getSelectionBounds();

  const newW = Math.max(1, w + previewOffset.dx);
  const newH = Math.max(1, h + previewOffset.dy);

  // hapus isi lama
  ctx.clearRect(x, y, w, h);

  // gambar buffer dengan ukuran baru
  ctx.drawImage(selectionBuffer, x, y, newW, newH);

  // update koordinat seleksi
  selection.endX = selection.startX + newW;
  selection.endY = selection.startY + newH;

  // buffer baru dari buffer lama
  const newBuffer = document.createElement("canvas");
  newBuffer.width = newW;
  newBuffer.height = newH;
  newBuffer.getContext("2d").drawImage(selectionBuffer, 0, 0, w, h, 0, 0, newW, newH);
  selectionBuffer = newBuffer;

  previewOffset = {dx:0, dy:0};
  isResizingSelection = false;
  render();
}






function drawHandles(ctx) {
  const size = 8; // ukuran pixel di layar
  const corners = [
    {x: selection.startX, y: selection.startY},
    {x: selection.endX,   y: selection.startY},
    {x: selection.endX,   y: selection.endY},
    {x: selection.startX, y: selection.endY}
  ];

  ctx.save();
  ctx.setTransform(1,0,0,1,0,0); 
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";

  corners.forEach(c => {
    
    const screenX = c.x * scale + panX;
    const screenY = c.y * scale + panY;
    ctx.fillRect(screenX - size/2, screenY - size/2, size, size);
    ctx.strokeRect(screenX - size/2, screenY - size/2, size, size);
  });

  ctx.restore();
}








document.getElementById('bucket-tool').addEventListener('click', () => {
  currentTool = 'bucket';
  console.log("Tool aktif: Ember"); 
});



// Konversi hex (#rrggbb) ke RGBA array
function hexToRgba(hex, alpha = 1.0) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b, Math.floor(alpha * 255)];
}

// Flood fill sederhana (DFS stack)
function bucketFillLayer(layers, activeLayerIndex, x, y, fillColor, tolerance = 0) {
  const layer = layers[activeLayerIndex].canvas; // ambil canvas layer aktif
  const ctxLayer = layer.getContext("2d");

  const w = layer.width;
  const h = layer.height;
  const imgData = ctxLayer.getImageData(0, 0, w, h);
  const data = imgData.data;

  const startIdx = (y * w + x) * 4;
  const targetColor = [
    data[startIdx],
    data[startIdx+1],
    data[startIdx+2],
    data[startIdx+3]
  ];

  function matchColor(idx) {
    return (
      Math.abs(data[idx]   - targetColor[0]) <= tolerance &&
      Math.abs(data[idx+1] - targetColor[1]) <= tolerance &&
      Math.abs(data[idx+2] - targetColor[2]) <= tolerance &&
      Math.abs(data[idx+3] - targetColor[3]) <= tolerance
    );
  }

  const stack = [[x, y]];
  const visited = new Set();

  while (stack.length) {
    const [px, py] = stack.pop();
    if (px < 0 || py < 0 || px >= w || py >= h) continue;

    const idx = (py * w + px) * 4;
    if (!matchColor(idx)) continue;
    if (visited.has(idx)) continue;
    visited.add(idx);

    // ubah pixel di layer aktif
    data[idx]   = fillColor[0];
    data[idx+1] = fillColor[1];
    data[idx+2] = fillColor[2];
    data[idx+3] = fillColor[3];

    stack.push([px+1, py]);
    stack.push([px-1, py]);
    stack.push([px, py+1]);
    stack.push([px, py-1]);
  }

  ctxLayer.putImageData(imgData, 0, 0);
  // tidak perlu panggil render() manual, karena update() loop akan redraw semua layer
   render(); 
}



canvas.addEventListener("click", (e) => {
  if (currentTool !== "bucket") return;

  const rect = canvas.getBoundingClientRect();
  const { x, y } = getEventXY(e);

  const px = Math.floor(x - rect.left);
  const py = Math.floor(y - rect.top);

  const rgba = hexToRgba(currentColor, currentOpacity);
  bucketFillLayer(layers, activeLayerIndex, px, py, rgba);
});

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault(); // cegah scroll/zoom default
  if (currentTool !== "bucket") return;

  const rect = canvas.getBoundingClientRect();
  const { x, y } = getEventXY(e);

  const px = Math.floor(x - rect.left);
  const py = Math.floor(y - rect.top);

  const rgba = hexToRgba(currentColor, currentOpacity);
  bucketFillLayer(layers, activeLayerIndex, px, py, rgba);
});



const toast = document.getElementById("toast");











    // Fungsi Save
  if (saveBtn) {
  saveBtn.addEventListener("click", () => {
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = canvas.width;
    finalCanvas.height = canvas.height;
    const finalCtx = finalCanvas.getContext("2d");

    // Background putih
    finalCtx.fillStyle = "white";
    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Background layer
    finalCtx.drawImage(backgroundCanvas, 0, 0);

    // Gabungkan semua layer
    layers.forEach(layer => {
      finalCtx.globalCompositeOperation = layer.blendingMode || "source-over";
      finalCtx.drawImage(layer.canvas, 0, 0);
    });

    // Export PNG
    const dataURL = finalCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "NIxuna paint.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Feedback toast
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  });
}











function getEventXY(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}




    function startDrawing(e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (isPanning) return;
        const { x, y } =  getTransformedCoordinates(...Object.values(getEventXY(e)));
        
        lastX = x;
        lastY = y;

 
         if (currentTool === "move") {
    const handle = getHandleAt(x,y);
    if (handle) {
      isResizingSelection = true;
      resizeHandle = handle;
      moveStart = {x,y};
    } else if (selection &&
               x >= selection.startX && x <= selection.endX &&
               y >= selection.startY && y <= selection.endY) {
      isMovingSelection = true;
      moveStart = {x,y};
    }
    return; // jangan masuk ke draw()
  }

 if (currentTool === "perspective") return;


   if (currentTool === "eyedropper") return;


         if (currentTool === 'select') {
    isSelecting = true;
    selection = { startX: x, startY: y, endX: x, endY: y };
    return; // <-- jangan masuk ke draw()
  }


         if (currentTool === 'bucket') {
        const rgba = hexToRgba(currentColor, currentOpacity);
        bucketFillLayer(layers, activeLayerIndex, x, y, rgba);
        saveState();
        return;
    }
 isDrawing = true;
        if (currentTool !== 'ruler') { 
        saveState(); 
        draw(e); 
    } else {
       
        console.log(`Mode Penggaris Aktif. Titik Awal: (${x.toFixed(2)}, ${y.toFixed(2)})`);
        }
         render(); 
    }

    function draw(e) {
    if (!isDrawing) return;
       if (e.touches && e.touches.length > 1) return;
    const { x, y } =  getTransformedCoordinates(...Object.values(getEventXY(e)));
    const activeLayer = layers[activeLayerIndex];
    const ctx = activeLayer.canvas.getContext('2d');

    ctx.save();
    ctx.lineWidth = currentSize;
    ctx.globalAlpha =  currentOpacity;

    // Tentukan tool
// Handler untuk ruler preview

  if (currentTool === "ruler"){ 

  const { x, y } = getTransformedCoordinates(...Object.values(getEventXY(e)));

  mouseX = x; 
  mouseY = y;
  render();
  return;
  }





    if (currentTool === 'brush') {
         ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = currentColor;
    ctx.lineCap = brushStyle === 'square' ? 'square' : 'round';
    ctx.lineJoin = brushStyle === 'square' ? 'bevel' : 'round';

    if (lastX != null && lastY != null) {
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
     
    }
       
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)'; 
        ctx.fillStyle = 'rgba(0,0,0,1)';
        } 
   

    // Tentukan tool
   

switch (brushStyle) {


          case 'normal':
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // hitung jarak gerakan brush (pakai nama unik)
          const bdx = x - lastX;
          const bdy = y - lastY;
          const bdist = Math.hypot(bdx, bdy);

          // lineWidth dinamis: makin pendek gerakan, makin kecil → ujung lancip
          const taper = Math.max(1, currentSize * (bdist / 20));
          ctx.lineWidth = taper;

          ctx.beginPath();
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
          break;


        case 'square':
            ctx.lineCap = 'square';
            ctx.lineJoin = 'bevel';
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            break;

        case 'dotted':
            ctx.setLineDash([1, currentSize * 2]);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.setLineDash([]); 
            break;

        case 'textured':
            ctx.globalAlpha = 0.3;
            const dist = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
            for (let i = 0; i < dist; i++) {
                const angle = Math.random() * Math.PI * 2;
                const offset = Math.random() * currentSize;
                const px = lastX + Math.cos(angle) * offset;
                const py = lastY + Math.sin(angle) * offset;
                ctx.beginPath();
                ctx.arc(px, py, currentSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            break;
          
   case 'watercolor':
    // 1. Perhitungan Aliran Pigmen (Flow Calculation)
    const randomizedSize = currentSize * (0.8 + Math.random() * 0.4);
    const dxw = x - lastX;
    const dyw = y - lastY;
    const travel = Math.sqrt(dxw * dxw + dyw * dyw);
    // Pigmen flow lebih pekat
    const pigmentFlow = Math.max(0.2, 1.8 - travel / 7); 

    // Atur Blending Mode ke 'multiply'
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = currentColor;

  
    for (let i = 0; i < 70; i++) { // Jumlah partikel ditingkatkan lagi (60 -> 70)
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * randomizedSize * 1.0; 
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;

        // Ukuran partikel yang lebih besar dan berbentuk persegi panjang
        const blotchWidth = randomizedSize * 0.15 * (0.5 + Math.random());
        const blotchHeight = blotchWidth * (0.3 + Math.random() * 0.7);
        
        // Opasitas Ditingkatkan (0.003 -> 0.015) agar tidak terlalu transparan
        ctx.globalAlpha = 0.60 * pigmentFlow; 
        
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle); // Rotasi mengikuti arah acak partikel
        ctx.fillRect(-blotchWidth / 2, -blotchHeight / 2, blotchWidth, blotchHeight);
        ctx.restore();
    }

    // 3. Efek Tepi Menyebar (Bloom Effect yang Lebih Lembut)
    for (let i = 0; i < 30; i++) { 
        const angle = Math.random() * Math.PI * 2;
        // Jarak sedikit lebih jauh dari pusat
        const distance = randomizedSize * (1.0 + Math.random() * 0.5); 
        const jx = x + Math.cos(angle) * distance;
        const jy = y + Math.sin(angle) * distance;
        
        const edgeSize = randomizedSize * 0.04 * Math.random();
        // Opasitas sangat tipis dan difokuskan pada tepi
        ctx.globalAlpha = 0.70; 
        ctx.fillStyle = currentColor;
        ctx.beginPath();
        // Menggunakan arc/lingkaran kecil untuk efek 'sebaran air'
        ctx.arc(jx, jy, edgeSize, 0, Math.PI * 2);
        ctx.fill();
    }

    // 4. Grain Kertas Menyatu (Paper Texture)
    // Membuat canvas grain (PENTING: Pindahkan ini ke SETUP program agar tidak lambat!)
    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = grainCanvas.height = 128; 
    const gctx = grainCanvas.getContext('2d');
    gctx.fillStyle = '#fff';
    gctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2000; i++) { // Jumlah titik grain DITINGKATKAN untuk tekstur kuat
        gctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.007})`; 
        gctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
    }
    const paperGrain = ctx.createPattern(grainCanvas, 'repeat');
    
    // Terapkan Grain
    ctx.globalAlpha = 0.02 * pigmentFlow; // Grain lebih terlihat
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = paperGrain;
    ctx.fillRect(x - randomizedSize * 1.5, y - randomizedSize * 1.5, randomizedSize * 3, randomizedSize * 3);
    
    // 5. Reset Konteks Canvas
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    break;






            
  
    

   case 'blender':
     const radius = currentSize * 2;
  const imgData = ctx.getImageData(x - radius/2, y - radius/2, radius, radius);
  const data = imgData.data;

  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i+3];
    if (alpha > 0) { // hanya pixel yang ada warnanya
      r += data[i];
      g += data[i+1];
      b += data[i+2];
      count++;
    }
  }

  if (count > 0) {
    r = r / count;
    g = g / count;
    b = b / count;

    const blendedColor = `rgba(${r},${g},${b},0.1)`; // warna rata-rata

    const offX = x - lastX;
    const offY = y - lastY;
    const travel = Math.sqrt(offX*offX + offY*offY);

    for (let step = 0; step < travel; step++) {
      const posX = lastX + (offX / travel) * step;
      const posY = lastY + (offY / travel) * step;

      ctx.beginPath();
      ctx.arc(posX, posY, currentSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = blendedColor;
      ctx.fill();
    }
  }
  break;

   





    case 'airbrush':
        ctx.strokeStyle = currentColor; 
    ctx.lineWidth = currentSize;
    
    ctx.globalCompositeOperation = 'lighten'; // Menciptakan efek pembauran cahaya
    ctx.globalAlpha = 0.02; // Kuas sangat transparan
    
    // Gunakan logika kuas normal (hanya garis atau titik)
    const dx4 = x - lastX;
    const dy4 = y - lastY;
    const distance4 = Math.sqrt(dx4 * dx4 + dy4 * dy4);

    // Iterasi agar terlihat halus
    for (let i = 0; i < distance4; i++) {
        const stepX = lastX + (dx4 / distance4) * i;
        const stepY = lastY + (dy4 / distance4) * i;
        
        ctx.beginPath();
        ctx.arc(stepX, stepY, currentSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
    }
    
    // Kembalikan ke normal setelah selesai
    ctx.globalCompositeOperation = 'source-over'; 
    ctx.globalAlpha = currentOpacity;
    break;

    case 'calligraphy':
   
    const d0 = x - lastX;
    const d1 = y - lastY;
    const speed = Math.sqrt(d0 * d0 + d1 * d1);

    
    const pressure = Math.max(0.2, 2 - speed / 10);

   
    ctx.lineWidth = currentSize * pressure * 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.quadraticCurveTo(lastX, lastY, x, y);
    ctx.stroke();

    ctx.lineWidth = currentSize * pressure;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.quadraticCurveTo(lastX, lastY, x, y);
    ctx.stroke();

    ctx.lineWidth = currentSize * pressure * 0.5;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    break;


    case 'spray':
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < currentSize * 5; i++) {
            const offsetX = (Math.random() - 0.5) * currentSize * 2;
            const offsetY = (Math.random() - 0.5) * currentSize * 2;
            ctx.beginPath();
            ctx.arc(x + offsetX, y + offsetY, Math.random() * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = ctx.strokeStyle; // pakai warna brush aktif
            ctx.fill();
        }
        break;
           case 'fuzzy':
        ctx.globalAlpha = 0.2; // opasitas rendah
        ctx.lineCap = 'round';
        ctx.lineWidth = currentSize / 5;

        const distFurry = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));
        for (let i = 0; i < distFurry; i += currentSize / 4) {
            const stepX = lastX + (x - lastX) * (i / distFurry);
            const stepY = lastY + (y - lastY) * (i / distFurry);

            for (let j = 0; j < 5; j++) {
                const angle = Math.atan2(y - lastY, x - lastX) + (Math.random() - 0.5) * (Math.PI / 4);
                const length = Math.random() * (currentSize * 2);

                const startX = stepX + (Math.random() - 0.5) * currentSize / 2;
                const startY = stepY + (Math.random() - 0.5) * currentSize / 2;
                const endX = startX + Math.cos(angle) * length;
                const endY = startY + Math.sin(angle) * length;

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }
        }
        break;

    case 'oil':
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = currentSize * 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.globalAlpha = 0.2;
        ctx.lineWidth = currentSize * 2.5;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        break;

    case 'charcoal':
        ctx.globalAlpha = 0.1;
        ctx.lineWidth = currentSize * 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(
                lastX + (Math.random() * 2 - 1) * currentSize / 2,
                lastY + (Math.random() * 2 - 1) * currentSize / 2
            );
            ctx.lineTo(
                x + (Math.random() * 2 - 1) * currentSize / 2,
                y + (Math.random() * 2 - 1) * currentSize / 2
            );
            ctx.stroke();
        }
        break;

    case 'marker':
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = currentSize * 2;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'bevel';
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        break;

    case 'pixel':
        ctx.fillStyle = ctx.strokeStyle; // pakai warna brush aktif
        ctx.fillRect(Math.floor(x), Math.floor(y), currentSize, currentSize);
        break;

    case 'splatter':
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = ctx.strokeStyle; // pakai warna brush aktif
        for (let i = 0; i < currentSize * 3; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * currentSize * 2;
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            ctx.beginPath();
            ctx.arc(px, py, Math.random() * 2, 0, 2 * Math.PI);
            ctx.fill();
        }
        break;
            case 'fur':
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = currentSize * 0.5;
        ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI / 2 - Math.PI / 4;
            const length = Math.random() * currentSize * 1.5;
            const offsetX = length * Math.cos(angle);
            const offsetY = length * Math.sin(angle);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + offsetX, y + offsetY);
            ctx.stroke(); // warna ikut ctx.strokeStyle (currentColor)
        }
        break;

    case 'wet-paint':
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.08; // transparan tipis
        ctx.fillStyle = currentColor; // pakai warna aktif

        const distX = x - lastX;
        const distY = y - lastY;
        const segmentDist = Math.sqrt(distX * distX + distY * distY);

        for (let i = 0; i < segmentDist; i++) {
            const stepX = lastX + (distX / segmentDist) * i;
            const stepY = lastY + (distY / segmentDist) * i;

            for (let j = 0; j < 5; j++) {
                const randomOffsetX = (Math.random() - 0.5) * currentSize * 0.8;
                const randomOffsetY = (Math.random() - 0.5) * currentSize * 0.8;

                ctx.beginPath();
                ctx.arc(
                    stepX + randomOffsetX,
                    stepY + randomOffsetY,
                    Math.random() * (currentSize / 2),
                    0,
                    Math.PI * 2
                );
                ctx.fill(); // warna ikut fillStyle = currentColor
            }
        }
        break;

    case 'wave':
        ctx.lineWidth = currentSize * 1.5;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);

        // efek gelombang dinamis
        const waveOffset = Math.sin(Date.now() / 100) * (currentSize / 2);
        ctx.lineTo(x, y + waveOffset);
        ctx.stroke(); // warna ikut strokeStyle = currentColor
        break;
        // --- 10 BRUSH BARU ---

    case 'light':
        ctx.lineWidth = currentSize / 2;
        ctx.globalAlpha = 0.1;
        ctx.shadowBlur = currentSize;
        ctx.shadowColor = currentColor; // pakai warna aktif
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
        break;

    case 'mesh':
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = currentColor; // pakai warna aktif
        const size = currentSize * 2;
        const rows = Math.ceil(Math.abs(y - lastY) / size);
        const cols = Math.ceil(Math.abs(x - lastX) / size);

        for (let i = 0; i <= rows; i++) {
            for (let j = 0; j <= cols; j++) {
                ctx.beginPath();
                ctx.arc(x - (j * size), y - (i * size), 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        break;

    case 'drip':
        ctx.lineWidth = currentSize;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.random() * 5 - 2.5, y + Math.random() * currentSize * 3);
        ctx.stroke();
        ctx.lineCap = 'round';
        break;

    case 'blob':
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = currentColor; // pakai warna aktif
        ctx.beginPath();
        ctx.arc(
            x + Math.random() * 5 - 2.5,
            y + Math.random() * 5 - 2.5,
            currentSize * 1.5,
            0,
            Math.PI * 2
        );
        ctx.fill();
        ctx.globalAlpha = 1.0;
        break;

    case 'chalk':
        ctx.lineCap = 'square';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.1;
        ctx.lineWidth = currentSize;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(
                x + (Math.random() - 0.5) * currentSize,
                y + (Math.random() - 0.5) * currentSize
            );
            ctx.stroke();
        }
        break;

    case 'hologram':
        ctx.globalAlpha = 0.8;
        ctx.lineWidth = currentSize / 4;
        ctx.lineCap = 'round';
        const angleOffset = Math.atan2(y - lastY, x - lastX);
        for (let i = 0; i < 3; i++) {
            ctx.strokeStyle = `hsl(${(360 / 3) * i}, 100%, 50%)`;
            ctx.beginPath();
            ctx.moveTo(
                lastX + Math.cos(angleOffset) * currentSize,
                lastY + Math.sin(angleOffset) * currentSize
            );
            ctx.lineTo(
                x + Math.cos(angleOffset) * currentSize,
                y + Math.sin(angleOffset) * currentSize
            );
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        break;

    case 'emboss':
        ctx.lineWidth = currentSize;
        ctx.lineCap = 'round';

        // highlight putih
        ctx.strokeStyle = '#FFFFFF';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(lastX + 1, lastY + 1);
        ctx.lineTo(x + 1, y + 1);
        ctx.stroke();

        // garis utama warna aktif
        ctx.strokeStyle = currentColor;
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();

        // bayangan hitam
        ctx.strokeStyle = '#000000';
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(lastX - 1, lastY - 1);
        ctx.lineTo(x - 1, y - 1);
        ctx.stroke();
        break;

    case 'chain':
        const linkWidth = currentSize * 2.5;
        const linkHeight = currentSize * 1.5;
        const spacing = linkWidth * 0.8;

        const chainDistX = x - lastX;
        const chainDistY = y - lastY;
        const distance9 = Math.sqrt(chainDistX * chainDistX + chainDistY * chainDistY);
        const linkCount = Math.floor(distance9 / spacing);
        const angle = Math.atan2(chainDistY, chainDistX);

        const draw3DLink = (ctx, linkX, linkY, isVertical) => {
            ctx.save();
            ctx.translate(linkX, linkY);

            let finalAngle = angle;
            if (isVertical) {
                finalAngle += Math.PI / 2;
            }
            ctx.rotate(finalAngle);

            // bayangan
            ctx.beginPath();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = currentSize * 0.7;
            ctx.globalAlpha = 0.3;
            ctx.lineCap = 'round';
            ctx.arc(-linkWidth / 2, 0, linkHeight / 2, Math.PI * 0.5, Math.PI * 1.5);
            ctx.arc(linkWidth / 2, 0, linkHeight / 2, -Math.PI * 0.5, Math.PI * 0.5);
            ctx.stroke();

            // badan utama
            ctx.beginPath();
            ctx.strokeStyle = currentColor; // warna aktif
            ctx.lineWidth = currentSize * 0.5;
            ctx.globalAlpha = 1.0;
            ctx.lineCap = 'round';
            ctx.arc(-linkWidth / 2, 0, linkHeight / 2, Math.PI * 0.5, Math.PI * 1.5);
            ctx.arc(linkWidth / 2, 0, linkHeight / 2, -Math.PI * 0.5, Math.PI * 0.5);
            ctx.stroke();

            // highlight putih
            ctx.beginPath();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = currentSize * 0.15;
            ctx.globalAlpha = 0.8;
            ctx.arc(-linkWidth / 2, 0, linkHeight / 2, Math.PI * 0.5, Math.PI * 1.5);
            ctx.stroke();

            ctx.restore();
        };

        for (let i = 0; i < linkCount; i++) {
            const ratio = i / linkCount;
            const linkX = lastX + chainDistX * ratio;
            const linkY = lastY + chainDistY * ratio;
            draw3DLink(ctx, linkX, linkY, i % 2 === 0);
        }
        break;

   
    case 'maple-leaf':
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = currentColor; // pakai warna aktif
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.random() * Math.PI * 2);

        ctx.beginPath();
        ctx.moveTo(0, -currentSize * 2);
        ctx.lineTo(currentSize, -currentSize);
        ctx.lineTo(currentSize * 2, -currentSize);
        ctx.lineTo(currentSize, 0);
        ctx.lineTo(currentSize * 2, currentSize);
        ctx.lineTo(-currentSize * 2, currentSize);
        ctx.lineTo(-currentSize, 0);
        ctx.lineTo(-currentSize * 2, -currentSize);
        ctx.lineTo(-currentSize, -currentSize);
        ctx.closePath();

        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1.0; // reset alpha
        break;

    case 'mist':
        ctx.globalAlpha = 0.05; // tipis/transparan
        ctx.lineWidth = currentSize * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = currentSize * 0.5;
        ctx.shadowColor = currentColor; // pakai warna aktif

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.shadowBlur = 0; // reset shadow
        ctx.globalAlpha = 1.0; // reset alpha
        break;
   
    }



  

    

    ctx.restore();

    lastX = x;
    lastY = y;
    render();
    }








// aktifkan filter blur
document.getElementById("blur-filter").addEventListener("click", () => {
  const activeLayer = layers[activeLayerIndex];
  const ctx = activeLayer.canvas.getContext('2d');

  // contoh blur cepat
  ctx.filter = 'blur(5px)';
  ctx.drawImage(activeLayer.canvas, 0, 0);
 

  console.log("Filter blur diterapkan");
   render(); 
});

// aktifkan penggaris
document.getElementById("ruler-tool").addEventListener("click", () => {
  currentTool = "ruler";
  console.log("Penggaris aktif: klik dan tarik untuk garis lurus");
});





    function stopDrawing(e) {
    if (!isDrawing) return;

    
    const { x, y } =  getTransformedCoordinates(...Object.values(getEventXY(e)));
    const activeLayer = layers[activeLayerIndex];
    const activeLayerCtx = activeLayer.canvas.getContext('2d');

   
    if (currentTool === 'ruler') {
        
        // Simpan state sebelum menggambar garis (untuk Undo)
        saveState(); 

        activeLayerCtx.save();
        activeLayerCtx.lineWidth = currentSize;
        activeLayerCtx.strokeStyle = currentColor;
        activeLayerCtx.globalCompositeOperation = 'source-over'; 
      

        // Gambar Garis Lurus dari Titik Awal (lastX, lastY) ke Titik Akhir (x, y)
        activeLayerCtx.beginPath();
        activeLayerCtx.moveTo(lastX, lastY); 
        activeLayerCtx.lineTo(x, y);         
        activeLayerCtx.stroke();
        activeLayerCtx.restore();
        
        console.log("Garis lurus digambar.");
    }
    
    
    if (currentTool !== 'ruler') {
        activeLayerCtx.closePath();
       
        saveState(); 
    }
    
    
    isDrawing = false;
    mouseX = -1; 
    mouseY = -1;
    
    updateThumbnail(activeLayerIndex);
    render(); 
}




 









   
// --- Manajemen Layer ---



function setBackgroundColor(color) {
    const bgCtx = backgroundCanvas.getContext('2d');
    bgCtx.clearRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    bgCtx.fillStyle = color;
    bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
    render();
}




function initLayers() {
    layers = [];

canvas.width = 1200; // Gunakan nilai default
canvas.height = 700;

    // Buat background terpisah
    backgroundCanvas = document.createElement('canvas');
    backgroundCanvas.width = canvas.width;
    backgroundCanvas.height = canvas.height;
    const bgCtx = backgroundCanvas.getContext('2d');
    bgCtx.fillStyle = 'white';
    bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

    // Tambahkan satu layer kosong di atas background
    addLayer();
    updateLayersPanel();
    render();
}

function addLayer() {
     const canvasElement = document.createElement('canvas');
      canvasElement.width = canvas.width;
    canvasElement.height = canvas.height;
    const newLayer = {
       canvas: canvasElement,
        opacity: 1.0,
        blendingMode: 'source-over',
        name: `Layer ${layers.length + 1}`
    };
   

    layers.push(newLayer);
    activeLayerIndex = layers.length - 1;
    updateLayersPanel();
    render();
    saveState();
}

function deleteLayer() {
    if (layers.length > 1) {
        layers.splice(activeLayerIndex, 1);
        activeLayerIndex = Math.min(activeLayerIndex, layers.length - 1);
        updateLayersPanel();
        render();
        saveState();
    }
}

function updateThumbnail(index) {
    const thumbnail = document.querySelector(`.layer-item[data-index="${index}"] canvas`);
    if (thumbnail) {
        const thumbCtx = thumbnail.getContext('2d');
        thumbCtx.clearRect(0, 0, thumbnail.width, thumbnail.height);
        thumbCtx.drawImage(layers[index].canvas, 0, 0, thumbnail.width, thumbnail.height);
    }
}

function updateLayersPanel() {
    if (!layersList) return;
    layersList.innerHTML = '';

    // tampilkan dari atas ke bawah
    for (let i = layers.length - 1; i >= 0; i--) {
        const layer = layers[i];
        const layerItem = document.createElement('div');
        layerItem.className = `layer-item ${i === activeLayerIndex ? 'active' : ''}`;
        layerItem.dataset.index = i;
        layerItem.draggable = true;

        const thumbnail = document.createElement('canvas');
        thumbnail.className = 'layer-thumbnail';
        thumbnail.width = 40;
        thumbnail.height = 40;
        layerItem.appendChild(thumbnail);
        updateThumbnail(i);

        const layerName = document.createElement('span');
        layerName.textContent = layer.name;
        layerItem.appendChild(layerName);

        layerItem.addEventListener('click', () => {
            activeLayerIndex = i;
            updateLayersPanel();
            if (blendingModeSelect) blendingModeSelect.value = layers[activeLayerIndex].blendingMode;
            render();
        });

        layersList.appendChild(layerItem);
    }
}

// Drag & drop hanya untuk layer selain background
if (layersList) {
    layersList.addEventListener('dragstart', (e) => {
        const targetItem = e.target.closest('.layer-item');
        if (targetItem) {
            draggedItem = targetItem;
            dragStartIndex = parseInt(targetItem.dataset.index);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData("layerIndex", dragStartIndex);
            setTimeout(() => targetItem.classList.add('dragging'), 0);
        }
    });

    layersList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(layersList, e.clientY);
        const draggingElement = document.querySelector('.dragging');
        if (!draggingElement) return;

        if (afterElement == null) {
            layersList.appendChild(draggingElement);
        } else {
            layersList.insertBefore(draggingElement, afterElement);
        }
    });

    layersList.addEventListener('drop', (e) => {
        e.preventDefault();

        const activeLayer = layers[activeLayerIndex];
        const domChildren = Array.from(layersList.children);

        // urutan DOM (atas → bawah) → array (bawah → atas)
        const newOrder = domChildren
            .map(child => layers[parseInt(child.dataset.index)])
            .reverse();

        layers = newOrder;
        activeLayerIndex = layers.indexOf(activeLayer);

        updateLayersPanel();
        render();
        saveState();
    });

    layersList.addEventListener('dragend', () => {
        const draggingElement = document.querySelector('.dragging');
        if (draggingElement) draggingElement.classList.remove('dragging');
        draggedItem = null;
        dragStartIndex = -1;
    });
}


// Pointer fallback untuk mobile/touch
layersList.addEventListener("pointerdown", e => {
  const targetItem = e.target.closest(".layer-item");
  if (!targetItem) return;
  targetItem.classList.add("dragging");
});

layersList.addEventListener("pointermove", e => {
  const draggingElement = document.querySelector(".dragging");
  if (!draggingElement) return;

  const { y } = getEventXY(e); // konsisten mouse/touch
  const afterElement = getDragAfterElement(layersList, y);

  if (afterElement == null) {
    layersList.appendChild(draggingElement);
  } else {
    layersList.insertBefore(draggingElement, afterElement);
  }
});

layersList.addEventListener("pointerup", () => {
  const draggingElement = document.querySelector(".dragging");
  if (draggingElement) draggingElement.classList.remove("dragging");

  // update urutan layer sama seperti di drop
  const activeLayer = layers[activeLayerIndex];
  const domChildren = Array.from(layersList.children);
  const newOrder = domChildren.map(child => layers[parseInt(child.dataset.index)]).reverse();
  layers = newOrder;
  activeLayerIndex = layers.indexOf(activeLayer);

  updateLayersPanel();
  render();
  saveState();
});





function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.layer-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Render: background dulu, lalu semua layer
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);
    

    // background
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(backgroundCanvas, 0, 0);

    // layer lain
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        ctx.globalCompositeOperation = layer.blendingMode;
         ctx.globalAlpha = layer.opacity; 
        ctx.drawImage(layer.canvas, 0, 0);
    }
    ctx.globalAlpha = 1.0;

    // brush preview
    if (!isDrawing && !isPanning) {
        const { x, y } = getTransformedCoordinates(mouseX, mouseY);
        ctx.beginPath();
        ctx.arc(x, y, currentSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = currentColor;
        ctx.globalAlpha = 0.7;
        ctx.fill();
    }

   renderSelection(ctx)
    ctx.restore();
    drawHandles(ctx)
    showTransformHandles(selection)
}

function update(currentTime) {
    render();
    lastRenderTime = currentTime;
    requestAnimationFrame(update);
}



function renderSelection(ctx) {
  if (!selection) return;
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "";
  ctx.strokeRect(
    selection.startX,
    selection.startY,
    selection.endX - selection.startX,
    selection.endY - selection.startY
  );
  ctx.restore();
}










    // --- Manajemen Riwayat (Undo/Redo) ---
    function saveState() {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        const layersData = layers.map(layer => ({
            dataURL: layer.canvas.toDataURL(),
            blendingMode: layer.blendingMode,
            name: layer.name
        }));
        history.push(layersData);
        historyIndex++;
    }

    function restoreState() {
        if (historyIndex < 0 || historyIndex >= history.length) {
            return;
        }
        const layersData = history[historyIndex];
        if (!layersData) return;
        
        const currentWidth = canvas.width;
        const currentHeight = canvas.height;
        
        layers = [];
        const imagesToLoad = layersData.length;
        let loadedImagesCount = 0;
        
        layersData.forEach((layerData, index) => {
            const newLayer = {
                canvas: document.createElement('canvas'),
                blendingMode: layerData.blendingMode,
                name: layerData.name
            };
            newLayer.canvas.width = currentWidth;
            newLayer.canvas.height = currentHeight;
            layers.push(newLayer);
            
            const image = new Image();
            image.onload = function() {
                const layerCtx = layers[index].canvas.getContext('2d');
                layerCtx.drawImage(image, 0, 0);
                loadedImagesCount++;
                if (loadedImagesCount === imagesToLoad) {
                    render();
                    updateLayersPanel();
                    activeLayerIndex = Math.min(activeLayerIndex, layers.length - 1);
                }
            };
            image.src = layerData.dataURL;
        });
    }

    // warna melingkar
var colorWheel = new iro.ColorPicker("#color-wheel", {
  width: 130,
  color: currentColor,
  borderWidth: 1,
  borderColor: "#fff"
});


colorWheel.on("color:change", function(color){
  currentColor = color.hexString;
});
// opacity brush

const opacityInput = document.getElementById('brush-opacity');
opacityInput.addEventListener('input', e => {
  currentOpacity = parseInt(e.target.value, 10) / 100;
});
// opacity layer
const opacitySlider = document.getElementById("layer-opacity");

opacitySlider.addEventListener("input", (e) => {
  const value = e.target.value; // 0–100
  layers[activeLayerIndex].opacity = value / 100; // simpan ke layer aktif
  render(); // redraw semua layer dengan opacity baru
});


 

document.getElementById("clone").addEventListener("click", cloneLayer);
function cloneLayer() {
    const sourceLayer = layers[activeLayerIndex];
    const newLayer = {
        opacity: sourceLayer.opacity,
        blendingMode: sourceLayer.blendingMode,
        name: sourceLayer.name + " Copy",
        canvas: document.createElement("canvas")
    };
    newLayer.canvas.width = canvas.width;
    newLayer.canvas.height = canvas.height;

    // salin isi layer ke canvas baru
    newLayer.canvas.getContext("2d").drawImage(sourceLayer.canvas, 0, 0);

    // masukkan ke array di atas layer aktif
    layers.splice(activeLayerIndex + 1, 0, newLayer);
    activeLayerIndex = activeLayerIndex + 1;

    updateLayersPanel();
    render()
    saveState();
}


document.getElementById("gabung").addEventListener("click", mergeLayer);
function mergeLayer() {
    if (activeLayerIndex <= 0) return; 

    const sourceLayer = layers[activeLayerIndex];
    const targetLayer = layers[activeLayerIndex - 1];
    const targetCtx = targetLayer.canvas.getContext("2d");

    // gambar isi source ke target
    targetCtx.globalAlpha = sourceLayer.opacity;
    targetCtx.globalCompositeOperation = sourceLayer.blendingMode;
    targetCtx.drawImage(sourceLayer.canvas, 0, 0);

    // hapus source layer
    layers.splice(activeLayerIndex, 1);
    activeLayerIndex = activeLayerIndex - 1;

    updateLayersPanel();
    render();
    saveState();
}








    // Fungsi untuk mengubah orientasi (portrait/landscape)
    if (toggleOrientationBtn) {
        toggleOrientationBtn.addEventListener('click', toggleOrientation);
    }
    
    function toggleOrientation() {
        const currentWidth = canvas.width;
        const currentHeight = canvas.height;
        
        const newWidth = currentHeight;
        const newHeight = currentWidth;
        
        resizeCanvas(newWidth, newHeight);
    }
//size canvas
    function resizeCanvas(newWidth, newHeight) {
        if (newWidth <= 0 || newHeight <= 0) {
            alert("Ukuran kanvas harus lebih besar dari 0.");
            return;
        }
        //layer
        const layersData = layers.map(layer => ({
            dataURL: layer.canvas.toDataURL(),
            blendingMode: layer.blendingMode,
            name: layer.name
        }));
//canvas
        layers = [];
        activeLayerIndex = 0;

        canvas.width = newWidth;
        canvas.height = newHeight;
        
        if (canvasContainer) {
            canvasContainer.style.width = `${newWidth}px`;
            canvasContainer.style.height = `${newHeight}px`;
        }

        backgroundCanvas.width = newWidth;
    backgroundCanvas.height = newHeight;
    const bgCtx = backgroundCanvas.getContext('2d');
    bgCtx.fillStyle = 'white';
    bgCtx.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);

        const imagesToLoad = layersData.length;
        let loadedImagesCount = 0;
        
        layersData.forEach((layerData, index) => {
            const newLayer = {
                canvas: document.createElement('canvas'),
                blendingMode: layerData.blendingMode,
                name: layerData.name
            };
            newLayer.canvas.width = newWidth;
            newLayer.canvas.height = newHeight;
            layers.push(newLayer);
            
            const image = new Image();
            image.onload = function() {
                const layerCtx = layers[index].canvas.getContext('2d');
                layerCtx.drawImage(image, 0, 0);
                loadedImagesCount++;
                if (loadedImagesCount === imagesToLoad) {
                    render();
                    updateLayersPanel();
                    activeLayerIndex = Math.min(activeLayerIndex, layers.length - 1);
                    history = [];
                    historyIndex = -1;
                    saveState();
                }
            };
            image.src = layerData.dataURL;
        });
        
        if (layersData.length === 0) {
            addLayer();
        }
    }

const toggleBtn = document.getElementById("toggle-panels-btn");
const toolsPanel = document.getElementById("tools-panel");
const toggleBtn1 = document.getElementById("toggle1");
const layersPanel = document.getElementById("layers-panel");
toggleBtn.addEventListener("click", () => {
  toolsPanel.classList.toggle("show");
  
});
toggleBtn1.addEventListener("click", () => {
layersPanel.classList.toggle("show")

})


//save warna
const saveColorBtn = document.getElementById('save-color');
const savedColorsDiv = document.getElementById('saved-colors');

if (saveColorBtn) {
    saveColorBtn.addEventListener('click', () => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = currentColor;
        swatch.style.width = '20px';
        swatch.style.height = '20px';
        swatch.style.display = 'inline-block';
        swatch.style.margin = '2px';

        // Klik swatch untuk pakai lagi
        swatch.addEventListener('click', () => {
            const swatchColor = swatch.style.backgroundColor;
            const hexColor = rgbStringToHex(swatchColor);

            currentColor = hexColor;

            const colorInput = document.getElementById('color-picker');
            if (colorInput) colorInput.value = hexColor;
        });

        savedColorsDiv.appendChild(swatch);
    });
}

// Helper: ubah "rgb(r,g,b)" jadi "#rrggbb"
function rgbStringToHex(rgbString) {
    const rgb = rgbString.match(/\d+/g).map(Number);
    return "#" + rgb.slice(0,3).map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join('');
}













    // --- Event Listeners ---
    if (canvasContainer) {
        canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());
 
 canvasContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = Math.sign(e.deltaY) < 0 ? 1.1 : 1 / 1.1; 
            
            const rect = canvas.getBoundingClientRect();
            
            const mouseXBefore = (e.clientX - rect.left - panX) / scale;
            const mouseYBefore = (e.clientY - rect.top - panY) / scale;

            const newScale = scale * zoomFactor;

            if (newScale < MIN_SCALE || newScale > MAX_SCALE) {
                return;
            }

            scale = newScale;

            const mouseXAfter = (e.clientX - rect.left - panX) / scale;
            const mouseYAfter = (e.clientY - rect.top - panY) / scale;

            panX += (mouseXAfter - mouseXBefore) * scale;
            panY += (mouseYAfter - mouseYBefore) * scale;
            
            render();
        }, false);

canvasContainer.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    startDrawing(e.touches[0]); // brush/eraser
  } else if (e.touches.length === 2) {
    isDrawing = false; // matikan brush
    const [t1, t2] = e.touches;
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    const dist = Math.hypot(dx, dy);
    const cx = (t1.clientX + t2.clientX) / 2;
    const cy = (t1.clientY + t2.clientY) / 2;
    const angle = Math.atan2(dy, dx);

    initialTouches = {
      distance: dist,
      centerX: cx,
      centerY: cy,
      angle: angle,
      baseScale: scale,
      basePanX: panX,
      basePanY: panY,
      baseRotation: rotation
    };
  }
}, {passive:false});

canvasContainer.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && isDrawing) {
    draw(e.touches[0]); // brush/eraser
    render();
  } else if (e.touches.length === 2 && initialTouches) {
    e.preventDefault();
    const [t1, t2] = e.touches;
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    const dist = Math.hypot(dx, dy);
    const cx = (t1.clientX + t2.clientX) / 2;
    const cy = (t1.clientY + t2.clientY) / 2;
    const angle = Math.atan2(dy, dx);

    // scale relatif
    let newScale = initialTouches.baseScale * (dist / initialTouches.distance);
    newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    scale = newScale;

    // pan relatif
    panX = initialTouches.basePanX + (cx - initialTouches.centerX) / scale;
    panY = initialTouches.basePanY + (cy - initialTouches.centerY) / scale;

    // rotasi relatif
    rotation = initialTouches.baseRotation + (angle - initialTouches.angle);

    render();
  }
}, {passive:false});

canvasContainer.addEventListener('touchend', e => {
  if (e.touches.length === 0) {
    stopDrawing(e); // brush/eraser selesai
    isDrawing = false;
  }
  if (e.touches.length < 2) {
    initialTouches = null; // pinch selesai
  }
}, {passive:false});



// attach once
// Mouse
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw, pickColor);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);




}










 document.addEventListener("keydown", (e) => {
    // Abaikan kalau user lagi ngetik di input/textarea
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  
    if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      if (undoBtn) undoBtn.click();
    }

    // Redo pakai M
    if (e.key.toLowerCase() === "m") {
      e.preventDefault();
      if (redoBtn) redoBtn.click();
    }
  });






    if (brushToolBtn) {
        brushToolBtn.addEventListener('click', () => {
            currentTool = 'brush';
            document.querySelectorAll('.tool-group button').forEach(btn => btn.classList.remove('active'));
            brushToolBtn.classList.add('active');
        });
    }
    
  if (eraserToolBtn) {
        eraserToolBtn.addEventListener('click', () => {
            currentTool = 'eraser';
            document.querySelectorAll('.tool-group button').forEach(btn => btn.classList.remove('active'));
             document.getElementById('eraser-tool').classList.add('active');
            eraserToolBtn.classList.add('active');
        });
    }

    if (brushStyleSelect) {
        brushStyleSelect.addEventListener('change', (e) => {
            brushStyle = e.target.value;
        });
    }

    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => {
            currentColor = e.target.value;
        });
    }

    if (sizeSlider) {
        sizeSlider.addEventListener('input', (e) => {
            currentSize = e.target.value;
        });
    }

    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            if (historyIndex > 0) {
                historyIndex--;
                restoreState();
            }
        });
    }
    
    if (redoBtn) {
        redoBtn.addEventListener('click', () => {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                restoreState();
            }
        });
    }

    if (addLayerBtn) addLayerBtn.addEventListener('click', addLayer);
    if (deleteLayerBtn) deleteLayerBtn.addEventListener('click', deleteLayer);

    if (resizeCanvasBtn) {
        resizeCanvasBtn.addEventListener('click', () => {
            const newWidth = parseInt(canvasWidthInput.value);
            const newHeight = parseInt(canvasHeightInput.value);
            resizeCanvas(newWidth, newHeight);
        });
    }

    if (blendingModeSelect) {
        blendingModeSelect.addEventListener('change', (e) => {
            if (activeLayerIndex >= 0 && activeLayerIndex < layers.length) {
                layers[activeLayerIndex].blendingMode = e.target.value;
                render();
                saveState();
            }
        });
    }

    // Inisialisasi awal
    initLayers();
    requestAnimationFrame(update);
    saveState();
});