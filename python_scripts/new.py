import argparse
import re
import json # 用于输出JSON

# --- 从你原始脚本中保留的核心函数 ---

cli_log_messages = []

def _cli_log(message):
    """将日志消息收集到列表中，以便最后作为JSON一部分输出。"""
    global cli_log_messages
    # print(f"LOG: {message}") # 在命令行运行时打印一些即时反馈 (可选)
    cli_log_messages.append(message)

def _clear_cli_log():
    """清空日志列表。"""
    global cli_log_messages
    cli_log_messages = []

def _normalize_text_block(text_block):
    lines = text_block.splitlines()
    stripped_lines = [line.strip() for line in lines]
    normalized_lines = []
    for line in stripped_lines:
        normalized_line = re.sub(r'\s+', ' ', line)
        if normalized_line: 
            normalized_lines.append(normalized_line)
    return normalized_lines

def _get_line_indentation(line_text):
    match = re.match(r'^(\s*)', line_text)
    return match.group(1) if match else ""

def _reindent_block(text_block_to_reindent, target_indentation):
    lines = text_block_to_reindent.splitlines()
    if not lines:
        return ""
    
    processed_lines = []
    first_non_blank_line_indent_len = -1
    for line_content_check in lines: # 修正了变量名迭代
        if line_content_check.strip():
            first_non_blank_line_indent_len = len(_get_line_indentation(line_content_check))
            break
    
    base_indent_len = 0
    if first_non_blank_line_indent_len != -1:
        base_indent_len = first_non_blank_line_indent_len

    for line in lines:
        if not line.strip(): # 处理空行或仅包含空格的行
            # 如果行本身有内容（即使只是空格），则将其与目标缩进结合
            # 如果行是完全空的，则结果也是空行
            processed_lines.append(target_indentation + line if line else "") 
            continue

        # 处理带有实际内容的行
        current_line_actual_indent_len = len(_get_line_indentation(line))
        
        line_content_for_reindent = ""
        if current_line_actual_indent_len >= base_indent_len:
             # 保留相对于块基础缩进的内部缩进
             line_content_for_reindent = line[base_indent_len:]
        else: 
             # 如果行缩进小于块的基础缩进，则去除其所有前导空格
             line_content_for_reindent = line.lstrip() 

        processed_lines.append(target_indentation + line_content_for_reindent)
    return "\n".join(processed_lines)

