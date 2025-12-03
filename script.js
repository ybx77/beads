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
const showNumbersCheckbox = document.getElementById('showNumbers');
const showGridCheckbox = document.getElementById('showGrid');
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

// 找到最接近的拼豆颜色
function findClosestBeadColor(r, g, b) {
    if (availableColors.length === 0) {
        // 如果没有可用颜色，返回默认颜色
        return {
            rgb: [r, g, b],
            brandCode: 'N/A',
            table: 'N/A'
        };
    }
    
    let minDistance = Infinity;
    let closestColor = availableColors[0];
    
    for (const color of availableColors) {
        const distance = colorDistance([r, g, b], color.rgb);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
        }
    }
    
    return closestColor;
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
function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            uploadedImage = img;
            configSection.style.display = 'block';
            controlsSection.style.display = 'block';
            resultSection.style.display = 'none';
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
    const showNumbers = showNumbersCheckbox.checked;
    const showGrid = showGridCheckbox.checked;
    
    processImage(uploadedImage, gridSize, showNumbers, showGrid);
    resultSection.style.display = 'block';
});

// 处理图片
function processImage(img, gridSize, showNumbers, showGrid) {
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
    
    // 原图不再显示，但保留canvas用于内部处理（如果需要）
    
    // 创建高分辨率画布（用于无损放大和下载）
    const scaleFactor = 8; // 8倍分辨率确保放大后清晰
    highResCanvas = document.createElement('canvas');
    highResCanvas.width = cols * cellSize * scaleFactor;
    highResCanvas.height = rows * cellSize * scaleFactor;
    const highResCtx = highResCanvas.getContext('2d');
    
    // 创建显示用的画布（带色号）
    resultCanvas.width = cols * cellSize;
    resultCanvas.height = rows * cellSize;
    const resultCtx = resultCanvas.getContext('2d');
    
    // 创建预览画布（无色号，仅供参考）
    previewCanvas.width = cols * cellSize;
    previewCanvas.height = rows * cellSize;
    const previewCtx = previewCanvas.getContext('2d');
    
    // 设置高分辨率画布的字体和样式
    highResCtx.textAlign = 'center';
    highResCtx.textBaseline = 'middle';
    
    // 设置显示画布的字体和样式
    resultCtx.textAlign = 'center';
    resultCtx.textBaseline = 'middle';
    
    // 预览画布不需要文字样式
    
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
            
            // 找到最接近的拼豆颜色
            const beadColor = findClosestBeadColor(r, g, b);
            
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
            
            // 绘制网格
            const x = col * cellSize;
            const y = row * cellSize;
            const highResX = x * scaleFactor;
            const highResY = y * scaleFactor;
            const highResCellSize = cellSize * scaleFactor;
            
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
            
            // 绘制网格线
            if (showGrid) {
                resultCtx.strokeStyle = '#ddd';
                resultCtx.lineWidth = 1;
                resultCtx.strokeRect(x, y, cellSize, cellSize);
                
                previewCtx.strokeStyle = '#ddd';
                previewCtx.lineWidth = 1;
                previewCtx.strokeRect(x, y, cellSize, cellSize);
                
                highResCtx.strokeStyle = '#ddd';
                highResCtx.lineWidth = scaleFactor;
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
    
    // 显示总数量
    totalCount.innerHTML = `<div class="total-beads">总计：<strong>${totalBeads}</strong> 颗豆子</div>`;
    
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
    
    // 计算统计区域尺寸
    const statsInfo = calculateStatsInfo();
    const statsWidth = 350;
    const statsHeight = statsInfo.height;
    
    // 计算总高度和宽度，优化布局（使用实际图片高度）
    const totalHeight = titleHeight + labelHeight + Math.max(resultHeight, statsHeight) + padding * 2;
    const totalWidth = resultWidth + imageSpacing + statsWidth + padding * 2;
    
    downloadCanvas.width = totalWidth;
    downloadCanvas.height = totalHeight;
    
    // 填充背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
    
    // 绘制标题
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('拼豆图案生成结果', downloadCanvas.width / 2, titleHeight);
    
    // 绘制拼豆图案（使用高分辨率canvas，保持原始尺寸，禁用图像平滑实现像素级渲染）
    const resultX = padding;
    const resultY = titleHeight + labelHeight;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('拼豆图案', resultX, resultY - 5);
    
    // 禁用图像平滑，实现真正的像素级渲染
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    
    if (highResCanvas) {
        // 使用高分辨率canvas，按原始尺寸绘制（不缩放）
        ctx.drawImage(highResCanvas, resultX, resultY);
    } else {
        ctx.drawImage(resultCanvas, resultX, resultY, resultWidth, resultHeight);
    }
    
    // 绘制色号统计（紧贴右侧，减少空白）
    const statsX = resultX + resultWidth + imageSpacing;
    const statsY = titleHeight + labelHeight;
    drawStatsOnCanvas(ctx, statsX, statsY, statsWidth, statsInfo);
    
    // 下载
    try {
        const link = document.createElement('a');
        link.download = '拼豆图案完整版.png';
        link.href = downloadCanvas.toDataURL('image/png', 1.0);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('下载错误:', error);
        alert('下载失败，请重试');
    }
}

function calculateStatsInfo() {
    const sortedColors = Object.values(colorStats).sort((a, b) => b.count - a.count);
    const itemHeight = 35;
    const headerHeight = 60;
    const padding = 20;
    const height = headerHeight + sortedColors.length * itemHeight + padding;
    return {
        height: height,
        colors: sortedColors
    };
}

function drawStatsOnCanvas(ctx, x, y, width, statsInfo) {
    const padding = 15;
    const startX = x + padding;
    let currentY = y + padding;
    
    // 绘制标题
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('颜色统计', startX, currentY);
    currentY += 35;
    
    // 计算总数量
    let totalBeads = 0;
    Object.values(colorStats).forEach(item => {
        totalBeads += item.count;
    });
    
    // 绘制总数量
    ctx.fillStyle = '#667eea';
    ctx.font = 'bold 20px Arial';
    ctx.fillText(`总计：${totalBeads} 颗`, startX, currentY);
    currentY += 40;
    
    // 绘制颜色列表
    const sortedColors = statsInfo.colors;
    const itemHeight = 32;
    const swatchSize = 24;
    const maxItems = Math.min(sortedColors.length, Math.floor((statsInfo.height - currentY + y) / itemHeight));
    
    sortedColors.slice(0, maxItems).forEach((item) => {
        // 绘制色块
        ctx.fillStyle = `rgb(${item.rgb[0]}, ${item.rgb[1]}, ${item.rgb[2]})`;
        ctx.fillRect(startX, currentY, swatchSize, swatchSize);
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, currentY, swatchSize, swatchSize);
        
        // 绘制色号（不显示品牌）
        ctx.fillStyle = '#333333';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(item.brandCode, startX + swatchSize + 8, currentY + 18);
        
        // 绘制数量
        ctx.fillStyle = '#666666';
        ctx.font = '13px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${item.count}颗`, startX + width - padding * 2, currentY + 18);
        
        currentY += itemHeight;
    });
    
    // 如果颜色太多，显示省略提示
    if (sortedColors.length > maxItems) {
        ctx.fillStyle = '#999999';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`...还有${sortedColors.length - maxItems}种颜色`, startX, currentY + 5);
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
});

// 初始化
loadColorData().then(() => {
    // 默认选择所有基础色号表
    buildAvailableColors();
});
