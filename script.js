// 全局变量
let colorData = null;
let uploadedImage = null;
let colorStats = {};
let availableColors = []; // 根据选择的品牌和色号表构建的颜色列表

// DOM元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const configSection = document.getElementById('configSection');
const controlsSection = document.getElementById('controlsSection');
const resultSection = document.getElementById('resultSection');
const gridSizeSlider = document.getElementById('gridSize');
const gridSizeValue = document.getElementById('gridSizeValue');
const colorMergeSlider = document.getElementById('colorMerge');
const colorMergeValue = document.getElementById('colorMergeValue');
const showNumbersCheckbox = document.getElementById('showNumbers');
const showGridCheckbox = document.getElementById('showGrid');
const bigGridSelect = document.getElementById('bigGrid');
const processBtn = document.getElementById('processBtn');
const originalCanvas = document.getElementById('originalCanvas');
const previewCanvas = document.getElementById('previewCanvas');
const resultCanvas = document.getElementById('resultCanvas');
const colorList = document.getElementById('colorList');
const totalCount = document.getElementById('totalCount');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
let resultCanvasData = null; // 保存原始canvas数据用于下载
let highResCanvas = null; // 高分辨率canvas用于下载

// 加载颜色数据
async function loadColorData() {
    try {
        const response = await fetch('color_data.json');
        colorData = await response.json();
        console.log('颜色数据加载成功');
    } catch (error) {
        console.error('加载颜色数据失败:', error);
        alert('加载颜色数据失败，请确保color_data.json文件存在');
    }
}

// 获取选中的品牌
function getSelectedBrand() {
    const brandRadio = document.querySelector('input[name="brand"]:checked');
    return brandRadio ? brandRadio.value : 'MARD';
}

// 获取选中的基础色号表
function getSelectedBaseTables() {
    const checked = document.querySelectorAll('input[name="baseTable"]:checked');
    return Array.from(checked).map(cb => cb.value);
}

// 获取选中的高级色号表
function getSelectedAdvancedTables() {
    const checked = document.querySelectorAll('input[name="advancedTable"]:checked');
    return Array.from(checked).map(cb => cb.value);
}

// 构建可用颜色列表
function buildAvailableColors() {
    availableColors = [];
    const brand = getSelectedBrand();
    const baseTables = getSelectedBaseTables();
    const advancedTables = getSelectedAdvancedTables();
    
    // 添加基础色号表的颜色
    baseTables.forEach(table => {
        if (colorData.base_tables[table]) {
            colorData.base_tables[table].forEach(color => {
                const brandCode = color.brands[brand];
                if (brandCode && brandCode !== '-' && brandCode.trim() !== '') {
                    availableColors.push({
                        id: color.id,
                        hex: color.hex,
                        rgb: color.rgb,
                        brandCode: brandCode,
                        table: table,
                        type: 'base'
                    });
                }
            });
        }
    });
    
    // 添加高级色号表的颜色
    advancedTables.forEach(table => {
        if (colorData.advanced_tables[table] && colorData.advanced_tables[table].colors) {
            colorData.advanced_tables[table].colors.forEach(color => {
                const brandCode = color.brands[brand];
                if (brandCode && brandCode !== '-' && brandCode.trim() !== '') {
                    availableColors.push({
                        id: color.id,
                        hex: color.hex,
                        rgb: color.rgb,
                        brandCode: brandCode,
                        table: table,
                        type: 'advanced',
                        tableName: colorData.advanced_tables[table].name
                    });
                }
            });
        }
    });
    
    console.log(`已加载 ${availableColors.length} 种颜色`);
}

// 计算两个颜色之间的欧几里得距离
function colorDistance(rgb1, rgb2) {
    const r = rgb1[0] - rgb2[0];
    const g = rgb1[1] - rgb2[1];
    const b = rgb1[2] - rgb2[2];
    return Math.sqrt(r * r + g * g + b * b);
}

// 找到最接近的拼豆颜色（从指定颜色库）
function findClosestBeadColorFromLibrary(r, g, b, colorLibrary) {
    if (colorLibrary.length === 0) {
        // 如果没有可用颜色，返回默认颜色
        return {
            rgb: [r, g, b],
            brandCode: 'N/A',
            table: 'N/A'
        };
    }
    
    let minDistance = Infinity;
    let closestColor = colorLibrary[0];
    
    for (const color of colorLibrary) {
        const distance = colorDistance([r, g, b], color.rgb);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    }
    
    return closestColor;
}

// 找到最接近的拼豆颜色（从默认颜色库）
function findClosestBeadColor(r, g, b) {
    return findClosestBeadColorFromLibrary(r, g, b, availableColors);
}