def _replace_whitespace_agnostic(code_to_search_in, search_block_query, replace_block_content):
    _cli_log("  Attempting 2nd round: Iterative Whitespace-agnostic multi-line search...")
    normalized_search_lines = _normalize_text_block(search_block_query)

    if not normalized_search_lines:
        _cli_log("  2nd round: Search block is effectively empty after normalization. Skipping.")
        return code_to_search_in, 0

    original_code_lines_with_endings = code_to_search_in.splitlines(True) 
    output_buffer = []
    current_original_line_idx = 0
    replacements_made_this_pass = 0

    while current_original_line_idx < len(original_code_lines_with_endings):
        match_found_here = False
        normalized_search_ptr = 0
        first_content_line_in_matched_block_original_idx = -1
        end_of_matched_original_block_idx = -1 
        block_scan_idx = current_original_line_idx 
        
        while block_scan_idx < len(original_code_lines_with_endings) and \
              normalized_search_ptr < len(normalized_search_lines):
            current_original_line_text = original_code_lines_with_endings[block_scan_idx]
            normalized_original_line_list = _normalize_text_block(current_original_line_text)

            if normalized_original_line_list: 
                if normalized_original_line_list[0] == normalized_search_lines[normalized_search_ptr]:
                    if first_content_line_in_matched_block_original_idx == -1:
                        first_content_line_in_matched_block_original_idx = block_scan_idx
                    normalized_search_ptr += 1
                    if normalized_search_ptr == len(normalized_search_lines): 
                        match_found_here = True
                        end_of_matched_original_block_idx = block_scan_idx 
                        break 
                else: 
                    if normalized_search_ptr > 0:
                        break 
            block_scan_idx += 1
        
        if match_found_here:
            replacements_made_this_pass += 1
            start_of_block_to_replace_idx = current_original_line_idx 
            _cli_log(f"  2nd round: Found whitespace-agnostic match. Original lines "
                      f"{start_of_block_to_replace_idx + 1} through {end_of_matched_original_block_idx + 1}.")
            indent_ref_idx = first_content_line_in_matched_block_original_idx \
                             if first_content_line_in_matched_block_original_idx != -1 \
                             else start_of_block_to_replace_idx 
            target_indent = _get_line_indentation(original_code_lines_with_endings[indent_ref_idx])
            reindented_replace_block_str = _reindent_block(replace_block_content, target_indent)

            if reindented_replace_block_str and '\n' in replace_block_content and not reindented_replace_block_str.endswith(('\n', '\r\n')):
                last_line_of_replaced_block = original_code_lines_with_endings[end_of_matched_original_block_idx]
                if last_line_of_replaced_block.endswith('\r\n'):
                    reindented_replace_block_str += '\r\n'
                elif last_line_of_replaced_block.endswith('\n'):
                    reindented_replace_block_str += '\n'
            elif not reindented_replace_block_str and replace_block_content: 
                pass 
            elif not replace_block_content: 
                 reindented_replace_block_str = ""

            output_buffer.append(reindented_replace_block_str)
            current_original_line_idx = end_of_matched_original_block_idx + 1 
        else:
            output_buffer.append(original_code_lines_with_endings[current_original_line_idx])
            current_original_line_idx += 1
    
    if replacements_made_this_pass > 0:
        _cli_log(f"  2nd round (Iterative): Completed with {replacements_made_this_pass} replacement(s).")

    return "".join(output_buffer), replacements_made_this_pass

def _extract_delimited_content(text, start_offset_in_text, start_delimiter, end_delimiter):
    end_delimiter_pos = text.find(end_delimiter, start_offset_in_text)
    if end_delimiter_pos == -1:
        _cli_log(f"错误: 从内容开始位置 {start_offset_in_text} (相对于命令字符串的偏移量) 开始，未能找到结束界定符 '{end_delimiter}'。")
        return None, start_offset_in_text 
    content_str = text[start_offset_in_text : end_delimiter_pos]
    return content_str, end_delimiter_pos + len(end_delimiter) 


