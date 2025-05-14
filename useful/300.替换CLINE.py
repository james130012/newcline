import tkinter as tk
from tkinter import scrolledtext, messagebox, simpledialog, Toplevel, Entry, Button, Label, PanedWindow, Frame
import re

# --- 行号显示类 (LineNumbers Class)  
class LineNumbers(tk.Canvas):
    def __init__(self, master, text_widget, **kwargs):
        self.font = kwargs.pop("font", ("TkDefaultFont", 10))
        self.foreground = kwargs.pop("foreground", "gray")
        tk.Canvas.__init__(self, master, **kwargs)
        self.textwidget = text_widget
        self.x_padding = 5
        self._original_yscrollcommand = None
        self.config(width=40, bg='#f0f0f0')

    def attach(self):
        self._original_yscrollcommand = self.textwidget.cget("yscrollcommand")
        self.textwidget.configure(yscrollcommand=self._on_scroll)
        self.textwidget.bind("<<Modified>>", self._on_modified, add="+")
        self.textwidget.bind("<Configure>", self._on_modified, add="+")
        self.bind("<Configure>", self._on_modified, add="+")

    def detach(self):
        if self._original_yscrollcommand:
            self.textwidget.configure(yscrollcommand=self._original_yscrollcommand)

    def _on_scroll(self, *args):
        if self._original_yscrollcommand:
            self._original_yscrollcommand(*args)
        self.redraw()

    def _on_modified(self, event=None):
        self.after_idle(self.redraw)

    def redraw(self, *args):
        self.delete("all")
        if not self.textwidget.winfo_exists() or not self.textwidget.winfo_viewable():
            return
        first_visible_char_index = self.textwidget.index("@0,0")
        if not first_visible_char_index:
            return

        current_line_index_str = self.textwidget.index(f"{first_visible_char_index} linestart")
        processed_lines_check = set()

        while True:
            if current_line_index_str in processed_lines_check:
                break
            processed_lines_check.add(current_line_index_str)
            dline = self.textwidget.dlineinfo(current_line_index_str)
            if dline is None:
                next_line_attempt = self.textwidget.index(f"{current_line_index_str}+1line")
                if next_line_attempt == current_line_index_str :
                    break
                current_line_index_str = next_line_attempt
                if self.textwidget.compare(current_line_index_str, ">=", tk.END):
                    break
                continue
            line_number_str = current_line_index_str.split('.')[0]
            y_position = dline[1]
            self.create_text(
                self.winfo_width() - self.x_padding,
                y_position,
                anchor=tk.NE,
                text=line_number_str,
                font=self.font,
                fill=self.foreground
            )
            if y_position > self.winfo_height() or y_position > self.textwidget.winfo_height():
                break
            current_line_index_str = self.textwidget.index(f"{current_line_index_str}+1line")
            if self.textwidget.compare(current_line_index_str, ">=", tk.END):
                break