// 合并拼豆颜色库中相似的颜色
function mergeColorLibrary(colors, threshold) {
    if (threshold === 0 || colors.length === 0) {
        return colors;
    }
    
    const merged = [];
    const used = new Set();
    
    // 按颜色在RGB空间中的位置排序，相近的颜色会在一起
    const sortedColors = [...colors].sort((a, b) => {
        const aSum = a.rgb[0] + a.rgb[1] + a.rgb[2];
        const bSum = b.rgb[0] + b.rgb[1] + b.rgb[2];
        return aSum - bSum;
    });
    
    for (let i = 0; i < sortedColors.length; i++) {
        if (used.has(i)) continue;
        
        const currentColor = sortedColors[i];
        const group = [currentColor];
        used.add(i);
        
        // 查找相似的颜色
        for (let j = i + 1; j < sortedColors.length; j++) {
            if (used.has(j)) continue;
            
            const otherColor = sortedColors[j];
            const distance = colorDistance(currentColor.rgb, otherColor.rgb);
            
            // 如果颜色距离小于阈值，合并它们
            if (distance <= threshold) {
                group.push(otherColor);
                used.add(j);
            }
        }
        
        // 如果只有一个颜色，直接使用
        if (group.length === 1) {
            merged.push(currentColor);
        } else {
            // 多个颜色合并：选择使用频率最高的，或者选择最接近平均值的
            // 计算平均RGB值
            let avgR = 0, avgG = 0, avgB = 0;
            group.forEach(color => {
                avgR += color.rgb[0];
                avgG += color.rgb[1];
                avgB += color.rgb[2];
            });
            avgR = Math.floor(avgR / group.length);
            avgG = Math.floor(avgG / group.length);
            avgB = Math.floor(avgB / group.length);
            
            // 找到最接近平均值的颜色作为代表
            let bestColor = group[0];
            let minDist = colorDistance([avgR, avgG, avgB], bestColor.rgb);
            
            for (const color of group) {
                const dist = colorDistance([avgR, avgG, avgB], color.rgb);
                if (dist < minDist) {
                    minDist = dist;
                    bestColor = color;
                }
            }
            
            merged.push(bestColor);
        }
    }
    
    return merged;
}

// 上传区域点击事件
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// 文件选择事件
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
});

// 拖拽事件
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFile(file);
    }
});

