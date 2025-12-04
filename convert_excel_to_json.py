import pandas as pd
import json
import os
import re

def parse_rgb(rgb_str):
    """解析RGB字符串，返回[r, g, b]"""
    if pd.isna(rgb_str):
        return None
    # 尝试提取数字
    numbers = re.findall(r'\d+', str(rgb_str))
    if len(numbers) >= 3:
        return [int(numbers[0]), int(numbers[1]), int(numbers[2])]
    return None

def parse_hex(hex_str):
    """解析HEX字符串，返回标准格式"""
    if pd.isna(hex_str):
        return None
    hex_str = str(hex_str).strip()
    if hex_str.startswith('#'):
        return hex_str.upper()
    elif len(hex_str) == 6:
        return '#' + hex_str.upper()
    return None

def convert_excel_to_json():
    """将所有Excel文件转换为JSON格式"""
    excel_dir = "色号"
    output_file = "color_data.json"
    
    # 品牌列表
    brands = ['MARD', 'COCO', '漫漫', '盼盼', '咪小窝']
    
    # 基础色号表
    base_tables = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M']
    
    # 高级色号表
    advanced_tables = {
        'P(珠光).xlsx': 'P',
        'Q(温变).xlsx': 'Q',
        'R(透明果冻水晶).xlsx': 'R',
        'T(透明).xlsx': 'T',
        'Y(夜光).xlsx': 'Y',
        'ZG(光变).xlsx': 'ZG'
    }
    
    color_data = {
        'base_tables': {},
        'advanced_tables': {}
    }
    
    # 处理基础色号表
    for table in base_tables:
        file_path = os.path.join(excel_dir, f"{table}.xlsx")
        if os.path.exists(file_path):
            try:
                df = pd.read_excel(file_path)
                colors = []
                
                # 确定hex列名（可能有大小写变化）
                hex_col = None
                for col in df.columns:
                    if col.upper() in ['HEX', 'HEX']:
                        hex_col = col
                        break
                
                if hex_col is None:
                    print(f"警告: {table}.xlsx 未找到HEX列")
                    continue
                
                for idx, row in df.iterrows():
                    hex_val = parse_hex(row[hex_col])
                    rgb_val = parse_rgb(row['RGB'])
                    
                    if hex_val and rgb_val:
                        color_info = {
                            'id': int(row['ID']) if pd.notna(row['ID']) else idx + 1,
                            'hex': hex_val,
                            'rgb': rgb_val,
                            'brands': {}
                        }
                        
                        # 提取各品牌的色号
                        for brand in brands:
                            brand_code = row[brand]
                            if pd.notna(brand_code):
                                brand_code_str = str(brand_code).strip()
                                # 如果是'-'，代表该品牌没有这个色，跳过
                                if brand_code_str == '-':
                                    print(f"  跳过: {table}.xlsx 第{idx+1}行 - {brand} 品牌无此色号")
                                    continue
                                color_info['brands'][brand] = brand_code_str
                        
                        colors.append(color_info)
                
                color_data['base_tables'][table] = colors
                print(f"✓ 处理完成: {table}.xlsx ({len(colors)} 种颜色)")
                
            except Exception as e:
                print(f"✗ 处理 {table}.xlsx 时出错: {e}")
    
    # 处理高级色号表
    for filename, table_code in advanced_tables.items():
        file_path = os.path.join(excel_dir, filename)
        if os.path.exists(file_path):
            try:
                df = pd.read_excel(file_path)
                colors = []
                
                # 确定hex列名
                hex_col = None
                for col in df.columns:
                    if col.upper() in ['HEX', 'HEX']:
                        hex_col = col
                        break
                
                if hex_col is None:
                    print(f"警告: {filename} 未找到HEX列")
                    continue
                
                for idx, row in df.iterrows():
                    hex_val = parse_hex(row[hex_col])
                    rgb_val = parse_rgb(row['RGB'])
                    
                    if hex_val and rgb_val:
                        color_info = {
                            'id': int(row['ID']) if pd.notna(row['ID']) else idx + 1,
                            'hex': hex_val,
                            'rgb': rgb_val,
                            'brands': {}
                        }
                        
                        # 提取各品牌的色号
                        for brand in brands:
                            brand_code = row[brand]
                            if pd.notna(brand_code):
                                brand_code_str = str(brand_code).strip()
                                # 如果是'-'，代表该品牌没有这个色，跳过
                                if brand_code_str == '-':
                                    print(f"  跳过: {filename} 第{idx+1}行 - {brand} 品牌无此色号")
                                    continue
                                color_info['brands'][brand] = brand_code_str
                        
                        colors.append(color_info)
                
                color_data['advanced_tables'][table_code] = {
                    'name': filename.replace('.xlsx', ''),
                    'colors': colors
                }
                print(f"✓ 处理完成: {filename} ({len(colors)} 种颜色)")
                
            except Exception as e:
                print(f"✗ 处理 {filename} 时出错: {e}")
    
    # 保存为JSON文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(color_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ 所有数据已保存到 {output_file}")
    return color_data

if __name__ == "__main__":
    convert_excel_to_json()