def process_code_modifications_cli(commands_str_raw, original_code):
    _clear_cli_log() 

    if not commands_str_raw.strip():
        _cli_log("提示: 命令输入为空，未执行替换。")
        if original_code and not original_code.endswith('\n') and original_code.strip():
             original_code += '\n'
        return {"modified_code": original_code, "log": cli_log_messages}

    parsed_commands = []
    cursor = 0
    START_DELIMITER = "《"
    END_DELIMITER = "》"

    while cursor < len(commands_str_raw):
        search_keyword_literal = "search:"
        replace_keyword_literal = "replace:"

        search_directive_match = re.search(re.escape(search_keyword_literal) + r"\s*" + re.escape(START_DELIMITER), commands_str_raw[cursor:])
        if not search_directive_match:
            remaining_text_to_check = commands_str_raw[cursor:].strip()
            if remaining_text_to_check and not remaining_text_to_check.startswith("#"): 
                _cli_log(f"解析提示：在命令文本中，从位置 {cursor} 开始，未找到更多有效的 '{search_keyword_literal}{START_DELIMITER}' 指令。")
            break 
        
        content_start_offset_for_search = cursor + search_directive_match.end()
        search_val_content, cursor_after_search_val_extraction = _extract_delimited_content(
            commands_str_raw, content_start_offset_for_search, START_DELIMITER, END_DELIMITER 
        ) 

        if search_val_content is None:
            break 
        search_val_str = search_val_content.strip() 
        
        replace_directive_match = re.search(re.escape(replace_keyword_literal) + r"\s*" + re.escape(START_DELIMITER), commands_str_raw[cursor_after_search_val_extraction:])
        if not replace_directive_match:
            _cli_log(f"错误：在 '{search_keyword_literal}《{search_val_content[:20]}...》' 内容之后，从位置 {cursor_after_search_val_extraction} 开始，未找到 '{replace_keyword_literal}{START_DELIMITER}' 指令。")
            break 
        
        content_start_offset_for_replace = cursor_after_search_val_extraction + replace_directive_match.end()
        replace_val_content, cursor_after_replace_val_extraction = _extract_delimited_content(
            commands_str_raw, content_start_offset_for_replace, START_DELIMITER, END_DELIMITER
        )
        
        if replace_val_content is None:
            break
        replace_val_str = replace_val_content.strip() 
            
        parsed_commands.append((search_val_str, replace_val_str))
        cursor = cursor_after_replace_val_extraction 

    if not parsed_commands and commands_str_raw.strip():
        log_already_exists = any("解析提示" in msg or "错误" in msg for msg in cli_log_messages)
        if not log_already_exists:
             _cli_log("命令解析失败或未找到完整命令对。请确保使用 'search:《内容》 replace:《内容》' 格式，并用书名号《》包裹实际内容。")
        if original_code and not original_code.endswith('\n') and original_code.strip():
             original_code += '\n'
        return {"modified_code": original_code, "log": cli_log_messages}
    
    if not parsed_commands: 
        _cli_log("未在命令区找到有效的 search/replace 对。")
        if original_code and not original_code.endswith('\n') and original_code.strip():
             original_code += '\n'
        return {"modified_code": original_code, "log": cli_log_messages}

    _cli_log(f"成功解析 {len(parsed_commands)} 个 search/replace 替换对。开始处理...")

    current_code = original_code
    pair_count = 0
    total_primary_replacements = 0
    total_secondary_replacements = 0

    for search_val, replace_val in parsed_commands:
        pair_count += 1
        _cli_log(f"\n--- 第 {pair_count} 对 ---")
        log_search_val_display = (search_val[:100].replace('\n', '\\n') + '...') if len(search_val) > 100 else search_val.replace('\n', '\\n')
        log_replace_val_display = (replace_val[:100].replace('\n', '\\n') + '...') if len(replace_val) > 100 else replace_val.replace('\n', '\\n')

        _cli_log(f"Search (trimmed, for exact match): '{log_search_val_display}'")
        _cli_log(f"Replace (trimmed): '{log_replace_val_display}'")
        
        initial_occurrences = current_code.count(search_val)
        if initial_occurrences > 0:
            current_code = current_code.replace(search_val, replace_val)
            total_primary_replacements += initial_occurrences
            _cli_log(f"执行替换 (第1轮 精确匹配): 找到并替换了 {initial_occurrences} 处。")
        else:
            _cli_log(f"第1轮 精确匹配: 未找到 search 字符串 '{log_search_val_display}'。尝试第2轮宽松匹配...")
            processed_code_round2, round_2_replacements_count = _replace_whitespace_agnostic(current_code, search_val, replace_val)
            if round_2_replacements_count > 0:
                current_code = processed_code_round2
                total_secondary_replacements += round_2_replacements_count
            else:
                _cli_log(f"  第2轮 宽松匹配: 也未找到匹配项。此对未执行任何替换。")

    if current_code and not current_code.endswith('\n') and current_code.strip():
        current_code += '\n'
            
    _cli_log(f"\n--- 所有替换完成 ---")
    _cli_log(f"总计: 第1轮替换 {total_primary_replacements} 处, 第2轮替换 {total_secondary_replacements} 处。")
    
    return {"modified_code": current_code, "log": cli_log_messages}


def main():
    parser = argparse.ArgumentParser(description="代码批量替换命令行工具")
    parser.add_argument("--commands", required=True, help="包含替换命令的字符串，例如: search:《原始》 replace:《替换》")
    parser.add_argument("--original_code", required=True, help="待处理的原始代码字符串")
    
    args = parser.parse_args()
    results = process_code_modifications_cli(args.commands, args.original_code)
    print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