// 处理文件
const infoSection = document.getElementById('infoSection');
function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            uploadedImage = img;
            configSection.style.display = 'block';
            controlsSection.style.display = 'block';
            resultSection.style.display = 'none';
            // 隐藏信息部分
            if (infoSection) {
                infoSection.style.display = 'none';
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 监听品牌和色号表选择变化
document.querySelectorAll('input[name="brand"], input[name="baseTable"], input[name="advancedTable"]').forEach(input => {
    input.addEventListener('change', () => {
        updateSelectedStyles();
        buildAvailableColors();
    });
});

// 更新选中状态的样式
function updateSelectedStyles() {
    // 更新品牌选项样式
    document.querySelectorAll('.brand-option').forEach(option => {
        const radio = option.querySelector('input[type="radio"]');
        if (radio && radio.checked) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
    
    // 更新色号表选项样式
    document.querySelectorAll('.table-option').forEach(option => {
        const checkbox = option.querySelector('input[type="checkbox"]');
        if (checkbox && checkbox.checked) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// 初始化时更新样式
setTimeout(() => {
    updateSelectedStyles();
}, 100);

// 网格大小滑块事件
gridSizeSlider.addEventListener('input', (e) => {
    gridSizeValue.textContent = e.target.value;
});

// 颜色合并滑块事件
colorMergeSlider.addEventListener('input', (e) => {
    colorMergeValue.textContent = e.target.value;
});

// 处理按钮点击事件
processBtn.addEventListener('click', () => {
    if (!uploadedImage) return;
    
    // 检查是否至少选择了一个基础色号表
    const baseTables = getSelectedBaseTables();
    if (baseTables.length === 0) {
        alert('请至少选择一个基础色号表！');
        return;
    }
    
    // 重新构建颜色列表
    buildAvailableColors();
    
    if (availableColors.length === 0) {
        alert('没有可用的颜色，请检查品牌和色号表选择！');
        return;
    }
    
    const gridSize = parseInt(gridSizeSlider.value);
    const colorMerge = parseInt(colorMergeSlider.value);
    const showNumbers = showNumbersCheckbox.checked;
    const showGrid = showGridCheckbox.checked;
    const bigGrid = bigGridSelect.value;
    
    processImage(uploadedImage, gridSize, colorMerge, showNumbers, showGrid, bigGrid);
    resultSection.style.display = 'block';
});

// 处理图片
function processImage(img, gridSize, colorMerge, showNumbers, showGrid, bigGrid = 'none') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 计算画布大小（保持宽高比）
    const maxSize = 800;
    let width = img.width;
    let height = img.height;
    
    if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
    }
    
    // 调整到网格大小
    width = Math.floor(width / gridSize) * gridSize;
    height = Math.floor(height / gridSize) * gridSize;
    
    canvas.width = width;
    canvas.height = height;
    
    // 绘制原始图片
    ctx.drawImage(img, 0, 0, width, height);
    
    // 获取图片数据
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // 重置颜色统计
    colorStats = {};
    
    // 处理每个网格
    const cellSize = gridSize;
    const cols = Math.floor(width / cellSize);
    const rows = Math.floor(height / cellSize);
    
    // 如果启用了颜色合并，先合并拼豆颜色库中相似的颜色
    let mergedColorLibrary = availableColors;
    if (colorMerge > 0) {
        // 将颜色合并阈值转换为颜色距离阈值（0-100 映射到 0-50 的颜色距离）
        const mergeThreshold = (colorMerge / 100) * 50;
        
        // 合并拼豆颜色库中相似的颜色
        mergedColorLibrary = mergeColorLibrary(availableColors, mergeThreshold);
        console.log(`颜色合并：从 ${availableColors.length} 种颜色合并到 ${mergedColorLibrary.length} 种颜色`);
    }
    
    // 先收集所有网格的原始RGB颜色
    const gridColors = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // 计算网格区域的平均颜色
            let r = 0, g = 0, b = 0, count = 0;
            
            for (let y = row * cellSize; y < (row + 1) * cellSize && y < height; y++) {
                for (let x = col * cellSize; x < (col + 1) * cellSize && x < width; x++) {
                    const index = (y * width + x) * 4;
                    r += data[index];
                    g += data[index + 1];
                    b += data[index + 2];
                    count++;
                }
            }
            
            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);
            
            // 使用合并后的颜色库找到最接近的拼豆颜色
            const beadColor = findClosestBeadColorFromLibrary(r, g, b, mergedColorLibrary);
            gridColors.push({
                row,
                col,
                rgb: [r, g, b],
                beadColor: beadColor
            });
        }
    }
    
    // 原图不再显示，但保留canvas用于内部处理（如果需要）
    
    // 计算统计区域大小（根据格子大小动态调整）
    // 边距要足够大，避免数字重叠，但不要太远
    const statsMargin = Math.max(20, Math.min(35, cellSize * 0.6)); // 统计区域边距，随格子大小动态调整，更靠近边缘
    // 字体大小与网格内色号数字大小一致（使用相同的计算逻辑）
    // 这个值会在绘制色号时计算，这里先定义一个函数来计算
    function calculateFontSize(cellSize) {
        let fontSize;
        if (cellSize <= 5) {
            fontSize = Math.max(2, cellSize * 0.12);
        } else if (cellSize <= 10) {
            fontSize = Math.max(3, cellSize * 0.15);
        } else if (cellSize <= 15) {
            fontSize = Math.max(4, cellSize * 0.18);
        } else if (cellSize <= 20) {
            fontSize = Math.max(5, cellSize * 0.2);
        } else if (cellSize <= 25) {
            fontSize = Math.max(6, cellSize * 0.22);
        } else if (cellSize <= 35) {
            fontSize = Math.max(7, cellSize * 0.25);
        } else {
            fontSize = Math.max(9, cellSize * 0.28);
        }
        return fontSize;
    }
    const statsFontSize = calculateFontSize(cellSize);
    
    // 创建高分辨率画布（用于无损放大和下载）
    const scaleFactor = 8; // 8倍分辨率确保放大后清晰
    highResCanvas = document.createElement('canvas');
    highResCanvas.width = (cols * cellSize + statsMargin * 2) * scaleFactor;
    highResCanvas.height = (rows * cellSize + statsMargin * 2) * scaleFactor;
    const highResCtx = highResCanvas.getContext('2d');
    
    // 创建显示用的画布（带色号，包含行列统计）
    resultCanvas.width = cols * cellSize + statsMargin * 2;
    resultCanvas.height = rows * cellSize + statsMargin * 2;
    const resultCtx = resultCanvas.getContext('2d');
    
    // 创建预览画布（无色号，仅供参考，也包含行列统计）
    previewCanvas.width = cols * cellSize + statsMargin * 2;
    previewCanvas.height = rows * cellSize + statsMargin * 2;
    const previewCtx = previewCanvas.getContext('2d');
    
    // 不再需要统计数组，直接使用行列索引（从1开始）
    
    // 计算高分辨率单元格大小（在循环外部定义，供后续使用）
    const highResCellSize = cellSize * scaleFactor;
    
    // 设置高分辨率画布的字体和样式
    highResCtx.textAlign = 'center';
    highResCtx.textBaseline = 'middle';
    
    // 设置显示画布的字体和样式
    resultCtx.textAlign = 'center';
    resultCtx.textBaseline = 'middle';
    
    // 预览画布不需要文字样式
    
    // 绘制网格
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // 获取已处理的颜色（如果进行了颜色合并）
            const gridColor = gridColors[row * cols + col];
            const beadColor = gridColor.beadColor;
            
            // 统计颜色（使用品牌色号作为key）
            const colorKey = beadColor.brandCode;
            if (!colorStats[colorKey]) {
                colorStats[colorKey] = {
                    brandCode: beadColor.brandCode,
                    rgb: beadColor.rgb,
                    count: 0
                };
            }
            colorStats[colorKey].count++;
            
            // 绘制网格（加上统计边距偏移）
            const x = col * cellSize + statsMargin;
            const y = row * cellSize + statsMargin;
            const highResX = (col * cellSize + statsMargin) * scaleFactor;
            const highResY = (row * cellSize + statsMargin) * scaleFactor;
            
            const colorStr = `rgb(${beadColor.rgb[0]}, ${beadColor.rgb[1]}, ${beadColor.rgb[2]})`;
            
            // 绘制到显示画布（带色号）
            resultCtx.fillStyle = colorStr;
            resultCtx.fillRect(x, y, cellSize, cellSize);
            
            // 绘制到预览画布（无色号，仅供参考）
            previewCtx.fillStyle = colorStr;
            previewCtx.fillRect(x, y, cellSize, cellSize);
            
            // 绘制到高分辨率画布
            highResCtx.fillStyle = colorStr;
            highResCtx.fillRect(highResX, highResY, highResCellSize, highResCellSize);
            
            // 绘制网格线（根据格子大小动态调整线宽，更细）
            if (showGrid) {
                // 线宽随格子大小变化，使用更细的线
                const lineWidth = cellSize <= 10 ? 0.3 : (cellSize <= 20 ? 0.5 : (cellSize <= 30 ? 0.7 : 0.9));
                
                resultCtx.strokeStyle = '#ddd';
                resultCtx.lineWidth = lineWidth;
                resultCtx.strokeRect(x, y, cellSize, cellSize);
                
                previewCtx.strokeStyle = '#ddd';
                previewCtx.lineWidth = lineWidth;
                previewCtx.strokeRect(x, y, cellSize, cellSize);
                
                // 高分辨率画布的线宽也要按比例缩放
                highResCtx.strokeStyle = '#ddd';
                highResCtx.lineWidth = lineWidth * scaleFactor;
                highResCtx.strokeRect(highResX, highResY, highResCellSize, highResCellSize);
            }
            
            // 绘制色号（总是绘制，即使很小）
            if (showNumbers) {
                // 根据背景颜色选择文字颜色（确保可读性）
                const brightness = (beadColor.rgb[0] * 299 + beadColor.rgb[1] * 587 + beadColor.rgb[2] * 114) / 1000;
                const textColor = brightness > 128 ? '#000' : '#fff';
                
                // 根据网格大小自适应字体，确保不超出格子
                // 使用更保守的字体大小，留出足够边距
                let fontSize;
                if (cellSize <= 5) {
                    fontSize = Math.max(2, cellSize * 0.12); // 极小网格用12%大小
                } else if (cellSize <= 10) {
                    fontSize = Math.max(3, cellSize * 0.15); // 很小网格用15%大小
                } else if (cellSize <= 15) {
                    fontSize = Math.max(4, cellSize * 0.18); // 小网格用18%大小
                } else if (cellSize <= 20) {
                    fontSize = Math.max(5, cellSize * 0.2); // 较小网格用20%大小
                } else if (cellSize <= 25) {
                    fontSize = Math.max(6, cellSize * 0.22); // 中等网格用22%大小
                } else if (cellSize <= 35) {
                    fontSize = Math.max(7, cellSize * 0.25); // 较大网格用25%大小
                } else {
                    fontSize = Math.max(9, cellSize * 0.28); // 大网格用28%大小
                }
                
                // 根据文本宽度动态调整字体大小，确保不超出网格
                const text = beadColor.brandCode;
                const maxTextWidth = cellSize * 0.9; // 留出10%边距
                const maxTextHeight = cellSize * 0.9;
                
                // 测量文本宽度并调整字体大小
                resultCtx.font = `bold ${fontSize}px Arial`;
                let textWidth = resultCtx.measureText(text).width;
                
                // 如果文本宽度超出，按比例缩小字体
                if (textWidth > maxTextWidth) {
                    fontSize = Math.floor(fontSize * (maxTextWidth / textWidth));
                }
                
                // 确保字体高度也不超出
                if (fontSize > maxTextHeight) {
                    fontSize = Math.floor(maxTextHeight);
                }
                
                // 确保最小字体可读
                fontSize = Math.max(2, fontSize);
                
                // 绘制到显示画布
                resultCtx.fillStyle = textColor;
                resultCtx.font = `bold ${fontSize}px Arial`;
                resultCtx.fillText(
                    text,
                    x + cellSize / 2,
                    y + cellSize / 2
                );
                
                // 绘制到高分辨率画布（使用相同的字体比例，确保清晰）
                highResCtx.fillStyle = textColor;
                highResCtx.font = `bold ${fontSize * scaleFactor}px Arial`;
                highResCtx.textAlign = 'center';
                highResCtx.textBaseline = 'middle';
                highResCtx.fillText(
                    text,
                    highResX + highResCellSize / 2,
                    highResY + highResCellSize / 2
                );
            }
        }
    }
    
    // 绘制大网格（5x5或10x10）
    if (bigGrid !== 'none' && showGrid) {
        const bigGridSize = parseInt(bigGrid);
        const bigGridLineWidth = cellSize <= 10 ? 1 : (cellSize <= 20 ? 1.5 : 2);
        
        // 绘制大网格线（显示画布，使用纯黑色）
        resultCtx.strokeStyle = '#000000';
        resultCtx.lineWidth = bigGridLineWidth;
        previewCtx.strokeStyle = '#000000';
        previewCtx.lineWidth = bigGridLineWidth;
        
        // 绘制垂直大网格线
        for (let col = 0; col <= cols; col += bigGridSize) {
            const x = statsMargin + col * cellSize;
            resultCtx.beginPath();
            resultCtx.moveTo(x, statsMargin);
            resultCtx.lineTo(x, statsMargin + rows * cellSize);
            resultCtx.stroke();
            
            previewCtx.beginPath();
            previewCtx.moveTo(x, statsMargin);
            previewCtx.lineTo(x, statsMargin + rows * cellSize);
            previewCtx.stroke();
        }
        
        // 绘制水平大网格线
        for (let row = 0; row <= rows; row += bigGridSize) {
            const y = statsMargin + row * cellSize;
            resultCtx.beginPath();
            resultCtx.moveTo(statsMargin, y);
            resultCtx.lineTo(statsMargin + cols * cellSize, y);
            resultCtx.stroke();
            
            previewCtx.beginPath();
            previewCtx.moveTo(statsMargin, y);
            previewCtx.lineTo(statsMargin + cols * cellSize, y);
            previewCtx.stroke();
        }
        
        // 绘制大网格线（高分辨率画布，使用纯黑色）
        const highResBigGridLineWidth = bigGridLineWidth * scaleFactor;
        highResCtx.strokeStyle = '#000000';
        highResCtx.lineWidth = highResBigGridLineWidth;
        
        // 绘制垂直大网格线（高分辨率）
        for (let col = 0; col <= cols; col += bigGridSize) {
            const x = (statsMargin + col * cellSize) * scaleFactor;
            highResCtx.beginPath();
            highResCtx.moveTo(x, statsMargin * scaleFactor);
            highResCtx.lineTo(x, (statsMargin + rows * cellSize) * scaleFactor);
            highResCtx.stroke();
        }
        
        // 绘制水平大网格线（高分辨率）
        for (let row = 0; row <= rows; row += bigGridSize) {
            const y = (statsMargin + row * cellSize) * scaleFactor;
            highResCtx.beginPath();
            highResCtx.moveTo(statsMargin * scaleFactor, y);
            highResCtx.lineTo((statsMargin + cols * cellSize) * scaleFactor, y);
            highResCtx.stroke();
        }
    }
    
    // 绘制行列统计（在拼豆图案周围）
    // 根据字体大小调整位置，让数字更靠近图案边缘
    const textOffsetY = 0; // 文字垂直偏移，设为0让数字更靠近
    
    // 计算数字位置，更靠近图案边缘
    const numberOffset = Math.max(8, statsFontSize * 0.8); // 数字距离图案边缘的距离，更小更靠近
    
    // 设置统计文字样式
    resultCtx.fillStyle = '#1f2937';
    resultCtx.font = `bold ${statsFontSize}px Arial`;
    resultCtx.textAlign = 'center';
    resultCtx.textBaseline = 'middle';
    
    previewCtx.fillStyle = '#1f2937';
    previewCtx.font = `bold ${statsFontSize}px Arial`;
    previewCtx.textAlign = 'center';
    previewCtx.textBaseline = 'middle';
    
    // 绘制左侧行号（每行的左侧显示行号，从1开始）
    for (let row = 0; row < rows; row++) {
        const x = numberOffset;
        const y = statsMargin + row * cellSize + cellSize / 2;
        resultCtx.fillText((row + 1).toString(), x, y);
        previewCtx.fillText((row + 1).toString(), x, y);
    }
    
    // 绘制右侧行号（每行的右侧显示行号，从1开始）
    for (let row = 0; row < rows; row++) {
        const x = statsMargin + cols * cellSize + (statsMargin - numberOffset);
        const y = statsMargin + row * cellSize + cellSize / 2;
        resultCtx.fillText((row + 1).toString(), x, y);
        previewCtx.fillText((row + 1).toString(), x, y);
    }
    
    // 绘制上方列号（每列的上方显示列号，从1开始）
    for (let col = 0; col < cols; col++) {
        const x = statsMargin + col * cellSize + cellSize / 2;
        const y = numberOffset;
        resultCtx.fillText((col + 1).toString(), x, y);
        previewCtx.fillText((col + 1).toString(), x, y);
    }
    
    // 绘制下方列号（每列的下方显示列号，从1开始）
    for (let col = 0; col < cols; col++) {
        const x = statsMargin + col * cellSize + cellSize / 2;
        const y = statsMargin + rows * cellSize + (statsMargin - numberOffset);
        resultCtx.fillText((col + 1).toString(), x, y);
        previewCtx.fillText((col + 1).toString(), x, y);
    }
    
    // 高分辨率画布也需要绘制统计
    const highResStatsMargin = statsMargin * scaleFactor;
    const highResStatsFontSize = statsFontSize * scaleFactor;
    const highResNumberOffset = numberOffset * scaleFactor;
    highResCtx.fillStyle = '#1f2937';
    highResCtx.font = `bold ${highResStatsFontSize}px Arial`;
    highResCtx.textAlign = 'center';
    highResCtx.textBaseline = 'middle';
    
    // 绘制左侧行号（高分辨率，每行的左侧显示行号，从1开始）
    for (let row = 0; row < rows; row++) {
        const x = highResNumberOffset;
        const y = highResStatsMargin + row * highResCellSize + highResCellSize / 2;
        highResCtx.fillText((row + 1).toString(), x, y);
    }
    
    // 绘制右侧行号（高分辨率，每行的右侧显示行号，从1开始）
    for (let row = 0; row < rows; row++) {
        const x = highResStatsMargin + cols * highResCellSize + (highResStatsMargin - highResNumberOffset);
        const y = highResStatsMargin + row * highResCellSize + highResCellSize / 2;
        highResCtx.fillText((row + 1).toString(), x, y);
    }
    
    // 绘制上方列号（高分辨率，每列的上方显示列号，从1开始）
    for (let col = 0; col < cols; col++) {
        const x = highResStatsMargin + col * highResCellSize + highResCellSize / 2;
        const y = highResNumberOffset;
        highResCtx.fillText((col + 1).toString(), x, y);
    }
    
    // 绘制下方列号（高分辨率，每列的下方显示列号，从1开始）
    for (let col = 0; col < cols; col++) {
        const x = highResStatsMargin + col * highResCellSize + highResCellSize / 2;
        const y = highResStatsMargin + rows * highResCellSize + (highResStatsMargin - highResNumberOffset);
        highResCtx.fillText((col + 1).toString(), x, y);
    }
    
    // 保存canvas数据用于下载
    resultCanvasData = resultCanvas.toDataURL();
    
    // 设置显示样式 - 自适应大小
    resultCanvas.style.width = 'auto';
    resultCanvas.style.height = 'auto';
    resultCanvas.style.maxWidth = '100%';
    resultCanvas.style.maxHeight = '80vh';
    resultCanvas.style.display = 'block';
    resultCanvas.style.margin = '0 auto';
    
    // 设置预览画布样式 - 自适应大小
    previewCanvas.style.width = 'auto';
    previewCanvas.style.height = 'auto';
    previewCanvas.style.maxWidth = '100%';
    previewCanvas.style.maxHeight = '80vh';
    previewCanvas.style.display = 'block';
    previewCanvas.style.margin = '0 auto';
    
    // 显示颜色统计
    displayColorStats();
}