class CodeModifierApp:
    def __init__(self, root):
        self.root = root
        root.title("代码批量替换工具 V2.5 (书名号界定内容, 优化版)") # Version updated
        root.geometry("900x750")

        self.find_dialog = None
        self.current_search_target_widget = None
        self.search_start_index = "1.0"
        self.first_match_found_in_current_search = False

        main_frame = tk.Frame(root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        pw_outer_vertical = PanedWindow(main_frame, orient=tk.VERTICAL, sashrelief=tk.RAISED, sashwidth=6, bd=0)
        pw_outer_vertical.pack(fill=tk.BOTH, expand=True)

        command_frame = tk.LabelFrame(pw_outer_vertical, text="1. 输入修改命令 (例如: search:《内容》 replace:《内容》)", padx=5, pady=5)
        self.command_text = scrolledtext.ScrolledText(command_frame, height=8, wrap=tk.WORD, undo=True)
        self.command_text.pack(fill=tk.BOTH, expand=True)
        self.command_text.insert(tk.END, """# 示例命令 (可以有多对，内容用书名号《》包裹):\n# search:《原始文本，可以包含 ' 和 "》\n# replace:《替换文本》\n""")
        pw_outer_vertical.add(command_frame, minsize=80, height=150, stretch="first")

        pw_horizontal_code_areas = PanedWindow(pw_outer_vertical, orient=tk.HORIZONTAL, sashrelief=tk.RAISED, sashwidth=6, bd=0)
        pw_outer_vertical.add(pw_horizontal_code_areas, minsize=200, stretch="always")

        original_frame_container = tk.LabelFrame(pw_horizontal_code_areas, text="2. 粘贴原文代码 (Ctrl+F 查找)", padx=5, pady=5)
        original_text_area_frame = Frame(original_frame_container)
        original_text_area_frame.pack(fill=tk.BOTH, expand=True)
        self.original_code_text = scrolledtext.ScrolledText(original_text_area_frame, height=15, wrap=tk.NONE, undo=True)
        self.original_line_numbers = LineNumbers(original_text_area_frame, self.original_code_text, font=("Consolas", 10))
        self.original_line_numbers.pack(side=tk.LEFT, fill=tk.Y)
        self.original_code_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.original_line_numbers.attach()
        self.original_code_text.insert(tk.END, "// 在此粘贴原文代码...\n")
        self.original_code_text.bind("<Control-f>", lambda event: self.show_find_dialog(self.original_code_text))
        self.original_code_text.bind("<Control-F>", lambda event: self.show_find_dialog(self.original_code_text))
        pw_horizontal_code_areas.add(original_frame_container, minsize=200, stretch="always")
        
        self.command_text.config(undo=True)
        self.original_code_text.config(undo=True)

        pw_right_vertical_stack = PanedWindow(pw_horizontal_code_areas, orient=tk.VERTICAL, sashrelief=tk.RAISED, sashwidth=6, bd=0)
        pw_horizontal_code_areas.add(pw_right_vertical_stack, minsize=200, stretch="always")

        button_frame_in_pane = Frame(pw_right_vertical_stack)
        self.process_button = tk.Button(
            button_frame_in_pane, text="执行替换", command=self.process_replacements,
            bg="#4CAF50", fg="white", font=("TkDefaultFont", 10, "bold"))
        self.process_button.pack(fill=tk.X, padx=5, pady=5)
        pw_right_vertical_stack.add(button_frame_in_pane, minsize=40, height=45, stretch="never")

        modified_frame_container = tk.LabelFrame(pw_right_vertical_stack, text="3. 修改后代码 (Ctrl+F 查找)", padx=5, pady=5)
        modified_text_area_frame = Frame(modified_frame_container)
        modified_text_area_frame.pack(fill=tk.BOTH, expand=True)
        self.modified_code_text = scrolledtext.ScrolledText(modified_text_area_frame, height=15, wrap=tk.NONE, undo=True)
        self.modified_line_numbers = LineNumbers(modified_text_area_frame, self.modified_code_text, font=("Consolas", 10))
        self.modified_line_numbers.pack(side=tk.LEFT, fill=tk.Y)
        self.modified_code_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.modified_line_numbers.attach()
        self.modified_code_text.config(undo=True)
        self.modified_code_text.bind("<Control-f>", lambda event: self.show_find_dialog(self.modified_code_text))
        self.modified_code_text.bind("<Control-F>", lambda event: self.show_find_dialog(self.modified_code_text))
        pw_right_vertical_stack.add(modified_frame_container, minsize=100, stretch="always")

        log_frame_container = tk.LabelFrame(pw_right_vertical_stack, text="操作日志", padx=5, pady=5)
        self.log_text = scrolledtext.ScrolledText(log_frame_container, height=5, wrap=tk.WORD, state=tk.DISABLED)
        self.log_text.pack(fill=tk.BOTH, expand=True)
        pw_right_vertical_stack.add(log_frame_container, minsize=50, height=100, stretch="last")

        for widget in [self.original_code_text, self.modified_code_text]:
            widget.tag_configure("search_highlight", background="yellow", foreground="black")
    
    def show_find_dialog(self, text_widget):
        active_text_widget_for_find = text_widget
        if self.find_dialog is not None and self.find_dialog.winfo_exists():
            if self.current_search_target_widget == active_text_widget_for_find:
                self.find_dialog.lift()
                self.find_entry.focus_set()
                self.find_entry.selection_range(0, tk.END)
                return
            else:
                self.close_find_dialog()
        self.current_search_target_widget = active_text_widget_for_find
        if self.current_search_target_widget:
             self._clear_highlight(self.current_search_target_widget)
        self.find_dialog = Toplevel(self.root)
        self.find_dialog.title("查找")
        self.find_dialog.transient(self.root)
        self.find_dialog.resizable(False, False)
        try:
            if text_widget.winfo_exists() and text_widget.winfo_ismapped():
                 x = text_widget.winfo_rootx() + text_widget.winfo_width() // 2 - 150
                 y = text_widget.winfo_rooty() + 50
                 self.find_dialog.geometry(f"300x100+{x}+{y}")
            else:
                x_root = self.root.winfo_rootx() + self.root.winfo_width() // 2 - 150
                y_root = self.root.winfo_rooty() + self.root.winfo_height() // 2 - 50
                self.find_dialog.geometry(f"300x100+{x_root}+{y_root}")
        except tk.TclError:
                x_root = self.root.winfo_rootx() + self.root.winfo_width() // 2 - 150
                y_root = self.root.winfo_rooty() + self.root.winfo_height() // 2 - 50
                self.find_dialog.geometry(f"300x100+{x_root}+{y_root}")
        Label(self.find_dialog, text="查找内容:").grid(row=0, column=0, padx=5, pady=5, sticky="w")
        self.find_entry = Entry(self.find_dialog, width=25)
        self.find_entry.grid(row=0, column=1, padx=5, pady=5, columnspan=2)
        self.find_entry.focus_set()
        self.find_entry.bind("<Return>", lambda event: self.find_text_in_widget(start_new_search=True))
        self.find_entry.bind("<KP_Enter>", lambda event: self.find_text_in_widget(start_new_search=True))
        find_button = Button(self.find_dialog, text="查找下一个", command=lambda: self.find_text_in_widget(start_new_search=False))
        find_button.grid(row=1, column=1, padx=5, pady=5, sticky="e")
        close_button = Button(self.find_dialog, text="关闭", command=self.close_find_dialog)
        close_button.grid(row=1, column=2, padx=5, pady=5, sticky="e")
        self.find_dialog.protocol("WM_DELETE_WINDOW", self.close_find_dialog)
        self.find_dialog.bind("<Escape>", lambda event: self.close_find_dialog())

    def find_text_in_widget(self, start_new_search=False):
        if not self.find_dialog or not self.find_dialog.winfo_exists() or not self.current_search_target_widget: return
        text_widget = self.current_search_target_widget
        search_term = self.find_entry.get()
        if not search_term: return
        if start_new_search:
            self._clear_highlight(text_widget)
            self.search_start_index = "1.0"
            self.first_match_found_in_current_search = False
        if self.search_start_index is None or start_new_search: self.search_start_index = "1.0"
        if not start_new_search:
            try:
                if text_widget.tag_ranges(tk.SEL):
                    self.search_start_index = text_widget.index(f"{tk.SEL_LAST}+1c")
                elif text_widget.tag_ranges("search_highlight"):
                     last_hl_end = text_widget.index("search_highlight.last")
                     self.search_start_index = f"{last_hl_end}+1c" if last_hl_end else text_widget.index(f"{tk.INSERT}+1c")
                else: self.search_start_index = text_widget.index(f"{tk.INSERT}+1c")
            except tk.TclError: self.search_start_index = "1.0"
        pos = text_widget.search(search_term, self.search_start_index, stopindex=tk.END, nocase=1, count=tk.Variable())
        if pos:
            self._clear_highlight(text_widget)
            match_end = f"{pos}+{len(search_term)}c"
            text_widget.tag_add("search_highlight", pos, match_end)
            text_widget.tag_remove(tk.SEL, "1.0", tk.END)
            text_widget.tag_add(tk.SEL, pos, match_end)
            text_widget.mark_set(tk.INSERT, match_end)
            text_widget.see(pos)
            self.search_start_index = match_end
            self.first_match_found_in_current_search = True
            if self.find_dialog and self.find_dialog.winfo_exists(): self.find_dialog.lift()
        else:
            if self.first_match_found_in_current_search or not start_new_search:
                if messagebox.askyesno("查找", "已到文档末尾，是否从头开始搜索？", parent=self.find_dialog):
                    self.search_start_index = "1.0"
                    self._clear_highlight(text_widget)
                    self.first_match_found_in_current_search = False
                    self.find_text_in_widget(start_new_search=False)
                else:
                    self.search_start_index = "1.0"
                    self.first_match_found_in_current_search = False
            else:
                messagebox.showinfo("查找", f"未找到 '{search_term}'", parent=self.find_dialog)
                self.search_start_index = "1.0"
                self.first_match_found_in_current_search = False

    def _clear_highlight(self, text_widget):
        if text_widget and text_widget.winfo_exists():
            text_widget.tag_remove("search_highlight", "1.0", tk.END)

    def close_find_dialog(self):
        if self.find_dialog and self.find_dialog.winfo_exists():
            if self.current_search_target_widget:
                self._clear_highlight(self.current_search_target_widget)
            self.find_dialog.destroy()
        self.find_dialog = None
        self.search_start_index = "1.0"
        self.first_match_found_in_current_search = False
        
    def _log(self, message):
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)

    def _clear_log(self):
        self.log_text.config(state=tk.NORMAL)
        self.log_text.delete("1.0", tk.END)
        self.log_text.config(state=tk.DISABLED)

    def _normalize_text_block(self, text_block):
        lines = text_block.splitlines()
        stripped_lines = [line.strip() for line in lines]
        whitespace_removed_lines = [re.sub(r'\s+', '', line) for line in stripped_lines]
        normalized_lines = [line for line in whitespace_removed_lines if line]
        return normalized_lines

    def _get_line_indentation(self, line_text):
        match = re.match(r'^(\s*)', line_text)
        return match.group(1) if match else ""

    def _reindent_block(self, text_block_to_reindent, target_indentation):
        lines = text_block_to_reindent.splitlines()
        if not lines:
            return ""
        # Determine the base indentation of the block to reindent
        # This is tricky: we want the indentation of the *block itself*, not necessarily the first line if it's unindented.
        # A simple heuristic: find the minimum indentation of the first non-blank line.
        base_indent_len = -1
        processed_lines = []

        first_non_blank_line_indent_len = -1
        for line_idx, line_content in enumerate(lines):
            if line_content.strip():
                first_non_blank_line_indent_len = len(self._get_line_indentation(line_content))
                break
        
        if first_non_blank_line_indent_len == -1: # Block is all blank lines or empty
            base_indent_len = 0 # Treat as no indentation
        else:
            base_indent_len = first_non_blank_line_indent_len

        for line in lines:
            if not line.strip(): # If the line in replacement block is blank
                # Append with target_indentation unless it's just an empty line
                processed_lines.append(target_indentation + line if line else "") 
                continue

            current_line_actual_indent_len = len(self._get_line_indentation(line))
            
            # Calculate indent relative to the block's base indent
            relative_indent_len = current_line_actual_indent_len - base_indent_len
            if relative_indent_len < 0: # Should not happen if base_indent_len is min indent. Safety.
                relative_indent_len = 0
            
            # Get the content part of the line (after its original indent)
            content_part = line.lstrip()
            
            # New indent = target_indent + original_relative_indent_within_block
            # The original relative indent must be preserved. We get it by taking original spacing AFTER base_indent_len
            # This is tricky, best is to assume replace_block is formatted as desired relative to its own first line.
            # The `_reindent_block` should ideally take a block and ensure all lines are *at least* `target_indentation`
            # while preserving relative indents *within* the block.

            # Simpler logic: strip leading space from line then add target_indent + original leading space (minus base)
            # This part preserves the internal structure of the replacement block better.
            
            # Strip leading whitespace that formed the original base_indent_len or less
            if current_line_actual_indent_len >= base_indent_len:
                 line_content_for_reindent = line[base_indent_len:]
            else: # line was less indented than base, unusual, keep its original form relative to target
                 line_content_for_reindent = line.lstrip() # Or just line itself? Let's lstrip.

            processed_lines.append(target_indentation + line_content_for_reindent)

        return "\n".join(processed_lines)

    # OPTIMIZED iterative whitespace-agnostic replacement function
    def _replace_whitespace_agnostic(self, code_to_search_in, search_block_query, replace_block_content):
        self._log("  Attempting 2nd round: Iterative Whitespace-agnostic multi-line search...")
        normalized_search_lines = self._normalize_text_block(search_block_query)

        if not normalized_search_lines:
            self._log("  2nd round: Search block is effectively empty after normalization. Skipping.")
            return code_to_search_in, 0

        original_code_lines_with_endings = code_to_search_in.splitlines(True)
        output_buffer = []
        current_original_line_idx = 0
        replacements_made_this_pass = 0

        while current_original_line_idx < len(original_code_lines_with_endings):
            match_found_here = False
            
            normalized_search_ptr = 0
            temp_scan_original_idx = current_original_line_idx
            
            first_content_line_in_matched_block_original_idx = -1
            # This will store the end index of the original block that was matched
            end_of_matched_original_block_idx = -1 

            # Scan ahead to find a potential match
            block_scan_idx = temp_scan_original_idx
            while block_scan_idx < len(original_code_lines_with_endings) and \
                  normalized_search_ptr < len(normalized_search_lines):
                
                current_original_line_text = original_code_lines_with_endings[block_scan_idx]
                normalized_original_line_list = self._normalize_text_block(current_original_line_text)

                if normalized_original_line_list: # Current original line has content
                    if normalized_original_line_list[0] == normalized_search_lines[normalized_search_ptr]:
                        if first_content_line_in_matched_block_original_idx == -1:
                            first_content_line_in_matched_block_original_idx = block_scan_idx
                        normalized_search_ptr += 1
                        if normalized_search_ptr == len(normalized_search_lines): 
                            match_found_here = True
                            end_of_matched_original_block_idx = block_scan_idx 
                            break 
                    else: 
                        break # Content mismatch
                # If original line is blank, it's consumed as part of the potential block being matched.
                # The `normalized_search_ptr` only advances on content lines.
                block_scan_idx += 1
            
            if match_found_here:
                replacements_made_this_pass += 1
                
                start_of_block_to_replace_idx = current_original_line_idx # The first line considered for this match attempt
                
                self._log(f"  2nd round: Found whitespace-agnostic match. Original lines "
                          f"{start_of_block_to_replace_idx + 1} through {end_of_matched_original_block_idx + 1}.")

                indent_ref_idx = first_content_line_in_matched_block_original_idx \
                                 if first_content_line_in_matched_block_original_idx != -1 \
                                 else start_of_block_to_replace_idx
                
                target_indent = self._get_line_indentation(original_code_lines_with_endings[indent_ref_idx])
                reindented_replace_block_str = self._reindent_block(replace_block_content, target_indent)

                if reindented_replace_block_str and '\n' in replace_block_content and not reindented_replace_block_str.endswith('\n'):
                    # Attempt to preserve original line ending style of the last line of the replaced block
                    last_line_of_replaced_block = original_code_lines_with_endings[end_of_matched_original_block_idx]
                    if last_line_of_replaced_block.endswith('\r\n'):
                        reindented_replace_block_str += '\r\n'
                    elif last_line_of_replaced_block.endswith('\n'):
                        reindented_replace_block_str += '\n'
                    else: # Fallback
                         reindented_replace_block_str += '\n'
                elif not reindented_replace_block_str and replace_block_content: # If reindented is empty but original replace wasn't
                    pass # Do nothing, effectively deleting if replace_block_content was just whitespace
                elif not replace_block_content: # If replace block is truly empty
                     reindented_replace_block_str = ""


                output_buffer.append(reindented_replace_block_str)
                current_original_line_idx = end_of_matched_original_block_idx + 1
            else:
                output_buffer.append(original_code_lines_with_endings[current_original_line_idx])
                current_original_line_idx += 1
        
        if replacements_made_this_pass > 0:
            self._log(f"  2nd round (Iterative): Completed with {replacements_made_this_pass} replacement(s).")

        return "".join(output_buffer), replacements_made_this_pass

    def _extract_delimited_content(self, text, start_offset_in_text, start_delimiter, end_delimiter):
        end_delimiter_pos = text.find(end_delimiter, start_offset_in_text)
        if end_delimiter_pos == -1:
            self._log(f"错误: 从位置 {start_offset_in_text} 开始，未能找到结束界定符 '{end_delimiter}'。")
            return None, start_offset_in_text
        content_str = text[start_offset_in_text : end_delimiter_pos]
        return content_str, end_delimiter_pos + len(end_delimiter)

    def process_replacements(self):
        self._clear_log()
        try:
            self.modified_code_text.delete("1.0", tk.END)
        except tk.TclError as e:
            self._log(f"Error clearing modified_code_text: {e}")

        commands_str_raw = self.command_text.get("1.0", tk.END)
        original_code = self.original_code_text.get("1.0", "end-1c") 

        if not commands_str_raw.strip():
            self._log("提示: 命令输入为空，未执行替换。原文已复制到修改后区域。")
            self.modified_code_text.insert(tk.END, original_code)
            if original_code and not original_code.endswith('\n'):
                self.modified_code_text.insert(tk.END, '\n')
            self.modified_line_numbers.after_idle(self.modified_line_numbers.redraw)
            return

        parsed_commands = []
        cursor = 0
        command_num = 0
        
        START_DELIMITER = "《"
        END_DELIMITER = "》"

        while cursor < len(commands_str_raw):
            command_num += 1
            search_keyword_literal = "search:"
            replace_keyword_literal = "replace:"

            search_directive_match = re.search(re.escape(search_keyword_literal) + r"\s*" + re.escape(START_DELIMITER), commands_str_raw[cursor:])
            if not search_directive_match:
                remaining_text_to_check = commands_str_raw[cursor:].strip()
                if remaining_text_to_check and not remaining_text_to_check.startswith("#"):
                    self._log(f"解析提示：在剩余文本中未找到更多 '{search_keyword_literal}{START_DELIMITER}' 指令。光标: {cursor}。")
                break 
            cursor_after_search_directive = cursor + search_directive_match.end()
            search_val_str, cursor_after_search_val = self._extract_delimited_content(
                commands_str_raw, cursor_after_search_directive, START_DELIMITER, END_DELIMITER
            ) # Note: _extract_delimited_content expects offset to be AFTER opening delimiter, but current regex gives end of 《
              # This needs to be fixed if START_DELIMITER is > 1 char or if regex changes.
              # For 《, it's fine because match.end() is already after 《.
            if search_val_str is None:
                self._log(f"错误：未能正确解析 '{search_keyword_literal}' 由 '{START_DELIMITER}{END_DELIMITER}' 包裹的内容。")
                break 
            
            replace_directive_match = re.search(re.escape(replace_keyword_literal) + r"\s*" + re.escape(START_DELIMITER), commands_str_raw[cursor_after_search_val:])
            if not replace_directive_match:
                self._log(f"错误：在 '{search_keyword_literal}' 内容之后未找到 '{replace_keyword_literal}{START_DELIMITER}' 指令。光标: {cursor_after_search_val}")
                break 
            cursor_before_replace_val_content = cursor_after_search_val + replace_directive_match.end()
            replace_val_str, cursor_after_replace_val = self._extract_delimited_content(
                commands_str_raw, cursor_before_replace_val_content, START_DELIMITER, END_DELIMITER
            )
            if replace_val_str is None:
                self._log(f"错误：未能正确解析 '{replace_keyword_literal}' 由 '{START_DELIMITER}{END_DELIMITER}' 包裹的内容。")
                break
            parsed_commands.append((search_val_str, replace_val_str))
            cursor = cursor_after_replace_val 

        if not parsed_commands and commands_str_raw.strip():
             if not self.log_text.get("1.0",tk.END).strip().endswith("解析提示：在剩余文本中未找到更多"): 
                self._log("命令解析失败或未找到完整命令对。请确保使用书名号《》包裹内容。")
             self.modified_code_text.insert(tk.END, original_code)
             if original_code and not original_code.endswith('\n'): self.modified_code_text.insert(tk.END, '\n')
             self.modified_line_numbers.after_idle(self.modified_line_numbers.redraw)
             return
        
        if not parsed_commands:
            self._log("未在命令区找到有效的 search/replace 对 或 命令为空。")
            self.modified_code_text.insert(tk.END, original_code)
            if original_code and not original_code.endswith('\n'): self.modified_code_text.insert(tk.END, '\n')
            self.modified_line_numbers.after_idle(self.modified_line_numbers.redraw)
            return

        self._log(f"成功解析 {len(parsed_commands)} 个 search/replace 替换对。开始处理...")

        current_code = original_code
        pair_count = 0
        total_primary_replacements = 0
        total_secondary_replacements = 0

        for search_val, replace_val in parsed_commands:
            pair_count += 1
            self._log(f"\n--- 第 {pair_count} 对 ---")
            
            log_search_val_display = (search_val[:100].replace('\n', '\\n') + '...') if len(search_val) > 100 else search_val.replace('\n', '\\n')
            log_replace_val_display = (replace_val[:100].replace('\n', '\\n') + '...') if len(replace_val) > 100 else replace_val.replace('\n', '\\n')

            self._log(f"Search (content): '{log_search_val_display}'")
            self._log(f"Replace (content): '{log_replace_val_display}'")
            
            initial_occurrences = current_code.count(search_val)
            if initial_occurrences > 0:
                current_code = current_code.replace(search_val, replace_val)
                total_primary_replacements += initial_occurrences
                self._log(f"执行替换 (第1轮 精确匹配): 找到并替换了 {initial_occurrences} 处。")
            else:
                self._log(f"第1轮 精确匹配: 未找到 search 字符串。尝试第2轮宽松匹配...")
                processed_code_round2, round_2_replacements_count = self._replace_whitespace_agnostic(current_code, search_val, replace_val)
                if round_2_replacements_count > 0:
                    current_code = processed_code_round2
                    total_secondary_replacements += round_2_replacements_count
                    # Log for individual replacements is now inside _replace_whitespace_agnostic
                else:
                    self._log(f"  第2轮 宽松匹配: 也未找到匹配项。此对未执行任何替换。")

        self.modified_code_text.insert(tk.END, current_code)
        if current_code and not current_code.endswith('\n'):
            self.modified_code_text.insert(tk.END, '\n')
            
        self.modified_line_numbers.after_idle(self.modified_line_numbers.redraw)
        self._log(f"\n--- 所有替换完成 ---")
        self._log(f"总计: 第1轮替换 {total_primary_replacements} 处, 第2轮替换 {total_secondary_replacements} 处。")


if __name__ == "__main__":
    root = tk.Tk()
    app = CodeModifierApp(root)
    root.mainloop()