import json
import re

def convert_color_codes_to_uppercase():
    """将color_data.json中所有色号的小写字母转换为大写"""
    input_file = "color_data.json"
    output_file = "color_data.json"
    
    # 读取JSON文件
    with open(input_file, 'r', encoding='utf-8') as f:
        color_data = json.load(f)
    
    # 统计修改数量
    modified_count = 0
    
    # 处理基础色号表
    for table_name, colors in color_data.get('base_tables', {}).items():
        for color in colors:
            if 'brands' in color:
                for brand, code in color['brands'].items():
                    if code and code != '-':
                        # 将小写字母转换为大写，保留数字和其他字符
                        new_code = code.upper()
                        if new_code != code:
                            color['brands'][brand] = new_code
                            modified_count += 1
                            print(f"修改: {table_name} - {brand}: {code} -> {new_code}")
    
    # 处理高级色号表
    for table_code, table_data in color_data.get('advanced_tables', {}).items():
        colors = table_data.get('colors', [])
        for color in colors:
            if 'brands' in color:
                for brand, code in color['brands'].items():
                    if code and code != '-':
                        # 将小写字母转换为大写，保留数字和其他字符
                        new_code = code.upper()
                        if new_code != code:
                            color['brands'][brand] = new_code
                            modified_count += 1
                            print(f"修改: {table_code} - {brand}: {code} -> {new_code}")
    
    # 保存修改后的JSON文件
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(color_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ 处理完成！共修改了 {modified_count} 个色号")
    print(f"✓ 文件已保存到 {output_file}")

if __name__ == "__main__":
    convert_color_codes_to_uppercase()