// 显示颜色统计
function displayColorStats() {
    colorList.innerHTML = '';
    
    // 计算总豆子数量
    let totalBeads = 0;
    Object.values(colorStats).forEach(item => {
        totalBeads += item.count;
    });
    
    // 计算颜色种类数量
    const colorTypes = Object.keys(colorStats).length;
    
    // 显示总数量和颜色种类
    totalCount.innerHTML = `
        <div class="total-beads">
            <div class="total-item">总计：<strong>${totalBeads}</strong> 颗豆子</div>
            <div class="total-item">使用：<strong>${colorTypes}</strong> 种颜色</div>
        </div>
    `;
    
    // 按数量排序
    const sortedColors = Object.values(colorStats).sort((a, b) => b.count - a.count);
    
    if (sortedColors.length === 0) {
        colorList.innerHTML = '<p style="text-align: center; color: #666;">暂无颜色统计</p>';
        return;
    }
    
    sortedColors.forEach(item => {
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';
        
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = `rgb(${item.rgb[0]}, ${item.rgb[1]}, ${item.rgb[2]})`;
        
        const info = document.createElement('div');
        info.className = 'color-info';
        
        const name = document.createElement('div');
        name.className = 'color-name';
        name.textContent = item.brandCode;
        
        const count = document.createElement('div');
        count.className = 'color-count';
        count.textContent = `需要 ${item.count} 颗`;
        
        info.appendChild(name);
        info.appendChild(count);
        colorItem.appendChild(swatch);
        colorItem.appendChild(info);
        colorList.appendChild(colorItem);
    });
}

