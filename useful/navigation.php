<?php
// ----------------------------------------------------------------------
// navigation.php - 动态生成导航链接的 PHP 脚本 (支持图标和日期)
// ----------------------------------------------------------------------

// 【重要】存放 HTML 文件的实际文件夹路径
$dir_path = "/var/www/jamesband.asia/"; // 需要链接的HTML文件存放目录

// 【重要】您的域名，用于构建绝对链接
$base_url = "http://jamesband.asia/"; // 确保与您的配置一致

$html_files = array(); 

if (is_dir($dir_path)) {
    if ($dh = opendir($dir_path)) {
        while (($file_entry = readdir($dh)) !== false) {
            $file_path = $dir_path . $file_entry;
            $file_info = pathinfo($file_path);

            if (is_file($file_path) && isset($file_info['extension']) && strtolower($file_info['extension']) == 'html') {
                if ($file_entry !== 'navigation.php' && $file_entry !== 'index.php') {
                    $html_files[] = $file_entry; 
                }
            }
        }
        closedir($dh); 
    } else {
        echo "<ul><li class='no-files'>错误：无法打开目录 '{$dir_path}'。</li></ul>";
        exit; 
    }
} else {
    echo "<ul><li class='no-files'>错误：目录 '{$dir_path}' 不存在或不是一个有效的目录。</li></ul>";
    exit;
}

$file_details = array();
foreach ($html_files as $filename) {
    $file_path_for_time = $dir_path . $filename;
    if (is_file($file_path_for_time)) {
        $file_details[$filename] = filemtime($file_path_for_time);
    }
}

asort($file_details); 
$sorted_filenames = array_keys($file_details);

echo "<ul>\n";

if (empty($sorted_filenames)) {
    echo "    <li class='no-files'>在目标目录 ({$dir_path}) 下没有找到 HTML 文件。</li>\n";
} else {
    foreach ($sorted_filenames as $file) {
        $link_text = htmlspecialchars(pathinfo($file, PATHINFO_FILENAME));
        $link_href = htmlspecialchars($base_url . $file);
        $file_timestamp = $file_details[$file]; // 获取文件时间戳
        $display_date = date("m-d", $file_timestamp); // 格式化日期为 月-日

        $icon_class = "fas fa-file-alt"; 
        if (stripos($link_text, '报告') !== false || stripos($link_text, 'report') !== false) {
            $icon_class = "fas fa-chart-line"; // 更换了报告图标
        } elseif (stripos($link_text, '代码') !== false || stripos($link_text, 'code') !== false) {
            $icon_class = "fas fa-code";
        } elseif (stripos($link_text, '笔记') !== false || stripos($link_text, 'note') !== false) {
            $icon_class = "fas fa-book-open";
        } elseif (stripos($link_text, '学习') !== false || stripos($link_text, 'study') !== false) {
            $icon_class = "fas fa-graduation-cap";
        } elseif (stripos($link_text, '项目') !== false || stripos($link_text, 'project') !== false) {
            $icon_class = "fas fa-folder-open";
        }


        // 输出包含图标、日期和文本的链接
        echo "    <li>\n";
        echo "        <a href=\"{$link_href}\" target=\"_blank\">\n";
        // 新增: 包裹图标和日期
        echo "            <div class=\"tile-icon-area\">\n";
        echo "                <span class=\"tile-date\">{$display_date}</span>\n"; // 显示日期
        echo "                <span class=\"link-icon\"><i class=\"{$icon_class}\"></i></span>\n"; // 图标元素
        echo "            </div>\n";
        echo "            <span class=\"link-text\">{$link_text}</span>\n"; // 文本
        echo "        </a>\n";
        echo "    </li>\n";
    }
}

echo "</ul>\n";
?>