// 下载按钮事件 - 生成包含原图、拼豆图案和色号统计的完整图片
downloadBtn.addEventListener('click', () => {
    try {
        generateDownloadImage();
    } catch (error) {
        console.error('下载失败:', error);
        alert('下载失败，请重试');
    }
});

function generateDownloadImage() {
    if (!resultCanvas) {
        alert('请先生成拼豆图案');
        return;
    }
    
    if (Object.keys(colorStats).length === 0) {
        alert('没有颜色统计数据，请重新生成图案');
        return;
    }
    
    // 创建一个大画布来包含所有内容（使用高分辨率）
    const downloadCanvas = document.createElement('canvas');
    const ctx = downloadCanvas.getContext('2d');
    
    // 计算尺寸 - 使用高分辨率
    const padding = 60;
    const titleHeight = 50;
    const labelHeight = 30;
    const imageSpacing = 40;
    
    // 获取拼豆图案的实际尺寸（使用高分辨率canvas的尺寸）
    let resultWidth, resultHeight;
    if (highResCanvas) {
        // 使用高分辨率canvas的原始尺寸（不缩放）
        resultWidth = highResCanvas.width;
        resultHeight = highResCanvas.height;
    } else {
        resultWidth = resultCanvas.width || 0;
        resultHeight = resultCanvas.height || 0;
    }
    
    if (resultWidth === 0 || resultHeight === 0) {
        alert('图片数据不完整，请重新生成');
        return;
    }
    
    // 判断是横图还是竖图
    const isLandscape = resultWidth > resultHeight;
    
    // 计算统计区域尺寸（加大显示）
    // 横图时需要根据实际宽度重新计算高度
    let statsInfo;
    let statsWidth, statsHeight;
    if (isLandscape) {
        statsWidth = resultWidth;
        // 重新计算横图时的实际高度
        const itemWidth = 180;
        const itemHeight = 70;
        const rowSpacing = 20;
        const padding = 30;
        const headerHeight = 120;
        const itemsPerRow = Math.floor((statsWidth - padding * 2) / itemWidth);
        const rows = Math.ceil(Object.keys(colorStats).length / itemsPerRow);
        statsHeight = headerHeight + rows * (itemHeight + rowSpacing) + padding;
        statsInfo = {
            height: statsHeight,
            colors: Object.values(colorStats).sort((a, b) => b.count - a.count)
        };
    } else {
        statsInfo = calculateStatsInfo(isLandscape);
        statsWidth = 550; // 竖图时统计在右侧，宽度更大
        statsHeight = statsInfo.height;
    }
    
    // 根据横竖图计算总尺寸
    let totalWidth, totalHeight;
    if (isLandscape) {
        // 横图：统计在下方
        totalWidth = resultWidth + padding * 2;
        totalHeight = titleHeight + labelHeight + resultHeight + imageSpacing + statsHeight + padding * 2;
    } else {
        // 竖图：统计在右侧
        totalWidth = resultWidth + imageSpacing + statsWidth + padding * 2;
        totalHeight = titleHeight + labelHeight + Math.max(resultHeight, statsHeight) + padding * 2;
    }
    
    // 检查canvas尺寸是否过大（某些浏览器限制）
    const maxCanvasSize = 16384; // 大多数浏览器的最大canvas尺寸
    if (totalWidth > maxCanvasSize || totalHeight > maxCanvasSize) {
        alert('图片尺寸过大，无法下载。请减小网格大小或图片尺寸。');
        return;
    }
    
    downloadCanvas.width = totalWidth;
    downloadCanvas.height = totalHeight;
    
    // 填充背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
    
    // 绘制标题
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('拼豆图案生成结果', downloadCanvas.width / 2, titleHeight);
    
    // 绘制拼豆图案（使用高分辨率canvas，保持原始尺寸，禁用图像平滑实现像素级渲染）
    const resultX = padding;
    const resultY = titleHeight + labelHeight;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('拼豆图案', resultX, resultY - 5);
    
    // 禁用图像平滑，实现真正的像素级渲染
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    
    try {
        if (highResCanvas && highResCanvas.width > 0 && highResCanvas.height > 0) {
            // 使用高分辨率canvas，按原始尺寸绘制（不缩放）
            ctx.drawImage(highResCanvas, resultX, resultY);
        } else {
            // 使用普通canvas
            ctx.drawImage(resultCanvas, resultX, resultY, resultWidth, resultHeight);
        }
    } catch (e) {
        console.error('绘制图案失败:', e);
        alert('绘制图案失败，请重新生成');
        return;
    }
    
    // 根据横竖图决定统计位置
    let statsX, statsY;
    if (isLandscape) {
        // 横图：统计在下方
        statsX = resultX;
        statsY = resultY + resultHeight + imageSpacing;
    } else {
        // 竖图：统计在右侧
        statsX = resultX + resultWidth + imageSpacing;
        statsY = resultY;
    }
    
    try {
        drawStatsOnCanvas(ctx, statsX, statsY, statsWidth, statsInfo, isLandscape);
    } catch (e) {
        console.error('绘制统计失败:', e);
        alert('绘制颜色统计失败：' + e.message);
        return;
    }
    
    // 下载
    try {
        // 检查canvas是否有内容
        if (downloadCanvas.width === 0 || downloadCanvas.height === 0) {
            alert('图片数据不完整，请重新生成');
            return;
        }
        
        // 尝试生成图片数据
        let dataURL;
        try {
            dataURL = downloadCanvas.toDataURL('image/png', 1.0);
        } catch (e) {
            console.error('生成图片数据失败:', e);
            // 如果失败，尝试降低质量
            try {
                dataURL = downloadCanvas.toDataURL('image/png', 0.9);
            } catch (e2) {
                alert('图片尺寸过大，无法生成下载文件。请减小网格大小。');
                return;
            }
        }
        
        // 检查数据URL是否有效
        if (!dataURL || dataURL === 'data:,') {
            alert('图片数据生成失败，请重新生成');
            return;
        }
        
        // 创建下载链接
        const link = document.createElement('a');
        link.download = '拼豆图案完整版.png';
        link.href = dataURL;
        
        // 添加到DOM并触发下载
        document.body.appendChild(link);
        link.click();
        
        // 延迟移除，确保下载开始
        setTimeout(() => {
            document.body.removeChild(link);
        }, 100);
    } catch (error) {
        console.error('下载错误:', error);
        alert('下载失败：' + (error.message || '未知错误') + '。请检查图片尺寸是否过大。');
    }
}

function calculateStatsInfo(isLandscape = false) {
    const sortedColors = Object.values(colorStats).sort((a, b) => b.count - a.count);
    const headerHeight = 120; // 增大标题区域高度
    const padding = 30;
    
    let height;
    if (isLandscape) {
        // 横图：计算需要多少行（横向排列）
        const itemWidth = 180;
        const itemHeight = 70;
        const rowSpacing = 20;
        // 需要知道宽度才能计算，这里先估算，实际会在drawStatsOnCanvas中计算
        const estimatedWidth = 1200; // 估算宽度
        const itemsPerRow = Math.floor((estimatedWidth - padding * 2) / itemWidth);
        const rows = Math.ceil(sortedColors.length / itemsPerRow);
        height = headerHeight + rows * (itemHeight + rowSpacing) + padding;
    } else {
        // 竖图：纵向排列
        const itemHeight = 55;
        height = headerHeight + sortedColors.length * itemHeight + padding;
    }
    
    return {
        height: height,
        colors: sortedColors
    };
}

function drawStatsOnCanvas(ctx, x, y, width, statsInfo, isLandscape = false) {
    const padding = 30;
    const startX = x + padding;
    let currentY = y + padding;
    
    // 绘制标题（加大字体）
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('颜色统计', startX, currentY);
    currentY += 55;
    
    // 计算总数量和颜色种类
    let totalBeads = 0;
    Object.values(colorStats).forEach(item => {
        totalBeads += item.count;
    });
    const colorTypes = Object.keys(colorStats).length;
    
    // 绘制总数量和颜色种类（加大字体）
    ctx.fillStyle = '#667eea';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(`总计：${totalBeads} 颗`, startX, currentY);
    currentY += 45;
    ctx.fillText(`使用：${colorTypes} 种颜色`, startX, currentY);
    currentY += 60;
    
    // 绘制颜色列表（加大字体和间距）
    const sortedColors = statsInfo.colors;
    const swatchSize = 45; // 增大色块
    
    if (isLandscape) {
        // 横图：横向排列
        const itemWidth = 180; // 每个颜色项的宽度
        const itemHeight = 70; // 每个颜色项的高度
        const availableWidth = width - padding * 2;
        const itemsPerRow = Math.max(1, Math.floor(availableWidth / itemWidth)); // 确保至少1列
        const rowSpacing = 20; // 行间距
        
        let currentCol = 0;
        let currentRow = 0;
        let startY = currentY;
        
        sortedColors.forEach((item, index) => {
            if (currentCol >= itemsPerRow) {
                currentCol = 0;
                currentRow++;
            }
            
            const itemX = startX + currentCol * itemWidth;
            const itemY = startY + currentRow * (itemHeight + rowSpacing);
            
            // 绘制色块
            ctx.fillStyle = `rgb(${item.rgb[0]}, ${item.rgb[1]}, ${item.rgb[2]})`;
            ctx.fillRect(itemX, itemY, swatchSize, swatchSize);
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 2;
            ctx.strokeRect(itemX, itemY, swatchSize, swatchSize);
            
            // 绘制色号（加大字体）
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.brandCode, itemX + swatchSize + 12, itemY + 20);
            
            // 绘制数量（加大字体）
            ctx.fillStyle = '#666666';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${item.count}颗`, itemX + swatchSize + 12, itemY + 50);
            
            currentCol++;
        });
    } else {
        // 竖图：纵向排列
        const itemHeight = 55;
        const maxItems = Math.min(sortedColors.length, Math.floor((statsInfo.height - currentY + y) / itemHeight));
        
        sortedColors.slice(0, maxItems).forEach((item) => {
            // 绘制色块（增大）
            ctx.fillStyle = `rgb(${item.rgb[0]}, ${item.rgb[1]}, ${item.rgb[2]})`;
            ctx.fillRect(startX, currentY, swatchSize, swatchSize);
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 2;
            ctx.strokeRect(startX, currentY, swatchSize, swatchSize);
            
            // 绘制色号（不显示品牌，加大字体）
            ctx.fillStyle = '#333333';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(item.brandCode, startX + swatchSize + 15, currentY + 28);
            
            // 绘制数量（加大字体）
            ctx.fillStyle = '#666666';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(`${item.count}颗`, startX + width - padding * 2, currentY + 28);
            
            currentY += itemHeight;
        });
        
        // 如果颜色太多，显示省略提示（加大字体）- 仅竖图需要
        if (sortedColors.length > maxItems) {
            ctx.fillStyle = '#999999';
            ctx.font = '18px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`...还有${sortedColors.length - maxItems}种颜色`, startX, currentY + 10);
        }
    }
}

// 重置按钮事件
resetBtn.addEventListener('click', () => {
    uploadedImage = null;
    fileInput.value = '';
    configSection.style.display = 'none';
    controlsSection.style.display = 'none';
    resultSection.style.display = 'none';
    colorStats = {};
    // 显示信息部分
    if (infoSection) {
        infoSection.style.display = 'block';
    }
});

// FAQ 折叠/展开功能
document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
        const faqItem = question.closest('.faq-item');
        const isActive = faqItem.classList.contains('active');
        
        // 关闭所有其他FAQ项
        document.querySelectorAll('.faq-item').forEach(item => {
            if (item !== faqItem) {
                item.classList.remove('active');
            }
        });
        
        // 切换当前FAQ项
        faqItem.classList.toggle('active', !isActive);
    });
});

// 初始化
loadColorData().then(() => {
    // 默认选择所有基础色号表
    buildAvailableColors();
});
